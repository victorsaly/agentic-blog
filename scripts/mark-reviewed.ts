// Why: the review workflow's one step. It takes the files Victor marked in the studio, checks each again
// (the dispatch payload is input like any other), turns `reviewed: false` to `true` in its front matter and
// nothing else, and tells the workflow what to call the pull request. Files already reviewed are left alone.
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { markReviewed, readReviewRequest } from '../site/src/lib/review.js';

async function main(): Promise<void> {
  const payload: unknown = JSON.parse(process.env['PAYLOAD'] ?? 'null');
  const asked = readReviewRequest(payload);
  if (!asked.ok) throw new Error(asked.error);
  const by =
    typeof payload === 'object' &&
    payload !== null &&
    typeof (payload as { by?: unknown }).by === 'string'
      ? (payload as { by: string }).by
      : 'the studio';

  const root = resolve(import.meta.dirname, '..');
  const marked: string[] = [];
  for (const file of asked.files) {
    const before = await readFile(resolve(root, file), 'utf8').catch(() => null);
    if (before === null) {
      console.info(`skipped ${file}: no such file`);
      continue;
    }
    const after = markReviewed(before);
    if (after === null) {
      console.info(`skipped ${file}: already reviewed`);
      continue;
    }
    await writeFile(resolve(root, file), after, 'utf8');
    marked.push(file);
  }

  const stamp = new Date().toISOString().replaceAll(/[:.]/g, '-').slice(0, 19);
  const title =
    marked.length === 1
      ? `content: reviewed ${marked[0] ?? ''}`
      : `content: reviewed ${String(marked.length)} files`;
  const body = [
    `Marked reviewed in the studio by ${by}. Only the \`reviewed\` flag changed in each file.`,
    '',
    ...marked.map((f) => `- \`${f}\``),
    '',
    'Merging takes the "Not reviewed yet" tag off these versions (or shows these sources and plays these recordings) on the next deploy.',
  ].join('\n');
  const output = process.env['GITHUB_OUTPUT'];
  if (output)
    await appendFile(
      output,
      `branch=review/${stamp}\ntitle=${title}\nchanged=${String(marked.length)}\nbody<<EOF\n${body}\nEOF\n`,
    );
  console.info(marked.length > 0 ? `marked ${marked.join(', ')}` : 'nothing to mark');
}

await main();
