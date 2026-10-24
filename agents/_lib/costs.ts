// Why: the ledger records what each run cost, and a cost the runner guessed would make the ledger lie. So
// the price of every model an agent may use is written here once, with where it came from, and a model with
// no price stops the run before anything is spent. Cost is computed from what the model reported using,
// never estimated from the text.

/** Dollars per million tokens. From the Claude API pricing table, checked 2026-10-06. */
interface Price {
  input: number;
  output: number;
  cacheRead: number;
}

const PRICES: Record<string, Price> = {
  'claude-fable-5-1': { input: 10, output: 50, cacheRead: 0.25 },
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.2 },
};

/** Writing the cache costs 1.25 times the input price (the 5-minute cache, the only one the agents use). */
const CACHE_WRITE = 1.25;
/** Web searches cost $10 per 1,000. */
const WEB_SEARCH_USD = 0.01;

/** What the model reported using, added up over a run. */
export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  webSearches: number;
}

export const noUsage = (): Usage => ({
  inputTokens: 0,
  outputTokens: 0,
  cacheWriteTokens: 0,
  cacheReadTokens: 0,
  webSearches: 0,
});

export function addUsage(a: Usage, b: Usage): Usage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    webSearches: a.webSearches + b.webSearches,
  };
}

/** The model's price; throws for a model with none, so a call the ledger could not price is never made. */
export function priceOf(model: string): Price {
  const price = PRICES[model];
  if (!price)
    throw new Error(`no price for ${model}; add it to agents/_lib/costs.ts before using it`);
  return price;
}

/** The dollars a model's usage cost, to a millionth of a dollar. Throws for a model with no price. */
export function usdFor(model: string, usage: Usage): number {
  const price = priceOf(model);
  const usd =
    (usage.inputTokens * price.input +
      usage.cacheWriteTokens * price.input * CACHE_WRITE +
      usage.cacheReadTokens * price.cacheRead +
      usage.outputTokens * price.output) /
      1_000_000 +
    usage.webSearches * WEB_SEARCH_USD;
  return Math.round(usd * 1_000_000) / 1_000_000;
}

/** The usage in words, for the ledger's units field. */
export function unitsOf(model: string, usage: Usage): string {
  const parts = [
    `${String(usage.inputTokens)} input`,
    `${String(usage.outputTokens)} output`,
    ...(usage.cacheWriteTokens > 0 ? [`${String(usage.cacheWriteTokens)} cache write`] : []),
    ...(usage.cacheReadTokens > 0 ? [`${String(usage.cacheReadTokens)} cache read`] : []),
  ];
  const searches =
    usage.webSearches > 0
      ? `, ${String(usage.webSearches)} web search${usage.webSearches === 1 ? '' : 'es'}`
      : '';
  return `${model}: ${parts.join(', ')} tokens${searches}`;
}

/**
 * A run's cost shared across the files it wrote, to a millionth of a dollar, so the receipts add up to
 * exactly what the run cost. The last file takes what rounding leaves over.
 */
export function shares(usd: number, count: number): number[] {
  if (count <= 0) return [];
  const micros = Math.round(usd * 1_000_000);
  const each = Math.floor(micros / count);
  return Array.from({ length: count }, (_, i) =>
    i === count - 1 ? (micros - each * (count - 1)) / 1_000_000 : each / 1_000_000,
  );
}
