// Why: /how-it-works lists every agent with its why, what it reads and what it writes. Workflow facts come
// from each agent's card; the agent's rationale stays in its prompt.
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

export interface AgentCardFacts {
  name: string;
  phase: number;
  reads: string[];
  writes: string[];
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

function whysFrom(prompts: string[]): Map<string, string> {
  const whys = new Map<string, string>();
  for (const prompt of prompts) {
    const frontMatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(prompt)?.[1];
    if (frontMatter === undefined) continue;
    const meta: unknown = parse(frontMatter);
    if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) continue;
    const record = meta as Record<string, unknown>;
    if (typeof record['name'] === 'string' && typeof record['why'] === 'string') {
      whys.set(record['name'], record['why'].trim().replace(/\s+/g, ' '));
    }
  }
  return whys;
}

/** One entry per card matched to its prompt rationale; by phase, then by name. */
export function rosterFrom(agentFacts: AgentCardFacts[], prompts: string[]): AgentCard[] {
  const whys = whysFrom(prompts);
  const roster: AgentCard[] = [];
  for (const facts of agentFacts) {
    const why = whys.get(facts.name);
    if (
      facts.name.trim() === '' ||
      why === undefined ||
      why === '' ||
      !Number.isInteger(facts.phase) ||
      facts.phase < 1 ||
      facts.reads.length === 0 ||
      facts.writes.length === 0
    ) {
      continue;
    }
    roster.push({
      name: facts.name,
      why,
      phase: facts.phase,
      reads: facts.reads,
      writes: facts.writes,
      canHold: holders.has(facts.name),
    });
  }
  return roster.sort((a, b) => a.phase - b.phase || a.name.localeCompare(b.name));
}

/** The first sentence of a why: the line on a closed row. */
export function firstSentence(text: string): string {
  const match = /^.+?[.!?](?=\s|$)/.exec(text);
  return match ? match[0] : text;
}
