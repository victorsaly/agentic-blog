// Why: one place that says what a content file must carry, used by the why-check, the site and the agents.
// If a rule about front matter changes, it changes here and everywhere at once.
import { z } from 'zod';

/** Every Markdown file the repo publishes or runs must say why it exists. */
export const whySchema = z
  .string()
  .trim()
  .min(20, 'a why needs at least a sentence')
  .max(600, 'a why is two or three sentences, not an essay');

/** YAML turns a bare 2026-10-23 into a Date; a quoted one stays a string. Both are a date. */
const isoDate = z.union([z.iso.date(), z.date()]);

export const originFrontMatter = z.object({
  why: whySchema,
  recorded: isoDate,
  language: z.string().min(2).max(5),
  // voice: spoken and transcribed; text: written, or transcribed elsewhere and pasted. Old files are voice.
  medium: z.enum(['voice', 'text']).default('voice'),
  audio: z.string().optional(), // R2 object key; absent when the recording is not kept, always for text
  speakers: z.array(z.string().min(1)).min(1),
  edited: z.literal(false), // origins are never edited; the schema makes the claim checkable
});

export const structureFrontMatter = z.object({
  why: whySchema,
  title: z.string().min(1).max(120),
  date: isoDate,
  // Shown beside the title on every list; given once, when the thought is published, and never changed.
  number: z.number().int().positive().optional(),
  language: z.string().min(2).max(5),
  themes: z.array(z.string().min(1)).min(1),
  message: z.string().min(1).max(400),
  origins: z.array(z.string().min(1)).min(1),
  draft: z.boolean().default(false),
});

export const versionFrontMatter = z.object({
  why: whySchema,
  kind: z.enum(['short', 'long', 'linkedin', 'voice', 'language']),
  language: z.string().min(2).max(5),
  converted_from: z.string().min(1),
  converted_by: z.string().min(1), // agent name, or "victor" when written by hand
  reviewed: z.boolean(),
});

export const genericFrontMatter = z.object({ why: whySchema }).loose();

export type OriginFrontMatter = z.infer<typeof originFrontMatter>;
export type StructureFrontMatter = z.infer<typeof structureFrontMatter>;
export type VersionFrontMatter = z.infer<typeof versionFrontMatter>;
