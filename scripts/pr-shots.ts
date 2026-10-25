// Why: a pull request that changes what a reader or the blogger sees is reviewed faster, and more honestly,
// with the same part of the page before and after the change side by side. This takes those pictures, on a
// desk and on a phone: before from the live site (what main shows), after from the branch running locally.
// With --publish it keeps them on the pr-screenshots branch, which never merges into main, so the code stays
// light, and prints the table to paste into the pull request.
// Usage:
//   npm run pr:shots -- --pr 109 --page /how-it-works --part tour=.tour [--part ...]
//     [--after http://localhost:4321] [--before https://blog.victorsaly.com] [--devices desk,phone]
//     [--wait 1500] [--publish]
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from 'playwright';

const BRANCH = 'pr-screenshots';
const devices = {
  desk: { viewport: { width: 1280, height: 900 }, isMobile: false },
  phone: { viewport: { width: 390, height: 844 }, isMobile: true },
} as const;
type Device = keyof typeof devices;

/** Every value given for a flag, in order: --part tour=.tour --part list=.list. */
function all(flag: string): string[] {
  const args = process.argv.slice(2);
  return args.flatMap((a, i) =>
    a === flag && args[i + 1] !== undefined ? [args[i + 1] ?? ''] : [],
  );
}
const one = (flag: string, fallback: string): string => all(flag)[0] ?? fallback;

const pr = one('--pr', '');
const page = one('--page', '/');
const before = one('--before', 'https://blog.victorsaly.com');
const after = one('--after', 'http://localhost:4321');
const wait = Number(one('--wait', '1500'));
const chosen = one('--devices', 'desk,phone')
  .split(',')
  .filter((d): d is Device => d in devices);
const parts = all('--part').map((p) => {
  const [name, ...selector] = p.split('=');
  return { name: name ?? 'page', selector: selector.join('=') };
});
if (!/^\d+$/.test(pr) || parts.length === 0) {
  console.error('Give the pull request and at least one part: --pr 109 --part tour=.tour');
  process.exit(1);
}

// A real path, not a URL's: a folder name with a space or an accent must not stay percent-encoded.
const root = fileURLToPath(new URL('../', import.meta.url));
const out = join(root, '.pr-shots', pr);
mkdirSync(out, { recursive: true });

