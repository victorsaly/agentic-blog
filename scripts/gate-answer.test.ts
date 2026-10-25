// Why: an answer lands as an origin, and an origin the schema refuses would fail the build on the pull
// request; a payload read wrongly would close the wrong gate or none. Approving the merge gate has to carry the
// thought out of draft, or a merged post has no page.
import matter from 'gray-matter';
import { describe, expect, it } from 'vitest';
import { checkNumbers } from './check-why';
import { originFrontMatter, structureFrontMatter } from './content-schema';
import {
  answerFileFor,
  answerOrigin,
  claimsFrom,
  closeGatePayload,
  nextNumber,
  numberOf,
  numbersFromGrep,
  publishedStructure,
  publishesOnClose,
} from './gate-answer';

describe('the answer as an origin', () => {
  it('lands only the interview answers, as origin/answers.md', () => {
    expect(answerFileFor('answers', 'answered')).toBe('origin/answers.md');
    expect(answerFileFor('message', 'approved')).toBeNull();
    expect(answerFileFor('message', 'redirected')).toBeNull();
  });

  it('keeps the words exactly, with front matter the origin schema accepts', () => {
    const text = answerOrigin(
      '2026-10-23-a',
      '  On a walk.\n\nA podcast.  ',
      '2026-10-25',
      'info@victorsaly.com',
    );
    const { data } = matter(text);
    expect(originFrontMatter.safeParse(data).success).toBe(true);
    // Not a character changed: indentation and trailing spaces are kept, only a final line ending added.
    expect(text.endsWith('---\n\n  On a walk.\n\nA podcast.  \n')).toBe(true);
    expect(data).toMatchObject({ medium: 'text', edited: false });
  });
});

describe('a spoken answer as an origin', () => {
  it('is voice, with the key of its recording, and still passes the schema', () => {
    const text = answerOrigin(
      '2026-10-23-a',
      'Spoken words.',
      '2026-10-25',
      'info@victorsaly.com',
      {
        key: 'answer/2026-10-25T19-00-00-000Z-ab12cd34.webm',
      },
    );
    const { data } = matter(text);
    expect(originFrontMatter.safeParse(data).success).toBe(true);
    expect(data).toMatchObject({
      medium: 'voice',
      audio: 'answer/2026-10-25T19-00-00-000Z-ab12cd34.webm',
    });
  });
});

describe('the close-gate payload', () => {
  it('reads what the studio sends and refuses a run or thought it does not recognise', () => {
    const sent = {
      run: '20261025T190114Z-answers-315c',
      thought: '2026-10-23-a',
      decision: 'answered',
      words: 'Here.',
      by: 'info@victorsaly.com',
      branch: 'origin/2026-10-23-a',
    };
    expect(closeGatePayload.parse(sent)).toEqual({ ...sent, medium: 'text' });
    expect(closeGatePayload.safeParse({ ...sent, run: '../x' }).success).toBe(false);
    expect(closeGatePayload.safeParse({ ...sent, thought: 'x' }).success).toBe(false);
  });
});

describe('approving the merge gate', () => {
  const draft = [
    '---',
    'why: >',
    '  The structure of a thought about trying the same idea again.',
    'title: Same idea, a year later',
    'date: 2026-10-25',
    'language: en',
    'themes:',
    '  - accountability',
    'message: >',
    '  The message.',
    'origins:',
    '  - origin/transcript.md',
    'draft: true',
    '---',
    '',
    '## The idea',
    '',
    'draft: true is only front matter.',
    '',
  ].join('\n');

  it('publishes only when the merge gate is approved', () => {
    expect(publishesOnClose('merge', 'approved')).toBe(true);
    expect(publishesOnClose('merge', 'redirected')).toBe(false);
    expect(publishesOnClose('message', 'approved')).toBe(false);
  });

  it('takes the number after the highest one taken', () => {
    expect(nextNumber([])).toBe(1);
    expect(nextNumber([2, 1, 2])).toBe(3);
  });

  it('carries a draft out with its number, a thought the build and check:why accept', () => {
    const published = publishedStructure(draft, 3);
    expect(published).not.toBeNull();
    const { data, content } = matter(published ?? '');
    expect(data).toMatchObject({ number: 3, draft: false });
    expect(structureFrontMatter.safeParse(data).success).toBe(true);
    expect(checkNumbers([{ file: 'thoughts/c/structure.md', data }])).toEqual([]);
    // Only the draft line changed: the body, which says "draft: true" too, is left as it was.
    expect(content).toContain('draft: true is only front matter.');
    expect(published?.replace('number: 3\ndraft: false', 'draft: true')).toBe(draft);
  });

  it('keeps a number already given, and never touches a thought already out', () => {
    const numbered = draft.replace('draft: true', 'number: 7\ndraft: true');
    expect(matter(publishedStructure(numbered, 3) ?? '').data).toMatchObject({ number: 7 });
    expect(
      publishedStructure(draft.replace('draft: true', 'number: 2\ndraft: false'), 3),
    ).toBeNull();
  });

  it('publishes a draft written with CRLF line endings, and keeps them', () => {
    const crlf = draft.replaceAll('\n', '\r\n');
    const published = publishedStructure(crlf, 4);
    expect(published).toBe(crlf.replace('draft: true', 'number: 4\r\ndraft: false'));
    expect(numberOf(published ?? '')).toBe(4);
  });

  it('counts the numbers held on other branches, never the thought being published', () => {
    const output = [
      'refs/remotes/origin/main:thoughts/2026-10-23-a/structure.md:number: 1',
      'refs/remotes/origin/main:thoughts/2026-10-23-b/structure.md:number: 2',
      'refs/remotes/origin/interview/2026-10-26-c:thoughts/2026-10-26-c/structure.md:number: 3',
      'refs/remotes/origin/gate/2026-10-27-d-ab12:thoughts/2026-10-27-d/structure.md:number: 9',
      'refs/remotes/origin/main:thoughts/2026-10-23-a/versions/long.md:number: 40',
      '',
    ].join('\n');
    expect(numbersFromGrep(output, '2026-10-27-d')).toEqual([1, 2, 3]);
    // Approved on its branch, not merged: the next approval elsewhere goes past it.
    expect(nextNumber(numbersFromGrep(output, '2026-10-28-e'))).toBe(10);
  });
});

describe('the numbers claimed as tags', () => {
  it('reads each tag as its number and the thought that claimed it', () => {
    expect(
      claimsFrom('3 2026-10-25-september-last-year-tried\n4 2026-10-26-b\n\nnot-a-claim\n'),
    ).toEqual([
      { number: 3, thought: '2026-10-25-september-last-year-tried' },
      { number: 4, thought: '2026-10-26-b' },
    ]);
  });
});
