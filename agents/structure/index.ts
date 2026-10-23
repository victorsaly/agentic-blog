// Why: see PROMPT.md. Gathers the origin, the answers if any, and the themes list, and asks once.
import { askForFile, readIfPresent, readOrigin, userMessage } from '../_lib/generic.js';
import type { AgentRun } from '../_lib/types.js';

export const run: AgentRun = async (ctx) => {
  const transcript = readOrigin(ctx);
  const answers = readIfPresent(ctx, 'origin/answers.md');
  const interview = readIfPresent(ctx, 'interview.md');
  const message = userMessage(
    { transcript, answers, interview, themes: ctx.settings.themes.join('\n') },
    `Today is ${ctx.today}. The thought folder is ${ctx.thought.slug}. Write structure.md as the prompt describes.`,
  );
  const file = await askForFile(ctx, message, 'structure.md');
  return {
    status: 'done',
    summary: 'Found the message, the idea and the small ideas; draft until reviewed.',
    files: [file],
  };
};
