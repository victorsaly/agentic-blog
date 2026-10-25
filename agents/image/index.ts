// Why: see PROMPT.md. One picture for the post and one for each section of the long version, so the
// drawings follow the text. Claude plans every picture in one reply; the code names the files, Workers AI
// draws them, and a manifest records which section each belongs to and its alt text. A picture that fails
// to draw does not stop the others. If the blogger put their own photo in image/, nothing is drawn.
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import matter from 'gray-matter';
import { z } from 'zod';
import { markdownFile } from '../_lib/files.js';
import { kebab, readIfPresent, readOrThrow, userMessage } from '../_lib/generic.js';
import { unfence } from '../_lib/claude.js';
import type { AgentContext, AgentRun, OutputFile } from '../_lib/types.js';
import { hasFfmpeg } from '../_lib/workers-ai.js';
import { reviewDrawing } from './review.js';

export const MANIFEST = 'image/prompts.md';
const MAX_SECTIONS = 8;
/** Drawings per picture before giving up on it; each failed one is shown to Claude with its problems. */
const MAX_ATTEMPTS = 3;
const SKIP_SECTION = /^what changed from the origin/i;

const plan = z.object({
  why: z.string().min(20),
  images: z
    .array(
      z.object({
        section: z.string().min(1),
        name: z.string().min(1).max(60),
        subject: z.string().min(1),
        alt: z.string().min(1).max(250),
        quote: z.string().optional(),
        note: z.string().max(300).optional(),
      }),
    )
    .min(1),
});

