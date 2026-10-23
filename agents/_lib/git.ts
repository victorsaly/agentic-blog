// Why: two agents learn from history (profile from the blogger's edits, publish from which agents ran).
// Reading git is a side effect, so it lives here, at the edge, and fails soft: no history is not an error.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

export async function git(cwd: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await run('git', args, { cwd, maxBuffer: 10 * 1024 * 1024 });
    return stdout.trim();
  } catch {
    return '';
  }
}

/**
 * What the blogger changed in the versions after an agent wrote them: the diff from the last commit an
 * agent made to versions/ to the working tree. Empty when nobody has edited them yet.
 */
export async function reviewDiff(repo: string, slug: string): Promise<string> {
  const path = `thoughts/${slug}/versions`;
  const lastAgent = await git(repo, ['log', '-1', '--format=%H', '--grep=^agent(', '--', path]);
  if (lastAgent === '') return '';
  return git(repo, ['diff', lastAgent, '--', path]);
}

/** Which agents ran on this thought, oldest first, from the commit subjects the workflow writes. */
export async function agentHistory(repo: string, slug: string): Promise<string> {
  return git(repo, [
    'log',
    '--reverse',
    '--date=short',
    '--format=%ad %s',
    '--grep=^agent(',
    '--',
    `thoughts/${slug}`,
  ]);
}
