// Why: the ledger's dollars come from here; a wrong multiplier would put a wrong cost on every post.
import { describe, expect, it } from 'vitest';
import { addUsage, hasPrice, noUsage, unitsOf, usdFor } from './costs.js';

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
    expect(hasPrice('claude-sonnet-5-5')).toBe(true);
    expect(hasPrice('some-new-model')).toBe(false);
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
