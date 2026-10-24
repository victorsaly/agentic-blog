// Why: nothing an agent wrote should reach a reader looking as if Victor had read it. Each version and each
// sources file carries `reviewed`; this works out, from those flags alone, what still waits for him, so the
// studio can list it and a post can tag it. Pure, so the list is tested without a build.

export interface Waiting {
  /** The file to open and set `reviewed: true` in, from the repo root. */
  file: string;
  /** What a reader knows it as. */
  name: string;
  /** Where it shows on the site, when it shows at all. */
  href?: string;
}

export interface ThoughtWaiting {
  slug: string;
  title: string;
  waiting: Waiting[];
}

interface VersionLike {
  slug: string;
  leaf: string;
  kind: string;
  reviewed: boolean;
}

interface SourcesLike {
  slug: string;
  reviewed: boolean;
}

const order = ['short', 'long', 'linkedin', 'language', 'voice'];

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
  thoughts: { slug: string; title: string; date: Date }[],
  versions: VersionLike[],
  sources: SourcesLike[],
): ThoughtWaiting[] {
  return [...thoughts]
    .sort((a, b) => b.date.getTime() - a.date.getTime() || b.slug.localeCompare(a.slug))
    .map((t) => {
      const own = versions
        .filter((v) => v.slug === t.slug && !v.reviewed)
        .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
      const waiting: Waiting[] = own.map((v) => ({
        file: `thoughts/${t.slug}/versions/${v.leaf}.md`,
        ...nameOf(v),
      }));
      if (sources.some((s) => s.slug === t.slug && !s.reviewed))
        // Unreviewed sources are not shown to readers at all, so there is no page to link.
        waiting.push({ file: `thoughts/${t.slug}/sources.md`, name: 'The sources' });
      return { slug: t.slug, title: t.title, waiting };
    })
    .filter((t) => t.waiting.length > 0);
}
