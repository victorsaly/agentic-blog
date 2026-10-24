// Why: the ledger records what each run cost, and a cost the runner guessed would make the ledger lie. So
// every model an agent may use has its price here, once, with where the figure came from, and a model with
// no price is refused before anything is spent. Prices are list prices; a free allowance or a discount is
// not taken off, so the ledger never shows a run as cheaper than it could have been.
import { perMillion, type PriceList } from '@roadbook/core';

/** A picture from Workers AI's flux-1-schnell at 1024px and 8 steps: 4 tiles at 4.8 and 8 steps at 9.6. */
export const FLUX_NEURONS = 4 * 4.8 + 8 * 9.6;

export const prices: PriceList = {
  // Claude, from the Claude API pricing table, checked 2026-10-06. Cache writes are 1.25x input (5-minute
  // cache); web searches are $10 per 1,000.
  'claude-fable-5-1': {
    inputTokens: perMillion(10),
    outputTokens: perMillion(50),
    cacheWriteTokens: perMillion(12.5),
    cacheReadTokens: perMillion(0.25),
    webSearches: 0.01,
  },
  'claude-opus-5-5': {
    inputTokens: perMillion(4),
    outputTokens: perMillion(20),
    cacheWriteTokens: perMillion(5),
    cacheReadTokens: perMillion(0.2),
    webSearches: 0.01,
  },
  'claude-sonnet-5-5': {
    inputTokens: perMillion(2),
    outputTokens: perMillion(10),
    cacheWriteTokens: perMillion(2.5),
    cacheReadTokens: perMillion(0.2),
    webSearches: 0.01,
  },
  // OpenAI image generation, from developers.openai.com/api/docs/pricing, checked 2026-10-24. Text input is
  // the prompt; image input is the reference photo.
  'gpt-image-2': {
    inputTokens: perMillion(5),
    imageInputTokens: perMillion(8),
    imageOutputTokens: perMillion(30),
  },
  // Workers AI, from developers.cloudflare.com/workers-ai/platform/pricing, checked 2026-10-24: $0.011 per
  // 1,000 neurons. The daily free neurons are not taken off.
  '@cf/black-forest-labs/flux-1-schnell': { neurons: 0.011 / 1000 },
};

export function hasPrice(model: string): boolean {
  return model in prices;
}
