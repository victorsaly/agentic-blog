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
});

export type CloseGatePayload = z.infer<typeof closeGatePayload>;

/**
 * The file an answer lands in, or null when this gate's words stay in the ledger. Only the interview's
 * answers are a file: origin/answers.md, which the structure agent reads.
 */
export function answerFileFor(gate: string, decision: string): string | null {
  return gate === 'answers' && decision === 'answered' ? 'origin/answers.md' : null;
}

/** The answer as an origin: exactly the words given, said to be written, never edited. */
export function answerOrigin(slug: string, words: string, date: string, by: string): string {
  const who = by.includes('@') ? ` by ${by}` : '';
  const why = `Victor's answers to the interview about "${slug}", written in the studio${who} on ${date}. Kept exactly as written; the structure agent reads them beside the origin.`;
  return [
    '---',
    'why: >',
    `  ${why}`,
    `recorded: ${date}`,
    'language: en',
    'medium: text',
    'speakers: [victor]',
    'edited: false',
    '---',
    '',
    words.trim(),
    '',
  ].join('\n');
}
