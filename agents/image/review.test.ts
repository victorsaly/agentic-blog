// Why: the review is the only thing between a broken drawing and the post, so a vague or malformed answer
// must count as a failure, never as a pass.
import { describe, expect, it } from 'vitest';
import { parseReview } from './review.js';

describe('parseReview', () => {
  it('passes only a clear ok with no problems', () => {
    expect(parseReview('{"ok": true, "problems": []}')).toEqual({ ok: true, problems: [] });
  });

  it('fails when problems are listed, even if ok is true', () => {
    expect(parseReview('{"ok": true, "problems": ["The left person has no head."]}').ok).toBe(
      false,
    );
  });

  it('reads a verdict inside a code fence or after words', () => {
    expect(
      parseReview('Here:\n```json\n{"ok": false, "problems": ["A logo on the laptop."]}\n```'),
    ).toEqual({
      ok: false,
      problems: ['A logo on the laptop.'],
    });
  });

  it('fails when there is no verdict or it is broken', () => {
    expect(parseReview('Looks fine to me.').ok).toBe(false);
    expect(parseReview('{"ok": true, problems: }').ok).toBe(false);
  });
});
