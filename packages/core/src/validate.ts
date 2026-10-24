// Why: the accountability rules are only real if breaking one stops the project. validate() is the single
// judge for every way a project can be written: by hand, in the builder, or by Claude through the MCP
// server. Each rule has a stable id, says what is wrong in plain words, and says how to fix it.
import type { ZodIssue } from 'zod';
import { project as projectSchema, type Node, type Project, type Workflow } from './schema.js';

export type Severity = 'error' | 'warning';

export interface Issue {
  rule: string;
  severity: Severity;
  /** Where in the project: "workflow blog-post › node publish", or a config path. */
  where: string;
  message: string;
  fix: string;
}

export interface Validation {
  ok: boolean;
  /** The parsed project, present when the shape was valid (even if rules failed). */
  project?: Project;
  issues: Issue[];
}

export interface ValidateOptions {
  /** Test cases found on disk per agent card name; overrides what the card says. */
  testCounts?: Readonly<Record<string, number>>;
}

/** The rules, by id. Kept as data so the CLI, the builder and the MCP server can explain them. */
export const rules = {
  RB001: 'The setup file has the shape Roadbook expects.',
  RB010: 'Nothing reaches a sink without a person approving it first.',
  RB020: 'Every link points at a node that exists.',
  RB021: 'A workflow has no loops.',
  RB022: 'A workflow starts at an input and has at least one sink.',
  RB023: 'A branch sends work only to nodes that wait for it.',
  RB030: 'An agent card is named after the node it describes.',
  RB031: 'Only active agents can reach a sink.',
  RB032: 'An agent whose card asks for a gate after it has one.',
  RB040: 'An agent runs on a declared provider its card allows.',
  RB041: 'Every provider has a declared data exit.',
  RB042: 'Every exit processes data only in an allowed region.',
  RB043: 'An agent sends only the kinds of data its exit allows.',
  RB044: 'The data home is one of the allowed regions.',
  RB050: 'Capacity is declared on gates that exist.',
  RB060: 'Every agent has a test set.',
  RB070: 'The owner can reach the studio.',
} as const;

export type RuleId = keyof typeof rules;

function issue(
  rule: RuleId,
  severity: Severity,
  where: string,
  message: string,
  fix: string,
): Issue {
  return { rule, severity, where, message, fix };
}

function fromZod(zodIssue: ZodIssue): Issue {
  const path = zodIssue.path.map(String).join('.') || 'the file';
  return issue(
    'RB001',
    'error',
    path,
    zodIssue.message,
    'Correct this field in roadbook.config.ts; the message says what is expected.',
  );
}

const at = (wf: Workflow, nodeId?: string): string =>
  nodeId === undefined ? `workflow ${wf.id}` : `workflow ${wf.id} › node ${nodeId}`;

function hasCard(n: Node): n is Extract<Node, { kind: 'agent' | 'guard' }> {
  return n.kind === 'agent' || n.kind === 'guard';
}

// ---------------------------------------------------------------------------------------------- graph

interface Graph {
  ids: string[];
  get: (nodeId: string) => Node | undefined;
  successors: (nodeId: string) => string[];
}

function graphOf(wf: Workflow): Graph {
  const entries = Object.entries(wf.nodes);
  const byId = new Map<string, Node>(entries);
  const next = new Map<string, string[]>();
  for (const [nodeId, n] of entries) {
    for (const before of n.after) {
      next.set(before, [...(next.get(before) ?? []), nodeId]);
    }
  }
  return {
    ids: entries.map(([nodeId]) => nodeId),
    get: (nodeId) => byId.get(nodeId),
    successors: (nodeId) => next.get(nodeId) ?? [],
  };
}

function findCycle(g: Graph): string[] | null {
  const state = new Map<string, 'visiting' | 'done'>();
  const stack: string[] = [];
  const visit = (nodeId: string): string[] | null => {
    const seen = state.get(nodeId);
    if (seen === 'done') return null;
    if (seen === 'visiting') return [...stack.slice(stack.indexOf(nodeId)), nodeId];
    state.set(nodeId, 'visiting');
    stack.push(nodeId);
    for (const s of g.successors(nodeId)) {
      const cycle = visit(s);
      if (cycle) return cycle;
    }
    stack.pop();
    state.set(nodeId, 'done');
    return null;
  };
  for (const nodeId of g.ids) {
    const cycle = visit(nodeId);
    if (cycle) return cycle;
  }
  return null;
}

/**
 * Nodes that can be reached from an input along a path that has not yet passed an approve gate.
 * A sink in this set could publish something no person approved.
 */
function openNodes(g: Graph, roots: string[]): Set<string> {
  const open = new Set<string>();
  const queue = [...roots];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined || open.has(current)) continue;
    open.add(current);
    const n = g.get(current);
    const closes = n?.kind === 'gate' && n.asks === 'approve';
    if (closes) continue;
    queue.push(...g.successors(current));
  }
  return open;
}

