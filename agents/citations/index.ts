// Why: see PROMPT.md. The only agent besides drilldown that reads the web; it gets a search budget, and
// everything it finds stays unreviewed until the blogger has opened the links.
import { askForFile, readIfPresent, readOrThrow, userMessage } from '../_lib/generic.js';
import type { AgentRun } from '../_lib/types.js';

export const run: AgentRun = async (ctx) => {
  const long = readOrThrow(ctx, 'versions/long.md');
  const message = userMessage(
    { long_version: long, structure: readIfPresent(ctx, 'structure.md') },
    `Today is ${ctx.today}. Search for each name or claim, then write sources.md as the prompt describes. Use only URLs that appeared in your search results.`,
  );
  const file = await askForFile(ctx, message, 'sources.md', {
    webSearch: { maxUses: 12 },
    maxOutputTokens: 8000,
  });
  return {
    status: 'done',
    summary:
      'Listed a door out for each name and claim in the long version; open every link before merging.',
    files: [file],
  };
};
