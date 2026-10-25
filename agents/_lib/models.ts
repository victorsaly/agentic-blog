// Why: an agent asks and draws; it never chooses a provider. The card says which of the project's providers
// it may use, in order, and this turns that into the two calls an agent gets: ask (the first provider that
// writes) and draw (the first provider that draws and is set up here). Every reply, failed or not, goes into
// the run's usage log, and no call is made to a model the price list cannot cost.
import {
  ModelCallError,
  type ImageReply,
  type SpeechReply,
  type ModelAdapter,
  type Provider,
  type UsageLog,
} from '@roadbook/core';
import { claudeAdapter } from './claude.js';
import { elevenLabsAdapter } from './elevenlabs.js';
import { openAiImagesAdapter } from './openai-images.js';
import { hasPrice } from './prices.js';
import type { AskOptions } from './types.js';
import { workersAiAdapter } from './workers-ai.js';

/** The adapter for a provider the project declared, by its kind. */
export function adapterFor(name: string, provider: Provider): ModelAdapter {
  switch (provider.kind) {
    case 'claude':
      return claudeAdapter(name, provider);
    case 'openai-images':
      return openAiImagesAdapter(name, provider);
    case 'workers-ai':
      return workersAiAdapter(name, provider);
    case 'elevenlabs':
      return elevenLabsAdapter(name, provider);
    default:
      throw new Error(`provider "${name}" is ${provider.kind}, which has no adapter yet`);
  }
}

export interface Chosen {
  /** Who answers ask(). */
  writer: ModelAdapter;
  /** Who may draw, in the card's order; the first one set up here draws. */
  drawers: ModelAdapter[];
  /** Who may speak, in the card's order; the first one set up here speaks. */
  speakers?: ModelAdapter[];
}

/**
 * The providers an agent's card allows, turned into adapters. A card made for drawing may name no writer;
 * its review calls then go to the project's first provider that writes.
 */
export function choose(
  card: { model: { default: string; allowed: string[] } },
  adapters: ReadonlyMap<string, ModelAdapter>,
): Chosen {
  const named = [...new Set([card.model.default, ...card.model.allowed])].map((name) => {
    const adapter = adapters.get(name);
    if (!adapter)
      throw new Error(`the card names provider "${name}", which the project does not declare`);
    return adapter;
  });
  const writer = named.find((a) => a.write) ?? [...adapters.values()].find((a) => a.write);
  if (!writer) throw new Error('the project declares no provider that writes');
  return {
    writer,
    drawers: named.filter((a) => a.draw),
    speakers: named.filter((a) => a.speak),
  };
}

/**
 * The model ask() calls by default: the agent's PROMPT.md when it names one, else the model the project
 * declared for the chosen writer (its first), else the site-wide setting. Swapping the writer's model in
 * roadbook.config.ts therefore changes what is called, priced and put on the receipt.
 */
export function textModel(chosen: Chosen, override: string | undefined, fallback: string): string {
  return override ?? chosen.writer.models()[0] ?? fallback;
}

/** Every model this run may bill for has a price, checked before anything is spent. */
export function unpriced(chosen: Chosen, textModel: string): string[] {
  const models = [
    textModel,
    ...[...chosen.drawers, ...(chosen.speakers ?? [])]
      .filter((d) => d.available())
      .flatMap((d) => d.models()),
  ];
  return [...new Set(models)].filter((m) => !hasPrice(m));
}

export interface Calls {
  ask: (user: string, options?: AskOptions) => Promise<string>;
  draw: (prompt: string, reference?: Uint8Array) => Promise<ImageReply>;
  speak: (text: string, voice: { id: string; model?: string }) => Promise<SpeechReply>;
}

/** The calls an agent gets, each logging what it used. */
export function connect(
  chosen: Chosen,
  log: UsageLog,
  defaults: { system: string; model: string; maxOutputTokens: number },
): Calls {
  const { writer, drawers } = chosen;
  const speakers = chosen.speakers ?? [];
  const write = writer.write;
  if (!write) throw new Error(`provider "${writer.provider}" cannot write`);
  return {
    async ask(user, options = {}) {
      const model = options.model ?? defaults.model;
      // A call the ledger could not cost is never made.
      if (!hasPrice(model))
        throw new Error(`no price for ${model}; add it to agents/_lib/prices.ts first`);
      try {
        const reply = await write({
          system: defaults.system,
          user,
          model,
          maxOutputTokens: options.maxOutputTokens ?? defaults.maxOutputTokens,
          ...(options.images ? { images: options.images } : {}),
          ...(options.webSearch ? { webSearch: options.webSearch } : {}),
        });
        log.record(reply);
        return reply.text;
      } catch (error: unknown) {
        if (error instanceof ModelCallError) log.record(error.metered);
        throw error;
      }
    },
    async draw(prompt, reference) {
      const drawer = drawers.find((d) => d.available());
      if (!drawer?.draw)
        return {
          provider: 'none',
          model: 'none',
          usage: {},
          ok: false,
          reason: `no image provider is set up here (the card allows ${drawers.map((d) => d.provider).join(', ') || 'none'}).`,
        };
      try {
        const reply = await drawer.draw({ prompt, ...(reference ? { reference } : {}) });
        log.record(reply);
        return reply;
      } catch (error: unknown) {
        if (error instanceof ModelCallError) log.record(error.metered);
        throw error;
      }
    },
    async speak(text, voice) {
      const speaker = speakers.find((s) => s.available());
      if (!speaker?.speak)
        throw new Error(
          `no voice provider is set up here (the card allows ${speakers.map((s) => s.provider).join(', ') || 'none'})`,
        );
      const model = voice.model ?? speaker.models()[0];
      // A call the ledger could not cost is never made.
      if (model !== undefined && !hasPrice(model))
        throw new Error(`no price for ${model}; add it to agents/_lib/prices.ts first`);
      try {
        const reply = await speaker.speak({
          text,
          voice: voice.id,
          ...(model !== undefined ? { model } : {}),
        });
        log.record(reply);
        return reply;
      } catch (error: unknown) {
        if (error instanceof ModelCallError) log.record(error.metered);
        throw error;
      }
    },
  };
}
