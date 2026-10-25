// Why: each station of the tour on /how-it-works shows the real screen of that step, so a reader sees what
// actually happens and not only a drawing of it. The screens are taken from the live site, the public
// repository on GitHub, and the studio running locally (the live studio is behind a sign-in), and saved to
// site/src/assets/tour/<id>.png. Nothing private is shown: the studio pages taken are the ones that hold
// controls only. Take them again when a screen changes.
// Usage: npm run dev (for the studio), then npm run tour:screens [-- --studio http://localhost:4321]
import { mkdir } from 'node:fs/promises';
import { chromium, type Page } from 'playwright';

const site = 'https://blog.victorsaly.com';
const repo = 'https://github.com/victorsaly/agentic-blog';
const proof = '2026-10-23-productive-friction-counts-evidence';
const first = '2026-10-23-talked-out-loud-tidied-by-ai';
const at = process.argv.indexOf('--studio');
const studio = at > 0 ? (process.argv[at + 1] ?? '') : 'http://localhost:4321';
const out = new URL('../site/src/assets/tour/', import.meta.url).pathname;

interface Screen {
  /** The station's id in site/src/lib/tour.ts. */
  id: string;
  url: string;
  /** Anything to do before the picture: open a tab, pick a thought, play a few words. */
  prepare?: (page: Page) => Promise<void>;
  /** Picture only this element, from its top, at most one screen tall. */
  only?: string;
}

const screens: Screen[] = [
  { id: 'studio', url: `${studio}/studio/talk` },
  { id: 'origin', url: `${site}/thoughts/${proof}/origin` },
  {
    id: 'interview',
    url: `${repo}/blob/main/thoughts/${proof}/interview.md`,
    only: 'article.markdown-body',
  },
  { id: 'structure', url: `${site}/thoughts/${proof}` },
  { id: 'makers', url: `${site}/thoughts/${proof}#the-bar-is-raising` },
  {
    id: 'gates',
    url: `${repo}/blob/main/thoughts/${proof}/safety.md`,
    only: 'article.markdown-body',
  },
  {
    id: 'publish',
    url: `${site}/thoughts/${proof}`,
    // A few words in, paused, so the word being said is underlined as a reader would see it.
    prepare: async (page) => {
      await page.locator('[data-read-along] [data-play]').click();
      await page.waitForTimeout(2500);
      await page.locator('[data-read-along] [data-play]').click();
      await page.locator('[data-read-along]').scrollIntoViewIfNeeded();
      await page.mouse.wheel(0, -120);
    },
  },
  { id: 'you', url: `${repo}/pull/84` },
  {
    id: 'feedback',
    url: `${studio}/studio/feedback`,
    prepare: async (page) => {
      await page.locator('select').first().selectOption({ index: 1 });
    },
  },
  { id: 'close', url: `${site}/thoughts/${first}` },
];

const width = 1280;
const height = 800;
const browser = await chromium.launch();
await mkdir(out, { recursive: true });
for (const s of screens) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1.5 });
  // GitHub keeps a connection open, so the page is taken once it has loaded and what is pictured is there.
  await page.goto(s.url, { waitUntil: 'load' });
  if (s.only) await page.locator(s.only).first().waitFor();
  await page.waitForTimeout(1500);
  // The dev server's own toolbar is not part of the studio.
  await page.addStyleTag({ content: 'astro-dev-toolbar { display: none !important; }' });
  await s.prepare?.(page);
  await page.waitForTimeout(600);
  const file = `${out}${s.id}.png`;
  if (s.only) {
    const box = await page.locator(s.only).first().boundingBox();
    if (!box) throw new Error(`${s.id}: ${s.only} is not on ${s.url}`);
    await page.screenshot({
      path: file,
      fullPage: true,
      clip: {
        x: box.x - 24,
        y: box.y - 24,
        width: box.width + 48,
        height: Math.min(box.height + 48, height),
      },
    });
  } else await page.screenshot({ path: file });
  console.info(`took  ${s.id}.png  ${s.url}`);
  await page.close();
}
await browser.close();
