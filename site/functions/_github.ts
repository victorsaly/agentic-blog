// Why: the studio asks GitHub a few things about a thought (which pull request its gate is on, a file on that
// branch) and asks it to run workflows. The headers and the lookup live here once.
import type { Env } from './_lib';

export function githubHeaders(env: Env): Record<string, string> {
  return {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${env.GITHUB_TOKEN ?? ''}`,
    'user-agent': 'agentic-blog-studio',
    'x-github-api-version': '2022-11-28',
  };
}

export interface OpenPull {
  number: number;
  url: string;
  branch: string;
}

/** At most this many branches are asked for the file, to stay inside the Worker's request limit. */
const CHECKS = 8;

/**
 * The open pull request whose branch holds `path`, or null when none does: the file is on main (every branch
 * made since inherits it, so main is asked first and wins), or it is not pushed. Branches that name the
 * thought are asked first.
 */
export async function pullHolding(env: Env, path: string, slug: string): Promise<OpenPull | null> {
  const base = `https://api.github.com/repos/${env.GITHUB_REPO}`;
  const headers = githubHeaders(env);
  const onMain = await fetch(`${base}/contents/${path}?ref=main`, { headers });
  if (onMain.ok) return null;
  const response = await fetch(`${base}/pulls?state=open&per_page=50`, { headers });
  if (!response.ok)
    throw new Error(`GitHub did not list the pull requests (${String(response.status)}).`);
  const listed: unknown = await response.json();
  if (!Array.isArray(listed))
    throw new Error('GitHub sent something that is not a list of pull requests.');
  const pulls = listed.flatMap((p: unknown): OpenPull[] => {
    if (typeof p !== 'object' || p === null) return [];
    const {
      number,
      html_url: url,
      head,
    } = p as { number?: unknown; html_url?: unknown; head?: unknown };
    const branch =
      typeof head === 'object' && head !== null ? (head as { ref?: unknown }).ref : null;
    return typeof number === 'number' && typeof url === 'string' && typeof branch === 'string'
      ? [{ number, url, branch }]
      : [];
  });
  const ordered = [
    ...pulls.filter((p) => p.branch.includes(slug)),
    ...pulls.filter((p) => !p.branch.includes(slug)),
  ].slice(0, CHECKS);
  for (const pull of ordered) {
    const there = await fetch(`${base}/contents/${path}?ref=${encodeURIComponent(pull.branch)}`, {
      headers,
    });
    if (there.ok) return pull;
  }
  return null;
}

/** A file's text on a branch, or null when it is not there. */
export async function fileOn(env: Env, path: string, ref: string): Promise<string | null> {
  const response = await fetch(
    `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path}?ref=${encodeURIComponent(ref)}`,
    { headers: { ...githubHeaders(env), accept: 'application/vnd.github.raw' } },
  );
  return response.ok ? response.text() : null;
}
