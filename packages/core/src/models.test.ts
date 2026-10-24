// Why: every dollar a ledger records goes through costOf; it must price each meter at its own rate and
// refuse, never zero, a model or a meter it has no price for.
import { describe, expect, it } from 'vitest';
import {
  PriceError,
  UsageLog,
  addUsage,
  costOf,
  describeUsage,
  perMillion,
  type PriceList,
} from './models.js';

const prices: PriceList = {
  writer: { inputTokens: perMillion(2), outputTokens: perMillion(10), webSearches: 0.01 },
  painter: {
    imageInputTokens: perMillion(8),
    imageOutputTokens: perMillion(30),
    inputTokens: perMillion(5),
  },
  flux: { neurons: 0.011 / 1000 },
};

describe('costOf', () => {
  it('prices each meter at its own rate, for any provider', () => {
    expect(costOf(prices, 'writer', { inputTokens: 4152, outputTokens: 2730 })).toBe(0.035604);
    expect(costOf(prices, 'writer', { inputTokens: 1_000_000, webSearches: 3 })).toBe(2.03);
    expect(costOf(prices, 'painter', { inputTokens: 100, imageOutputTokens: 4160 })).toBe(0.1253);
    expect(costOf(prices, 'flux', { neurons: 96 })).toBe(0.001056);
  });

  it('refuses a model with no price, and a used meter with no rate', () => {
    expect(() => costOf(prices, 'unknown', {})).toThrow(PriceError);
    expect(() => costOf(prices, 'flux', { outputTokens: 10 })).toThrow(
      'flux used outputTokens but has no price for it',
    );
    expect(costOf(prices, 'flux', {})).toBe(0);
  });
});

describe('UsageLog, addUsage and describeUsage', () => {
  it('adds up replies per provider and model and says what was used', () => {
    const log = new UsageLog();
    log.record({ provider: 'writer', model: 'm', usage: { inputTokens: 10, outputTokens: 1 } });
    log.record({ provider: 'images', model: 'p', usage: { imageOutputTokens: 4160 } });
    log.record({ provider: 'writer', model: 'm', usage: { inputTokens: 5, webSearches: 1 } });
    expect(log.totals()).toEqual([
      {
        provider: 'writer',
        model: 'm',
        usage: { inputTokens: 15, outputTokens: 1, webSearches: 1 },
      },
      { provider: 'images', model: 'p', usage: { imageOutputTokens: 4160 } },
    ]);
    expect(addUsage({ neurons: 1 }, { neurons: 0 })).toEqual({ neurons: 1 });
    expect(describeUsage('m', { inputTokens: 15, outputTokens: 1, webSearches: 1 })).toBe(
      'm: 15 input tokens, 1 output token, 1 web search',
    );
  });
});
