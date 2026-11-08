// Why: on the free plan Workers AI stops for the day once 10,000 neurons are used, and the live words while
// Victor talks use most of them. When that happens the studio should say so in plain words, and when it
// comes back, instead of a bare 500 that leaves him guessing.

/** True when a Workers AI error is the free daily allowance running out (Cloudflare error 4006). */
export function isAllowanceUsedUp(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /\b4006\b|daily free allocation/i.test(message);
}

/** Whole hours, rounded up, until the allowance comes back at 00:00 UTC. */
export function hoursUntilReset(now: Date): number {
  const reset = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(1, Math.ceil((reset - now.getTime()) / 3_600_000));
}

/** What the studio shows when a recording could not be written down for that reason. */
export function allowanceMessage(now: Date): string {
  const hours = hoursUntilReset(now);
  return `Cloudflare's free daily AI allowance is used up, mostly by the live words shown while you talk. It comes back at 00:00 UTC, in about ${String(hours)} hour${hours === 1 ? '' : 's'}; press Try again then, or type your words now`;
}
