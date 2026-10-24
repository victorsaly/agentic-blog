// Why: the shape of a Roadbook project, in one place. Everything a project can declare is described here,
// and anything it cannot declare is left out on purpose: there is no field to switch off a gate, to make
// an override silent, or to skip a why. The accountability rules start as things the schema refuses to say.
import { z } from 'zod';

/** A short plain-words reason. Every node, card and exit must carry one. */
export const why = z
  .string()
  .trim()
  .min(20, 'a why needs at least a sentence')
  .max(600, 'a why is two or three sentences, not an essay');

const id = z
  .string()
  .regex(/^[a-z][a-z0-9-]*$/, 'use lowercase letters, digits and dashes, starting with a letter');

/** What kind of data crosses a boundary. Declared on exits and on agent cards so they can be compared. */
export const dataKind = z.enum([
  'text', // prose written or spoken by a person, or derived from it
  'audio', // a recording
  'image', // a picture
  'prompt', // instructions written by the project, no personal content
  'code', // source code or diffs
  'metadata', // titles, tags, dates
]);

export const region = z.enum(['uk', 'eu', 'us', 'global', 'local']);

// ---------------------------------------------------------------------------------------------- providers

export const providerKind = z.enum([
  'claude',
  'openai',
  'openai-images',
  'azure-openai',
  'gemini',
  'workers-ai',
  'openai-compatible',
]);

export const provider = z.object({
  kind: providerKind,
  /** The default model this provider is called with; a card may name another allowed one. */
  model: z.string().min(1).optional(),
  /** The environment variable that holds the key. Never the key itself. */
  secret: z.string().regex(/^[A-Z][A-Z0-9_]*$/).optional(),
  /** For openai-compatible and azure-openai: where the endpoint lives. */
  endpoint: z.string().url().optional(),
});

// ---------------------------------------------------------------------------------------------- data

/** One declared way out: which provider, what it may receive, where it processes it, what it keeps. */
export const dataExit = z.object({
  sends: z.array(dataKind).min(1),
  region,
  retention: z.enum(['zero', 'provider-default', 'owner-storage']),
  why,
});

export const dataRules = z.object({
  /** Where the project runs. 'owner-account' means an account the owner controls; there is no other option. */
  host: z.literal('owner-account'),
  /** Where the owner's data lives at rest. */
  home: region,
  /** The regions an exit may process data in. An exit outside this list is refused. */
  allowedRegions: z.array(region).min(1),
  /** Personal data found in an output is held for a person to review before it leaves. */
  personalData: z.literal('hold-for-review'),
  /** Every provider used by the project must appear here, by the provider's name. */
  exits: z.record(id, dataExit),
});

// ---------------------------------------------------------------------------------------------- agent card

export const port = z.object({
  name: z.string().min(1),
  type: z.enum(['text', 'markdown', 'image', 'audio', 'json', 'list', 'file']),
  optional: z.boolean().optional(),
  limit: z.string().min(1).optional(),
});

export const doneMeans = z.object({
  id,
  /** The check in plain words, as a reviewer would say it. */
  says: z.string().min(10),
});

export const agentCard = z.object({
  name: id,
  purpose: z.string().min(10).max(200),
  why,
  inputs: z.array(port).min(1),
  outputs: z.array(port).min(1),
  mustNot: z.array(z.string().min(10)).min(1, 'an agent needs at least one line it never crosses'),
  doneMeans: z.array(doneMeans).min(1, 'an agent needs at least one measurable check'),
  qualityBar: z.object({
    /** Share of reviewed outputs approved without a rewrite, 0 to 1. */
    approvedWithoutRewrite: z.number().min(0).max(1),
  }),
  model: z.object({
    /** A provider name from the project's providers. */
    default: id,
    allowed: z.array(id).min(1),
  }),
  budget: z.object({
    usdPerRun: z.number().positive(),
    secondsPerRun: z.number().positive(),
  }),
  gateAfter: z.boolean(),
  data: z.object({ sends: z.array(dataKind).min(1) }),
  owner: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'a version is major.minor.patch'),
  stage: z.enum(['draft', 'trial', 'active', 'retired']),
  /** How many cases are in the agent's test set. Counted by the loader, not typed by hand. */
  tests: z.number().int().min(0).default(0),
});

