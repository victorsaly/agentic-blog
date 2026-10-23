// Why: the why-check guards every build; it needs its own tests so a change to it cannot silently let
// files through without a why, or start rejecting files that are fine.
import { describe, expect, it } from 'vitest';
import { checkFrontMatter } from './check-why.js';

const why = 'why: This file exists so the test can show a good why passing the check.';

describe('checkFrontMatter', () => {
  it('accepts a generic file with a why', () => {
    expect(checkFrontMatter('wiki/some-book.md', `---\n${why}\n---\nBody`)).toEqual([]);
  });

  it('rejects a file with no why', () => {
    const problems = checkFrontMatter('wiki/some-book.md', '---\ntitle: x\n---\nBody');
    expect(problems).toHaveLength(1);
    expect(problems[0]?.message).toContain('why');
  });

  it('rejects a why that is too short to be a sentence', () => {
    const problems = checkFrontMatter('wiki/some-book.md', '---\nwhy: because\n---\nBody');
    expect(problems[0]?.message).toContain('sentence');
  });

  it('rejects an origin that claims to have been edited', () => {
    const source = [
      '---',
      why,
      'recorded: 2026-10-23',
      'language: en',
      'speakers: [victor]',
      'edited: true',
      '---',
      'Body',
    ].join('\n');
    const problems = checkFrontMatter('thoughts/x/origin/transcript.md', source);
    expect(problems.some((p) => p.message.startsWith('edited'))).toBe(true);
  });

  it('requires a version to say what it was converted from and by whom', () => {
    const source = ['---', why, 'kind: short', 'language: en', 'reviewed: false', '---', 'Body'].join('\n');
    const messages = checkFrontMatter('thoughts/x/versions/short.md', source).map((p) => p.message);
    expect(messages.some((m) => m.startsWith('converted_from'))).toBe(true);
    expect(messages.some((m) => m.startsWith('converted_by'))).toBe(true);
  });
});
