// Why: the chat's rules have unit tests, but a right answer needs a real model, and a real model costs money
// and can change. So a short set of real questions, each with what its answer must contain, link to or
// avoid, is asked on request (never in CI) against the live site or a local build, and the table says what
// held. The cases live in site/src/lib/ask.eval.json. Each question is one Claude call on the blogger's key,
// paced to the chat's own burst limit.
// Usage: npm run ask:eval [-- --at https://blog.victorsaly.com] [--only "part of a name"] [--pace 13000]
import { readFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';

interface Turn {
  question: string;
  answer: string;
}
interface Case {
  name: string;
  question: string;
  post?: string;
  history?: Turn[];
  /** Regular expressions (case-insensitive) the answer must match, every one. */
  mentions?: string[];
  /** Regular expressions the answer must not match. */
  avoids?: string[];
  /** The answer must link to at least one place whose address starts with one of these. */
  links?: string[];
  maxWords?: number;
}
interface Reply {
  answer?: unknown;
  places?: unknown;
  error?: unknown;
}

const arg = (flag: string, fallback: string): string => {
  const at = process.argv.indexOf(flag);
  return at > 0 ? (process.argv[at + 1] ?? fallback) : fallback;
};
const base = arg('--at', 'https://blog.victorsaly.com').replace(/\/$/, '');
const only = arg('--only', '').toLowerCase();
const pace = Number(arg('--pace', '13000'));

const file = new URL('../site/src/lib/ask.eval.json', import.meta.url);
const { cases } = JSON.parse(await readFile(file, 'utf8')) as { cases: Case[] };
const chosen = cases.filter((c) => c.name.toLowerCase().includes(only));
if (chosen.length === 0) {
  console.error(`No case matches "${only}".`);
  process.exit(1);
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

let failed = 0;
console.info(`Asking ${String(chosen.length)} question(s) at ${base}/ask\n`);
for (const [i, c] of chosen.entries()) {
  if (i > 0) await sleep(pace);
  const started = Date.now();
  const response = await fetch(`${base}/ask`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      question: c.question,
      ...(c.post ? { post: c.post } : {}),
      ...(c.history ? { history: c.history } : {}),
    }),
  });
  const reply = (await response.json().catch(() => ({}))) as Reply;
  const answer = typeof reply.answer === 'string' ? reply.answer : '';
  const places = Array.isArray(reply.places)
    ? reply.places.flatMap((p) => (isRecord(p) && typeof p['href'] === 'string' ? [p['href']] : []))
    : [];
  const seconds = ((Date.now() - started) / 1000).toFixed(1);

  const problems: string[] = [];
  if (!response.ok)
    problems.push(
      `HTTP ${String(response.status)}: ${typeof reply.error === 'string' ? reply.error : ''}`,
    );
  for (const m of c.mentions ?? [])
    if (!new RegExp(m, 'i').test(answer)) problems.push(`does not mention /${m}/`);
  for (const a of c.avoids ?? [])
    if (new RegExp(a, 'i').test(answer)) problems.push(`should not say /${a}/`);
  if (c.links && !places.some((p) => c.links?.some((l) => p.startsWith(l))))
    problems.push(`links to none of ${c.links.join(', ')} (got ${places.join(', ') || 'no link'})`);
  const words = answer.split(/\s+/).filter(Boolean).length;
  if (words > (c.maxWords ?? 180))
    problems.push(`${String(words)} words, over ${String(c.maxWords ?? 180)}`);

  const mark = problems.length === 0 ? 'pass' : 'FAIL';
  if (problems.length > 0) failed += 1;
  console.info(`${mark}  ${c.name}  (${seconds}s)`);
  for (const p of problems) console.info(`      ${p}`);
  console.info(
    `      ${answer.replace(/\s+/g, ' ').slice(0, 220)}${answer.length > 220 ? '…' : ''}\n`,
  );
}
console.info(`${String(chosen.length - failed)} of ${String(chosen.length)} held.`);
process.exit(failed === 0 ? 0 : 1);
