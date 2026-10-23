// Why: see PROMPT.md. Claude picks the one subject and writes the prompt; Workers AI draws it; every
// pixel is then forced to black or white. If the blogger put their own photo in image/, nothing is drawn.
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import matter from 'gray-matter';
import { askForFile, readOrThrow, userMessage } from '../_lib/generic.js';
import type { AgentRun, OutputFile } from '../_lib/types.js';
import { generatePicture } from '../_lib/workers-ai.js';

async function ownPhotos(thoughtDir: string): Promise<string[]> {
  const names = await readdir(join(thoughtDir, 'image')).catch(() => [] as string[]);
  return names.filter((name) => /\.(jpe?g|png|webp|heic)$/i.test(name) && name !== 'picture.png');
}

export const run: AgentRun = async (ctx) => {
  const structure = readOrThrow(ctx, 'structure.md');
  const photos = await ownPhotos(ctx.thought.dir);
  const message = userMessage(
    {
      structure,
      house_style: ctx.settings.media.image_style,
      own_photos: photos.length > 0 ? photos.join('\n') : undefined,
    },
    `Today is ${ctx.today}. Write image/prompt.md as the prompt describes.`,
  );
  const promptFile = await askForFile(ctx, message, 'image/prompt.md');
  if (photos.length > 0) {
    return {
      status: 'done',
      summary: `The blogger placed their own photo (${photos.join(', ')}); wrote the conversion note, drew nothing.`,
      files: [promptFile],
    };
  }

  const picture = await generatePicture(matter(promptFile.content).content.trim());
  const files: OutputFile[] = [promptFile];
  if (picture.ok) files.push({ path: 'image/picture.png', content: '', bytes: picture.png });
  return {
    status: 'done',
    summary: picture.ok
      ? 'Wrote the prompt and drew image/picture.png, black on white.'
      : `Wrote the prompt only. ${picture.reason}`,
    files,
  };
};
