// Why: a guard that forgets a decision makes the blogger decide twice; a guard that stretches one lets
// something through he never saw. Both are pinned here with a stand-in model: no test asks Claude.
import matter from 'gray-matter';
import { describe, expect, it } from 'vitest';
import type { AgentContext, Settings } from '../_lib/types.js';
import { decisionIn, notKept, verdictFor } from './decision.js';
import { makeRun } from './index.js';

const KEPT = 'My daughter is dyslexic. My son finds it hard to hold his attention on a page.';

const decided = (kept: string[]): string =>
  matter.stringify('\n# Security check\n', {
    why: 'The publish check, with the decision that released it.',
    verdict: 'pass',
    decided_by: 'Victor Saly',
    decided: '2026-10-25',
    kept,
  });

/** What the model would write: a verdict, the passages it would hold, and whatever else it adds. */
const reply = (verdict: string, held: string[], extra: Record<string, unknown> = {}): string =>
  matter.stringify('\n# Security check\n\nFindings.\n', {
    why: 'The publish check for a thought.',
    checked: '2026-10-26',
    verdict,
    held,
    ...extra,
  });

function context(
  files: Record<string, string>,
  answer: string,
): AgentContext & { asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    agent: 'security',
    prompt: {
      meta: { name: 'security', why: 'x'.repeat(20), phase: 5, reads: ['a'], writes: ['b'] },
      instructions: '',
    },
    settings: {} as unknown as Settings,
    profile: '',
    thought: {
      slug: 'a-thought',
      dir: '/nowhere',
      files: new Map(
        Object.entries({ 'versions/long.md': `---\nwhy: x\n---\n\n${KEPT}\n`, ...files }),
      ),
    },
    ask: (message: string) => {
      asked.push(message);
      return Promise.resolve(answer);
    },
    draw: () => Promise.reject(new Error('security draws nothing')),
    today: '2026-10-26',
  };
}

const run = makeRun({ audit: () => Promise.resolve('npm audit found no advisories.') });

describe('the security agent and the blogger’s decision', () => {
  it('passes when every passage it would hold is one he kept, and keeps his decision', async () => {
    const ctx = context(
      { 'security.md': decided([KEPT]) },
      reply('hold', ['My daughter is dyslexic.']),
    );
    const result = await run(ctx);
    expect(result.status).toBe('done');
    const data = matter(result.files[0]?.content ?? '').data;
    expect(data['verdict']).toBe('pass');
    expect(data['decided_by']).toBe('Victor Saly');
    expect(data['kept']).toEqual([KEPT]);
  });

  it('tells the model what he kept', async () => {
    const ctx = context({ 'security.md': decided([KEPT]) }, reply('pass', []));
    await run(ctx);
    expect(ctx.asked[0]).toContain('<kept_by_the_blogger>');
    expect(ctx.asked[0]).toContain(KEPT);
  });

  it('holds a passage he did not keep, even about the same people', async () => {
    const ctx = context(
      { 'security.md': decided([KEPT]) },
      reply('hold', ['My daughter is dyslexic.', 'She goes to Hill Primary School.']),
    );
    const result = await run(ctx);
    expect(result.status).toBe('held');
    expect(matter(result.files[0]?.content ?? '').data['verdict']).toBe('hold');
  });

  it('holds a kept passage once it is reworded', async () => {
    const ctx = context(
      { 'security.md': decided([KEPT]) },
      reply('hold', ['My daughter has dyslexia.']),
    );
    expect((await run(ctx)).status).toBe('held');
  });

  it('never takes a decision from the model', async () => {
    const ctx = context(
      {},
      reply('hold', ['My daughter is dyslexic.'], {
        decided_by: 'Victor Saly',
        decided: '2026-10-26',
        kept: ['My daughter is dyslexic.'],
      }),
    );
    const result = await run(ctx);
    expect(result.status).toBe('held');
    const data = matter(result.files[0]?.content ?? '').data;
    expect(data['decided_by']).toBeUndefined();
    expect(data['kept']).toBeUndefined();
  });

  it('holds a pass that still quotes a passage nobody kept', async () => {
    const ctx = context({}, reply('pass', ['My daughter is dyslexic.']));
    expect((await run(ctx)).status).toBe('held');
  });

  it('holds a hold that quotes nothing, since there is nothing to check it against', async () => {
    const ctx = context({ 'security.md': decided([KEPT]) }, reply('hold', []));
    expect((await run(ctx)).status).toBe('held');
  });
});

describe('a reply that cannot be checked', () => {
  it('fails the run when held is broken, keeping none of it', async () => {
    const answer = matter.stringify('\n# Security check\n', {
      why: 'The publish check for a thought.',
      verdict: 'pass',
      held: ['an unapproved private passage', null],
    });
    await expect(run(context({}, answer))).rejects.toThrow(/held/);
  });

  it('fails the run when held is missing', async () => {
    const answer = matter.stringify('\n# Security check\n', {
      why: 'The publish check for a thought.',
      verdict: 'pass',
    });
    await expect(run(context({}, answer))).rejects.toThrow(/held/);
  });
});

describe('decisionIn', () => {
  it('reads who, when and the exact passages, with the date YAML makes a Date', () => {
    const file = `---\nwhy: x\nverdict: pass\ndecided_by: Victor Saly\ndecided: 2026-10-25\nkept:\n  - "${KEPT}"\n---\n`;
    expect(decisionIn(file)).toEqual({
      decidedBy: 'Victor Saly',
      decided: '2026-10-25',
      kept: [KEPT],
    });
  });

  it('is none without passages: a decision that names nothing releases nothing', () => {
    const file = '---\nwhy: x\nverdict: pass\ndecided_by: Victor Saly\ndecided: 2026-10-25\n---\n';
    expect(decisionIn(file)).toBeNull();
    expect(decisionIn(undefined)).toBeNull();
  });
});

describe('notKept', () => {
  it('compares words, not quote marks or spacing', () => {
    expect(
      notKept(
        ['If it does not work for my kids,  it is not finished.'],
        ['The type is chosen for them too. If it does not work for my kids, it is not finished.'],
      ),
    ).toEqual([]);
    expect(
      notKept(['“Built for a dyslexic reader”'], ['"Built for a dyslexic reader" and more']),
    ).toEqual([]);
  });
});

describe('notKept on whole words', () => {
  it('never takes a name for the end of a longer one', () => {
    expect(notKept(['Anna has cancer.'], ['Joanna has cancer.'])).toEqual(['Anna has cancer.']);
  });

  it('never takes a word for the start of a longer one', () => {
    expect(notKept(['my son'], ['my sons are grown'])).toEqual(['my son']);
  });

  it('needs the words next to each other, in order', () => {
    expect(notKept(['daughter dyslexic'], [KEPT])).toEqual(['daughter dyslexic']);
  });

  it('holds a quote with no words in it', () => {
    expect(notKept(['—'], [KEPT])).toEqual(['—']);
  });
});

describe('verdictFor', () => {
  it('refuses a verdict that is not pass or hold', () => {
    expect(() => verdictFor('maybe', [], null)).toThrow(/pass or hold/);
  });
});
