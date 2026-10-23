// Why: every converting agent reads the origin through readOrigin; if it missed a text origin or a second
// note, the agents would convert half a thought without saying so.
import { describe, expect, it } from 'vitest';
import { readOrigin } from './generic.js';
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
