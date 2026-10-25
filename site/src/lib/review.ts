// Why: nothing an agent wrote should reach a reader looking as if Victor had read it. Each version, each
// sources file and each recording carries `reviewed`; this works out, from those flags alone, what still
// waits for him, so the studio can list it and a post can tag it. Each carries its words too, so he can read
// it in the studio, a draft and the sources included, which have no page. Pure, so it is tested without a build.

export interface Waiting {
  /** The file to open and set `reviewed: true` in, from the repo root. */
  file: string;
  /** What a reader knows it as. */
  name: string;
  /** Where it shows on the site, when it shows at all. */
  href?: string;
  /** A recording's audio, so it can be heard in the studio: on the post it plays only once reviewed. */
  listen?: string;
  /** The file's words as written (Markdown), so it can be read in the studio without a page to go to. */
  text?: string;
}

export interface ThoughtWaiting {
  slug: string;
  title: string;
  /** A draft has no public page yet, so nothing in it links anywhere. */
  draft: boolean;
  waiting: Waiting[];
}

interface VersionLike {
  slug: string;
  leaf: string;
  kind: string;
  reviewed: boolean;
  body?: string | undefined;
}

interface SourcesLike {
  slug: string;
  reviewed: boolean;
  body?: string | undefined;
}

interface VoiceLike {
  slug: string;
  leaf: string;
  reviewed: boolean;
  body?: string | undefined;
  /** The audio's URL in the built site, when it was found. */
  audio?: string;
}

const order = ['short', 'long', 'linkedin', 'language', 'voice'];

/** The words, when there are any to read. */
const textOf = (body: string | undefined): Pick<Waiting, 'text'> =>
  body !== undefined && body.trim() !== '' ? { text: body.trim() } : {};

function nameOf(v: VersionLike): Pick<Waiting, 'name' | 'href'> {
  const post = `/thoughts/${v.slug}`;
  switch (v.kind) {
    case 'short':
      return { name: 'The idea', href: `${post}#idea` };
    case 'long':
      return { name: 'The road', href: `${post}#road` };
    case 'linkedin':
      return { name: 'The LinkedIn post' };
    case 'language':
      return { name: `The version in ${v.leaf}` };
    default:
      return { name: `The ${v.kind} version` };
  }
}

/** Every thought with something unreviewed, newest first, and what waits in each. */
export function waitingForReview(
  thoughts: { slug: string; title: string; date: Date; draft: boolean }[],
  versions: VersionLike[],
  sources: SourcesLike[],
  voices: VoiceLike[],
): ThoughtWaiting[] {
  return [...thoughts]
    .sort((a, b) => b.date.getTime() - a.date.getTime() || b.slug.localeCompare(a.slug))
    .map((t) => {
      const own = versions
        .filter((v) => v.slug === t.slug && !v.reviewed)
        .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
      const waiting: Waiting[] = own.map((v) => {
        const { name, href } = nameOf(v);
        const file = `thoughts/${t.slug}/versions/${v.leaf}.md`;
        return href && !t.draft
          ? { file, name, href, ...textOf(v.body) }
          : { file, name, ...textOf(v.body) };
      });
      for (const v of voices.filter((x) => x.slug === t.slug && !x.reviewed)) {
        // An unreviewed recording is not played on the post, so it is heard here instead.
        const file = `thoughts/${t.slug}/voice/${v.leaf}.md`;
        const name =
          v.leaf === 'short' ? 'The idea, read aloud' : `The ${v.leaf} version, read aloud`;
        waiting.push(
          v.audio
            ? { file, name, listen: v.audio, ...textOf(v.body) }
            : { file, name, ...textOf(v.body) },
        );
      }
      const unread = sources.find((s) => s.slug === t.slug && !s.reviewed);
      if (unread)
        // Unreviewed sources are not shown to readers at all, so there is no page to link.
        waiting.push({
          file: `thoughts/${t.slug}/sources.md`,
          name: 'The sources',
          ...textOf(unread.body),
        });
      return { slug: t.slug, title: t.title, draft: t.draft, waiting };
    })
    .filter((t) => t.waiting.length > 0);
}

// ---------------------------------------------------------------------------------------------- marking

/** A file the studio may mark reviewed: a version, a recording or the sources of one thought, nothing else. */
const REVIEWABLE =
  /^thoughts\/\d{4}-\d{2}-\d{2}-[a-z0-9-]+\/((versions|voice)\/[a-z0-9-]+\.md|sources\.md)$/;
export const MAX_MARKED = 20;

export function isReviewable(path: string): boolean {
  return REVIEWABLE.test(path) && !path.split('/').includes('..');
}

export type ReviewRequest = { ok: true; files: string[] } | { ok: false; error: string };

/** What the studio sends to mark files reviewed, checked: known kinds of file only, a few at a time. */
export function readReviewRequest(body: unknown): ReviewRequest {
  const files: unknown =
    typeof body === 'object' && body !== null ? (body as { files?: unknown }).files : undefined;
  if (!Array.isArray(files) || files.length === 0)
    return { ok: false, error: 'Pick a file first.' };
  if (files.length > MAX_MARKED)
    return { ok: false, error: `Mark at most ${String(MAX_MARKED)} files at once.` };
  const paths = [...new Set(files.filter((f): f is string => typeof f === 'string'))];
  const bad = paths.find((f) => !isReviewable(f));
  if (bad !== undefined || paths.length !== files.length)
    return {
      ok: false,
      error: `Only versions, recordings and sources can be marked reviewed${bad ? ` (not ${bad})` : ''}.`,
    };
  return { ok: true, files: paths.sort() };
}

/**
 * The file with `reviewed: false` turned to `reviewed: true` in its front matter and nothing else changed,
 * or null when there is nothing to turn (already reviewed, or no such line).
 */
export function markReviewed(markdown: string): string | null {
  const front = /^---\r?\n[\s\S]*?\r?\n---/.exec(markdown);
  if (!front) return null;
  const turned = front[0].replace(/^reviewed:[ \t]*false[ \t]*$/m, 'reviewed: true');
  return turned === front[0] ? null : turned + markdown.slice(front[0].length);
}
