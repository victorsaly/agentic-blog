// Why: see PROMPT.md. This file only gathers the inputs and names the output; the behaviour is the prompt.
import { askForFile, readIfPresent, readOrThrow, userMessage } from '../_lib/generic.js';
import type { AgentRun } from '../_lib/types.js';

export const run: AgentRun = async (ctx) => {
  if (readIfPresent(ctx, 'origin/answers.md') !== undefined) {
    return { status: 'nothing-to-do', summary: 'The blogger has already answered; nothing to ask.', files: [] };
  }
  const transcript = readOrThrow(ctx, 'origin/transcript.md');
  const existing = readIfPresent(ctx, 'interview.md');
  const message = userMessage(
    { transcript, previous_questions: existing },
    `Today is ${ctx.today}. Write interview.md as the prompt describes. If previous questions exist, do not repeat them; only add what is still missing.`,
  );
  const file = await askForFile(ctx, message, 'interview.md');
  return { status: 'done', summary: 'Asked the questions a reader would need answered.', files: [file] };
};
