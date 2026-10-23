// Why: the site reads thoughts/ straight from the repo, so a merged pull request is a published post and
// nothing is copied. Three collections, one per kind of file, each validated against the same rules the
// why-check uses, so a file that breaks a rule fails the build rather than the page.
import { defineCollection, z } from 'astro:content';
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
    audio: z.string().optional(),
    speakers: z.array(z.string().min(1)).min(1),
    edited: z.literal(false),
  }),
});

export const collections = { thoughts, versions, origins };
