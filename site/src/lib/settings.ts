// Why: settings.yml is the one place that says who the blogger is and what the site allows. The site reads
// it at build time through this module so every page agrees, and a malformed file fails the build.
import { parse } from 'yaml';
import raw from '../../../settings.yml?raw';
import { z } from 'astro/zod';

const settingsSchema = z.object({
  site: z.object({
    name: z.string().min(1),
    domain: z.string().min(1),
    tagline: z.string().min(1),
    author: z.string().min(1),
    email: z.email(),
    linkedin: z.url().optional(),
    timezone: z.string().min(1),
  }),
  languages: z.object({
    origin: z.string().min(2).max(5),
    publish: z.array(z.string().min(2).max(5)).min(1),
  }),
  themes: z.array(z.string().min(1)).min(1),
  /** One plain line per theme, keyed by the theme, for the topic pages. */
  topics: z.record(z.string(), z.string().min(1)).default({}),
  depths: z.array(z.enum(['message', 'idea', 'road'])).length(3),
  publishing: z.object({
    index: z.boolean(),
    badge_text: z.string().min(1),
    social: z.array(z.string()),
    /** What readers see costs in; the ledger stays in US dollars. */
    currency: z
      .object({
        show: z.enum(['GBP', 'USD']),
        per_usd: z.number().positive(),
        rate_date: z.coerce.date(),
      })
      .default({ show: 'USD', per_usd: 1, rate_date: new Date('2026-10-23') }),
  }),
  licence: z.object({ code: z.string(), content: z.string() }),
  media: z.object({
    audio_bucket: z.string().min(1),
    image_style: z.string().min(1),
    image_character: z.string().min(1).optional(),
    image_reference: z.string().min(1).optional(),
    voice_id: z.string().nullable(),
    voice_name: z.string().min(1).optional(),
    voice_speed: z.number().min(0.8).max(1.25).optional(),
  }),
  agents: z.object({
    model: z.string().min(1),
    max_output_tokens: z.number().int().positive(),
    review_required: z.literal(true),
  }),
});

export type Settings = z.infer<typeof settingsSchema>;

// Vite inlines the file at build time, so the module works wherever Astro bundles it.
export const settings: Settings = settingsSchema.parse(parse(raw));
