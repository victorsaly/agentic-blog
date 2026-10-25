// Why: the studio answers a gate in two steps, reading then deciding, and both cross a boundary: what the
// page sends is read here before anything is asked of GitHub, and what Victor needs beside the question (the
// interview's questions, the structure he is approving) is named here once. Pure, so the rules are tested.

export type GateDecision = 'answered' | 'approved' | 'redirected' | 'picked';
export type GateAsks = 'answer' | 'approve' | 'pick';

/** Longer than any answer Victor writes; the dispatch to GitHub has a size limit of its own. */
export const MAX_WORDS = 10_000;

const decisions: readonly GateDecision[] = ['answered', 'approved', 'redirected', 'picked'];

export function readGateRequest(
  body: unknown,
): { ok: true; value: { decision: GateDecision; words: string } } | { ok: false; error: string } {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'Send JSON.' };
  const { decision, words } = body as { decision?: unknown; words?: unknown };
  if (typeof decision !== 'string' || !(decisions as readonly string[]).includes(decision))
    return { ok: false, error: 'Say what you decided.' };
  const said = typeof words === 'string' ? words : '';
  if (said.length > MAX_WORDS)
    return { ok: false, error: `Keep it under ${String(MAX_WORDS)} characters.` };
  return { ok: true, value: { decision: decision as GateDecision, words: said } };
}

/** The file beside a gate's question, from the thought's folder, and what to call it. */
export function gateContext(gate: string): { file: string; label: string } | null {
  if (gate === 'answers') return { file: 'interview.md', label: 'The questions' };
  if (gate === 'message') return { file: 'structure.md', label: 'The structure, with the message' };
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
