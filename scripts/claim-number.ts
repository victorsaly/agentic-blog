// Why: two approvals at the same moment must never give two posts one number. The remote decides: a number is
// claimed by pushing the tag number/N, which git refuses when it is there already, so only one push wins and
// the other takes the next. This is the git side of it, apart from the gate, so a real race is tested.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { type Claim, claimsFrom, nextNumber } from './gate-answer';

const git = promisify(execFile);

/** The numbers already claimed, as the number/N tags fetched into this checkout. */
export async function claimsIn(checkout: string): Promise<Claim[]> {
  const format = '--format=%(refname:strip=3) %(contents:subject)';
  const listed = await git('git', ['for-each-ref', format, 'refs/tags/number'], { cwd: checkout });
  return claimsFrom(listed.stdout);
}

/**
 * Claims the lowest number not taken for this thought, by pushing its tag to the remote. When the push fails,
 * the remote is asked whether the tag is there now: then the number is someone's and the next is tried. Asked
 * rather than read from git's message, which differs when two pushes meet on the server. Any other failure is
 * thrown, never guessed past.
 */
export async function claimNumber(
  checkout: string,
  remote: string,
  thought: string,
  taken: readonly number[],
): Promise<number> {
  const opts = { cwd: checkout };
  const bot = [
    '-c',
    'user.name=agentic-blog[bot]',
    '-c',
    'user.email=agentic-blog[bot]@users.noreply.github.com',
  ];
  const held = [...taken];
  for (let tries = 0; tries < 20; tries++) {
    const tried = nextNumber(held);
    const tag = `number/${String(tried)}`;
    await git('git', [...bot, 'tag', '-a', tag, '-m', thought, 'HEAD'], opts);
    try {
      await git('git', ['push', '--quiet', remote, `refs/tags/${tag}`], opts);
      return tried;
    } catch (error: unknown) {
      await git('git', ['tag', '-d', tag], opts);
      const there = await git('git', ['ls-remote', '--tags', remote, `refs/tags/${tag}`], opts);
      if (there.stdout.trim() === '') throw error;
      held.push(tried);
    }
  }
  throw new Error(`No free number claimed for ${thought} in 20 tries.`);
}
