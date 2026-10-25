// Why: a paused web search is carried on over several billed rounds, so a later round that fails must
// still hand back what the earlier rounds used. The SDK is stubbed; nothing is spent.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModelCallError } from '@roadbook/core';

const create = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create };
  },
}));

const { claudeAdapter } = await import('./claude.js');

afterEach(() => {
  create.mockReset();
  vi.unstubAllEnvs();
});

describe('claudeAdapter', () => {
  it('keeps the usage of earlier rounds when a continuation fails', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'key');
    create
      .mockResolvedValueOnce({
        stop_reason: 'pause_turn',
        content: [{ type: 'text', text: 'half' }],
        usage: { input_tokens: 100, output_tokens: 20 },
      })
      .mockRejectedValueOnce(new Error('overloaded'));
    const adapter = claudeAdapter('writer', { kind: 'claude' });
    const call = adapter.write?.({ system: 's', user: 'u', maxOutputTokens: 100 });
    const error: unknown = await call?.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ModelCallError);
    expect((error as ModelCallError).metered).toMatchObject({
      provider: 'writer',
      model: 'claude-sonnet-5-5',
      usage: { inputTokens: 100, outputTokens: 20 },
    });
  });

  it('starts a new paragraph where a search came between two pieces of text, and joins cited pieces', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'key');
    create.mockResolvedValueOnce({
      stop_reason: 'end_turn',
      content: [
        { type: 'text', text: "I'll look for sources." },
        { type: 'server_tool_use', id: 's1', name: 'web_search', input: { query: 'q' } },
        { type: 'web_search_tool_result', tool_use_id: 's1', content: [] },
        { type: 'text', text: '---\nwhy: the sources\n---\n\nA claim' },
        { type: 'text', text: ', cited.' },
      ],
      usage: { input_tokens: 100, output_tokens: 20 },
    });
    const adapter = claudeAdapter('writer', { kind: 'claude' });
    const reply = await adapter.write?.({ system: 's', user: 'u', maxOutputTokens: 100 });
    expect(reply?.text).toBe(
      "I'll look for sources.\n\n---\nwhy: the sources\n---\n\nA claim, cited.",
    );
  });

  it('lets a first-round failure through as it is, since nothing was billed', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'key');
    create.mockRejectedValueOnce(new Error('bad key'));
    const adapter = claudeAdapter('writer', { kind: 'claude' });
    const error: unknown = await adapter
      .write?.({ system: 's', user: 'u', maxOutputTokens: 100 })
      .catch((e: unknown) => e);
    expect(error).not.toBeInstanceOf(ModelCallError);
  });
});
