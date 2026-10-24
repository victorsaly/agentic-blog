// Why: the long version is plain Markdown the agents write, and the drawings are listed beside it in
// image/prompts.md. This plugin runs while Astro's Markdown processor (Sätteri) reads each long version
// and places every section's drawing under its heading as an ordinary Markdown image, so Astro serves it
// like any other image in the post. Any other file passes through untouched.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineMdastPlugin, type MdastPluginEntry, type PluginFactoryContext } from 'satteri';
import { parse } from 'yaml';
import { picturesFrom, sameHeading, textOf, type MdNode, type Picture } from './pictures';

const LONG = /\/thoughts\/[^/]+\/versions\/long\.md$/;

function frontMatter(text: string): unknown {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  return match?.[1] ? parse(match[1]) : null;
}

function picturesBeside(fileURL: URL): Picture[] {
  try {
    const list = readFileSync(new URL('../image/prompts.md', fileURL), 'utf8');
    return picturesFrom(frontMatter(list)).filter((p) => p.section !== 'cover');
  } catch {
    return []; // no drawings for this thought yet
  }
}

export const sectionPictures: MdastPluginEntry = (file: PluginFactoryContext) => {
  if (!file.fileURL || !LONG.test(fileURLToPath(file.fileURL).replaceAll('\\', '/'))) return null;
  const pictures = picturesBeside(file.fileURL);
  if (pictures.length === 0) return null;
  return defineMdastPlugin({
    name: 'section-pictures',
    heading(node, ctx) {
      if (node.depth !== 2) return;
      const heading = textOf(node as unknown as MdNode);
      const picture = pictures.find((p) => sameHeading(p.section, heading));
      if (!picture) return;
      ctx.insertAfter(node, {
        type: 'paragraph',
        children: [{ type: 'image', url: `../${picture.file}`, alt: picture.alt }],
      });
    },
  });
};
