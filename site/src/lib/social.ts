// Why: a shared link is often the first time someone meets a post, and a preview with no picture reads as a
// bare URL. Each post has a share card (its title, its message and its cover print, drawn by
// scripts/social-cards.ts into public/social); a post without one yet shares its cover, and every other
// page shares the site's own card. The rule for which picture a page shares lives here once.
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** The size LinkedIn, X, Slack and the rest draw a large preview at. */
export const CARD = { width: 1200, height: 630 } as const;

export interface ShareImage {
  /** Absolute, or from the site's root; the layout makes it absolute. */
  src: string;
  alt: string;
  width: number;
  height: number;
  type: 'image/png' | 'image/jpeg';
}

/** The address a card is served at: "site" for the site's own, a thought's slug for a post's. */
export function cardPath(name: string): string {
  return `/social/${name}.png`;
}

/** The card called `name`, if scripts/social-cards.ts has drawn it into `publicDir`. */
export function shareCard(name: string, alt: string, publicDir: string): ShareImage | undefined {
  const src = cardPath(name);
  if (!existsSync(join(publicDir, src))) return undefined;
  return { src, alt, ...CARD, type: 'image/png' };
}

/** What a post shares: its card, else its cover print, else nothing (the layout falls back to the site's). */
export function postShareImage(
  card: ShareImage | undefined,
  cover: { src: string; width: number; height: number; alt: string } | undefined,
): ShareImage | undefined {
  if (card) return card;
  if (!cover) return undefined;
  return { ...cover, type: 'image/png' };
}
