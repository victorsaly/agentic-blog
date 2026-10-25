// Why: see PROMPT.md. Gathers the origin, the answers if any, and the themes list, and asks once. When
// Victor sent the message back (Not this, at the message gate), his words come too, and they lead.
import { askForFile, readIfPresent, readOrigin, userMessage } from '../_lib/generic.js';
import type { AgentRun } from '../_lib/types.js';

export const run: AgentRun = async (ctx) => {
  const transcript = readOrigin(ctx);
  const answers = readIfPresent(ctx, 'origin/answers.md');
  const interview = readIfPresent(ctx, 'interview.md');
  const sentBack = ctx.sentBack ?? undefined;
  const message = userMessage(
    {
      transcript,
      answers,
      interview,
      themes: ctx.settings.themes.join('\n'),
      not_the_message: sentBack,
    },
    `Today is ${ctx.today}. The thought folder is ${ctx.thought.slug}. Write structure.md as the prompt describes.${
      sentBack === undefined
        ? ''
        : ' Victor sent the last message back; not_the_message is what he said. Find the message again with his words leading, and keep only what still fits.'
    }`,
  );
  const file = await askForFile(ctx, message, 'structure.md');
  return {
    status: 'done',
    summary: 'Found the message, the idea and the small ideas; draft until reviewed.',
    files: [file],
  };
};
