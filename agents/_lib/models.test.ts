// Why: this decides which provider every agent call goes to and makes sure each call's usage is logged;
// these use stand-in adapters, so no provider is called and nothing is spent.
import { describe, expect, it } from 'vitest';
import { ModelCallError, UsageLog, type ModelAdapter } from '@roadbook/core';
import { adapterFor, choose, connect, unpriced } from './models.js';

function writer(name: string, fail = false): ModelAdapter {
  return {
    provider: name,
    available: () => true,
    models: () => ['claude-sonnet-5-5'],
    write: (request) => {
      const metered = {
        provider: name,
        model: request.model ?? 'claude-sonnet-5-5',
        usage: { inputTokens: 10, outputTokens: 2 },
      };
      return fail
        ? Promise.reject(new ModelCallError('declined', metered))
        : Promise.resolve({ ...metered, text: `answer to ${request.user}` });
    },
  };
}

function drawer(name: string, available: boolean, model = 'gpt-image-2'): ModelAdapter {
  return {
    provider: name,
    available: () => available,
    models: () => [model],
    draw: () =>
      Promise.resolve({
        provider: name,
        model,
        usage: { imageOutputTokens: 4000 },
        ok: true,
        png: new Uint8Array([1]),
      }),
  };
}

const defaults = { system: 's', model: 'claude-sonnet-5-5', maxOutputTokens: 100 };

describe('choose', () => {
  it('draws with the first provider set up here, in the card order, and writes with the project writer', async () => {
    const adapters = new Map([
      ['writer', writer('writer')],
      ['images', drawer('images', false)],
      ['workers', drawer('workers', true, '@cf/black-forest-labs/flux-1-schnell')],
    ]);
    const chosen = choose(
      { model: { default: 'images', allowed: ['images', 'workers'] } },
      adapters,
    );
    expect(chosen.writer.provider).toBe('writer');
    const log = new UsageLog();
    const picture = await connect(chosen, log, defaults).draw('a door');
    expect(picture.provider).toBe('workers');
    expect(log.totals()).toEqual([
      {
        provider: 'workers',
        model: '@cf/black-forest-labs/flux-1-schnell',
        usage: { imageOutputTokens: 4000 },
      },
    ]);
  });

  it('refuses a card that names a provider the project does not declare', () => {
    expect(() => choose({ model: { default: 'ghost', allowed: ['ghost'] } }, new Map())).toThrow(
      'the card names provider "ghost"',
    );
  });
});

describe('connect', () => {
  it('logs what a call used, even when the call failed after being charged', async () => {
    const log = new UsageLog();
    const ok = connect({ writer: writer('writer'), drawers: [] }, log, defaults);
    expect(await ok.ask('why?')).toBe('answer to why?');
    const failing = connect({ writer: writer('writer', true), drawers: [] }, log, defaults);
    await expect(failing.ask('why?')).rejects.toThrow('declined');
    expect(log.totals()).toEqual([
      {
        provider: 'writer',
        model: 'claude-sonnet-5-5',
        usage: { inputTokens: 20, outputTokens: 4 },
      },
    ]);
  });

  it('makes no call to a model it cannot price, and says when nothing can draw', async () => {
    const calls = connect(
      { writer: writer('writer'), drawers: [drawer('images', false)] },
      new UsageLog(),
      defaults,
    );
    await expect(calls.ask('why?', { model: 'some-new-model' })).rejects.toThrow(
      'no price for some-new-model',
    );
    const none = await calls.draw('a door');
    expect(none.ok).toBe(false);
    expect(
      unpriced(
        { writer: writer('writer'), drawers: [drawer('images', true, 'new-painter')] },
        'claude-sonnet-5-5',
      ),
    ).toEqual(['new-painter']);
  });
});

describe('adapterFor', () => {
  it('has an adapter for each kind the blog uses, and says so for one it lacks', () => {
    expect(adapterFor('writer', { kind: 'claude' }).write).toBeDefined();
    expect(adapterFor('images', { kind: 'openai-images' }).draw).toBeDefined();
    expect(adapterFor('workers', { kind: 'workers-ai' }).draw).toBeDefined();
    expect(() => adapterFor('g', { kind: 'gemini' })).toThrow('which has no adapter yet');
  });
});
