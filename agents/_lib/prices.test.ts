// Why: the ledger's dollars come from these figures; a slip in one would put a wrong cost on every post.
import { describe, expect, it } from 'vitest';
import { costOf } from '@roadbook/core';
import { FLUX_NEURONS, hasPrice, prices, shares } from './prices.js';

describe('prices', () => {
  it('cost a Claude run, an OpenAI drawing and a Workers AI drawing from what they used', () => {
    const sonnet = {
      inputTokens: 1_000_000,
      outputTokens: 100_000,
      cacheWriteTokens: 1_000_000,
      cacheReadTokens: 1_000_000,
      webSearches: 3,
    };
    // 2 input + 1 output + 2.5 cache write + 0.2 cache read + 0.03 searches
    expect(costOf(prices, 'claude-sonnet-5-5', sonnet)).toBe(5.73);
    // a drawing from the reference photo: prompt, photo, picture
    expect(
      costOf(prices, 'gpt-image-2', {
        inputTokens: 200,
        imageInputTokens: 1000,
        imageOutputTokens: 4000,
      }),
    ).toBe(0.129);
    expect(FLUX_NEURONS).toBe(96);
    expect(costOf(prices, '@cf/black-forest-labs/flux-1-schnell', { neurons: FLUX_NEURONS })).toBe(
      0.001056,
    );
  });

  it('knows which models it can price', () => {
    expect(hasPrice('claude-sonnet-5-5')).toBe(true);
    expect(hasPrice('some-new-model')).toBe(false);
  });
});

describe('shares', () => {
  it("splits a run's cost so the receipts add up to it, to the millionth", () => {
    expect(shares(0.4, 4)).toEqual([0.1, 0.1, 0.1, 0.1]);
    const split = shares(0.035604, 7);
    expect(split).toHaveLength(7);
    expect(Math.round(split.reduce((a, b) => a + b, 0) * 1_000_000)).toBe(35604);
    expect(shares(1, 0)).toEqual([]);
  });
});
