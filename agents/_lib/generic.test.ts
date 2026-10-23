// Why: every converting agent reads the origin through readOrigin; if it missed a text origin or a second
// note, the agents would convert half a thought without saying so.
import { describe, expect, it } from 'vitest';
import { readOrigin, setFrontMatterField } from './generic.js';
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
