// Why: Bicep has what-if; Roadbook has plan. Before anything is built or deployed, the owner should be able
// to read, in plain words, what the project will do: which agents run on which models, where data goes,
// what it will cost at most per run, what a person must approve, and what is still missing. Nothing here
// touches the network; it only reads the project and the environment it is given.
import type { Node, Project, Region, Workflow } from './schema.js';

export interface PlannedNode {
  id: string;
  kind: Node['kind'];
  why: string;
  provider?: string;
  /** Worst case: every retry used, and the fallback tried once if there is one. */
  maxUsdPerRun?: number;
  stage?: string;
  needsApproval?: boolean;
  retries?: number;
  onFailure?: string;
  escalatesTo?: string;
}

export interface PlannedWorkflow {
  id: string;
  why: string;
  nodes: PlannedNode[];
  gates: { id: string; asks: string; question: string; capacity?: string }[];
  sinks: { id: string; target: string }[];
  /** Upper bound: every agent and guard runs, uses every retry, and tries its fallback. */
  maxUsdPerRun: number;
}

export interface PlannedExit {
  provider: string;
  kind: string;
  sends: string[];
  region: Region;
  retention: string;
  usedBy: string[];
}

export interface PlannedSecret {
  name: string;
  neededBy: string[];
  setHere: boolean;
}

export interface PlannedResource {
  kind: string;
  name: string;
  why: string;
}

export interface Plan {
  project: string;
  owner: string;
  workflows: PlannedWorkflow[];
  exits: PlannedExit[];
  secrets: PlannedSecret[];
  resources: PlannedResource[];
  budget: { monthlyCapUsd: number; runsAtCap: number | null };
  capacity: { gate: string; limit: string }[];
}

function providerOf(n: Node): string | undefined {
  if (n.kind !== 'agent' && n.kind !== 'guard') return undefined;
  return n.provider ?? n.card.model.default;
}

function sinkLabel(n: Extract<Node, { kind: 'sink' }>): string {
  const t = n.target;
  switch (t.kind) {
    case 'github-pr':
      return `GitHub pull request on ${t.repo}`;
    case 'azure-repos-pr':
      return `Azure Repos pull request on ${t.organisation}/${t.project}/${t.repo}`;
    case 'dry-run':
      return 'dry run: the result is shown, nothing is sent';
  }
}

function capacityLabel(c: { perDay?: number | undefined; perWeek?: number | undefined }): string {
  const parts: string[] = [];
  if (c.perDay !== undefined) parts.push(`${String(c.perDay)} a day`);
  if (c.perWeek !== undefined) parts.push(`${String(c.perWeek)} a week`);
  return parts.join(', ');
}

function planWorkflow(p: Project, wf: Workflow): PlannedWorkflow {
  const entries = Object.entries(wf.nodes);
  const nodes: PlannedNode[] = entries.map(([id, n]) => {
    const planned: PlannedNode = { id, kind: n.kind, why: n.why };
    if (n.kind === 'agent' || n.kind === 'guard') {
      const provider = providerOf(n);
      if (provider !== undefined) planned.provider = provider;
      const b = n.card.behaviour;
      const attempts = 1 + b.retry.max + (b.onFailure === 'use-fallback' ? 1 : 0);
      planned.maxUsdPerRun = n.card.budget.usdPerRun * attempts;
      planned.stage = n.card.stage;
      planned.needsApproval = b.needsApproval;
      planned.retries = b.retry.max;
      planned.onFailure = b.onFailure;
      const to = b.escalate.to;
      planned.escalatesTo = to === 'owner' ? 'owner' : 'gate' in to ? `gate ${to.gate}` : to.email;
    }
    return planned;
  });
  const gates = entries.flatMap(([id, n]) => {
    if (n.kind !== 'gate') return [];
    const cap = p.flow.capacity[id];
    return [
      {
        id,
        asks: n.asks,
        question: n.question,
        ...(cap ? { capacity: capacityLabel(cap) } : {}),
      },
    ];
  });
  const sinks = entries.flatMap(([id, n]) =>
    n.kind === 'sink' ? [{ id, target: sinkLabel(n) }] : [],
  );
  const maxUsdPerRun = nodes.reduce((sum, n) => sum + (n.maxUsdPerRun ?? 0), 0);
  return { id: wf.id, why: wf.why, nodes, gates, sinks, maxUsdPerRun };
}

function resourcesFor(p: Project): PlannedResource[] {
  const r = p.runtime;
  if (r.kind === 'local') {
    return [{ kind: 'local', name: 'this machine', why: 'Runs here; nothing is provisioned.' }];
  }
  return [
    {
      kind: 'cloudflare-worker',
      name: r.worker,
      why: 'Serves the site and the studio, and runs each workflow as a Durable Object.',
    },
    {
      kind: 'custom-domain',
      name: r.domain,
      why: 'Where the project is reached; claimed by the Worker.',
    },
    {
      kind: 'access-application',
      name: `${r.domain}/studio and /api/*`,
      why: `Only ${r.access.join(', ')} can open the studio or call its API.`,
    },
    ...r.buckets.map((name) => ({
      kind: 'r2-bucket',
      name,
      why: 'Raw material (audio, images) kept in the owner’s own storage.',
    })),
  ];
}

export function plan(p: Project, env: Readonly<Record<string, string | undefined>> = {}): Plan {
  const workflows = p.workflows.map((wf) => planWorkflow(p, wf));

  const usedBy = new Map<string, string[]>();
  for (const wf of p.workflows) {
    for (const [id, n] of Object.entries(wf.nodes)) {
      const provider = providerOf(n);
      if (provider !== undefined)
        usedBy.set(provider, [...(usedBy.get(provider) ?? []), `${wf.id}/${id}`]);
    }
  }

  const exits: PlannedExit[] = Object.entries(p.providers).flatMap(([name, provider]) => {
    const exit = p.data.exits[name];
    if (!exit) return [];
    return [
      {
        provider: name,
        kind: provider.kind,
        sends: exit.sends,
        region: exit.region,
        retention: exit.retention,
        usedBy: usedBy.get(name) ?? [],
      },
    ];
  });

  const secretUse = new Map<string, string[]>();
  for (const [name, provider] of Object.entries(p.providers)) {
    if (provider.secret !== undefined) {
      secretUse.set(provider.secret, [...(secretUse.get(provider.secret) ?? []), name]);
    }
  }
  for (const wf of p.workflows) {
    for (const n of Object.values(wf.nodes)) {
      if (n.kind === 'sink' && n.target.kind === 'github-pr') {
        secretUse.set('GITHUB_TOKEN', [
          ...(secretUse.get('GITHUB_TOKEN') ?? []),
          `sink ${n.target.repo}`,
        ]);
      }
    }
  }
  const secrets: PlannedSecret[] = [...secretUse.entries()].map(([name, neededBy]) => ({
    name,
    neededBy: [...new Set(neededBy)],
    setHere: typeof env[name] === 'string' && env[name] !== '',
  }));

  const costliest = Math.max(0, ...workflows.map((w) => w.maxUsdPerRun));
  return {
    project: p.name,
    owner: `${p.owner.name} <${p.owner.email}>`,
    workflows,
    exits,
    secrets,
    resources: resourcesFor(p),
    budget: {
      monthlyCapUsd: p.budget.monthlyCapUsd,
      runsAtCap: costliest > 0 ? Math.floor(p.budget.monthlyCapUsd / costliest) : null,
    },
    capacity: Object.entries(p.flow.capacity).map(([gate, c]) => ({
      gate,
      limit: capacityLabel(c),
    })),
  };
}
