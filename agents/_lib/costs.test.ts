// Why: the ledger's dollars come from here; a wrong multiplier would put a wrong cost on every post.
import { describe, expect, it } from 'vitest';
import { addUsage, noUsage, priceOf, shares, unitsOf, usdFor } from './costs.js';

describe('usdFor', () => {
  it('prices each kind of token at its own rate, and each web search', () => {
    const usage = {
      inputTokens: 1_000_000,
      outputTokens: 100_000,
      cacheWriteTokens: 1_000_000,
      cacheReadTokens: 1_000_000,
      webSearches: 3,
    };
    // 2 input + 1 output + 2.5 cache write + 0.2 cache read + 0.03 searches
    expect(usdFor('claude-sonnet-5-5', usage)).toBe(5.73);
  });

  it('refuses a model it has no price for, rather than guessing', () => {
    expect(priceOf('claude-sonnet-5-5').input).toBe(2);
    expect(() => priceOf('some-new-model')).toThrow('no price for some-new-model');
    expect(() => usdFor('some-new-model', noUsage())).toThrow('no price for some-new-model');
  });
});

describe('unitsOf and addUsage', () => {
  it('adds calls up and says what was used, leaving out what was not', () => {
    const one = { ...noUsage(), inputTokens: 1200, outputTokens: 300 };
    const two = { ...noUsage(), inputTokens: 800, outputTokens: 200, webSearches: 1 };
    expect(unitsOf('claude-sonnet-5-5', addUsage(one, two))).toBe(
      'claude-sonnet-5-5: 2000 input, 500 output tokens, 1 web search',
    );
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
