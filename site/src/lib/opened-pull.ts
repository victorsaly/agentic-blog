// Why: after Victor sends a thought, GitHub takes a minute to write the files and open the pull request, and
// the studio used to say "the pull request is open" at once, linking to a list that was still empty. This
// picks, from GitHub's list of open pull requests, the one the studio's send opened: the newest with the
// send's label, opened since it was asked for. Pure and narrowed from unknown, so it is tested here.

export interface OpenedPull {
  number: number;
  url: string;
}

/** How far GitHub's clock may run behind the studio's, so a pull request opened at once is not missed. */
const SLACK_MS = 30_000;

export function pullOpenedSince(listed: unknown, label: string, since: string): OpenedPull | null {
  if (!Array.isArray(listed)) return null;
  const after = Date.parse(since) - SLACK_MS;
  const found = listed.flatMap((p: unknown): (OpenedPull & { at: number })[] => {
    if (typeof p !== 'object' || p === null) return [];
    const { number, html_url: url, created_at: created, labels } = p as Record<string, unknown>;
    if (typeof number !== 'number' || typeof url !== 'string' || typeof created !== 'string')
      return [];
    const named =
      Array.isArray(labels) &&
      labels.some(
        (l: unknown) =>
          typeof l === 'object' && l !== null && (l as { name?: unknown }).name === label,
      );
    const at = Date.parse(created);
    return named && at >= after ? [{ number, url, at }] : [];
  });
  const newest = found.sort((a, b) => b.at - a.at)[0];
  return newest ? { number: newest.number, url: newest.url } : null;
}
