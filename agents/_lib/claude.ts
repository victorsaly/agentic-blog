// Why: one thin door to the model. Every agent asks through here, so the model, the token budget and the
// system message are set in one place and a change to any of them is one commit. It also counts what every
// call used, per model, so the runner can record what the run really cost.
import Anthropic from '@anthropic-ai/sdk';
import { addUsage, noUsage, priceOf, type Usage } from './costs.js';
import type { AskOptions } from './types.js';

export interface AskClient {
  /** Who bills these calls, as the ledger names it. */
  provider: 'anthropic';
  ask: (user: string, options?: AskOptions) => Promise<string>;
  /** What the calls so far used, by model. */
  usage: () => Map<string, Usage>;
}

/** One response's usage. Web searches sit under server_tool_use, which this SDK version does not type. */
function usageOf(response: Anthropic.Message): Usage {
  const u = response.usage;
  const tools: unknown = (u as unknown as { server_tool_use?: unknown }).server_tool_use;
  const searches =
    typeof tools === 'object' && tools !== null
      ? (tools as { web_search_requests?: unknown }).web_search_requests
      : undefined;
  return {
    inputTokens: u.input_tokens,
    outputTokens: u.output_tokens,
    cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
    cacheReadTokens: u.cache_read_input_tokens ?? 0,
    webSearches: typeof searches === 'number' ? searches : 0,
  };
}

export function createAskClient(
  system: string,
  defaults: { model: string; maxOutputTokens: number },
): AskClient {
  // A model the ledger could not price is refused here, before the run starts or anything is spent.
  priceOf(defaults.model);
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
  const client = new Anthropic({ apiKey });
  const used = new Map<string, Usage>();

  return {
    provider: 'anthropic',
    usage: () => new Map(used),
    async ask(user, options = {}) {
      // The installed SDK predates the web search tool's types, so the tool goes in as plain data.
      const tools = options.webSearch
        ? ([
            {
              type: 'web_search_20260209',
              name: 'web_search',
              max_uses: options.webSearch.maxUses,
            },
          ] as unknown as Anthropic.Tool[])
        : undefined;
      const content: Anthropic.ContentBlockParam[] = [
        ...(options.images ?? []).map((png): Anthropic.ImageBlockParam => ({
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/png',
            data: Buffer.from(png).toString('base64'),
          },
        })),
        { type: 'text', text: user },
      ];
      const messages: Anthropic.MessageParam[] = [{ role: 'user', content }];
      const texts: string[] = [];

      // A long search can pause the turn; resend it as it stands and the server carries on.
      const model = options.model ?? defaults.model;
      if (options.model) priceOf(options.model);
      for (let round = 0; round < 6; round += 1) {
        const response = await client.messages.create({
          model,
          max_tokens: options.maxOutputTokens ?? defaults.maxOutputTokens,
          system,
          messages,
          ...(tools ? { tools } : {}),
        });
        // Counted before anything else, so a refused or empty answer still shows what it cost.
        used.set(model, addUsage(used.get(model) ?? noUsage(), usageOf(response)));
        if ((response.stop_reason as string) === 'refusal')
          throw new Error('the model declined this request; read the input before running again');
        texts.push(
          ...response.content
            .filter((block): block is Anthropic.TextBlock => block.type === 'text')
            .map((block) => block.text),
        );
        if ((response.stop_reason as string) !== 'pause_turn') break;
        messages.push({
          role: 'assistant',
          content: response.content,
        });
      }

      const text = texts.join('').trim();
      if (text.length === 0) throw new Error('the model returned no text');
      return text;
    },
  };
}

/** Pulls the first fenced block out of a reply, or the whole reply when there is none. */
export function unfence(reply: string): string {
  const match = /```[a-z]*\n([\s\S]*?)```/.exec(reply);
  return (match?.[1] ?? reply).trim();
}
