// Why: every model a project uses, whoever makes it, is reached through one small contract: an adapter
// that writes text or draws a picture, and that always says what the call used. Usage is counted in named
// meters (tokens of each kind, web searches, neurons) so one price list can cost any provider the same way,
// and the ledger records what a run really used instead of an estimate. Agents never call a provider
// directly; swapping Claude for another writer, or one image model for another, is a change to the project's
// providers, not to an agent.

/** The things a provider charges for. Each provider reports the ones it uses; the rest stay at zero. */
export const meters = [
  'inputTokens',
  'outputTokens',
  'cacheWriteTokens',
  'cacheReadTokens',
  'imageInputTokens',
  'imageOutputTokens',
  'webSearches',
  'neurons',
] as const;

export type Meter = (typeof meters)[number];

/** What a call used, by meter. A meter left out was not used. */
export type Usage = Partial<Record<Meter, number>>;

/** Every reply says which provider and model answered, and what it used. */
export interface Metered {
  /** The provider's name in the project, e.g. "writer". */
  provider: string;
  model: string;
  usage: Usage;
}

export interface TextRequest {
  system: string;
  user: string;
  maxOutputTokens: number;
  /** A different model from the same provider, when the card allows it. */
  model?: string;
  /** PNG pictures to show the model before the text. */
  images?: Uint8Array[];
  /** Lets the model search the web, at most this many times, where the provider can. */
  webSearch?: { maxUses: number };
}

export type TextReply = Metered & { text: string };

export interface ImageRequest {
  prompt: string;
  /** A photo to draw from, where the provider can take one. */
  reference?: Uint8Array;
}

/** A picture, or the plain reason there is none. A failed call still says what it used. */
export type ImageReply = Metered & ({ ok: true; png: Uint8Array } | { ok: false; reason: string });

/** A call that failed after the provider had already charged for it: the error says what was used. */
export class ModelCallError extends Error {
  readonly metered: Metered;
  constructor(message: string, metered: Metered) {
    super(message);
    this.metered = metered;
  }
}

export interface ModelAdapter {
  /** The provider's name in the project. */
  provider: string;
  /** Whether it can be called here: its key is set, its account is configured. */
  available: () => boolean;
  /** The models this adapter may bill for, so a run can check every one has a price before it starts. */
  models: () => string[];
  write?: (request: TextRequest) => Promise<TextReply>;
  draw?: (request: ImageRequest) => Promise<ImageReply>;
}

export function addUsage(a: Usage, b: Usage): Usage {
  const sum: Usage = { ...a };
  for (const meter of meters) {
    const add = b[meter] ?? 0;
    if (add !== 0) sum[meter] = (sum[meter] ?? 0) + add;
  }
  return sum;
}

/** Dollars per unit of each meter, per model. A token rate is per token, not per million. */
export type PriceList = Record<string, Partial<Record<Meter, number>>>;

/** A rate given per million tokens, as providers publish them. */
export const perMillion = (usd: number): number => usd / 1_000_000;

export class PriceError extends Error {}

/**
 * The dollars a model's usage cost, to a millionth of a dollar. Refuses a model with no price, and a meter
 * the model used that has no rate, rather than counting it as free.
 */
export function costOf(prices: PriceList, model: string, usage: Usage): number {
  const rates = prices[model];
  if (!rates) throw new PriceError(`no price for ${model}`);
  let usd = 0;
  for (const meter of meters) {
    const units = usage[meter] ?? 0;
    if (units === 0) continue;
    const rate = rates[meter];
    if (rate === undefined) throw new PriceError(`${model} used ${meter} but has no price for it`);
    usd += units * rate;
  }
  return Math.round(usd * 1_000_000) / 1_000_000;
}

const meterWords: Record<Meter, [string, string]> = {
  inputTokens: ['input token', 'input tokens'],
  outputTokens: ['output token', 'output tokens'],
  cacheWriteTokens: ['cache write token', 'cache write tokens'],
  cacheReadTokens: ['cache read token', 'cache read tokens'],
  imageInputTokens: ['image input token', 'image input tokens'],
  imageOutputTokens: ['image output token', 'image output tokens'],
  webSearches: ['web search', 'web searches'],
  neurons: ['neuron', 'neurons'],
};

/** The usage in words, for a ledger's units field: "claude-sonnet-5-5: 4152 input tokens, 2730 output tokens". */
export function describeUsage(model: string, usage: Usage): string {
  const parts = meters
    .filter((m) => (usage[m] ?? 0) !== 0)
    .map((m) => {
      const n = usage[m] ?? 0;
      return `${String(n)} ${meterWords[m][n === 1 ? 0 : 1]}`;
    });
  return `${model}: ${parts.length > 0 ? parts.join(', ') : 'nothing used'}`;
}

/** Collects every reply's usage over a run, added up per provider and model. */
export class UsageLog {
  readonly #byModel = new Map<string, Metered>();

  record(reply: Metered): void {
    const key = `${reply.provider}\u0000${reply.model}`;
    const before = this.#byModel.get(key);
    this.#byModel.set(key, {
      provider: reply.provider,
      model: reply.model,
      usage: addUsage(before?.usage ?? {}, reply.usage),
    });
  }

  /** One entry per provider and model used, in the order they were first used. */
  totals(): Metered[] {
    return [...this.#byModel.values()].map((m) => ({ ...m, usage: { ...m.usage } }));
  }
}
