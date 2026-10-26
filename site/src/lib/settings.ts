// Why: settings.yml is the one place that says who the blogger is and what the site allows. The site reads
// it at build time through this module so every page agrees, and a malformed file fails the build.
import { parse } from 'yaml';
import raw from '../../../settings.yml?raw';
import { z } from 'astro/zod';

const settingsSchema = z
  .object({
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
    // A topic is an address (/topics/<topic>, #t-<topic>) and a name the graph keys on: lowercase words
    // joined by hyphens, nothing else, so it can never break a link or a selector.
    themes: z
      .array(
        z
          .string()
          .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'a topic is lowercase words joined by hyphens'),
      )
      .min(1),
    /** One plain line per theme, keyed by the theme, for the topic pages. */
    topics: z.record(z.string(), z.string().min(1)).default({}),
    topic_names: z.record(z.string(), z.string().min(1)).default({}),
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
    // The token goes into an attribute on every reader page, so only plain letters and digits pass.
    analytics: z
      .object({
        cloudflare_token: z
          .string()
          .regex(/^[A-Za-z0-9]+$/, 'the Web Analytics token is letters and digits only')
          .nullable(),
      })
      .default({ cloudflare_token: null }),
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
  })
  // A line or a name keyed to a theme that does not exist would vanish without a word, so a renamed theme
  // fails here.
  .refine((s) => Object.keys(s.topics).every((topic) => s.themes.includes(topic)), {
    message: 'every key under topics must be one of the themes',
    path: ['topics'],
  })
  .refine((s) => Object.keys(s.topic_names).every((topic) => s.themes.includes(topic)), {
    message: 'every key under topic_names must be one of the themes',
    path: ['topic_names'],
  });

export type Settings = z.infer<typeof settingsSchema>;

// Vite inlines the file at build time, so the module works wherever Astro bundles it.
export const settings: Settings = settingsSchema.parse(parse(raw));
