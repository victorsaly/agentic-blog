// Why: a chat answer is short Markdown: paragraphs, a list now and then, one bold phrase, and links to places
// on the site. This reads exactly that much into plain parts the panel draws as elements, so no HTML from a
// model ever reaches the page, and a link only becomes a link when it points inside this blog.

export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'link'; text: string; href: string };

export type Block = { kind: 'para'; parts: Inline[] } | { kind: 'list'; items: Inline[][] };

/**
 * A post, its origin page, a place inside either, the site's own pages (how it works, the topics, the graph),
 * or a wiki file in the blog's own repository; nothing else.
 */
const PLACE =
  /^(\/thoughts\/[a-z0-9-]+(\/origin)?|\/how-it-works|\/topics(\/[a-z0-9-]+)?|\/graph)(#[\p{L}\p{N}_-]+)?$/u;
const WIKI = /^https:\/\/github\.com\/victorsaly\/agentic-blog\/blob\/main\/wiki\/[a-z0-9-]+\.md$/;
const INLINE = /\*\*([^*\n]+)\*\*|\[([^\]\n]+)\]\(([^)\s]+)\)/g;
const ITEM = /^\s*(?:[-*•]|\d+[.)])\s+/;

export function isPlace(href: string): boolean {
  return PLACE.test(href) || WIKI.test(href);
}

export function inlineOf(line: string): Inline[] {
  const parts: Inline[] = [];
  let at = 0;
  for (const match of line.matchAll(INLINE)) {
    if (match.index > at) parts.push({ kind: 'text', text: line.slice(at, match.index) });
    const [whole, bold, words, href] = match;
    if (bold) parts.push({ kind: 'bold', text: bold });
    else if (words && href && isPlace(href)) parts.push({ kind: 'link', text: words, href });
    else parts.push({ kind: 'text', text: words ?? whole });
    at = match.index + whole.length;
  }
  if (at < line.length) parts.push({ kind: 'text', text: line.slice(at) });
  return parts;
}

export function blocksOf(answer: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  let items: string[] = [];
  const flush = (): void => {
    if (para.length > 0) blocks.push({ kind: 'para', parts: inlineOf(para.join(' ')) });
    if (items.length > 0) blocks.push({ kind: 'list', items: items.map(inlineOf) });
    para = [];
    items = [];
  };
  for (const raw of answer.split('\n')) {
    const line = raw.trim();
    if (line === '') flush();
    else if (ITEM.test(line)) {
      if (para.length > 0) {
        blocks.push({ kind: 'para', parts: inlineOf(para.join(' ')) });
        para = [];
      }
      items.push(line.replace(ITEM, ''));
    } else {
      if (items.length > 0) flush();
      para.push(line);
    }
  }
  flush();
  return blocks;
}

/** The answer as plain words for the clipboard: bold loses its stars, a link keeps its full address. */
export function plainText(answer: string, origin: string): string {
  return answer.replace(INLINE, (whole, bold?: string, words?: string, href?: string) => {
    if (bold) return bold;
    if (words && href && isPlace(href))
      return `${words} (${href.startsWith('/') ? `${origin}${href}` : href})`;
    return words ?? whole;
  });
}
