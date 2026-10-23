// Why: every agent has the same shape so the runner, the workflows and a future service can treat them
// alike: a name, a why, what it reads, what it writes, and one run() that takes a context and returns
// files to open a pull request with. The types are the contract; PROMPT.md is the behaviour.
import { z } from 'zod';

export const agentNames = [
  'interview',
  'profile',
  'structure',
  'convert',
  'image',
  'citations',
  'drilldown',
  'feedback',
  'safety',
  'security',
  'seo',
  'publish',
] as const;

export type AgentName = (typeof agentNames)[number];

export const promptFrontMatter = z.object({
  name: z.enum(agentNames),
  why: z.string().trim().min(20).max(600),
  phase: z.number().int().min(0).max(5),
  reads: z.array(z.string().min(1)).min(1),
  writes: z.array(z.string().min(1)).min(1),
  model: z.string().min(1).optional(),
  max_output_tokens: z.number().int().positive().optional(),
});

export type PromptFrontMatter = z.infer<typeof promptFrontMatter>;

export interface Prompt {
  meta: PromptFrontMatter;
  /** The body of PROMPT.md: the instructions, after the why. */
  instructions: string;
}

export interface Settings {
  site: {
    name: string;
    domain: string;
    tagline: string;
    author: string;
    email: string;
    timezone: string;
  };
  languages: { origin: string; publish: string[] };
  themes: string[];
  depths: string[];
  publishing: { index: boolean; badge_text: string; social: string[] };
  licence: { code: string; content: string };
  media: { audio_bucket: string; image_style: string; voice_id: string | null };
  agents: { model: string; max_output_tokens: number; review_required: true };
}

export interface ThoughtFiles {
  slug: string;
  dir: string;
  /** Relative path → content, for every Markdown file in the thought folder. */
  files: Map<string, string>;
}

export interface AgentContext {
  agent: AgentName;
  prompt: Prompt;
  settings: Settings;
  profile: string;
  thought: ThoughtFiles;
  /** Calls the reasoning model with the profile and the prompt already in the system message. */
  ask: (user: string, options?: AskOptions) => Promise<string>;
  /** Today, so output files carry a date the runner controls. */
  today: string;
}

export interface AskOptions {
  maxOutputTokens?: number;
  model?: string;
  /** Lets the model search the web (Anthropic's server-side tool), at most this many times. */
  webSearch?: { maxUses: number };
}

/** A file an agent wants written. Paths are relative to the thought folder (or the repo for profile/wiki). */
export interface OutputFile {
  path: string;
  content: string;
  /** Raw bytes for a non-Markdown file such as a picture; content is then ignored. */
  bytes?: Uint8Array;
  /** Where the path starts. Defaults to the agent's usual place (the thought, or the repo for profile/wiki). */
  base?: 'thought' | 'repo';
}

export interface AgentResult {
  status: 'done' | 'nothing-to-do' | 'held' | 'not-implemented';
  /** One or two sentences for the pull request body. */
  summary: string;
  files: OutputFile[];
  /** When status is 'held': the reason the post must wait for a human. */
  holdReason?: string;
}

export type AgentRun = (ctx: AgentContext) => Promise<AgentResult>;

export const ORIGIN_DIR = 'origin/';

/** The one rule the runner enforces for every agent: nothing is ever written under origin/. */
export function assertNotOrigin(path: string): void {
  if (path.includes(`/${ORIGIN_DIR}`) || path.startsWith(ORIGIN_DIR)) {
    throw new Error(`refusing to write ${path}: origins are never edited`);
  }
}
