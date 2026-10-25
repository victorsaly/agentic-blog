// Why: Claude behind the one model contract. The project's "writer" provider is this adapter: it sends the
// system message, the pictures and the question, carries a paused web search on, and returns the text (a
// new paragraph wherever a search came between two pieces of it) with what every round used, read from the usage Claude reports, so the ledger can cost it exactly.
import Anthropic from '@anthropic-ai/sdk';
import {
  ModelCallError,
  addUsage,
  type ModelAdapter,
  type Provider,
  type Usage,
} from '@roadbook/core';

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

export function claudeAdapter(name: string, provider: Provider): ModelAdapter {
  const secret = provider.secret ?? 'ANTHROPIC_API_KEY';
  const fallbackModel = provider.model ?? 'claude-sonnet-5-5';
  let client: Anthropic | null = null;

  return {
    provider: name,
    available: () => Boolean(process.env[secret]),
    models: () => [fallbackModel],
    async write(request) {
      const apiKey = process.env[secret];
      if (!apiKey) throw new Error(`${secret} is not set`);
      client ??= new Anthropic({ apiKey });
      const model = request.model ?? fallbackModel;
      // The installed SDK predates the web search tool's types, so the tool goes in as plain data.
      const tools = request.webSearch
        ? ([
            {
              type: 'web_search_20260209',
              name: 'web_search',
              max_uses: request.webSearch.maxUses,
            },
          ] as unknown as Anthropic.Tool[])
        : undefined;
      const content: Anthropic.ContentBlockParam[] = [
        ...(request.images ?? []).map((png): Anthropic.ImageBlockParam => ({
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/png',
            data: Buffer.from(png).toString('base64'),
          },
        })),
        { type: 'text', text: request.user },
      ];
      const messages: Anthropic.MessageParam[] = [{ role: 'user', content }];
      const texts: string[] = [];
      let usage: Usage = {};

      // A long search can pause the turn; resend it as it stands and the server carries on.
      for (let round = 0; round < 6; round += 1) {
        let response: Anthropic.Message;
        try {
          response = await client.messages.create({
            model,
            max_tokens: request.maxOutputTokens,
            system: request.system,
            messages,
            ...(tools ? { tools } : {}),
          });
        } catch (error: unknown) {
          // The rounds before this one were billed; the error carries them so the ledger still counts them.
          if (round === 0) throw error;
          const reason = error instanceof Error ? error.message : String(error);
          throw new ModelCallError(`round ${String(round + 1)} failed: ${reason}`, {
            provider: name,
            model,
            usage,
          });
        }
        usage = addUsage(usage, usageOf(response));
        if ((response.stop_reason as string) === 'refusal')
          throw new ModelCallError(
            'the model declined this request; read the input before running again',
            { provider: name, model, usage },
          );
        // Text that runs on (a cited sentence comes in pieces) is joined as it is; text after a search, or
        // after a pause, starts a new paragraph, so a file written after "I'll look for sources." still
        // opens on a line of its own.
        let after = texts.length > 0;
        for (const block of response.content) {
          if (block.type !== 'text') {
            after = true;
            continue;
          }
          texts.push(after && texts.length > 0 ? `\n\n${block.text}` : block.text);
          after = false;
        }
        if ((response.stop_reason as string) !== 'pause_turn') break;
        messages.push({ role: 'assistant', content: response.content });
      }

      const text = texts.join('').trim();
      if (text.length === 0)
        throw new ModelCallError('the model returned no text', { provider: name, model, usage });
      return { provider: name, model, usage, text };
    },
  };
}

/** Pulls the first fenced block out of a reply, or the whole reply when there is none. */
export function unfence(reply: string): string {
  const match = /```[a-z]*\n([\s\S]*?)```/.exec(reply);
  return (match?.[1] ?? reply).trim();
}
