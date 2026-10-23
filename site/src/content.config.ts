// Why: the site reads thoughts/ straight from the repo, so a merged pull request is a published post and
// nothing is copied. One collection per kind of file, each validated against the same rules the
// why-check uses, so a file that breaks a rule fails the build rather than the page.
import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

const why = z.string().trim().min(20).max(600);
const language = z.string().min(2).max(5);

const thoughts = defineCollection({
  loader: glob({ pattern: '*/structure.md', base: '../thoughts' }),
  schema: z.object({
    why,
    title: z.string().min(1).max(120),
    date: z.coerce.date(),
    language,
    themes: z.array(z.string().min(1)).min(1),
    message: z.string().min(1).max(400),
    origins: z.array(z.string().min(1)).min(1),
    draft: z.boolean().default(false),
  }),
});

const versions = defineCollection({
  loader: glob({ pattern: '*/versions/*.md', base: '../thoughts' }),
  schema: z.object({
    why,
    kind: z.enum(['short', 'long', 'linkedin', 'voice', 'language']),
    language,
    converted_from: z.string().min(1),
    converted_by: z.string().min(1),
    reviewed: z.boolean(),
  }),
});

const origins = defineCollection({
  loader: glob({ pattern: '*/origin/*.md', base: '../thoughts' }),
  schema: z.object({
    why,
    recorded: z.coerce.date(),
    language,
    medium: z.enum(['voice', 'text']).default('voice'),
    audio: z.string().optional(),
    speakers: z.array(z.string().min(1)).min(1),
    edited: z.literal(false),
  }),
});

// The image agent's list of drawings: which file, which section, what a screen reader says.
const pictures = defineCollection({
  loader: glob({ pattern: '*/image/prompts.md', base: '../thoughts' }),
  schema: z
    .object({
      why,
      images: z.array(
        z
          .object({ file: z.string(), section: z.string(), alt: z.string(), drawn: z.boolean() })
          .loose(),
      ),
    })
    .loose(),
});

// The citations agent's doors out. Shown on the post only once reviewed is true.
const sources = defineCollection({
  loader: glob({ pattern: '*/sources.md', base: '../thoughts' }),
  schema: z
    .object({ why, checked: z.coerce.date().optional(), reviewed: z.boolean().default(false) })
    .loose(),
});

export const collections = { thoughts, versions, origins, pictures, sources };
