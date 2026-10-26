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
  schema: z
    .object({
      why,
      title: z.string().min(1).max(120),
      date: z.coerce.date(),
      // Given once, when the thought is published; check:why keeps it unique and says which one is free.
      number: z.number().int().positive().optional(),
      language,
      themes: z.array(z.string().min(1)).min(1),
      message: z.string().min(1).max(400),
      // What search results and link previews show, when the message is too long to cut well (the SEO agent
      // proposes one in seo.md; Victor takes it here). Without it the message is cut at a whole sentence.
      description: z.string().min(1).max(155).optional(),
      origins: z.array(z.string().min(1)).min(1),
      draft: z.boolean().default(false),
    })
    .refine((data) => data.draft || data.number !== undefined, {
      message: 'a published thought needs a number',
      path: ['number'],
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

// The voice agent's reading of a version: which audio and word times go with it, and in whose voice.
// Played on the post once reviewed is true, that is, once Victor has listened.
const voices = defineCollection({
  loader: glob({ pattern: '*/voice/*.md', base: '../thoughts' }),
  schema: z
    .object({
      why,
      read_from: z.string(),
      audio: z.string(),
      timings: z.string(),
      voice: z.string().min(1),
      seconds: z.number().positive(),
      reviewed: z.boolean().default(false),
    })
    .loose(),
});

export const collections = { thoughts, versions, origins, pictures, sources, voices };
