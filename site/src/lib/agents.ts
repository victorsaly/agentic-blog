// Why: /how-it-works lists every agent with its why, what it reads and what it writes. The facts come from
// each agent's card, so the page and the workflow use the same source.

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
  why: string;
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

/** One card per agent that names itself, has a why and a phase; by phase, then by name. */
export function rosterFrom(agentFacts: AgentCardFacts[]): AgentCard[] {
  const roster: AgentCard[] = [];
  for (const facts of agentFacts) {
    if (
      facts.name.trim() === '' ||
      facts.why.trim() === '' ||
      !Number.isInteger(facts.phase) ||
      facts.phase < 1 ||
      facts.reads.length === 0 ||
      facts.writes.length === 0
    ) {
      continue;
    }
    roster.push({
      name: facts.name,
      why: facts.why.trim().replace(/\s+/g, ' '),
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