/** The sections of the long version that get a picture, in order, after the cover. */
export function sectionsOf(long: string | undefined): string[] {
  if (long === undefined) return [];
  return [...long.matchAll(/^## (.+)$/gm)]
    .map((m) => (m[1] ?? '').trim())
    .filter((title) => title !== '' && !SKIP_SECTION.test(title))
    .slice(0, MAX_SECTIONS);
}

/** Quotes compare by their words, so curly quotes or a line break never hide a real match. */
function words(text: string): string {
  return text
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** The quote only if it really is the blogger's sentence from the text; otherwise none. */
export function verifiedQuote(quote: string | undefined, text: string | undefined): string | null {
  if (!quote || !text) return null;
  const q = words(quote);
  return q.length >= 12 && words(text).includes(q) ? quote.trim() : null;
}

/** The prompt the drawing model sees: the house style, the recurring person, then the scene. */
export function drawingPrompt(
  style: string,
  character: string | undefined,
  subject: string,
): string {
  const person = character
    ? ` If a person appears, it is always this person: ${character.trim()}`
    : '';
  return `${style.trim()}${person} ${subject.trim()} Generous empty space, nothing else. Square image.`;
}

/** 00 for the cover, then 01, 02… in section order, then words that say what is in the picture. */
export function fileNameFor(index: number, name: string): string {
  return `image/${String(index).padStart(2, '0')}-${kebab(name) || 'picture'}.png`;
}

/** Files this agent wrote last time, so a rerun replaces them instead of leaving stale pictures. */
function previousOutputs(ctx: AgentContext): string[] {
  const manifest = readIfPresent(ctx, MANIFEST);
  const legacy = readIfPresent(ctx, 'image/prompt.md');
  const files: string[] = [];
  if (manifest !== undefined) {
    const images: unknown = matter(manifest).data['images'];
    if (Array.isArray(images))
      for (const image of images) {
        const file: unknown = (image as Record<string, unknown>)['file'];
        if (typeof file === 'string' && /^image\/[a-z0-9-]+\.png$/.test(file)) files.push(file);
      }
  }
  if (legacy !== undefined && matter(legacy).data['generated_by'] === 'image')
    files.push('image/picture.png', 'image/prompt.md');
  return files;
}

async function ownPhotos(thoughtDir: string, ours: string[]): Promise<string[]> {
  const names = await readdir(join(thoughtDir, 'image')).catch(() => [] as string[]);
  return names.filter(
    (name) => /\.(jpe?g|png|webp|heic)$/i.test(name) && !ours.includes(`image/${name}`),
  );
}

export const run: AgentRun = async (ctx) => {
  const structure = readOrThrow(ctx, 'structure.md');
  const long = readIfPresent(ctx, 'versions/long.md');
  const previous = previousOutputs(ctx);
  const photos = await ownPhotos(ctx.thought.dir, previous);
  if (photos.length > 0) {
    return {
      status: 'nothing-to-do',
      summary: `The blogger placed their own photo (${photos.join(', ')}); nothing drawn.`,
      files: [],
    };
  }

  // Every drawing is made black on white with ffmpeg after it is paid for, so it must be there first.
  if (!(await hasFfmpeg()))
    throw new Error(
      'ffmpeg is not installed here, and every drawing is made black on white with it; nothing was spent',
    );

  // The reference photo lives on the blogger's machine only; in CI it is absent and the text describes him.
  const referencePath = ctx.settings.media.image_reference;
  const reference = referencePath
    ? await readFile(resolve(ctx.thought.dir, '..', '..', referencePath))
        .then((b) => new Uint8Array(b))
        .catch(() => undefined)
    : undefined;

  const sections = ['cover', ...sectionsOf(long)];
  const message = userMessage(
    {
      structure,
      long_version: long,
      house_style: ctx.settings.media.image_style,
      recurring_person: ctx.settings.media.image_character,
      pictures_wanted: sections.map((s, i) => `${String(i)}. ${s}`).join('\n'),
    },
    `Today is ${ctx.today}. Plan one picture for each entry in pictures_wanted, in that order, as the prompt describes. Reply with front matter only: why, then images, a list with section (copied exactly), name, subject, alt, quote and note for each.`,
  );
  const reply = unfence(await ctx.ask(message, { maxOutputTokens: 8000 }));
  const parsed = plan.safeParse(matter(reply).data);
  if (!parsed.success) throw new Error(`the image plan did not parse: ${parsed.error.message}`);

  const files: OutputFile[] = previous.map((path) => ({ path, content: '', remove: true }));
  const manifest: Record<string, unknown>[] = [];
  const failures: string[] = [];
  for (const [index, image] of parsed.data.images.entries()) {
    const file = fileNameFor(index, image.name);
    // The blogger appears once, on the cover; every other panel is the idea of its section.
    const isCover = image.section === 'cover';
    const prompt = drawingPrompt(
      ctx.settings.media.image_style,
      isCover ? ctx.settings.media.image_character : undefined,
      image.subject,
    );
    const quote = verifiedQuote(
      image.quote,
      image.section === 'cover' ? `${structure}\n${long ?? ''}` : long,
    );
    let kept: Uint8Array | null = null;
    let problems: string[] = [];
    let attempts = 0;
    let model = '';
    while (attempts < MAX_ATTEMPTS && kept === null) {
      attempts += 1;
      const picture = await ctx.draw(prompt, isCover ? reference : undefined);
      model = `${picture.provider}/${picture.model}${isCover && reference && picture.provider !== 'none' ? ' (asked to draw from the reference photo)' : ''}`;
      if (!picture.ok) {
        problems = [picture.reason];
        break; // a credentials or service problem; redrawing will not help
      }
      const review = await reviewDrawing(ctx, picture.png, image.subject);
      if (review.ok) kept = picture.png;
      else problems = review.problems;
    }
    if (kept !== null) files.push({ path: file, content: '', bytes: kept });
    else failures.push(`${file}: ${problems.join(' ')}`);
    manifest.push({
      file,
      section: image.section,
      subject: image.subject,
      alt: image.alt,
      drawn: kept !== null,
      model,
      reviewed_by: 'claude',
      attempts,
      ...(kept === null ? { problems } : {}),
      ...(quote ? { quote } : {}),
      ...(image.note ? { note: image.note.trim() } : {}),
      prompt,
    });
  }

  const drawn = manifest.filter((m) => m['drawn'] === true).length;
  files.push({
    path: MANIFEST,
    content: markdownFile(
      {
        why: parsed.data.why,
        generated_by: 'image',
        drawn: ctx.today,
        images: manifest,
      },
      [
        '| File | Section | What it shows |',
        '|---|---|---|',
        ...manifest.map(
          (m) => `| ${String(m['file'])} | ${String(m['section'])} | ${String(m['alt'])} |`,
        ),
      ].join('\n'),
    ),
  });
  return {
    status: 'done',
    summary:
      `Drew ${String(drawn)} of ${String(manifest.length)} pictures that passed review: the cover and one per section.` +
      (failures.length > 0 ? ` Not drawn: ${failures.join('; ')}` : ''),
    files,
  };
};
