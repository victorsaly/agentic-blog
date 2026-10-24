// Why: the Workers AI drawer must call the model the project declared, with the key it named, and must
// keep a charged picture's cost even when its answer cannot be read. Fetch is stubbed; nothing is spent.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FLUX_NEURONS } from './prices.js';
import { workersAiAdapter } from './workers-ai.js';

const FLUX = '@cf/black-forest-labs/flux-1-schnell';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('workersAiAdapter', () => {
  it('draws with drawModel, not the transcription model', () => {
    const adapter = workersAiAdapter('workers', {
      kind: 'workers-ai',
      model: '@cf/openai/whisper-large-v3-turbo',
      drawModel: FLUX,
    });
    expect(adapter.models()).toEqual([FLUX]);
  });

  it('uses the secret the provider names', () => {
    vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', 'acct');
    vi.stubEnv('CLOUDFLARE_AI_TOKEN', '');
    vi.stubEnv('CLOUDFLARE_API_KEY', '');
    vi.stubEnv('MY_CF_TOKEN', 'token');
    expect(
      workersAiAdapter('workers', { kind: 'workers-ai', secret: 'MY_CF_TOKEN' }).available(),
    ).toBe(true);
    expect(workersAiAdapter('workers', { kind: 'workers-ai' }).available()).toBe(false);
  });

  it('makes no call to a drawing model whose neurons it cannot count', async () => {
    vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', 'acct');
    vi.stubEnv('CLOUDFLARE_AI_TOKEN', 'token');
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const reply = await workersAiAdapter('workers', {
      kind: 'workers-ai',
      drawModel: '@cf/new/painter',
    }).draw?.({ prompt: 'a door' });
    expect(reply?.ok).toBe(false);
    expect(reply?.usage).toEqual({});
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps the cost of a charged picture whose answer cannot be read', async () => {
    vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', 'acct');
    vi.stubEnv('CLOUDFLARE_AI_TOKEN', 'token');
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('not json', { status: 200 }))),
    );
    const reply = await workersAiAdapter('workers', { kind: 'workers-ai' }).draw?.({
      prompt: 'a door',
    });
    expect(reply).toMatchObject({ ok: false, model: FLUX, usage: { neurons: FLUX_NEURONS } });
  });
});
