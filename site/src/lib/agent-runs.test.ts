// Why: the Agents area is only worth opening if it tells the truth about a run; a held post shown as a
// plain failure, or a queued run missing, would send Victor to the wrong place.
import { describe, expect, it } from 'vitest';
import {
  HOLD_STEP,
  agentName,
  durationOf,
  isShown,
  liveRunOf,
  needsSteps,
  readLiveRuns,
  readRunName,
  readRuns,
  readSteps,
  type RawRun,
} from './agent-runs.js';

const run = (over: Partial<RawRun> = {}): RawRun => ({
  id: 1,
  display_title: 'agent:structure · 2026-10-23-a-thought',
  status: 'completed',
  conclusion: 'success',
  created_at: '2026-10-25T09:00:00Z',
  updated_at: '2026-10-25T09:04:00Z',
  html_url: 'https://github.com/o/r/actions/runs/1',
  pr: 12,
  ...over,
});

describe('readRunName', () => {
  it('reads the agent and the thought from a manual run and from a label on a branch', () => {
    expect(readRunName('agent:voice · 2026-10-23-a-thought')).toEqual({
      agent: 'voice',
      thought: '2026-10-23-a-thought',
    });
    expect(readRunName('agent:safety · origin/2026-10-23-a-thought')).toEqual({
      agent: 'safety',
      thought: '2026-10-23-a-thought',
    });
  });

  it('knows neither for a run from before the workflow named its runs', () => {
    expect(readRunName('content: reviewed 7 files')).toEqual({ agent: null, thought: null });
  });
});

describe('the state of a run', () => {
  it('is queued until GitHub starts it, then running with the step it is on', () => {
    expect(liveRunOf(run({ status: 'queued', conclusion: null })).state).toBe('queued');
    const going = liveRunOf(run({ status: 'in_progress', conclusion: null }), [
      { name: 'Set up job', status: 'completed', conclusion: 'success' },
      { name: 'Run the agent', status: 'in_progress', conclusion: null },
    ]);
    expect(going).toMatchObject({
      state: 'running',
      step: 'Run the agent',
      agent: 'structure',
      prUrl: 'https://github.com/o/r/pull/12',
    });
  });

  it('tells a held post from a failure by the hold step', () => {
    const failed = run({ conclusion: 'failure' });
    expect(
      liveRunOf(failed, [{ name: HOLD_STEP, status: 'completed', conclusion: 'failure' }]).state,
    ).toBe('held');
    expect(
      liveRunOf(failed, [{ name: HOLD_STEP, status: 'completed', conclusion: 'skipped' }]).state,
    ).toBe('failed');
    expect(liveRunOf(run({ conclusion: 'cancelled' })).state).toBe('stopped');
  });

  it('asks for the steps only when they change the answer, and hides skipped runs', () => {
    expect(needsSteps(run({ status: 'in_progress', conclusion: null }))).toBe(true);
    expect(needsSteps(run({ conclusion: 'failure' }))).toBe(true);
    expect(needsSteps(run())).toBe(false);
    expect(isShown(run({ conclusion: 'skipped' }))).toBe(false);
  });
});

describe('reading GitHub and the endpoint', () => {
  it('keeps only what is shaped like a run, with its pull request', () => {
    const runs = readRuns({
      workflow_runs: [
        {
          id: 7,
          display_title: 'agent:seo · 2026-10-23-a',
          status: 'completed',
          conclusion: 'success',
          created_at: 'a',
          updated_at: 'b',
          html_url: 'u',
          pull_requests: [{ number: 3 }],
        },
        { id: 'not a run' },
      ],
    });
    expect(runs).toHaveLength(1);
    expect(runs[0]?.pr).toBe(3);
    expect(readRuns(null)).toEqual([]);
    expect(readSteps({ jobs: [{ steps: [{ name: 's', status: 'queued' }] }] })).toEqual([
      { name: 's', status: 'queued', conclusion: null },
    ]);
  });

  it('reads its own answer back and refuses something else', () => {
    expect(readLiveRuns({ runs: [liveRunOf(run())] })).toHaveLength(1);
    expect(readLiveRuns({ error: 'no' })).toBeNull();
  });
});

describe('durationOf', () => {
  it('says seconds, minutes, or hours and minutes', () => {
    expect(durationOf('2026-10-25T09:00:00Z', '2026-10-25T09:00:42Z')).toBe('42 s');
    expect(durationOf('2026-10-25T09:00:00Z', '2026-10-25T09:04:10Z')).toBe('4 min');
    expect(durationOf('2026-10-25T09:00:00Z', '2026-10-25T10:05:00Z')).toBe('1 h 5 min');
  });

  it('says whole days from two days on', () => {
    expect(durationOf('2026-10-23T09:00:00Z', '2026-10-25T08:00:00Z')).toBe('47 h');
    expect(durationOf('2026-10-01T09:00:00Z', '2026-10-25T10:00:00Z')).toBe('24 days');
  });
});

describe('agentName', () => {
  it('capitalises a name and spells SEO as letters', () => {
    expect(agentName('structure')).toBe('Structure');
    expect(agentName('seo')).toBe('SEO');
  });
});
