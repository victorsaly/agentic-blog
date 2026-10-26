// Why: a shared link is often how a reader first meets a post, and the preview LinkedIn, X or Slack draws
// is 1200×630. A square cover print alone is cropped into it; this draws a card for each published thought
// instead: its title, its message marked once in marigold, and its cover print on the right, in the site's
// own type and tokens, so the preview is the post's front page in miniature. The site's own card, the
// newest cover with the name and the tagline, is what every other page shares. The cards are committed to
// site/public/social, so a build never needs a browser; draw them again when a title, a message or a cover
// changes, and name thoughts to draw only those.
// Usage: npm run social:cards [-- <thought-slug> ...]
import { mkdir, readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { chromium } from 'playwright';
import { structureFrontMatter } from './content-schema.js';
import { coverOf, picturesFrom } from '../site/src/lib/pictures.js';
import { newestFirst, splitFirstSentence } from '../site/src/lib/content.js';
import { CARD, cardPath } from '../site/src/lib/social.js';

const root = new URL('..', import.meta.url).pathname;
const thoughtsDir = join(root, 'thoughts');
const out = join(root, 'site', 'public');
const asked = process.argv.slice(2);
const settings = parse(await readFile(join(root, 'settings.yml'), 'utf8')) as {
  site: { name: string; domain: string; tagline: string };
};
const tokens = await readFile(join(root, 'site/src/styles/tokens.css'), 'utf8');

interface Card {
  name: string;
  label: string;
  title: string;
  message: string;
  print: string;
}

function frontMatter(text: string): unknown {
  const match = /^---\n([\s\S]*?)\n---/.exec(text);
  return match?.[1] ? parse(match[1]) : undefined;
}

const escape = (text: string) =>
  text.replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c,
  );

async function dataUrl(file: string): Promise<string> {
  return `data:image/png;base64,${(await readFile(file)).toString('base64')}`;
}

/** Every published thought with a drawn cover, newest first, in the home page's order. */
async function thoughtCards(): Promise<(Card & { data: { date: Date; number?: number } })[]> {
  const cards: (Card & { data: { date: Date; number?: number } })[] = [];
  for (const slug of await readdir(thoughtsDir)) {
    const structure = join(thoughtsDir, slug, 'structure.md');
    const prompts = join(thoughtsDir, slug, 'image', 'prompts.md');
    if (!existsSync(structure) || !existsSync(prompts)) continue;
    const data = structureFrontMatter.parse(frontMatter(await readFile(structure, 'utf8')));
    if (data.draft) continue;
    const cover = coverOf(picturesFrom(frontMatter(await readFile(prompts, 'utf8'))));
    const print = cover && join(thoughtsDir, slug, cover.file);
    if (!print || !existsSync(print)) continue;
    cards.push({
      name: slug,
      label: data.number ? `${settings.site.name} · No. ${data.number}` : settings.site.name,
      title: data.title,
      message: splitFirstSentence(data.message).first,
      print,
      data: { date: new Date(data.date), ...(data.number ? { number: data.number } : {}) },
    });
  }
  return cards.sort(newestFirst);
}

async function html(card: Card): Promise<string> {
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=block">
<style>${tokens}
  * { box-sizing: border-box; margin: 0; }
  body { width: ${CARD.width}px; height: ${CARD.height}px; background: var(--paper); color: var(--ink);
    font-family: var(--font-read); display: grid; grid-template-columns: 1fr ${CARD.height}px; overflow: hidden; }
  .text { display: flex; flex-direction: column; padding: 48px 56px 40px; border-top: var(--rule-heavy) solid var(--ink); }
  .label { font-size: 22px; font-weight: 700; letter-spacing: var(--tracking-label); text-transform: uppercase;
    padding-bottom: 12px; border-bottom: var(--rule-strong) solid var(--ink); }
  .fit { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 28px; overflow: hidden; }
  h1 { font-size: 72px; line-height: 1.05; text-wrap: balance; letter-spacing: var(--tracking-display); font-weight: 700; }
  p.message { font-size: 30px; line-height: var(--leading-tight); text-wrap: pretty; }
  mark { background: var(--mark); color: var(--mark-ink); padding: 0 0.15em; box-decoration-break: clone;
    -webkit-box-decoration-break: clone; }
  .domain { font-size: 22px; color: var(--quiet); padding-top: 12px; border-top: var(--rule-width) solid var(--rule); }
  img { width: ${CARD.height}px; height: ${CARD.height}px; object-fit: cover; display: block; }
</style></head><body>
  <div class="text">
    <p class="label">${escape(card.label)}</p>
    <div class="fit"><h1>${escape(card.title)}</h1><p class="message"><mark>${escape(card.message)}</mark></p></div>
    <p class="domain">${escape(settings.site.domain)}</p>
  </div>
  <img src="${await dataUrl(card.print)}" alt="">
  <script>
    // A long title steps down until the title and the message fit between the label and the address.
    document.fonts.ready.then(() => {
      const fit = document.querySelector('.fit');
      const title = document.querySelector('h1');
      const message = document.querySelector('p.message');
      for (let size = 68; size > 40 && fit.scrollHeight > fit.clientHeight; size -= 4) {
        title.style.fontSize = size + 'px';
        message.style.fontSize = Math.max(22, Math.round(size * 0.42)) + 'px';
      }
      document.body.dataset.fitted = 'yes';
    });
  </script>
</body></html>`;
}

const thoughts = await thoughtCards();
const newest = thoughts[0];
const cards: Card[] = [
  ...(newest && asked.length === 0
    ? [
        {
          name: 'site',
          label: 'Blog',
          title: settings.site.name,
          message: settings.site.tagline,
          print: newest.print,
        },
      ]
    : []),
  ...thoughts.filter((t) => asked.length === 0 || asked.includes(t.name)),
];

// CHROMIUM_PATH: for a machine whose browser is not the one this Playwright downloads.
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
await mkdir(join(out, 'social'), { recursive: true });
for (const card of cards) {
  const page = await browser.newPage({ viewport: CARD, deviceScaleFactor: 1 });
  await page.setContent(await html(card), { waitUntil: 'networkidle' });
  await page.waitForFunction('document.body.dataset.fitted === "yes"');
  const file = join(out, cardPath(card.name));
  await page.screenshot({ path: file, type: 'png' });
  await page.close();
  console.info(`  site/public${cardPath(card.name)}`);
}
await browser.close();
