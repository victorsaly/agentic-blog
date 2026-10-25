// Why: every converting agent reads the origin through readOrigin; if it missed a text origin or a second
// note, the agents would convert half a thought without saying so.
import { describe, expect, it } from 'vitest';
import {
  fencedFiles,
  fileFromReply,
  kebab,
  readOrigin,
  setFrontMatterField,
  withBadge,
} from './generic.js';
import type { AgentContext } from './types.js';

function ctxWith(files: Record<string, string>): AgentContext {
  return {
    agent: 'interview',
    thought: { slug: '2026-10-23-test', dir: '/tmp/x', files: new Map(Object.entries(files)) },
  } as unknown as AgentContext;
}

describe('readOrigin', () => {
  it('reads a text origin as well as a voice transcript, in name order', () => {
    const origin = readOrigin(
      ctxWith({
        'origin/transcript.md': 'spoken words',
        'origin/text.md': 'written words',
        'structure.md': 'not an origin',
      }),
    );
    expect(origin).toBe(
      '<!-- origin/text.md -->\nwritten words\n\n<!-- origin/transcript.md -->\nspoken words',
    );
  });

  it('leaves the answers to the interview out', () => {
    expect(
      readOrigin(ctxWith({ 'origin/text.md': 'words', 'origin/answers.md': 'replies' })),
    ).not.toContain('replies');
  });

  it('throws when there is no origin', () => {
    expect(() => readOrigin(ctxWith({ 'origin/answers.md': 'replies' }))).toThrow(/no origin file/);
  });
});

describe('setFrontMatterField', () => {
  const file =
    '---\nwhy: >\n  because\nconverted_from: ../origin/transcript.md\nreviewed: false\n---\n\nbody with converted_from: x';

  it('replaces the field in the front matter only', () => {
    const next = setFrontMatterField(file, 'converted_from', '../origin/text.md');
    expect(next).toContain('converted_from: ../origin/text.md\nreviewed: false');
    expect(next).toContain('body with converted_from: x');
  });

  it('adds the field when the model left it out', () => {
    const next = setFrontMatterField(
      '---\nwhy: because\n---\n\nbody',
      'converted_from',
      '../origin/text.md',
    );
    expect(next).toBe('---\nwhy: because\nconverted_from: ../origin/text.md\n---\n\nbody');
  });
});

describe('fencedFiles', () => {
  it('reads every block, with a path on the first line or a label on the fence', () => {
    const reply = [
      'Here you go.',
      '```markdown',
      'versions/short.md',
      '---',
      'why: because',
      '---',
      'Short.',
      '```',
      '```pr',
      '**The message**',
      '```',
    ].join('\n');
    expect(fencedFiles(reply)).toEqual([
      { label: 'versions/short.md', content: '---\nwhy: because\n---\nShort.' },
      { label: 'pr', content: '**The message**' },
    ]);
  });

  it('keeps a block that has no label', () => {
    expect(fencedFiles('```\n---\nwhy: x\n---\n```')).toEqual([
      { label: null, content: '---\nwhy: x\n---' },
    ]);
  });
});

describe('kebab', () => {
  it('makes a safe file name from a title', () => {
    expect(kebab('Ray Kurzweil – The Age of Spiritual Machines')).toBe(
      'ray-kurzweil-the-age-of-spiritual-machines',
    );
    expect(kebab('Gödel, Escher, Bach!')).toBe('godel-escher-bach');
  });
});

describe('withBadge', () => {
  const badge = 'Talked out loud, tidied by AI · https://blog.example.com/thoughts/x';

  it('replaces a footer the model wrote itself, so the badge is never doubled', () => {
    const post =
      '---\nwhy: x\n---\n\nThe point.\n\nConverted from my note: blog.example.com\n\n' +
      badge +
      '\n';
    expect(withBadge(post, badge, 'blog.example.com')).toBe(
      `---\nwhy: x\n---\n\nThe point.\n\n${badge}\n`,
    );
  });

  it('adds the badge when there is none', () => {
    expect(withBadge('The point.', badge, 'blog.example.com')).toBe(`The point.\n\n${badge}\n`);
  });
});

describe('fileFromReply', () => {
  const file = '---\nwhy: because it exists\n---\n\nBody.';

  it('takes a plain file, a fenced file, or a file after a sentence', () => {
    expect(fileFromReply(file)).toBe(file);
    expect(fileFromReply('```markdown\n' + file + '\n```')).toBe(file);
    expect(fileFromReply('Here is seo.md:\n\n' + file)).toBe(file);
    // A sentence before a web search, glued to the file written after it.
    expect(fileFromReply("I'll look for sources." + file)).toBe(file);
  });

  it('is null when there is no front matter with a why', () => {
    expect(fileFromReply('I could not check the page.')).toBeNull();
    expect(fileFromReply('---\ntitle: no why\n---\nBody')).toBeNull();
  });
});
