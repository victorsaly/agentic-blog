// Why: approving the gate before the way out merges the pull request, but only once every check on the
// commit that records the approval has passed: a failing check, or a guard's hold failing the agents check,
// keeps the post out. This reads GitHub's check runs for that commit into one verdict. Pure, so it is tested.

export interface CheckRun {
  name: string;
  status: string;
  conclusion: string | null;
}

export type Verdict = { kind: 'wait' } | { kind: 'pass' } | { kind: 'fail'; failed: string[] };

/** Conclusions that let a merge through: passed, or not needed for this change. */
const fine: readonly string[] = ['success', 'skipped', 'neutral'];

/**
 * Wait while a required check has not appeared yet (a job that waits on another registers late), or any
 * check is still going; fail on any that did not pass; else pass.
 */
export function verdictOf(runs: readonly CheckRun[], required: readonly string[] = []): Verdict {
  if (runs.length === 0 || runs.some((r) => r.status !== 'completed')) return { kind: 'wait' };
  if (required.some((name) => !runs.some((r) => r.name === name))) return { kind: 'wait' };
  const failed = runs
    .filter((r) => !fine.includes(r.conclusion ?? ''))
    .map((r) => `${r.name} (${r.conclusion ?? 'no conclusion'})`);
  return failed.length > 0 ? { kind: 'fail', failed } : { kind: 'pass' };
}

/** GitHub's answer for a commit's check runs, read back; anything unreadable is left out. */
export function readCheckRuns(data: unknown): CheckRun[] {
  if (typeof data !== 'object' || data === null) return [];
  const runs = (data as { check_runs?: unknown }).check_runs;
  if (!Array.isArray(runs)) return [];
  return runs.flatMap((r: unknown): CheckRun[] => {
    if (typeof r !== 'object' || r === null) return [];
    const { name, status, conclusion } = r as Record<string, unknown>;
    return typeof name === 'string' && typeof status === 'string'
      ? [{ name, status, conclusion: typeof conclusion === 'string' ? conclusion : null }]
      : [];
  });
}
