// Why: the diagram agent describes diagrams in diagram/diagrams.md beside the long version. This plugin
// draws each one as plain HTML (see diagrams.ts) at the end of the section it belongs to, so it follows the
// text that explains it. Any other file passes through untouched.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineMdastPlugin, type MdastPluginEntry, type PluginFactoryContext } from 'satteri';
import { parse } from 'yaml';
import { diagramHtml, diagramsFrom, type Diagram } from './diagrams';
import { sameHeading } from './pictures';

const LONG = /\/thoughts\/[^/]+\/versions\/long\.md$/;

function frontMatter(text: string): unknown {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  return match?.[1] ? parse(match[1]) : null;
}

function diagramsBeside(fileURL: URL): Diagram[] {
  try {
    return diagramsFrom(
      frontMatter(readFileSync(new URL('../diagram/diagrams.md', fileURL), 'utf8')),
    );
  } catch {
    return [];
  }
}

export const sectionDiagrams: MdastPluginEntry = (file: PluginFactoryContext) => {
  if (!file.fileURL || !LONG.test(fileURLToPath(file.fileURL).replaceAll('\\', '/'))) return null;
  const diagrams = diagramsBeside(file.fileURL);
  if (diagrams.length === 0) return null;
  return defineMdastPlugin({
    name: 'section-diagrams',
    after(root, ctx) {
      const children = root.children;
      // Walk backwards so each insertion leaves the earlier indexes where they were.
      const headings = children
        .map((node, index) => ({ node, index }))
        .filter(({ node }) => node.type === 'heading' && node.depth === 2);
      for (let h = headings.length - 1; h >= 0; h -= 1) {
        const current = headings[h];
        if (!current) continue;
        const title = ctx.textContent(current.node);
        const matching = diagrams.filter((d) => sameHeading(d.section, title));
        if (matching.length === 0) continue;
        const end = headings[h + 1]?.index ?? children.length;
        ctx.insertChildAt(
          root,
          end,
          matching.map((d) => ({ type: 'html' as const, value: diagramHtml(d) })),
        );
      }
    },
  });
};