// ---------------------------------------------------------------------------------------------- sinks

export const sink = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('github-pr'), repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/) }),
  z.object({
    kind: z.literal('azure-repos-pr'),
    organisation: z.string().min(1),
    project: z.string().min(1),
    repo: z.string().min(1),
  }),
  z.object({ kind: z.literal('dry-run') }),
]);

// ---------------------------------------------------------------------------------------------- workflow

const base = { why, after: z.array(id).default([]) };

export const node = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('input'), ...base, accepts: z.array(dataKind).min(1) }),
  z.object({
    kind: z.literal('agent'),
    ...base,
    card: agentCard,
    provider: id.optional(),
  }),
  z.object({ kind: z.literal('tool'), ...base, does: z.string().min(10) }),
  z.object({
    kind: z.literal('gate'),
    ...base,
    asks: z.enum(['answer', 'approve', 'pick']),
    question: z.string().min(5),
  }),
  z.object({
    kind: z.literal('branch'),
    ...base,
    when: z.string().min(5),
    then: id,
    otherwise: id,
  }),
  z.object({ kind: z.literal('guard'), ...base, card: agentCard, provider: id.optional() }),
  z.object({ kind: z.literal('sink'), ...base, target: sink }),
]);

export const workflow = z.object({
  id,
  why,
  nodes: z.record(id, node),
});

// ---------------------------------------------------------------------------------------------- flow

export const capacity = z.object({
  perDay: z.number().int().positive().optional(),
  perWeek: z.number().int().positive().optional(),
});

export const flow = z.object({
  /** Keys are gate node ids; the value is how many items a person can take through it. */
  capacity: z.record(id, capacity).default({}),
  release: z
    .object({
      cadence: z.string().min(3),
      maxPerDay: z.number().int().positive(),
      spreadThemes: z.string().optional(),
    })
    .optional(),
  /** Expensive steps only run for work due to reach a person within this window, e.g. '3d'. */
  prepareAhead: z.string().regex(/^\d+[dhw]$/).optional(),
  categories: z
    .record(id, z.object({ importance: z.enum(['high', 'medium', 'low']) }))
    .default({}),
  ageing: z.string().optional(),
  holds: z.array(z.object({ when: z.string().min(3), until: z.string().min(3), why })).default([]),
});

// ---------------------------------------------------------------------------------------------- project

export const accountability = z.object({
  /** The two sides of the switch on everything published. */
  disclosure: z.object({ left: z.string().min(2), right: z.string().min(2) }),
  /** Whether each item's replay is public: chosen per item, or never. There is no "always, unasked". */
  replay: z.enum(['per-item', 'private']),
  /** An override of a hold always needs a reason. Shown here so nobody has to wonder. */
  overrideNeedsReason: z.literal(true),
});

export const runtime = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('cloudflare'),
    worker: id,
    domain: z.string().min(3),
    access: z.array(z.string().email()).min(1),
    buckets: z.array(id).default([]),
  }),
  z.object({ kind: z.literal('local') }),
]);

export const project = z.object({
  name: id,
  why,
  owner: z.object({ name: z.string().min(1), email: z.string().email() }),
  accountability,
  data: dataRules,
  providers: z.record(id, provider),
  budget: z.object({
    monthlyCapUsd: z.number().positive(),
    atCap: z.literal('queue'),
  }),
  flow: flow.default({}),
  workflows: z.array(workflow).min(1),
  runtime,
});

export type DataKind = z.infer<typeof dataKind>;
export type Region = z.infer<typeof region>;
export type Provider = z.infer<typeof provider>;
export type DataExit = z.infer<typeof dataExit>;
export type AgentCard = z.infer<typeof agentCard>;
export type AgentCardInput = z.input<typeof agentCard>;
export type Sink = z.infer<typeof sink>;
export type Node = z.infer<typeof node>;
export type NodeInput = z.input<typeof node>;
export type Workflow = z.infer<typeof workflow>;
export type WorkflowInput = z.input<typeof workflow>;
export type Project = z.infer<typeof project>;
export type ProjectInput = z.input<typeof project>;
