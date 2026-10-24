import { describe, expect, it } from 'vitest';
import { captions, roomFor, scenes, timelineProblems, type Scene } from './scenes.js';

describe('the pitch timeline', () => {
  it('runs end to end on the beat with no gaps', () => {
    expect(timelineProblems(scenes)).toEqual([]);
  });

  it('finds a gap, an off-beat cut and a clip used twice', () => {
    const broken: Scene[] = [
      { start: 0, dur: 3.25, kind: 'card', lines: ['a'], vo: { key: 'x', line: 'a' } },
      { start: 4, dur: 2, kind: 'card', lines: ['b'], vo: { key: 'x', line: 'b' } },
    ];
    expect(timelineProblems(broken, 6)).toEqual([
      'a scene starts at 4s, expected 3.25s',
      'two scenes use the clip "x"',
    ]);
    expect(timelineProblems([{ start: 0.25, dur: 1, kind: 'card', lines: [] }], 1.25)).toContain(
      'the scene at 0.25s is off the beat',
    );
  });

  it('lets a line run over a silent scene but not into the next line', () => {
    const list: Scene[] = [
      { start: 0, dur: 2, kind: 'card', lines: ['a'], vo: { key: 'a', line: 'a' } },
      { start: 2, dur: 2, kind: 'card', lines: ['b'] },
      { start: 4, dur: 2, kind: 'card', lines: ['c'], vo: { key: 'c', line: 'c' } },
    ];
    expect(roomFor(list, 0, 6)).toBeCloseTo(3.65);
    expect(roomFor(list, 2, 6)).toBeCloseTo(1.65);
  });
});

describe('the captions', () => {
  it('times each line from its clip and skips silent scenes and missing clips', () => {
    const list: Scene[] = [
      { start: 0, dur: 2, kind: 'card', lines: ['a'], vo: { key: 'a', line: 'Hello there.' } },
      { start: 2, dur: 2, kind: 'card', lines: ['b'] },
      { start: 64, dur: 2, kind: 'card', lines: ['c'], vo: { key: 'c', line: 'Late.' } },
      { start: 66, dur: 2, kind: 'card', lines: ['d'], vo: { key: 'd', line: 'Never made.' } },
    ];
    expect(captions(list, { a: 1.5, c: 2.25 })).toBe(
      'WEBVTT\n\n00:00:00.350 --> 00:00:01.850\nHello there.\n\n00:01:04.350 --> 00:01:06.600\nLate.\n',
    );
  });
});
