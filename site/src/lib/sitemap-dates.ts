// Why: a sitemap entry without a date tells a search engine nothing about what changed, so it has to guess
// when to come back. A post and its origin change when the post is published; every list, and the home page,
// changes whenever a new post lands, so it carries the newest post's date. Pure, so the config can use it and
// a test can hold it.

/** The date to give a page in the sitemap, as YYYY-MM-DD: its post's own, else the newest post's. */
export function lastmodFor(pathname: string, dates: Map<string, Date>): string | undefined {
  const slug = /^\/thoughts\/([^/]+)/.exec(pathname)?.[1];
  const own = slug ? dates.get(slug) : undefined;
  const newest = [...dates.values()].sort((a, b) => b.getTime() - a.getTime())[0];
  return (own ?? newest)?.toISOString().slice(0, 10);
}
