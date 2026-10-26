// Why: the studio answers a gate in two steps, reading then deciding, and both cross a boundary: what the
// page sends is read here before anything is asked of GitHub, and what Victor needs beside the question (the
// interview's questions, the structure he is approving) is named here once. An answer can be spoken: then it
// carries the key of its recording, which must be one the studio saved for an answer. Pure, so tested.
import { isSafeKey } from './origin-request';

export type GateDecision = 'answered' | 'approved' | 'redirected' | 'picked';
export type GateAsks = 'answer' | 'approve' | 'pick';

/** Longer than any answer Victor writes; the dispatch to GitHub has a size limit of its own. */
export const MAX_WORDS = 10_000;

const decisions: readonly GateDecision[] = ['answered', 'approved', 'redirected', 'picked'];

export interface GateRequest {
  decision: GateDecision;
  words: string;
  medium: 'voice' | 'text';
  /** The recording's key in R2, for a spoken answer. */
  key?: string;
}

export function readGateRequest(
  body: unknown,
): { ok: true; value: GateRequest } | { ok: false; error: string } {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'Send JSON.' };
  const { decision, words, medium, key } = body as {
    decision?: unknown;
    words?: unknown;
    medium?: unknown;
    key?: unknown;
  };
  if (typeof decision !== 'string' || !(decisions as readonly string[]).includes(decision))
    return { ok: false, error: 'Say what you decided.' };
  const said = typeof words === 'string' ? words : '';
  if (said.length > MAX_WORDS)
    return { ok: false, error: `Keep it under ${String(MAX_WORDS)} characters.` };
  if (medium === 'voice') {
    if (typeof key !== 'string' || !isSafeKey(key) || !key.startsWith('answer/'))
      return { ok: false, error: 'A spoken answer needs the key of its recording.' };
    return { ok: true, value: { decision: decision as GateDecision, words: said, medium, key } };
  }
  return { ok: true, value: { decision: decision as GateDecision, words: said, medium: 'text' } };
}

/** The file beside a gate's question, from the thought's folder, and what to call it. */
export function gateContext(gate: string): { file: string; label: string } | null {
  if (gate === 'answers') return { file: 'interview.md', label: 'The questions' };
  if (gate === 'message') return { file: 'structure.md', label: 'The structure, with the message' };
  // The gate before the way out shows what goes live, in short, without leaving the studio.
  if (gate === 'merge') return { file: 'versions/short.md', label: 'What goes live, in short' };
  return null;
}

/** The front matter of a Markdown file left out, so the page shows what was written for Victor to read. */
export function bodyOf(markdown: string): string {
  const match = /^---\n[\s\S]*?\n---\n?/.exec(markdown);
  return (match ? markdown.slice(match[0].length) : markdown).trim();
}

/** The order of a run's events is not enough: a gate's run can be waiting, closed, or not a gate at all. */
export interface GateView {
  gate: string;
  asks: GateAsks;
  question: string;
  open: boolean;
}

/** A run's gate, from its events as the run page has them; null when the run is not a gate's. */
export function gateOf(
  events: readonly { type: string; fields: Record<string, unknown> }[],
  state: string,
): GateView | null {
  const opened = events.find((e) => e.type === 'gate.opened');
  if (!opened) return null;
  const { node, asks, question } = opened.fields;
  if (typeof node !== 'string' || typeof question !== 'string') return null;
  if (asks !== 'answer' && asks !== 'approve' && asks !== 'pick') return null;
  return { gate: node, asks, question, open: state === 'needs-you' };
}
