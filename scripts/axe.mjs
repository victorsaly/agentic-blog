// Why: accessibility is the floor, so every built page is audited with axe-core on every pull request.
// Usage: node scripts/axe.mjs http://localhost:4321  (after `serve site/dist -l 4321`)
import { readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';

const base = process.argv[2] ?? 'http://localhost:4321';
const dist = new URL('../site/dist', import.meta.url).pathname;

async function htmlFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((e) =>
      e.isDirectory()
        ? htmlFiles(join(dir, e.name))
        : e.name.endsWith('.html')
          ? [join(dir, e.name)]
          : [],
    ),
  );
  return nested.flat();
}

const pages = (await htmlFiles(dist)).map((file) => {
  const path = relative(dist, file)
    .replace(/index\.html$/, '')
    .replace(/\.html$/, '');
  return `${base}/${path}`.replace(/\/$/, '') || base;
});

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
let failures = 0;

for (const url of pages) {
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
    .analyze();
  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  if (serious.length > 0) {
    failures += serious.length;
    console.error(`\n${url}`);
    for (const v of serious) {
      console.error(`  ${v.id} (${v.impact}): ${v.help}`);
      for (const node of v.nodes.slice(0, 3)) console.error(`    ${node.target.join(' ')}`);
    }
  } else {
    console.info(`ok  ${url}`);
  }
  await page.close();
}

await browser.close();
if (failures > 0) {
  console.error(`\n${String(failures)} serious or critical accessibility problem(s).`);
  process.exitCode = 1;
} else {
  console.info(`\nEvery page passed: ${String(pages.length)} checked at phone width.`);
}
