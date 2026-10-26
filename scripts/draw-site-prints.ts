// Why: a few prints belong to the site, not to a post (the home page's portrait, the /how-it-works hero),
// and the image agent only draws for a thought. This draws every print a site/src/assets/*/prompts.md lists
// whose file is not there yet, in the house style, and keeps it only when Claude's review of the drawing
// passes, as the image agent does. The keys live in GitHub's secrets, so .github/workflows/site-prints.yml
// runs it when a prompts.md changes on a branch; locally it needs OPENAI_API_KEY and ANTHROPIC_API_KEY.
// Usage: npx tsx scripts/draw-site-prints.ts
import { existsSync } from 'node:fs';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import matter from 'gray-matter';
import { z } from 'zod';
import { claudeAdapter } from '../agents/_lib/claude.js';
import { loadSettings } from '../agents/_lib/context.js';
import { openAiImagesAdapter } from '../agents/_lib/openai-images.js';
import { hasFfmpeg } from '../agents/_lib/workers-ai.js';
import { drawingPrompt } from '../agents/image/index.js';
import { parseReview, reviewPrompt } from '../agents/image/review.js';

const root = new URL('..', import.meta.url).pathname;
const assets = join(root, 'site', 'src', 'assets');
/** Drawings per print before giving up on it, as in the image agent. */
const MAX_ATTEMPTS = 3;

const entry = z
  .object({
    file: z.string().min(1),
    subject: z.string().min(1).optional(),
    /** The recurring person (settings.yml's image_character) is in this print. */
    person: z.boolean().optional(),
    /**
     * A drawing already in the repository to keep the person's likeness from, from the repository's root.
     * The real photo stays on the blogger's machine; a cover drawn from it carries the face instead.
     */
    reference: z.string().min(1).optional(),
  })
  .loose();
const manifest = z.object({ images: z.array(entry) }).loose();

const settings = await loadSettings(root);
const writer = claudeAdapter('writer', { kind: 'claude', model: 'claude-sonnet-5-5' });
const images = openAiImagesAdapter('images', { kind: 'openai-images' });
if (!writer.available() || !images.available() || !writer.write || !images.draw)
  throw new Error('OPENAI_API_KEY and ANTHROPIC_API_KEY must both be set; nothing was drawn');
// Every drawing is made black on white with ffmpeg after it is paid for, so it must be there first.
if (!(await hasFfmpeg()))
  throw new Error('ffmpeg is not installed here, and every drawing needs it; nothing was spent');
const write = writer.write;
const draw = images.draw;

const failures: string[] = [];
for (const folder of await readdir(assets)) {
  const path = join(assets, folder, 'prompts.md');
  if (!existsSync(path)) continue;
  const raw = await readFile(path, 'utf8');
  const parsed = matter(raw);
  const data = manifest.parse(parsed.data);
  let changed = false;
  for (const image of data.images) {
    // A bare name sits beside its prompts.md; a path with a folder is from the repository's root.
    const file = image.file.includes('/')
      ? join(root, image.file)
      : join(dirname(path), image.file);
    if (existsSync(file) || !image.subject) continue;
    const prompt = drawingPrompt(
      settings.media.image_style,
      image.person ? settings.media.image_character : undefined,
      image.subject,
    );
    const reference = image.reference
      ? new Uint8Array(await readFile(join(root, image.reference)))
      : undefined;
    let problems: string[] = [];
    let attempts = 0;
    let model = '';
    let kept = false;
    while (attempts < MAX_ATTEMPTS) {
      attempts += 1;
      const picture = await draw(reference ? { prompt, reference } : { prompt });
      model = `${picture.provider === 'images' ? 'openai' : picture.provider}/${picture.model}${reference ? ` (from ${image.reference ?? ''})` : ''}`;
      if (!picture.ok) {
        problems = [picture.reason];
        break; // a credentials or service problem; redrawing will not help
      }
      const reply = await write({
        system: 'You review drawings for a blog.',
        user: reviewPrompt(image.subject),
        images: [picture.png],
        maxOutputTokens: 1000,
      });
      const review = parseReview(reply.text);
      if (review.ok) {
        await writeFile(file, picture.png);
        Object.assign(image, { model, reviewed_by: 'claude', attempts, prompt });
        changed = true;
        kept = true;
        console.info(`  drew ${image.file} (${String(attempts)} attempt(s))`);
        break;
      }
      problems = review.problems;
    }
    // A rejection can come with no reason given; the print is still missing, so the run still fails.
    if (!kept)
      failures.push(`${image.file}: ${problems.join(' ') || 'the review did not pass it'}`);
  }
  if (changed) {
    const drawn = new Date().toISOString().slice(0, 10);
    await writeFile(path, matter.stringify(parsed.content, { ...data, drawn }));
  }
}

if (failures.length > 0) {
  console.error(`Not drawn:\n${failures.join('\n')}`);
  process.exit(1);
}
