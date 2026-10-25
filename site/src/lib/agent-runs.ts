// Why: the studio's Agents area shows what the agents are doing on GitHub right now. GitHub describes a run
// in its own words (status, conclusion, steps); this turns that into the few states Victor cares about
// (queued, running, done, held, failed, stopped), with which agent and which thought, so the page only
// shows. Pure and narrowed from unknown, so a change in GitHub's answer shows up in a test, not as a blank.

export type LiveState = 'queued' | 'running' | 'done' | 'held' | 'failed' | 'stopped';

export interface LiveRun {
  id: number;
  /** Null for runs from before the workflow named them. */
  agent: string | null;
  thought: string | null;
  /** GitHub's title for the run, shown when the agent or thought is not known. */
  title: string;
  state: LiveState;
  /** The step running now, in the workflow's words. */
  step: string | null;
  started: string;
  updated: string;
  url: string;
  pr: number | null;
  /** The pull request's page, from the run's own address. */
  prUrl: string | null;
}

/** The workflow step that only runs when the agent held the post (see .github/workflows/agents.yml). */
export const HOLD_STEP = 'Hold the post if the agent said so';

const SLUG = /\d{4}-\d{2}-\d{2}-[a-z0-9-]+/;

/** "agent:structure · 2026-10-23-a" (the workflow's run-name) into its agent and thought. */
export function readRunName(name: string): { agent: string | null; thought: string | null } {
  const match = /^agent:([a-z-]+)\s+·\s+(.*)$/.exec(name.trim());
  if (!match) return { agent: null, thought: null };
  return { agent: match[1] ?? null, thought: SLUG.exec(match[2] ?? '')?.[0] ?? null };
}

export interface RawRun {
  id: number;
  display_title: string;
  status: string;
  conclusion: string | null;
  created_at: string;
  updated_at: string;
  html_url: string;
  pr: number | null;
}

export interface RawStep {
  name: string;
  status: string;
  conclusion: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** The runs in GitHub's list answer; anything not shaped like a run is left out. */
export function readRuns(data: unknown): RawRun[] {
  if (!isRecord(data) || !Array.isArray(data.workflow_runs)) return [];
  return data.workflow_runs.flatMap((r: unknown): RawRun[] => {
    if (!isRecord(r)) return [];
    const { id, display_title, status, conclusion, created_at, updated_at, html_url } = r;
    if (
      typeof id !== 'number' ||
      typeof display_title !== 'string' ||
      typeof status !== 'string' ||
      typeof created_at !== 'string' ||
      typeof updated_at !== 'string' ||
      typeof html_url !== 'string'
    )
      return [];
    const prs = Array.isArray(r.pull_requests) ? (r.pull_requests as unknown[]) : [];
    const first = prs[0];
    const pr = isRecord(first) && typeof first.number === 'number' ? first.number : null;
    return [
      {
        id,
        display_title,
        status,
        conclusion: typeof conclusion === 'string' ? conclusion : null,
        created_at,
        updated_at,
        html_url,
        pr,
      },
    ];
  });
}

/** Every step of every job in GitHub's jobs answer for one run. */
export function readSteps(data: unknown): RawStep[] {
  if (!isRecord(data) || !Array.isArray(data.jobs)) return [];
  return data.jobs.flatMap((job: unknown): RawStep[] => {
    if (!isRecord(job) || !Array.isArray(job.steps)) return [];
    return job.steps.flatMap((s: unknown): RawStep[] =>
      isRecord(s) && typeof s.name === 'string' && typeof s.status === 'string'
        ? [
            {
              name: s.name,
              status: s.status,
              conclusion: typeof s.conclusion === 'string' ? s.conclusion : null,
            },
          ]
        : [],
    );
  });
}

/** A run GitHub skipped was a label that was not an agent's; it is not shown at all. */
export function isShown(run: RawRun): boolean {
  return run.conclusion !== 'skipped';
}

/** True when the state depends on the steps: a run going now (which step) or one that failed (held or not). */
export function needsSteps(run: RawRun): boolean {
  return run.status === 'in_progress' || run.conclusion === 'failure';
}

export function stateOf(run: RawRun, steps: readonly RawStep[] = []): LiveState {
  if (run.status === 'in_progress') return 'running';
  if (run.status !== 'completed') return 'queued';
  if (run.conclusion === 'success') return 'done';
  if (run.conclusion === 'cancelled') return 'stopped';
  const held = steps.some((s) => s.name === HOLD_STEP && s.conclusion === 'failure');
  return held ? 'held' : 'failed';
}

export function liveRunOf(run: RawRun, steps: readonly RawStep[] = []): LiveRun {
  const { agent, thought } = readRunName(run.display_title);
  const state = stateOf(run, steps);
  return {
    id: run.id,
    agent,
    thought,
    title: run.display_title,
    state,
    step:
      state === 'running' ? (steps.find((s) => s.status === 'in_progress')?.name ?? null) : null,
    started: run.created_at,
    updated: run.updated_at,
    url: run.html_url,
    pr: run.pr,
    prUrl:
      run.pr === null
        ? null
        : run.html_url.replace(/\/actions\/runs\/.*$/, `/pull/${String(run.pr)}`),
  };
}

/** The endpoint's answer, read back on the page. */
export function readLiveRuns(data: unknown): LiveRun[] | null {
  if (!isRecord(data) || !Array.isArray(data.runs)) return null;
  const states: readonly string[] = ['queued', 'running', 'done', 'held', 'failed', 'stopped'];
  return data.runs.filter(
    (r: unknown): r is LiveRun =>
      isRecord(r) &&
      typeof r.id === 'number' &&
      typeof r.title === 'string' &&
      typeof r.state === 'string' &&
      states.includes(r.state) &&
      typeof r.started === 'string' &&
      typeof r.updated === 'string' &&
      typeof r.url === 'string',
  );
}

/** "4 min", "1 h 5 min": how long from one moment to another, in whole minutes, seconds under one. */
export function durationOf(fromIso: string, toIso: string): string {
  const seconds = Math.max(0, Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 1000));
  if (seconds < 60) return `${String(seconds)} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${String(minutes)} min`;
  const rest = minutes % 60;
  return `${String(Math.floor(minutes / 60))} h${rest ? ` ${String(rest)} min` : ''}`;
}

/** An agent's name as a heading shows it: capitalised, and SEO as the letters it is. */
export function agentName(name: string): string {
  return name === 'seo' ? 'SEO' : name.charAt(0).toUpperCase() + name.slice(1);
}
