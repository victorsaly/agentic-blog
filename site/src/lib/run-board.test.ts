// Why: the board decides what Victor sees first and the timeline says what each event was; a slip here would
// show a stopped run as working, an old hold as standing, or words the ledger never said.
import { describe, expect, it } from 'vitest';
import {
  QUIET_MS,
  boardOf,
  clockOf,
  isQuiet,
  readRunDetail,
  readRunRows,
  readRunsAnswer,
  startingOn,
  waitingOnVictor,
  timelineOf,
  type ListedRun,
  type ShownEvent,
} from './run-board';
import type { LiveRun } from './agent-runs';

const USD = { show: 'USD', perUsd: 1 } as const;
const NOW = '2026-10-25T12:00:00.000Z';
const ago = (ms: number): string => new Date(Date.parse(NOW) - ms).toISOString();

function aRow(over: Partial<ListedRun> = {}): ListedRun {
  return {
    id: '20261025T115900Z-safety-d367',
    thought: '2026-10-23-a-thought',
    agent: 'safety',
    state: 'running',
    startedAt: ago(60_000),
    updatedAt: ago(5_000),
    usd: 0.01,
    events: 3,
    head: 'a'.repeat(64),
    latest: true,
    ...over,
  };
}

const event = (seq: number, fields: Record<string, unknown>): ShownEvent => {
  const type = typeof fields.type === 'string' ? fields.type : 'unknown';
  return { seq, at: ago(60_000 - seq * 1000), type, fields: { ...fields, seq } };
};

describe('reading the answers back', () => {
  it('keeps only what is a run', () => {
    const unmarked: Record<string, unknown> = { ...aRow() };
    delete unmarked.latest;
    expect(readRunRows({ runs: [aRow(), unmarked, { id: 'x' }] })).toHaveLength(1);
    expect(readRunRows({ error: 'nope' })).toBeNull();
  });

  it('reads a run with its events, dropping an event it cannot read', () => {
    const detail = readRunDetail({
      run: aRow(),
      events: [{ seq: 0, at: NOW, type: 'run.started' }, { seq: 'one' }],
      more: true,
    });
    expect(detail?.events).toHaveLength(1);
    expect(detail?.more).toBe(true);
    expect(readRunDetail({ run: { id: 'x' }, events: [] })).toBeNull();
  });
});

describe('what waits on Victor', () => {
  const cell = (id: string, state: string) => ({
    id,
    thought: '2026-10-23-a-thought',
    agent: 'safety',
    state,
    startedAt: ago(60_000),
    runs: 1,
  });

  it('reads the whole answer, and refuses one without where each thought stands', () => {
    expect(readRunsAnswer({ runs: [aRow()], standing: [cell('a', 'held'), { id: 1 }] })).toEqual({
      runs: [aRow()],
      standing: [cell('a', 'held')],
    });
    expect(readRunsAnswer({ runs: [aRow()] })).toBeNull();
  });

  it('counts holds that stand and questions not yet overtaken by a newer run', () => {
    const waiting = waitingOnVictor({
      runs: [
        aRow({ id: 'asks', state: 'needs-you' }),
        aRow({ id: 'old-ask', state: 'needs-you', latest: false }),
      ],
      standing: [cell('h', 'held'), cell('d', 'done')],
    });
    expect(waiting.asking.map((r) => r.id)).toEqual(['asks']);
    expect(waiting.holds.map((c) => c.id)).toEqual(['h']);
  });
});

