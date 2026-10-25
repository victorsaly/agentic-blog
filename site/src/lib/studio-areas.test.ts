import { describe, expect, it } from 'vitest';
import { areaFor, studioAreas } from './studio-areas';

describe('studio areas', () => {
  it('gives every area its own address under /studio', () => {
    const hrefs = studioAreas.map((a) => a.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs.every((h) => h === '/studio' || h.startsWith('/studio/'))).toBe(true);
  });

  it('finds the area from the address, built or served', () => {
    expect(areaFor('/studio/comments')).toBe('comments');
    expect(areaFor('/studio/comments.html')).toBe('comments');
    expect(areaFor('/studio/review/')).toBe('review');
  });

  it('keeps a page inside an area on that area', () => {
    expect(areaFor('/studio/agents/run')).toBe('agents');
    expect(areaFor('/studio/agents/run.html')).toBe('agents');
    expect(areaFor('/studio/agentsx')).toBe('today');
  });

  it('treats the studio itself and anything unknown as the overview', () => {
    expect(areaFor('/studio')).toBe('today');
    expect(areaFor('/studio.html')).toBe('today');
    expect(areaFor('/studio/nowhere')).toBe('today');
  });
});
