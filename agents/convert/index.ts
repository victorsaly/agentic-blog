// Why: see PROMPT.md. One ask per version, so a weak short version does not drag the long one with it,
// and a failure leaves the others in place.
import {
  askForFile,
  originPaths,
  readIfPresent,
  readOrThrow,
  readOrigin,
  setFrontMatterField,
  userMessage,
} from '../_lib/generic.js';
import type { AgentContext, AgentRun, OutputFile } from '../_lib/types.js';

interface Target {
  kind: 'short' | 'long' | 'linkedin' | 'language';
  language: string;
  path: string;
}

export function targetsFor(ctx: AgentContext): Target[] {
  const origin = ctx.settings.languages.origin;
  const base: Target[] = [
    { kind: 'short', language: origin, path: 'versions/short.md' },
    { kind: 'long', language: origin, path: 'versions/long.md' },
  ];
  if (ctx.settings.publishing.social.includes('linkedin')) {
    base.push({ kind: 'linkedin', language: origin, path: 'versions/linkedin.md' });
  }
  for (const language of ctx.settings.languages.publish) {
    if (language !== origin)
      base.push({ kind: 'language', language, path: `versions/${language}.md` });
  }
  return base;
}

export const run: AgentRun = async (ctx) => {
  const structure = readOrThrow(ctx, 'structure.md');
  const transcript = readOrigin(ctx);
  const answers = readIfPresent(ctx, 'origin/answers.md');
  const files: OutputFile[] = [];

  for (const target of targetsFor(ctx)) {
    const message = userMessage(
      { structure, transcript, answers },
      `Today is ${ctx.today}. Write the "${target.kind}" version in language "${target.language}" as the prompt describes.`,
    );
    const file = await askForFile(ctx, message, target.path);
    // A version points back at the origin it came from; with several notes, at the first one.
    const from = `../${originPaths(ctx)[0] ?? 'origin/transcript.md'}`;
    files.push({ ...file, content: setFrontMatterField(file.content, 'converted_from', from) });
  }

  return {
    status: 'done',
    summary: `Wrote ${String(files.length)} versions: ${files.map((f) => f.path.replace('versions/', '')).join(', ')}. All unreviewed.`,
    files,
  };
};
