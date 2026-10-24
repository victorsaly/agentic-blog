// Why: this function is the only thing between the studio and a pull request on the repo; a loose rule
// here would let an empty or keyless note through, so each accepted and refused shape is pinned down.
import { describe, expect, it } from 'vitest';
import { MAX_TEXT_LENGTH, parseOriginRequest } from './origin-request.js';

const KEY = 'origin/2026-10-23T21-00-00-000Z-abcd1234.webm';

describe('voice origins', () => {
  it('accepts a recording key and its transcript', () => {
    const parsed = parseOriginRequest({ key: KEY, transcript: '  So I had this idea.  ' });
    expect(parsed).toEqual({
      ok: true,
      value: {
        medium: 'voice',
        key: KEY,
        transcript: 'So I had this idea.',
        mode: 'origin',
        thought: null,
      },
    });
  });

  it('refuses a missing or unsafe key', () => {
    expect(parseOriginRequest({ transcript: 'words' }).ok).toBe(false);
    expect(parseOriginRequest({ key: '../secrets.webm', transcript: 'words' }).ok).toBe(false);
  });
});

describe('text origins', () => {
  it('accepts text with no key', () => {
    const parsed = parseOriginRequest({ medium: 'text', transcript: 'Written on the train.' });
    expect(parsed).toEqual({
      ok: true,
      value: {
        medium: 'text',
        key: null,
        transcript: 'Written on the train.',
        mode: 'origin',
        thought: null,
      },
    });
  });

  it('refuses a key, so a recording is never claimed for text', () => {
    expect(parseOriginRequest({ medium: 'text', key: KEY, transcript: 'words' })).toEqual({
      ok: false,
      error: 'Text origins have no recording; leave the key out.',
    });
  });

  it('refuses empty and oversized text', () => {
    expect(parseOriginRequest({ medium: 'text', transcript: '   \n ' })).toEqual({
      ok: false,
      error: 'The text is empty.',
    });
    expect(
      parseOriginRequest({ medium: 'text', transcript: 'a'.repeat(MAX_TEXT_LENGTH + 1) }).ok,
    ).toBe(false);
  });

  it('still needs a thought for feedback', () => {
    expect(parseOriginRequest({ medium: 'text', mode: 'feedback', transcript: 'words' }).ok).toBe(
      false,
    );
    const parsed = parseOriginRequest({
      medium: 'text',
      mode: 'feedback',
      thought: '2026-10-23-talked-out-loud-tidied-by-ai',
      transcript: 'The short version loses the point.',
    });
    expect(parsed.ok && parsed.value.thought).toBe('2026-10-23-talked-out-loud-tidied-by-ai');
  });
});

describe('anything else', () => {
  it('refuses a body that is not an object', () => {
    expect(parseOriginRequest(null).ok).toBe(false);
    expect(parseOriginRequest('text').ok).toBe(false);
  });
});
