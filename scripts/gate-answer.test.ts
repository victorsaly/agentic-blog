// Why: an answer lands as an origin, and an origin the schema refuses would fail the build on the pull
// request; a payload read wrongly would close the wrong gate or none.
import matter from 'gray-matter';
import { describe, expect, it } from 'vitest';
import { originFrontMatter } from './content-schema';
import { answerFileFor, answerOrigin, closeGatePayload } from './gate-answer';

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
    const { data, content } = matter(text);
    expect(originFrontMatter.safeParse(data).success).toBe(true);
    expect(content.trim()).toBe('On a walk.\n\nA podcast.');
    expect(data).toMatchObject({ medium: 'text', edited: false });
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
    expect(closeGatePayload.parse(sent)).toEqual(sent);
    expect(closeGatePayload.safeParse({ ...sent, run: '../x' }).success).toBe(false);
    expect(closeGatePayload.safeParse({ ...sent, thought: 'x' }).success).toBe(false);
  });
});
