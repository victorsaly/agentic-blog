// Why: the theme row is the site's only classification; a wrong count or label shows on every page.
import { describe, expect, it } from 'vitest';
import { themeAbout, themeCounts, themeLabel, thoughtsLabel } from './themes.js';

describe('themeLabel', () => {
  it('reads like words, with AI in capitals', () => {
    expect(themeLabel('ai-changing-work')).toBe('AI changing work');
    expect(themeLabel('scalable-secure')).toBe('Scalable secure');
  });

  it('uses a name from settings when the tag cannot say it alone', () => {
    const names = { 'scalable-secure': 'Scalable and secure' };
    expect(themeLabel('scalable-secure', names)).toBe('Scalable and secure');
    expect(themeLabel('ai-changing-work', names)).toBe('AI changing work');
  });

  it('never takes a name from the object prototype', () => {
    expect(themeLabel('constructor', {})).toBe('Constructor');
    expect(themeLabel('to-string', { 'scalable-secure': 'Scalable and secure' })).toBe('To string');
  });
});

describe('themeCounts', () => {
  it('counts each theme once per post, most used first', () => {
    expect(
      themeCounts([
        ['credibility', 'accountability'],
        ['credibility', 'credibility'],
        ['ai-changing-work'],
      ]),
    ).toEqual([
      ['credibility', 2],
      ['accountability', 1],
      ['ai-changing-work', 1],
    ]);
  });
});

describe('thoughtsLabel', () => {
  it('says the count with its unit, one in words', () => {
    expect(thoughtsLabel(1)).toBe('One thought');
    expect(thoughtsLabel(12)).toBe('12 thoughts');
  });
});

describe('themeAbout', () => {
  const abouts = { accountability: 'Who answers for the work.' };

  it('gives the line written for a theme, and nothing for one without', () => {
    expect(themeAbout('accountability', abouts)).toBe('Who answers for the work.');
    expect(themeAbout('credibility', abouts)).toBeUndefined();
  });

  it('never takes a line from the object prototype', () => {
    expect(themeAbout('constructor', abouts)).toBeUndefined();
    expect(themeAbout('to-string', {})).toBeUndefined();
  });
});
