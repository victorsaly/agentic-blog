// Why: search engines and link previews read a page's description and its address. A description cut in the
// middle of a sentence, or an address with ".html" that the site never serves, looks careless and splits a
// page's standing between two URLs. These keep both clean, and are tested on their own.

export const DESCRIPTION_LIMIT = 155;

/** The message, cut at a whole sentence so it fits; one long sentence is cut at a word, with an ellipsis. */
export function metaDescription(message: string, limit = DESCRIPTION_LIMIT): string {
  const text = message.replace(/\s+/g, ' ').trim();
  if (text.length <= limit) return text;
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [];
  let out = '';
  for (const sentence of sentences) {
    const next = `${out}${out ? ' ' : ''}${sentence.trim()}`;
    if (next.length > limit) break;
    out = next;
  }
  if (out) return out;
  const cut = text.slice(0, limit - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:]$/, '')}…`;
}

/** The address a page is served at: no ".html", and the home page as "/". */
export function cleanPath(pathname: string): string {
  const path = pathname.replace(/\.html$/, '').replace(/\/index$/, '/');
  return path === '' ? '/' : path;
}

/** The path a search result shows instead of the address: home, then each step down, as BreadcrumbList. */
export function breadcrumbs(steps: { name: string; url: string }[]): Record<string, unknown> {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: steps.map((step, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: step.name,
      item: step.url,
    })),
  };
}