describe('the board', () => {
  it('puts what needs Victor first, then running, held and finished', () => {
    const board = boardOf(
      [
        aRow({ id: 'a', state: 'needs-you', agent: 'structure' }),
        aRow({ id: 'b', state: 'running', agent: 'voice' }),
        aRow({ id: 'c', state: 'held', agent: 'safety' }),
        aRow({ id: 'd', state: 'done', agent: 'seo' }),
        aRow({ id: 'e', state: 'failed', agent: 'image' }),
      ],
      NOW,
    );
    expect(board.needsYou.map((r) => r.id)).toEqual(['a']);
    expect(board.going.map((r) => r.id)).toEqual(['b']);
    expect(board.held.map((r) => r.id)).toEqual(['c']);
    expect(board.finished.map((r) => r.id).sort()).toEqual(['d', 'e']);
  });

  it('marks a run quiet when it says it is going but has sent nothing for a while', () => {
    const board = boardOf(
      [aRow({ id: 'fresh' }), aRow({ id: 'silent', updatedAt: ago(QUIET_MS + 1000) })],
      NOW,
    );
    expect(board.going.find((r) => r.id === 'fresh')?.quiet).toBe(false);
    expect(board.going.find((r) => r.id === 'silent')?.quiet).toBe(true);
  });

  it('shows a hold only while it is the latest run started, even if it reported last', () => {
    const board = boardOf(
      [
        aRow({ id: 'old', state: 'held', latest: false, updatedAt: ago(1000) }),
        aRow({ id: 'new', state: 'done', updatedAt: ago(60_000) }),
        aRow({ id: 'other', state: 'held', thought: '2026-10-24-another' }),
      ],
      NOW,
    );
    expect(board.held.map((r) => r.id)).toEqual(['other']);
  });

  it('shows what GitHub started until the runner reports it, so the top never says nothing runs', () => {
    const onGithub = (over: Partial<LiveRun>): LiveRun => ({
      id: 1,
      agent: 'interview',
      thought: '2026-10-23-a-thought',
      title: 'agent:interview',
      state: 'running',
      step: 'Run npm ci --no-audit --no-fund',
      started: ago(30_000),
      updated: ago(5_000),
      url: 'https://github.com/o/r/actions/runs/1',
      pr: null,
      prUrl: null,
      ...over,
    });
    const installing = onGithub({});
    // Before the agent starts, the live copy has only an older run of it.
    const older = aRow({ agent: 'interview', state: 'done', startedAt: ago(3_600_000) });
    expect(startingOn([installing], [older])).toEqual([installing]);
    // Once the runner reports, the live copy's own row is the one shown.
    const heard = aRow({ agent: 'interview', startedAt: ago(10_000) });
    expect(startingOn([installing], [older, heard])).toEqual([]);
    // Finished on GitHub, or another agent's run, is not starting.
    expect(startingOn([onGithub({ state: 'done' })], [])).toEqual([]);
    expect(startingOn([installing], [aRow({ startedAt: ago(10_000) })])).toEqual([installing]);
  });

  it('never calls a run that needs Victor quiet, however long it waits', () => {
    const waiting = { state: 'needs-you', updatedAt: ago(QUIET_MS * 10) };
    expect(isQuiet(waiting, NOW)).toBe(false);
    expect(isQuiet({ ...waiting, state: 'running' }, NOW)).toBe(true);
    expect(isQuiet({ ...waiting, state: 'done' }, NOW)).toBe(false);
  });
});

describe('the timeline', () => {
  it('says each event in words, naming who did it', () => {
    const lines = timelineOf(
      [
        event(0, { type: 'run.started', workflow: 'blog-post', origin: 'o.md', by: 'local' }),
        event(1, { type: 'node.state', node: 'safety', from: 'idle', to: 'running' }),
        event(2, {
          type: 'cost.incurred',
          node: 'safety',
          provider: 'claude',
          usd: 0.012,
          units: '1k',
        }),
        event(3, {
          type: 'node.state',
          node: 'safety',
          from: 'running',
          to: 'held',
          reason: 'a name',
        }),
        event(4, { type: 'gate.opened', node: 'seo', asks: 'approve', question: 'This title?' }),
        event(5, { type: 'override.given', node: 'safety', reason: 'it is mine', by: 'owner' }),
      ],
      USD,
    );
    expect(lines.map((l) => `${l.who ?? ''} ${l.what}`)).toEqual([
      'Victor started the run (blog-post)',
      'Safety started',
      'Safety spent 1.2¢ on claude',
      'Safety held the post',
      'SEO asks you to approve',
      'Victor overrode Safety',
    ]);
    expect(lines[3]?.detail).toBe('a name');
    expect(lines[4]?.detail).toBe('This title?');
  });

  it('joins text one agent streamed in pieces into one line, in order', () => {
    const lines = timelineOf(
      [
        event(0, { type: 'node.delta', node: 'structure', text: 'Hello, ' }),
        event(1, { type: 'node.delta', node: 'structure', text: 'world.' }),
        event(2, { type: 'node.delta', node: 'seo', text: 'Other.' }),
      ],
      USD,
    );
    expect(lines.map((l) => [l.seq, l.who, l.detail])).toEqual([
      [0, 'Structure', 'Hello, world.'],
      [2, 'SEO', 'Other.'],
    ]);
  });

  it('shows an event it does not know by its type, rather than hiding it', () => {
    expect(timelineOf([event(0, { type: 'something.new' })], USD)[0]?.what).toBe('something.new');
  });
});

describe('the clock', () => {
  it('counts minutes and seconds, and hours when it must', () => {
    expect(clockOf(ago(42_000), NOW)).toBe('0:42');
    expect(clockOf(ago(725_000), NOW)).toBe('12:05');
    expect(clockOf(ago(3_725_000), NOW)).toBe('1:02:05');
    expect(clockOf(NOW, ago(5000))).toBe('0:00');
  });
});
