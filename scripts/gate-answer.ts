// Why: when Victor answers a gate in the studio, his words have to land the way every word of his does: as an
// origin, exactly as he wrote it, with the front matter the schema checks. This decides the file and its text,
// and reads the studio's request, without touching the disk, so both are tested.
import { z } from 'zod';

/** The thought folders the studio and the agents name: a date, then words. */
const SLUG = /^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/;
const RUN = /^\d{8}T\d{6}Z-[a-z][a-z-]*-[0-9a-f]{4}$/;

/** What the studio sends with close-gate; the branch is the pull request the gate's run is on, if any. */
export const closeGatePayload = z.object({
  run: z.string().regex(RUN),
  thought: z.string().regex(SLUG),
  decision: z.enum(['answered', 'approved', 'redirected', 'picked']),
  words: z.string().max(10_000),
  by: z.string().min(1),
  branch: z.string().optional(),
  /** Spoken, with the recording's key in R2, or written. */
  medium: z.enum(['voice', 'text']).default('text'),
  key: z
    .string()
    .regex(/^answer\/[A-Za-z0-9-]+\.(webm|m4a|mp3|wav|ogg)$/)
    .optional(),
});

export type CloseGatePayload = z.infer<typeof closeGatePayload>;

/**
 * The file an answer lands in, or null when this gate's words stay in the ledger. Only the interview's
 * answers are a file: origin/answers.md, which the structure agent reads.
 */
export function answerFileFor(gate: string, decision: string): string | null {
  return gate === 'answers' && decision === 'answered' ? 'origin/answers.md' : null;
}

/**
 * The answer as an origin: exactly the words given, never edited. Spoken, it is the transcript with the key
 * of its recording, like any spoken origin; written, it says so.
 */
export function answerOrigin(
  slug: string,
  words: string,
  date: string,
  by: string,
  spoken?: { key: string },
): string {
  const who = by.includes('@') ? ` by ${by}` : '';
  const how = spoken ? 'spoken in the studio and written down' : 'written in the studio';
  const kept = spoken ? 'Kept exactly as transcribed' : 'Kept exactly as written';
  const why = `Victor's answers to the interview about "${slug}", ${how}${who} on ${date}. ${kept}; the structure agent reads them beside the origin.`;
  return [
    '---',
    'why: >',
    `  ${why}`,
    `recorded: ${date}`,
    'language: en',
    `medium: ${spoken ? 'voice' : 'text'}`,
    ...(spoken ? [`audio: ${spoken.key}`] : []),
    'speakers: [victor]',
    'edited: false',
    '---',
    '',
    // The words exactly as given, never trimmed: an origin is kept as it came. Only a final line ending is
    // added when there is none, so the file ends like every other.
    words.endsWith('\n') ? words.slice(0, -1) : words,
    '',
  ].join('\n');
}
