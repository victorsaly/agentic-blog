// Why: what the studio sends to close a gate, and what it shows beside the question, decide whether Victor's
// decision reaches GitHub at all and whether he can see what he is deciding.
import { describe, expect, it } from 'vitest';
import { MAX_WORDS, bodyOf, gateContext, gateOf, readGateRequest } from './gates';

describe('readGateRequest', () => {
  it('reads a decision and its words, and refuses anything else', () => {
    expect(readGateRequest({ decision: 'answered', words: 'Here.' })).toEqual({
      ok: true,
      value: { decision: 'answered', words: 'Here.', medium: 'text' },
    });
    expect(readGateRequest({ decision: 'approved' })).toEqual({
      ok: true,
      value: { decision: 'approved', words: '', medium: 'text' },
    });
    expect(readGateRequest({ decision: 'merged' })).toMatchObject({ ok: false });
    expect(readGateRequest(null)).toMatchObject({ ok: false });
    expect(
      readGateRequest({ decision: 'answered', words: 'x'.repeat(MAX_WORDS + 1) }),
    ).toMatchObject({
      ok: false,
    });
  });
});

describe('a spoken answer', () => {
  it('carries the key of a recording saved for an answer, and nothing else', () => {
    const key = 'answer/2026-10-25T19-00-00-000Z-ab12cd34.webm';
    expect(readGateRequest({ decision: 'answered', words: 'Hi.', medium: 'voice', key })).toEqual({
      ok: true,
      value: { decision: 'answered', words: 'Hi.', medium: 'voice', key },
    });
    for (const bad of ['origin/2026-a.webm', '../secret', undefined])
      expect(
        readGateRequest({ decision: 'answered', words: 'Hi.', medium: 'voice', key: bad }),
      ).toMatchObject({ ok: false });
  });
});

describe('what a gate shows', () => {
  it('names the file beside each gate, and none where there is nothing to read', () => {
    expect(gateContext('answers')?.file).toBe('interview.md');
    expect(gateContext('message')?.file).toBe('structure.md');
    expect(gateContext('merge')).toBeNull();
  });

  it('shows a file without its front matter', () => {
    expect(bodyOf('---\nwhy: x\n---\n\n1. Where were you?\n')).toBe('1. Where were you?');
    expect(bodyOf('No front matter.')).toBe('No front matter.');
  });

  it('knows a gate run, and whether it still waits', () => {
    const events = [
      { type: 'run.started', fields: {} },
      {
        type: 'gate.opened',
        fields: { node: 'answers', asks: 'answer', question: 'Answer them.' },
      },
    ];
    expect(gateOf(events, 'needs-you')).toEqual({
      gate: 'answers',
      asks: 'answer',
      question: 'Answer them.',
      open: true,
    });
    expect(gateOf(events, 'done')?.open).toBe(false);
    expect(gateOf([{ type: 'run.started', fields: {} }], 'done')).toBeNull();
  });
});
