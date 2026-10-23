// Why: see PROMPT.md. Two checks in one file: npm's advisories for the repo, and every version and source
// read for other people's data and secrets. A hold fails the check, like safety.
import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import matter from 'gray-matter';
import { askForFile, readIfPresent, userMessage } from '../_lib/generic.js';
import type { AgentRun } from '../_lib/types.js';

const exec = promisify(execFile);

/** npm audit exits non-zero when it finds something, so the output is read from the error too. */
async function audit(repo: string): Promise<string> {
  const raw = await exec('npm', ['audit', '--json', '--omit=dev'], {
    cwd: repo,
    maxBuffer: 20 * 1024 * 1024,
  })
    .then((r) => r.stdout)
    .catch((error: unknown) =>
      typeof error === 'object' && error !== null && 'stdout' in error ? String(error.stdout) : '',
    );
  try {
    const data = JSON.parse(raw) as {
      vulnerabilities?: Record<string, { severity: string; fixAvailable: unknown; via: unknown[] }>;
    };
    const rows = Object.entries(data.vulnerabilities ?? {}).map(
      ([name, v]) =>
        `${name}: ${v.severity}, fix ${v.fixAvailable === false ? 'not available' : 'available'}`,
    );
    return rows.length > 0
      ? rows.join('\n')
      : 'npm audit found no advisories for production dependencies.';
  } catch {
    return 'npm audit did not run; say so in the file.';
  }
}

export const run: AgentRun = async (ctx) => {
  const versions = [...ctx.thought.files.entries()].filter(([path]) =>
    path.startsWith('versions/'),
  );
  if (versions.length === 0)
    return { status: 'nothing-to-do', summary: 'No versions to check yet.', files: [] };

  const message = userMessage(
    {
      ...Object.fromEntries(versions.map(([path, c]) => [path.replace(/[^a-z0-9]/gi, '_'), c])),
      sources: readIfPresent(ctx, 'sources.md'),
      structure: readIfPresent(ctx, 'structure.md'),
      npm_audit: await audit(resolve(ctx.thought.dir, '..', '..')),
    },
    `Today is ${ctx.today}. Do the publish check as the prompt describes, include the npm audit result as a short section, and write security.md.`,
  );
  const file = await askForFile(ctx, message, 'security.md');
  const verdict: unknown = matter(file.content).data['verdict'];
  if (verdict === 'hold')
    return {
      status: 'held',
      summary: 'Security check found data to confirm before publishing.',
      files: [file],
      holdReason: file.content,
    };
  if (verdict !== 'pass')
    throw new Error(`security verdict must be pass or hold, got ${String(verdict)}`);
  return { status: 'done', summary: 'Security check passed.', files: [file] };
};
