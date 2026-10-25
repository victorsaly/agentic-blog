// Why: a hold is the blogger's to release, and once released it must stay released, but only for the exact
// words he chose to keep. These pure functions read his decision from the previous security.md, set the
// verdict in code from the passages the model would hold, and carry the decision into the new file, so a
// rerun neither forgets what he decided nor lets a new or reworded passage through on an old decision.
import matter from 'gray-matter';
import { z } from 'zod';
import { markdownFile } from '../_lib/files.js';

/** What the blogger decided: who, when, and the exact passages he chose to keep. */
export interface Decision {
  decidedBy: string;
  decided: string;
  kept: string[];
}

const decisionSchema = z.object({
  decided_by: z.string().trim().min(1),
  decided: z.union([z.string().min(1), z.date().transform((d) => d.toISOString().slice(0, 10))]),
  kept: z.array(z.string().trim().min(1)).min(1),
});

/** The decision in a security.md, or null when it has none or it is incomplete (no exact passages). */
export function decisionIn(file: string | undefined): Decision | null {
  if (file === undefined) return null;
  const parsed = decisionSchema.safeParse(matter(file).data);
  return parsed.success
    ? { decidedBy: parsed.data.decided_by, decided: parsed.data.decided, kept: parsed.data.kept }
    : null;
}

/** Quotes compare on their words: the same text with straight or curly quotes and any spacing. */
const plain = (text: string): string =>
  text.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim().toLowerCase();

/** The held passages no kept passage covers. A held quote is covered when it sits inside one kept. */
export function notKept(held: readonly string[], kept: readonly string[]): string[] {
  const keptPlain = kept.map(plain);
  return held.filter((quote) => !keptPlain.some((k) => k.includes(plain(quote))));
}

export interface Verdict {
  verdict: 'pass' | 'hold';
  /** Held passages that were released by the decision. */
  released: string[];
  /** Held passages that still need the blogger. */
  open: string[];
}

/**
 * The verdict from what the model would hold, never from the model's own word alone: a hold with no
 * quoted passages stays a hold (nothing to check it against), and a pass that quotes passages is a hold.
 */
export function verdictFor(
  modelVerdict: unknown,
  held: readonly string[],
  decision: Decision | null,
): Verdict {
  if (modelVerdict !== 'pass' && modelVerdict !== 'hold')
    throw new Error(`security verdict must be pass or hold, got ${String(modelVerdict)}`);
  if (held.length === 0)
    return modelVerdict === 'pass'
      ? { verdict: 'pass', released: [], open: [] }
      : { verdict: 'hold', released: [], open: [] };
  const open = notKept(held, decision?.kept ?? []);
  const released = held.filter((q) => !open.includes(q));
  return { verdict: open.length === 0 ? 'pass' : 'hold', released, open };
}

const heldSchema = z.array(z.string().trim().min(1)).catch([]);

/**
 * The file as written: the model's body, its front matter with the verdict set by code, and the decision
 * carried over from the previous file. Any decision fields the model wrote are dropped: only a person
 * records one.
 */
export function finalFile(
  reply: string,
  decision: Decision | null,
): { content: string; verdict: Verdict } {
  const { data, content } = matter(reply);
  const held = heldSchema.parse(data['held']);
  const verdict = verdictFor(data['verdict'], held, decision);
  const front: Record<string, unknown> = Object.fromEntries(
    Object.entries(data).filter(([key]) => !['decided_by', 'decided', 'kept'].includes(key)),
  );
  front['verdict'] = verdict.verdict;
  front['held'] = held;
  if (decision) {
    front['decided_by'] = decision.decidedBy;
    front['decided'] = decision.decided;
    front['kept'] = decision.kept;
  }
  return { content: markdownFile(front, content), verdict };
}
