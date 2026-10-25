// Why: which versions get written is decided by settings.yml, and a wrong reading of it would silently
// skip a language or double the origin language. This pins that logic down without calling any model.
import { describe, expect, it } from 'vitest';
import { targetsFor } from './index.js';
import type { AgentContext } from '../_lib/types.js';

function contextWith(languages: string[], social: string[]): AgentContext {
  return {
    agent: 'convert',
    prompt: {
      meta: { name: 'convert', why: 'x'.repeat(20), phase: 2, reads: ['a'], writes: ['b'] },
      instructions: '',
    },
    settings: {
      site: { name: '', domain: '', tagline: '', author: '', email: 'a@b.c', timezone: 'UTC' },
      languages: { origin: 'en', publish: languages },
      themes: ['t'],
      depths: ['message', 'idea', 'road'],
      publishing: { index: false, badge_text: '', social },
      licence: { code: 'MIT', content: 'x' },
      media: { audio_bucket: 'b', image_style: 's', voice_id: null },
      agents: { model: 'm', max_output_tokens: 1, review_required: true },
    },
    profile: '',
    thought: { slug: 's', dir: '/tmp/s', files: new Map() },
    ask: () => Promise.resolve(''),
    draw: () =>
      Promise.resolve({
        provider: 'none',
        model: 'none',
        usage: {},
        ok: false,
        reason: 'not in a test',
      }),
    speak: () => Promise.reject(new Error('convert speaks nothing')),
    today: '2026-10-23',
  };
}

describe('targetsFor', () => {
  it('always writes short and long in the origin language', () => {
    const paths = targetsFor(contextWith(['en'], [])).map((t) => t.path);
    expect(paths).toEqual(['versions/short.md', 'versions/long.md']);
  });

  it('adds linkedin only when the social list asks for it', () => {
    expect(targetsFor(contextWith(['en'], ['linkedin'])).some((t) => t.kind === 'linkedin')).toBe(
      true,
    );
    expect(targetsFor(contextWith(['en'], [])).some((t) => t.kind === 'linkedin')).toBe(false);
  });

  it('adds one language version per publish language other than the origin', () => {
    const targets = targetsFor(contextWith(['en', 'es', 'pt'], []));
    expect(targets.filter((t) => t.kind === 'language').map((t) => t.path)).toEqual([
      'versions/es.md',
      'versions/pt.md',
    ]);
  });
});
