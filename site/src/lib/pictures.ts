// Why: the image agent writes image/prompts.md, a list of drawings with the section each belongs to and
// its alt text. The post page and the Markdown pipeline both read that list, so the rule for which
// drawing goes where lives here once, as plain functions that can be tested without a build.

export interface Picture {
  /** Path inside the thought folder, e.g. image/03-hand-sketching-boxes.png. */
  file: string;
  /** "cover", or the exact heading of a section in the long version. */
  section: string;
  alt: string;
  /** The sentence from the post this drawing shows, word for word, when the agent found one. */
  quote?: string;
  /** The artist's note: what was drawn and why. */
  note?: string;
}

const FILE = /^image\/[a-z0-9-]+\.png$/;

interface Loose {
  images?: unknown;
  file?: unknown;
  section?: unknown;
  alt?: unknown;
  drawn?: unknown;
  quote?: unknown;
  note?: unknown;
}

function record(value: unknown): Loose | null {
  return typeof value === 'object' && value !== null ? value : null;
}

/** The drawings that were actually drawn, from the front matter of image/prompts.md. Anything odd is skipped. */
export function picturesFrom(frontMatter: unknown): Picture[] {
  const images = record(frontMatter)?.images;
  if (!Array.isArray(images)) return [];
  const pictures: Picture[] = [];
  for (const item of images) {
    const image = record(item);
    if (image?.drawn !== true) continue;
    const { file, section, alt } = image;
    if (typeof file !== 'string' || !FILE.test(file)) continue;
    if (typeof section !== 'string' || typeof alt !== 'string' || alt.trim() === '') continue;
    const quote =
      typeof image.quote === 'string' && image.quote.trim() !== '' ? image.quote.trim() : undefined;
    const note =
      typeof image.note === 'string' && image.note.trim() !== '' ? image.note.trim() : undefined;
    pictures.push({
      file,
      section: section.trim(),
      alt: alt.trim(),
      ...(quote ? { quote } : {}),
      ...(note ? { note } : {}),
    });
  }
  return pictures;
}

export function coverOf(pictures: Picture[]): Picture | undefined {
  return pictures.find((p) => p.section === 'cover');
}

/** Headings compare by their words only, so a curly quote or a trailing space never loses a drawing. */
export function sameHeading(a: string, b: string): boolean {
  const words = (s: string) =>
    s
      .normalize('NFKD')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  return words(a) === words(b);
}

/** The caption under a drawing: the quoted line, then the note, each only when there is one. */
export function captionNodes(picture: Picture): MdNode[] {
  if (!picture.quote && !picture.note) return [];
  const children: MdNode[] = [];
  if (picture.quote)
    children.push({ type: 'emphasis', children: [{ type: 'text', value: `“${picture.quote}”` }] });
  if (picture.quote && picture.note) children.push({ type: 'break' });
  if (picture.note) children.push({ type: 'text', value: picture.note });
  return [{ type: 'paragraph', data: { hProperties: { className: ['caption'] } }, children }];
}

/** Minimal Markdown tree shapes, enough to find level-two headings and insert an image after each. */
export interface MdNode {
  type: string;
  depth?: number;
  value?: string;
  url?: string;
  alt?: string;
  data?: { hProperties?: Record<string, unknown> };
  children?: MdNode[];
}

export function textOf(node: MdNode): string {
  if (typeof node.value === 'string') return node.value;
  return (node.children ?? []).map(textOf).join('');
}

/**
 * Puts each section's drawing straight after its heading, as an image paragraph. Returns how many were
 * placed. Section drawings only; the cover is the page's job.
 */
export function insertSectionPictures(tree: MdNode, pictures: Picture[]): number {
  const children = tree.children;
  if (!children) return 0;
  let placed = 0;
  for (let i = 0; i < children.length; i += 1) {
    const node = children[i];
    if (node?.type !== 'heading' || node.depth !== 2) continue;
    const heading = textOf(node);
    const picture = pictures.find((p) => p.section !== 'cover' && sameHeading(p.section, heading));
    if (!picture) continue;
    const nodes = [
      {
        type: 'paragraph',
        children: [{ type: 'image', url: `../${picture.file}`, alt: picture.alt }],
      },
      ...captionNodes(picture),
    ];
    children.splice(i + 1, 0, ...nodes);
    placed += 1;
    i += nodes.length;
  }
  return placed;
}
