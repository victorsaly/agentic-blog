// Why: see PROMPT.md. Reads this thought's origins and the blogger's edits to the versions, and proposes
// a new profile.md. Nothing the blogger wrote may disappear: a reply that drops a line is held.
import { resolve } from 'node:path';
import matter from 'gray-matter';
import { askForFile, readIfPresent, readOrigin, userMessage } from '../_lib/generic.js';
import { reviewDiff } from '../_lib/git.js';
import type { AgentRun } from '../_lib/types.js';

/** Lines of the profile body the blogger wrote (not the agent's own proposals). */
function ownLines(profile: string): string[] {
  return matter(profile)
    .content.split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.includes('(proposed by profile agent'));
}

export const run: AgentRun = async (ctx) => {
  const repo = resolve(ctx.thought.dir, '..', '..');
  const diff = await reviewDiff(repo, ctx.thought.slug);
  const message = userMessage(
    {
      current_profile: ctx.profile,
      origin: readOrigin(ctx),
      answers: readIfPresent(ctx, 'origin/answers.md'),
      review_diff: diff === '' ? 'The blogger has not edited any version yet.' : diff,
    },
    `Today is ${ctx.today}. Reply with the complete new profile.md as the prompt describes.`,
  );
  const file = await askForFile(ctx, message, 'profile.md', { maxOutputTokens: 8000 });

  const kept = new Set(ownLines(file.content));
  const dropped = ownLines(ctx.profile).filter((line) => !kept.has(line));
  if (dropped.length > 0) {
    return {
      status: 'held',
      summary: `The proposal drops ${String(dropped.length)} line(s) the blogger wrote; read before merging.`,
      files: [{ ...file, base: 'repo' }],
      holdReason: `Lines missing from the proposed profile:\n${dropped.map((l) => `- ${l}`).join('\n')}`,
    };
  }
  return {
    status: 'done',
    summary:
      diff === ''
        ? 'Proposed profile lines from the origin.'
        : 'Proposed profile lines from the origin and your edits.',
    files: [{ ...file, base: 'repo' }],
  };
};
