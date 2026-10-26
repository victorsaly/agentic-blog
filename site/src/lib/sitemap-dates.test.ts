// Why: the dates search engines read in the sitemap come from here; a wrong one hides a new post.
import { describe, expect, it } from 'vitest';
import { lastmodFor } from './sitemap-dates.js';

const dates = new Map([
  ['older', new Date('2026-10-23')],
  ['newer', new Date('2026-10-25')],
]);

describe('lastmodFor', () => {
  it('dates a post and its origin by the post', () => {
    expect(lastmodFor('/thoughts/older', dates)).toBe('2026-10-23');
    expect(lastmodFor('/thoughts/older/origin', dates)).toBe('2026-10-23');
  });

  it('dates every other page by the newest post', () => {
    expect(lastmodFor('/', dates)).toBe('2026-10-25');
    expect(lastmodFor('/topics/accountability', dates)).toBe('2026-10-25');
  });

  it('gives no date before anything is published', () => {
    expect(lastmodFor('/', new Map())).toBeUndefined();
  });
});
