// Why: the claim is what stops two approvals giving two posts one number, so it is tested against a real git
// remote, with both approvals racing from checkouts that have not seen each other's claim.
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { claimNumber, claimsIn } from './claim-number';

const git = promisify(execFile);
const dirs: string[] = [];

/** A bare remote and two clones of it, each with a commit to tag. */
async function remoteAndTwoCheckouts(): Promise<{ remote: string; a: string; b: string }> {
  const base = await mkdtemp(join(tmpdir(), 'claim-number-'));
  dirs.push(base);
  const remote = join(base, 'remote.git');
  await git('git', ['init', '--quiet', '--bare', remote]);
  const checkouts = await Promise.all(
    ['a', 'b'].map(async (name) => {
      const dir = join(base, name);
      await git('git', ['clone', '--quiet', remote, dir]);
      const who = ['-c', 'user.name=t', '-c', 'user.email=t@example.com'];
      await git('git', [...who, 'commit', '--quiet', '--allow-empty', '-m', name], { cwd: dir });
      return dir;
    }),
  );
  return { remote, a: checkouts[0] ?? '', b: checkouts[1] ?? '' };
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('claiming a number', () => {
  it('gives two approvals racing from the same stale view two different numbers', async () => {
    const { a, b } = await remoteAndTwoCheckouts();
    const won = await Promise.all([
      claimNumber(a, 'origin', '2026-10-26-first', [1, 2]),
      claimNumber(b, 'origin', '2026-10-26-second', [1, 2]),
    ]);
    expect(won.sort()).toEqual([3, 4]);

    await git('git', ['fetch', '--quiet', 'origin', '+refs/tags/number/*:refs/tags/number/*'], {
      cwd: a,
    });
    const claims = await claimsIn(a);
    expect(claims.map((c) => c.number).sort()).toEqual([3, 4]);
    expect(claims.map((c) => c.thought).sort()).toEqual(['2026-10-26-first', '2026-10-26-second']);
  });

  it('takes the next number when one was claimed after its checkout last looked', async () => {
    const { a, b } = await remoteAndTwoCheckouts();
    expect(await claimNumber(a, 'origin', '2026-10-26-first', [])).toBe(1);
    expect(await claimNumber(b, 'origin', '2026-10-26-second', [])).toBe(2);
  });

  it('fails when the remote cannot be reached, rather than guess a number', async () => {
    const { a } = await remoteAndTwoCheckouts();
    await expect(claimNumber(a, 'nowhere', '2026-10-26-first', [])).rejects.toThrow();
    expect(await claimsIn(a)).toEqual([]);
  });
});
