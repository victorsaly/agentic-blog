// Why: a converted version and a sources list each open with their own top heading, repeating the post's
// title inside the page. A page has one top heading, so this drops a level-one heading from versions and
// sources as Astro reads them; screen readers then hear the title once and the road starts at its sections.
import { fileURLToPath } from 'node:url';
import { defineMdastPlugin, type MdastPluginEntry, type PluginFactoryContext } from 'satteri';

const NESTED = /\/thoughts\/[^/]+\/(versions\/[^/]+|sources)\.md$/;

export const dropLeadHeading: MdastPluginEntry = (file: PluginFactoryContext) => {
  if (!file.fileURL || !NESTED.test(fileURLToPath(file.fileURL).replaceAll('\\', '/'))) return null;
  return defineMdastPlugin({
    name: 'drop-lead-heading',
    heading(node, ctx) {
      if (node.depth === 1) ctx.removeNode(node);
    },
  });
};
