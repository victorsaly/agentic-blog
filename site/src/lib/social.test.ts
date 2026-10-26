// Why: the picture a shared link shows comes from these; a wrong one shows on every LinkedIn post.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CARD, cardPath, postShareImage, shareCard } from './social.js';

const cover = { src: '/_astro/cover.png', width: 1024, height: 1024, alt: 'A hand holds a phone.' };

describe('shareCard', () => {
  it('finds a card that has been drawn, at the size previews use', () => {
    const dir = mkdtempSync(join(tmpdir(), 'social-'));
    mkdirSync(join(dir, 'social'));
    writeFileSync(join(dir, cardPath('a-post')), '');
    expect(shareCard('a-post', 'A post', dir)).toEqual({
      src: '/social/a-post.png',
      alt: 'A post',
      width: CARD.width,
      height: CARD.height,
      type: 'image/png',
    });
  });

  it('gives nothing for a card not drawn yet', () => {
    const dir = mkdtempSync(join(tmpdir(), 'social-'));
    expect(shareCard('missing', 'Missing', dir)).toBeUndefined();
  });
});

describe('postShareImage', () => {
  const card = { src: '/social/p.png', alt: 'P', ...CARD, type: 'image/png' as const };

  it('prefers the card over the cover', () => {
    expect(postShareImage(card, cover)).toBe(card);
  });

  it('falls back to the cover print, at its own size', () => {
    expect(postShareImage(undefined, cover)).toEqual({ ...cover, type: 'image/png' });
  });

  it('gives nothing when there is neither, so the site card stands in', () => {
    expect(postShareImage(undefined, undefined)).toBeUndefined();
  });
});