function reachesSink(g: Graph, from: string): boolean {
  const seen = new Set<string>();
  const queue = [...g.successors(from)];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined || seen.has(current)) continue;
    seen.add(current);
    if (g.get(current)?.kind === 'sink') return true;
    queue.push(...g.successors(current));
  }
  return false;
}

// ---------------------------------------------------------------------------------------------- rules

function checkWorkflow(p: Project, wf: Workflow, options: ValidateOptions): Issue[] {
  const issues: Issue[] = [];
  const g = graphOf(wf);

  // RB020: every link points at something
  for (const nodeId of g.ids) {
    const n = g.get(nodeId);
    if (!n) continue;
    for (const before of n.after) {
      if (!g.get(before)) {
        issues.push(
          issue(
            'RB020',
            'error',
            at(wf, nodeId),
            `"${nodeId}" waits for "${before}", which is not a node in this workflow.`,
            `Add a node called "${before}", or remove it from "${nodeId}".after.`,
          ),
        );
      }
    }
  }

  // RB021: no loops
  const cycle = findCycle(g);
  if (cycle) {
    issues.push(
      issue(
        'RB021',
        'error',
        at(wf),
        `The workflow loops: ${cycle.join(' → ')}. A loop with no exit would run for ever and spend for ever.`,
        'Break the loop. To rerun a step after feedback, use a gate; the runtime reruns the node for you.',
      ),
    );
  }

  // RB022: starts at an input, ends at a sink, nothing floating
  const roots = g.ids.filter((nodeId) => (g.get(nodeId)?.after.length ?? 0) === 0);
  for (const nodeId of roots) {
    if (g.get(nodeId)?.kind !== 'input') {
      issues.push(
        issue(
          'RB022',
          'error',
          at(wf, nodeId),
          `"${nodeId}" waits for nothing, but only an input may start a workflow.`,
          `Add the node it follows to "${nodeId}".after, or make it an input.`,
        ),
      );
    }
  }
  if (!g.ids.some((nodeId) => g.get(nodeId)?.kind === 'input')) {
    issues.push(
      issue(
        'RB022',
        'error',
        at(wf),
        'The workflow has no input.',
        'Add an input node.',
      ),
    );
  }
  const sinks = g.ids.filter((nodeId) => g.get(nodeId)?.kind === 'sink');
  if (sinks.length === 0) {
    issues.push(
      issue(
        'RB022',
        'error',
        at(wf),
        'The workflow has no sink, so its work never goes anywhere.',
        'Add a sink node (a pull request, or dry-run while you build).',
      ),
    );
  }

  // RB023: a branch only routes to nodes that wait for it
  for (const nodeId of g.ids) {
    const n = g.get(nodeId);
    if (n?.kind !== 'branch') continue;
    for (const target of [n.then, n.otherwise]) {
      if (!g.get(target)?.after.includes(nodeId)) {
        issues.push(
          issue(
            'RB023',
            'error',
            at(wf, nodeId),
            `The branch "${nodeId}" sends work to "${target}", which does not wait for it.`,
            `Add "${nodeId}" to "${target}".after.`,
          ),
        );
      }
    }
  }

  // RB010: the human gate before every sink. Only meaningful when the graph is sound.
  if (!cycle) {
    const open = openNodes(
      g,
      roots.filter((nodeId) => g.get(nodeId)?.kind === 'input'),
    );
    for (const sinkId of sinks) {
      if (open.has(sinkId)) {
        issues.push(
          issue(
            'RB010',
            'error',
            at(wf, sinkId),
            `Work can reach the sink "${sinkId}" without a person approving it. Roadbook does not allow that, in any project.`,
            `Put a gate that asks "approve" on every path into "${sinkId}".`,
          ),
        );
      }
    }
  }

  // Agent and guard rules
  for (const nodeId of g.ids) {
    const n = g.get(nodeId);
    if (!n || !hasCard(n)) continue;
    const card = n.card;
    const where = at(wf, nodeId);

    if (card.name !== nodeId) {
      issues.push(
        issue(
          'RB030',
          'error',
          where,
          `The node "${nodeId}" carries the card for "${card.name}".`,
          'Name the node after its agent, or give it the right card.',
        ),
      );
    }

    if (card.stage !== 'active' && !cycle && reachesSink(g, nodeId)) {
      issues.push(
        issue(
          'RB031',
          'error',
          where,
          `"${nodeId}" is in ${card.stage}, but it is on a path to a sink. Only active agents can touch real work.`,
          card.stage === 'trial'
            ? 'Finish the trial and set the card to active, or move the node off the path to the sink.'
            : 'Take it through a trial first.',
        ),
      );
    }

    if (card.gateAfter && !g.successors(nodeId).some((s) => g.get(s)?.kind === 'gate')) {
      issues.push(
        issue(
          'RB032',
          'error',
          where,
          `The card for "${nodeId}" says a person approves its output, but no gate follows it.`,
          `Add a gate whose after includes "${nodeId}", or change gateAfter on the card.`,
        ),
      );
    }

    const providerName = n.provider ?? card.model.default;
    if (!(providerName in p.providers)) {
      issues.push(
        issue(
          'RB040',
          'error',
          where,
          `"${nodeId}" runs on "${providerName}", which is not one of the project's providers.`,
          `Add "${providerName}" to providers, or choose a declared one.`,
        ),
      );
    } else if (!card.model.allowed.includes(providerName)) {
      issues.push(
        issue(
          'RB040',
          'error',
          where,
          `"${nodeId}" runs on "${providerName}", but its card only allows ${card.model.allowed.join(', ')}.`,
          `Add "${providerName}" to the card's allowed models, after checking it meets the quality bar.`,
        ),
      );
    }

    const exit = p.data.exits[providerName];
    if (exit) {
      const extra = card.data.sends.filter((kind) => !exit.sends.includes(kind));
      if (extra.length > 0) {
        issues.push(
          issue(
            'RB043',
            'error',
            where,
            `"${nodeId}" sends ${extra.join(', ')} to "${providerName}", but that exit only allows ${exit.sends.join(', ')}.`,
            `Widen the "${providerName}" exit on purpose, with a why, or stop the agent sending ${extra.join(', ')}.`,
          ),
        );
      }
    }

    const tests = options.testCounts?.[card.name] ?? card.tests;
    if (tests === 0) {
      issues.push(
        issue(
          'RB060',
          'warning',
          where,
          `"${nodeId}" has no test set, so its quality bar cannot be checked.`,
          `Add cases under agents/${card.name}/tests/.`,
        ),
      );
    }
  }

  return issues;
}

