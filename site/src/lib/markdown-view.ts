// Why: in the studio Victor reads what an agent wrote (the interview's questions, the structure with its small
// ideas table) and what he is about to send, and raw Markdown is hard to review. This reads the Markdown
// those files use into plain parts a component draws as elements: headings, paragraphs, lists, a table,
// a quote, and bold, italic, code and links inside them. No HTML from a file ever reaches the page, and a
// link only becomes one when it goes to a web address or a place on this site. Pure, so it is tested.

export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'italic'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'link'; text: string; href: string };

export type Block =
  | { kind: 'heading'; level: 2 | 3 | 4; parts: Inline[] }
  | { kind: 'para'; parts: Inline[] }
  | { kind: 'list'; ordered: boolean; items: Inline[][] }
  | { kind: 'quote'; parts: Inline[] }
  | { kind: 'table'; head: Inline[][]; rows: Inline[][][] };

const INLINE =
  /\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|_([^_\n]+)_|`([^`\n]+)`|\[([^\]\n]+)\]\(([^)\s]+)\)/g;
const BULLET = /^\s*[-*•]\s+/;
const NUMBERED = /^\s*\d+[.)]\s+/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_RULE = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;

/** A web address, or a place on this site; anything else stays words. */
export function isSafeHref(href: string): boolean {
  return /^https?:\/\/[^\s]+$/.test(href) || /^\/(?!\/)[^\s]*$/.test(href);
}

export function inlineOf(line: string): Inline[] {
  const parts: Inline[] = [];
  let at = 0;
  for (const match of line.matchAll(INLINE)) {
    if (match.index > at) parts.push({ kind: 'text', text: line.slice(at, match.index) });
    const [whole, bold, star, underscore, code, words, href] = match;
    if (bold !== undefined) parts.push({ kind: 'bold', text: bold });
    else if (star !== undefined) parts.push({ kind: 'italic', text: star });
    else if (underscore !== undefined) parts.push({ kind: 'italic', text: underscore });
    else if (code !== undefined) parts.push({ kind: 'code', text: code });
    else if (words !== undefined && href !== undefined && isSafeHref(href))
      parts.push({ kind: 'link', text: words, href });
    else parts.push({ kind: 'text', text: words ?? whole });
    at = match.index + whole.length;
  }
  if (at < line.length) parts.push({ kind: 'text', text: line.slice(at) });
  return parts;
}

const cells = (row: string): Inline[][] =>
  row
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => inlineOf(cell.trim()));

export function blocksOf(markdown: string): Block[] {
  const blocks: Block[] = [];
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = (): void => {
    if (para.length > 0) blocks.push({ kind: 'para', parts: inlineOf(para.join(' ')) });
    if (list !== null)
      blocks.push({ kind: 'list', ordered: list.ordered, items: list.items.map(inlineOf) });
    para = [];
    list = null;
  };
  for (let i = 0; i < lines.length; i += 1) {
    const line = (lines[i] ?? '').trim();
    const heading = HEADING.exec(line);
    if (line === '') {
      flush();
    } else if (heading) {
      flush();
      const level = Math.min(4, Math.max(2, (heading[1] ?? '#').length + 1)) as 2 | 3 | 4;
      blocks.push({ kind: 'heading', level, parts: inlineOf(heading[2] ?? '') });
    } else if (TABLE_ROW.test(line) && TABLE_RULE.test(lines[i + 1] ?? '')) {
      flush();
      const head = cells(line);
      const rows: Inline[][][] = [];
      i += 2;
      while (i < lines.length && TABLE_ROW.test(lines[i] ?? '')) {
        rows.push(cells(lines[i] ?? ''));
        i += 1;
      }
      i -= 1;
      blocks.push({ kind: 'table', head, rows });
    } else if (line.startsWith('>')) {
      flush();
      blocks.push({ kind: 'quote', parts: inlineOf(line.replace(/^>\s?/, '')) });
    } else if (BULLET.test(line) || NUMBERED.test(line)) {
      const ordered = NUMBERED.test(line);
      if (para.length > 0 || (list !== null && list.ordered !== ordered)) flush();
      list ??= { ordered, items: [] };
      list.items.push(line.replace(ordered ? NUMBERED : BULLET, ''));
    } else if (list !== null && /^\s{2,}/.test(lines[i] ?? '')) {
      // A wrapped list item carries on the item before it.
      const last = list.items.length - 1;
      list.items[last] = `${list.items[last] ?? ''} ${line}`;
    } else {
      if (list !== null) flush();
      para.push(line);
    }
  }
  flush();
  return blocks;
}
