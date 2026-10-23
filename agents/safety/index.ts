// Why: see PROMPT.md. Reads every version, asks once, and turns the verdict into a held result so the
// workflow fails the check and the post waits for a human.
import matter from 'gray-matter';
import { askForFile, readIfPresent, userMessage } from '../_lib/generic.js';
import type { AgentRun } from '../_lib/types.js';

export const run: AgentRun = async (ctx) => {
  const versions = [...ctx.thought.files.entries()].filter(([path]) =>
    path.startsWith('versions/'),
  );
  if (versions.length === 0) {
    return { status: 'nothing-to-do', summary: 'No versions to check yet.', files: [] };
  }
  const sections = Object.fromEntries(
    versions.map(([path, content]) => [path.replace(/[^a-z0-9]/gi, '_'), content]),
  );
  const message = userMessage(
    { ...sections, structure: readIfPresent(ctx, 'structure.md') },
    `Today is ${ctx.today}. Check every version above as the prompt describes and write safety.md.`,
  );
  const file = await askForFile(ctx, message, 'safety.md');
  const verdict: unknown = matter(file.content).data['verdict'];

  if (verdict === 'hold') {
    return {
      status: 'held',
      summary: 'Safety check found something to look at.',
      files: [file],
      holdReason: file.content,
    };
  }
  if (verdict !== 'pass')
    throw new Error(`safety verdict must be pass or hold, got ${String(verdict)}`);
  return { status: 'done', summary: 'Safety check passed.', files: [file] };
};
