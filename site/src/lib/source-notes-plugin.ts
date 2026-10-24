// Why: a reader should see which line rests on which source. While Astro's Markdown processor (Sätteri)
// reads a post's short and long versions, this plugin reads the sources.md beside them and puts a small
// number at the end of the first paragraph that carries each claim, linking to that source in the list at
// the end of the post. Drawing captions are skipped; a claim it cannot place is still listed, unnumbered
// in the text. The page hides the numbers until the sources are reviewed.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineMdastPlugin, type MdastPluginEntry, type PluginFactoryContext } from 'satteri';
import { textOf, type MdNode } from './pictures';
import { carries, parseSources } from './sources';

const VERSION = /\/thoughts\/[^/]+\/versions\/(short|long)\.md$/;

function sourcesBeside(fileURL: URL): string {
  try {
    return readFileSync(new URL('../sources.md', fileURL), 'utf8');
  } catch {
    return ''; // no sources for this thought yet
  }
}

export const sourceNotes: MdastPluginEntry = (file: PluginFactoryContext) => {
  if (!file.fileURL) return null;
  const path = fileURLToPath(file.fileURL).replaceAll('\\', '/');
  if (!VERSION.test(path)) return null;
  const { claims } = parseSources(sourcesBeside(file.fileURL));
  if (claims.length === 0) return null;
  const placed = new Set<number>();
  return defineMdastPlugin({
    name: 'source-notes',
    paragraph(node, ctx) {
      const md = node as unknown as MdNode;
      const className = md.data?.hProperties?.className;
      if (Array.isArray(className) && className.includes('caption')) return;
      const text = textOf(md);
      const notes = claims
        .map((claim, i) => ({ claim, n: i + 1 }))
        .filter(({ claim, n }) => !placed.has(n) && carries(text, claim.quote));
      if (notes.length === 0) return;
      for (const { n } of notes) placed.add(n);
      ctx.appendChild(
        node,
        notes.map(({ n }) => ({
          type: 'link',
          url: `#source-${String(n)}`,
          data: { hProperties: { className: ['cite'], 'aria-label': `Source ${String(n)}` } },
          children: [{ type: 'text', value: String(n) }],
        })),
      );
    },
  });
};
