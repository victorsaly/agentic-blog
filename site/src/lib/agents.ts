// Why: /how-it-works lists every agent with its why, what it reads and what it writes. That list is read
// from each agents/*/PROMPT.md front matter at build time, not retyped, so the page cannot drift from the
// agents it describes: change a prompt's why and the page changes with it.
import { parse } from 'yaml';

export interface AgentCard {
  name: string;
  why: string;
  phase: number;
  reads: string[];
  writes: string[];
  /** It can stop a post with a written reason (the runner exits 3 and the check fails). */
  canHold: boolean;
}

/** What each phase is for, in the words the page uses. */
export const phases: Record<number, string> = {
  1: 'Ask',
  2: 'Shape',
  3: 'Learn',
  4: 'Make',
  5: 'Check and send',
};

const holders = new Set(['safety', 'security']);

function list(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((v): v is string => typeof v === 'string' && v.trim() !== '')
        .map((v) => v.trim())
    : [];
}

/** The front matter between the first two --- lines, parsed; null when there is none. */
function frontMatter(markdown: string): unknown {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown);
  return match?.[1] === undefined ? null : parse(match[1]);
}

/** One card per PROMPT.md that names itself, has a why and a phase; by phase, then by name. */
export function rosterFrom(prompts: string[]): AgentCard[] {
  const cards: AgentCard[] = [];
  for (const markdown of prompts) {
    const meta = frontMatter(markdown);
    if (typeof meta !== 'object' || meta === null) continue;
    const { name, why, phase, reads, writes } = meta as Record<string, unknown>;
    if (typeof name !== 'string' || typeof why !== 'string' || typeof phase !== 'number') continue;
    cards.push({
      name,
      why: why.trim().replace(/\s+/g, ' '),
      phase,
      reads: list(reads),
      writes: list(writes),
      canHold: holders.has(name),
    });
  }
  return cards.sort((a, b) => a.phase - b.phase || a.name.localeCompare(b.name));
}

/** The first sentence of a why: the line on a closed row. */
export function firstSentence(text: string): string {
  const match = /^.+?[.!?](?=\s|$)/.exec(text);
  return match ? match[0] : text;
}
