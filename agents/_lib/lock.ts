// Why: two runs on the same thought at once (two terminals, say) could each read the ledger before the other
// had saved, and both open the same gate. Deciding which gates open, and opening them, happens inside this
// lock, one runner at a time per thought. Making a folder is atomic, so it is the lock; it lives in the
// system's temp folder, never in the thought (the ledger folder holds runs and nothing else). A lock left by
// a runner that died is taken back once it is old. On GitHub the workflow's concurrency group already keeps
// one agent per thought; this covers runs on a computer.
import { createHash } from 'node:crypto';
import { mkdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface LockOptions {
  /** A lock older than this was left by a runner that stopped; it is taken back. */
  staleMs?: number;
  /** How long to wait for the lock before giving up. */
  waitMs?: number;
  /** Where the lock folder is made; the system's temp folder unless a test says otherwise. */
  dir?: string;
}

const pause = (ms: number): Promise<void> =>
  new Promise((done) => {
    setTimeout(done, ms);
  });

/** Runs `work` while holding the lock named `name`, one holder at a time on this computer. */
export async function withLock<T>(
  name: string,
  work: () => Promise<T>,
  options: LockOptions = {},
): Promise<T> {
  const { staleMs = 60_000, waitMs = 30_000, dir = tmpdir() } = options;
  const path = join(
    dir,
    `roadbook-${createHash('sha256').update(name).digest('hex').slice(0, 16)}.lock`,
  );
  const until = Date.now() + waitMs;
  let held = false;
  while (!held) {
    try {
      await mkdir(path);
      held = true;
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const made = await stat(path).catch(() => null);
      if (made !== null && Date.now() - made.mtimeMs > staleMs) {
        await rm(path, { recursive: true, force: true });
        continue;
      }
      if (Date.now() > until) throw new Error(`another runner has held ${name} for too long`);
      await pause(100);
    }
  }
  try {
    return await work();
  } finally {
    await rm(path, { recursive: true, force: true });
  }
}
