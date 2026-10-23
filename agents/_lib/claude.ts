// Why: one thin door to the model. Every agent asks through here, so the model, the token budget and the
// system message are set in one place and a change to any of them is one commit.
import Anthropic from '@anthropic-ai/sdk';
import type { AskOptions } from './types.js';

export interface AskClient {
  ask: (user: string, options?: AskOptions) => Promise<string>;
}

export function createAskClient(
  system: string,
  defaults: { model: string; maxOutputTokens: number },
): AskClient {
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
  const client = new Anthropic({ apiKey });

  return {
    async ask(user, options = {}) {
      const response = await client.messages.create({
        model: options.model ?? defaults.model,
        max_tokens: options.maxOutputTokens ?? defaults.maxOutputTokens,
        system,
        messages: [{ role: 'user', content: user }],
      });
      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('\n')
        .trim();
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
