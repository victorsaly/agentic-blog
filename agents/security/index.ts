// Why: see PROMPT.md. Two checks in one file: npm's advisories for the repo, and every version and source
// read for other people's data and secrets. A hold fails the check, like safety. The model quotes what it
// would hold; the verdict is set in code, which releases only the passages the blogger chose to keep.
import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { askForFile, readIfPresent, userMessage } from '../_lib/generic.js';
import type { AgentContext, AgentRun } from '../_lib/types.js';
import { decisionIn, finalFile } from './decision.js';

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

export interface SecurityDeps {
  /** npm's advisories for the repo, one line each. */
  audit: (ctx: AgentContext) => Promise<string>;
}

export function makeRun(deps: SecurityDeps): AgentRun {
  return async (ctx) => {
    const versions = [...ctx.thought.files.entries()].filter(([path]) =>
      path.startsWith('versions/'),
    );
    if (versions.length === 0)
      return { status: 'nothing-to-do', summary: 'No versions to check yet.', files: [] };

    const decision = decisionIn(readIfPresent(ctx, 'security.md'));
    const kept = decision
      ? [
          `${decision.decidedBy} decided on ${decision.decided} to keep these passages, exactly as quoted:`,
          ...decision.kept.map((k) => `- "${k}"`),
        ].join('\n')
      : undefined;
    const message = userMessage(
      {
        ...Object.fromEntries(versions.map(([path, c]) => [path.replace(/[^a-z0-9]/gi, '_'), c])),
        sources: readIfPresent(ctx, 'sources.md'),
        structure: readIfPresent(ctx, 'structure.md'),
        kept_by_the_blogger: kept,
        npm_audit: await deps.audit(ctx),
      },
      `Today is ${ctx.today}. Do the publish check as the prompt describes, include the npm audit result as a short section, and write security.md.`,
    );
    const reply = await askForFile(ctx, message, 'security.md');
    const { content, verdict } = finalFile(reply.content, decision);
    const file = { path: 'security.md', content };
    if (verdict.verdict === 'hold')
      return {
        status: 'held',
        summary:
          verdict.released.length > 0
            ? `Security check found data to confirm before publishing (${String(verdict.released.length)} passage(s) kept by ${decision?.decidedBy ?? 'the blogger'} were not held again).`
            : 'Security check found data to confirm before publishing.',
        files: [file],
        holdReason: content,
      };
    return {
      status: 'done',
      summary:
        verdict.released.length > 0 && decision
          ? `Security check passed: every passage it would hold is one ${decision.decidedBy} chose to keep on ${decision.decided}.`
          : 'Security check passed.',
      files: [file],
    };
  };
}

export const run: AgentRun = makeRun({
  audit: (ctx) => audit(resolve(ctx.thought.dir, '..', '..')),
});