/** Opens what the part sits in (or is), lets it draw, and pictures it; false when the page has no such part. */
async function picture(p: Page, selector: string, file: string): Promise<boolean> {
  const part = p.locator(selector).first();
  if ((await part.count()) === 0) return false;
  // Runs in the page; written as text because these scripts are checked without the browser's types.
  await p.evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return;
    for (let d = el.closest('details'); d; d = d.parentElement && d.parentElement.closest('details')) d.open = true;
    if (el.tagName === 'DETAILS') el.open = true;
    // A tall part is pictured in strips as the page scrolls; a sticky bar would be stamped across it.
    for (const node of document.querySelectorAll('*'))
      if (getComputedStyle(node).position === 'sticky') node.style.position = 'static';
  })()`);
  await part.scrollIntoViewIfNeeded();
  await p.waitForTimeout(wait);
  // A chart or an island inside the part may still be loading or drawing: wait for the network to go quiet
  // (GitHub never does, so not for long), then until the part's height holds for two seconds.
  await p.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined);
  let height = -1;
  for (let steady = 0, tries = 0; steady < 8 && tries < 60; tries++) {
    const now = Math.round((await part.boundingBox())?.height ?? 0);
    steady = now === height ? steady + 1 : 0;
    height = now;
    await p.waitForTimeout(250);
  }
  // A part taller than the window is pictured beyond it, where Chrome can lay a chart out at no height; so the
  // window is made tall enough to hold the whole part first.
  const size = p.viewportSize();
  if (size && height + 80 > size.height) {
    await p.setViewportSize({ width: size.width, height: height + 80 });
    await part.scrollIntoViewIfNeeded();
    await p.waitForTimeout(600);
  }
  await part.screenshot({ path: file });
  return true;
}

const browser = await chromium.launch();
const missing: string[] = [];
for (const device of chosen) {
  for (const [when, base] of [
    ['before', before],
    ['after', after],
  ] as const) {
    // A fresh page for each part, with only that part opened: a chart drawn late in another part would move it.
    for (const part of parts) {
      const p = await browser.newPage({ ...devices[device], deviceScaleFactor: 2 });
      await p.goto(`${base}${page}`, { waitUntil: 'load' });
      // The dev server's own toolbar is not part of the page.
      await p.addStyleTag({ content: 'astro-dev-toolbar { display: none !important; }' });
      // Down to the end and back once, so pictures and islands below the fold have loaded and the page has
      // stopped moving before the part is measured.
      await p.evaluate('window.scrollTo(0, document.body.scrollHeight)');
      await p.waitForTimeout(wait);
      await p.evaluate('window.scrollTo(0, 0)');
      await p.waitForTimeout(300);
      const file = join(out, `${part.name}-${device}-${when}.png`);
      // An older picture of a part that is no longer there must not pass for the current one.
      rmSync(file, { force: true });
      if (!(await picture(p, part.selector, file)))
        missing.push(`${part.name} ${when} on ${device}`);
      await p.close();
    }
  }
}
await browser.close();
console.info(`took the pictures into .pr-shots/${pr}/`);
if (missing.length > 0) console.info(`not on the page (new or removed): ${missing.join('; ')}`);

if (!process.argv.includes('--publish')) process.exit(0);

// Kept on their own branch: a temporary checkout of it, the pictures copied in, one commit, pushed.
const git = (args: string[], cwd = root): string =>
  execFileSync('git', args, { cwd, encoding: 'utf8' });
const repo = git(['remote', 'get-url', 'origin'])
  .trim()
  .replace(/\.git$/, '')
  .replace(/^git@github\.com:/, 'https://github.com/');
const slug = repo.replace('https://github.com/', '');
const place = mkdtempSync(join(tmpdir(), 'pr-shots-'));
rmSync(place, { recursive: true });
const known = git(['ls-remote', '--heads', 'origin', BRANCH]).trim() !== '';
if (known) {
  git(['fetch', 'origin', BRANCH]);
  git(['worktree', 'add', '-B', BRANCH, place, `origin/${BRANCH}`]);
} else {
  git(['worktree', 'add', '--orphan', '-b', BRANCH, place]);
  writeFileSync(
    join(place, 'README.md'),
    '# Before and after\n\nPictures for pull requests, one folder each, made by `npm run pr:shots`. This branch never merges into main.\n',
  );
}
try {
  // The pull request's folder is replaced, not added to, so a picture taken out locally goes from there too.
  rmSync(join(place, pr), { recursive: true, force: true });
  mkdirSync(join(place, pr), { recursive: true });
  cpSync(out, join(place, pr), { recursive: true });
  git(['add', '-A'], place);
  if (git(['status', '--porcelain'], place).trim() !== '') {
    git(['commit', '-m', `chore: before and after for #${pr}`], place);
    git(['push', 'origin', BRANCH], place);
  }
} finally {
  git(['worktree', 'remove', '--force', place]);
}

const url = (file: string): string =>
  `https://raw.githubusercontent.com/${slug}/${BRANCH}/${pr}/${file}`;
const files = new Set(readdirSync(out));
const lines = ['## Before and after', ''];
for (const part of parts) {
  for (const device of chosen) {
    const b = `${part.name}-${device}-before.png`;
    const a = `${part.name}-${device}-after.png`;
    if (!files.has(b) && !files.has(a)) continue;
    lines.push(`**${part.name}, ${device}**`, '', '| Before | After |', '| --- | --- |');
    const cell = (f: string): string =>
      files.has(f) ? `<img src="${url(f)}" width="420">` : '(not there)';
    lines.push(`| ${cell(b)} | ${cell(a)} |`, '');
  }
}
// A local server means the branch; anywhere else is named as it is.
const named = (base: string): string =>
  /\/\/(localhost|127\.0\.0\.1)/.test(base) ? 'this branch, run locally' : `${base}${page}`;
lines.push(`<sub>Before: ${named(before)} · After: ${named(after)} · \`npm run pr:shots\`</sub>`);
const table = lines.join('\n');
writeFileSync(join(out, 'table.md'), `${table}\n`);
console.info(`\n${table}\n`);
if (!existsSync(join(out, 'table.md'))) process.exit(1);
