// Why: every agent run as it happens, wherever it runs (GitHub or Victor's computer), read from the live copy
// the runner fills event by event. What needs Victor comes first, then what is running, what is held, and
// how the latest runs ended; each opens on its timeline. It asks again every few seconds while something is
// going and the page is in view. A run that says it is going but has sent nothing for a while is shown as
// quiet, never as working. When the studio cannot be asked it says so, and what it showed before keeps the
// time it was true. Only the summary line is announced, so a screen reader is not talked over by each refresh.
import { useCallback, useState } from 'react';
import { agentName, durationOf } from '../lib/agent-runs';
import { boardOf, isGoing, readRunRows, stateWord, type BoardRun } from '../lib/run-board';
import { moneyOf, type Currency } from '../lib/money';
import type { LiveRunRow } from '../lib/live-runs';
import { usePoll } from './use-poll';

const BUSY_MS = 5_000;
const QUIET_MS = 30_000;

interface Status {
  known: { rows: LiveRunRow[]; at: string } | null;
  error: string | null;
}

function errorOf(data: unknown): string {
  return typeof data === 'object' &&
    data !== null &&
    typeof (data as { error?: unknown }).error === 'string'
    ? (data as { error: string }).error
    : 'The studio could not read the runs.';
}

export interface RunsBoardProps {
  /** Thought titles by folder name, so a run names its thought the way the site does. */
  titles: Record<string, string>;
  currency: Currency;
}

export function RunsBoard({ titles, currency }: RunsBoardProps): React.JSX.Element {
  const [status, setStatus] = useState<Status>({ known: null, error: null });

  const ask = useCallback(async (): Promise<number> => {
    try {
      const response = await fetch('/api/runs');
      const data: unknown = await response.json().catch(() => null);
      const rows = response.ok ? readRunRows(data) : null;
      if (rows === null) throw new Error(errorOf(data));
      setStatus({ known: { rows, at: new Date().toISOString() }, error: null });
      return rows.some((r) => isGoing(r.state)) ? BUSY_MS : QUIET_MS;
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message !== 'Failed to fetch'
          ? error.message
          : 'The studio could not be reached. Check the connection.';
      setStatus((now) => ({ known: now.known, error: message }));
      return QUIET_MS;
    }
  }, []);
  usePoll(ask);

  const { known, error } = status;
  if (known === null && error === null) return <p className="quiet">Reading the runs…</p>;
  if (known === null)
    return (
      <div className="agents-live">
        <p className="summary" aria-live="polite">
          Could not read the runs.
        </p>
        <p role="alert">{error} The page asks again on its own.</p>
      </div>
    );

  const now = new Date().toISOString();
  const board = boardOf(known.rows, now);
  const quiet = board.going.filter((r) => r.quiet).length;
  const running = board.going.length - quiet;
  const parts = [
    board.needsYou.length > 0 && `${String(board.needsYou.length)} need you`,
    running > 0 && `${String(running)} running`,
    quiet > 0 && `${String(quiet)} gone quiet`,
  ].filter((p): p is string => p !== false);
  const counted = parts.length === 0 ? 'No run is going' : parts.join(', ');
  const seen = new Date(known.at).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const summary =
    error === null ? `${counted} right now.` : `${counted} at ${seen}, the last answer.`;

  const row = (run: BoardRun): React.JSX.Element => {
    const going = isGoing(run.state);
    const spent = `${moneyOf(run.usd, currency)}${going ? ' so far' : ''}`;
    const when = run.quiet
      ? `nothing sent for ${durationOf(run.updatedAt, now)}; it may have stopped without saying so`
      : going
        ? `for ${durationOf(run.startedAt, now)}`
        : `took ${durationOf(run.startedAt, run.updatedAt)} · ${durationOf(run.updatedAt, now)} ago`;
    return (
      <li key={run.id}>
        <span className={`state state-${run.quiet ? 'quiet' : run.state}`}>
          {run.quiet ? 'Quiet' : stateWord(run.state)}
        </span>
        <span className="what">
          <strong>{agentName(run.agent)}</strong>
          <a href={`/thoughts/${run.thought}`}>{titles[run.thought] ?? run.thought}</a>
          <span className="small quiet">
            {when} · {spent} · {run.events} events
          </span>
        </span>
        <span className="links small">
          <a href={`/studio/agents/run?id=${encodeURIComponent(run.id)}`}>Timeline</a>
        </span>
      </li>
    );
  };

  const group = (
    id: string,
    heading: string,
    runs: BoardRun[],
    empty: string | null,
  ): React.JSX.Element | null =>
    runs.length === 0 && empty === null ? null : (
      <section aria-labelledby={id}>
        <h2 className="label" id={id}>
          {heading}
        </h2>
        {runs.length === 0 ? (
          <p className="quiet">{empty}</p>
        ) : (
          <ul className="runs-list">{runs.map(row)}</ul>
        )}
      </section>
    );

  return (
    <div className="agents-live">
      <p className="summary" aria-live="polite">
        {summary}
      </p>
      {error !== null && <p role="alert">{error} The page asks again on its own.</p>}
      {group('needs-label', 'Needs you', board.needsYou, null)}
      {group(
        'running-label',
        'Running now',
        board.going,
        'Nothing running. A run shows here within seconds of starting, on GitHub or with npm run agent.',
      )}
      {group('held-label', 'Held', board.held, null)}
      {group('finished-label', 'Recently finished', board.finished, 'No run has finished lately.')}
    </div>
  );
}