function checkProject(p: Project, options: ValidateOptions): Issue[] {
  const issues: Issue[] = [];

  // RB041, RB042: every provider is a declared, allowed way out
  for (const name of Object.keys(p.providers)) {
    const exit = p.data.exits[name];
    if (!exit) {
      issues.push(
        issue(
          'RB041',
          'error',
          `providers.${name}`,
          `The provider "${name}" has no data exit, so nobody has said what it may receive or where.`,
          `Add data.exits.${name} with sends, region, retention and why.`,
        ),
      );
      continue;
    }
    if (!p.data.allowedRegions.includes(exit.region)) {
      issues.push(
        issue(
          'RB042',
          'error',
          `data.exits.${name}`,
          `"${name}" processes data in ${exit.region}, which is not an allowed region (${p.data.allowedRegions.join(', ')}).`,
          `Choose a provider or deployment in an allowed region, or allow ${exit.region} on purpose.`,
        ),
      );
    }
  }

  // RB044: home is allowed
  if (!p.data.allowedRegions.includes(p.data.home)) {
    issues.push(
      issue(
        'RB044',
        'error',
        'data.home',
        `The data home is ${p.data.home}, but ${p.data.home} is not in allowedRegions.`,
        `Add ${p.data.home} to allowedRegions.`,
      ),
    );
  }

  // RB050: capacity sits on real gates
  const gates = new Set(
    p.workflows.flatMap((wf) =>
      Object.entries(wf.nodes)
        .filter(([, n]) => n.kind === 'gate')
        .map(([nodeId]) => nodeId),
    ),
  );
  for (const gateId of Object.keys(p.flow.capacity)) {
    if (!gates.has(gateId)) {
      issues.push(
        issue(
          'RB050',
          'error',
          `flow.capacity.${gateId}`,
          `Capacity is set for "${gateId}", which is not a gate in any workflow.`,
          'Use the id of a gate node; capacity measures what a person can take through a gate.',
        ),
      );
    }
  }

  // RB070: the owner can reach the studio
  if (p.runtime.kind === 'cloudflare' && !p.runtime.access.includes(p.owner.email)) {
    issues.push(
      issue(
        'RB070',
        'warning',
        'runtime.access',
        `The owner (${p.owner.email}) is not on the studio's access list.`,
        'Add the owner to runtime.access.',
      ),
    );
  }

  for (const wf of p.workflows) issues.push(...checkWorkflow(p, wf, options));
  return issues;
}

export function validate(input: unknown, options: ValidateOptions = {}): Validation {
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map(fromZod) };
  }
  const issues = checkProject(parsed.data, options);
  return {
    ok: issues.every((i) => i.severity !== 'error'),
    project: parsed.data,
    issues,
  };
}
