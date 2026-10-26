// Why: every agent run as it happens, wherever it runs (GitHub or Victor's computer), read from the live copy
// the runner fills event by event. What waits on Victor comes first (a question, or a hold: the same two the
// tab row counts), then what is running; what finished waits behind a press (part "earlier"). A question says
// so and opens on Decide. A running row carries GitHub's log and pull request when GitHub has it, and a run
// GitHub has started that the runner has not reported yet (the first minute, while GitHub installs) shows as
// starting, so the page never says nothing is running while GitHub is. The page's one feed (runs-feed.ts)
// asks again every few seconds while something is going and the page is in view. A run that says it is going
// but has sent nothing for a while is shown as quiet, never as working. When the studio cannot be asked it
// says so, and what it showed before keeps the time it was true. Only the summary line is announced, so a
// screen reader is not talked over by each refresh.
import { agentName, durationOf, type LiveRun } from '../lib/agent-runs';
import {
  boardOf,
  isGoing,
  startingOn,
  stateWord,
  workingOn,
  type BoardRun,
} from '../lib/run-board';
import type { BuiltStep } from '../lib/route-live';
import { ActionIcon } from './ActionIcon';
import { moneyOf, type Currency } from '../lib/money';
import { useGithubFeed } from './github-feed';
import { useRunsFeed } from './runs-feed';

const timeOf = (iso: string): string =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export interface RunsBoardProps {
  /** Thought titles by folder name, so a run names its thought the way the site does. */
  titles: Record<string, string>;
  currency: Currency;
  /** Now: the summary, what waits on Victor and what runs. Earlier: what finished, behind a press. */
  part?: 'now' | 'earlier';
  /** Each thought's steps as the ledgers left them, so a failure a later run replaced is not listed. */
  builtStates?: Record<string, Record<string, BuiltStep>>;
}

export function RunsBoard({
  titles,
  currency,
  part = 'now',
  builtStates = {},
}: RunsBoardProps): React.JSX.Element {
  const { known, error } = useRunsFeed();
  const github = useGithubFeed();
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
  const board = boardOf(known.runs, now);
  const starting = startingOn(github.known?.runs ?? [], known.runs);
  // A gate is Victor's to answer only once nothing on its thought still works; until then it is shut, and
  // says what it waits for. The same rule the tab row and Today count by (workingOn).
  const workingFor = (run: BoardRun): string[] =>
    workingOn(run.thought, known.runs, github.known?.runs ?? [], now);
  const answerable = board.needsYou.filter((r) => workingFor(r).length === 0);
  const shut = board.needsYou.filter((r) => workingFor(r).length > 0);
  const firstShut = shut[0] === undefined ? [] : workingFor(shut[0]);
  // A failure a later run of the same step replaced, in the live copy or the ledger, is not listed.
  const stopped = board.stopped.filter(
    (r) => (builtStates[r.thought]?.[r.agent]?.run ?? '') <= r.id,
  );
  const quiet = board.going.filter((r) => r.quiet).length;
  const running = board.going.length - quiet;
  // What waits on Victor is a question or a hold, the same two the tab row counts.
  const parts = [
    answerable.length > 0 &&
      `${String(answerable.length)} need${answerable.length === 1 ? 's' : ''} you`,
    shut.length === 1 &&
      `1 waiting on ${String(firstShut.length)} ${firstShut.length === 1 ? 'step' : 'steps'}`,
    shut.length > 1 && `${String(shut.length)} waiting on steps`,
    board.held.length > 0 && `${String(board.held.length)} held`,
    stopped.length > 0 && `${String(stopped.length)} did not finish`,
    running > 0 && `${String(running)} running`,
    starting.length > 0 && `${String(starting.length)} getting ready on GitHub`,
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
    const waitsOn = run.state === 'needs-you' ? workingFor(run) : [];
    const asks = run.state === 'needs-you' && waitsOn.length === 0;
    const opens = asks
      ? 'Decide'
      : waitsOn.length > 0
        ? 'Timeline'
        : run.state === 'held' || run.state === 'failed'
          ? 'Read why'
          : 'Timeline';
    // A run waiting on Victor has spent nothing; the money is said only when there is some.
    const spent = run.usd > 0 ? ` · ${moneyOf(run.usd, currency)}${going ? ' so far' : ''}` : '';
    // The same run on GitHub, while it works there: its log and its pull request sit on this row.
    const onGithub = (github.known?.runs ?? []).find(
      (g) =>
        g.agent === run.agent &&
        g.thought === run.thought &&
        (g.state === 'running' || g.state === 'queued'),
    );
    const when = run.quiet
      ? `nothing sent for ${durationOf(run.updatedAt, now)}; it may have stopped without saying so`
      : waitsOn.length > 0
        ? `${agentName(run.agent)}: opens when ${waitsOn.map(agentName).join(' and ')} ${waitsOn.length === 1 ? 'finishes' : 'finish'}`
        : asks
          ? `your call, waiting since ${timeOf(run.startedAt)}`
          : going
            ? `for ${durationOf(run.startedAt, now)}`
            : `took ${durationOf(run.startedAt, run.updatedAt)} · ${durationOf(run.updatedAt, now)} ago`;
    return (
      <li key={run.id}>
        {waitsOn.length > 0 ? (
          <span className="state state-shut">
            Waiting on {waitsOn.length} {waitsOn.length === 1 ? 'step' : 'steps'}
          </span>
        ) : (
          <span className={`state state-${run.quiet ? 'quiet' : run.state}`}>
            {run.quiet ? 'Quiet' : stateWord(run.state)}
          </span>
        )}
        <span className="what">
          <strong>{agentName(run.agent)}</strong>
          {/* A question's row leads to the decision, not out of the studio: its thought is named, not linked. */}
          {asks ? (
            <span>{titles[run.thought] ?? run.thought}</span>
          ) : (
            <a href={`/thoughts/${run.thought}`}>{titles[run.thought] ?? run.thought}</a>
          )}
          <span className="small quiet">
            {when}
            {spent}
          </span>
        </span>
        <span className="links small">
          {/* The one thing to do on the row, said as what it is: decide, read why it held or stopped, or watch. */}
          <a
            href={`/studio/agents/run?id=${encodeURIComponent(run.id)}`}
            className={asks ? 'control decide' : undefined}
            aria-label={`${opens}: ${agentName(run.agent)} on ${titles[run.thought] ?? run.thought}`}
          >
            {asks && <ActionIcon name="decide" />}
            {opens}
          </a>
          {onGithub && <a href={onGithub.url}>Log</a>}
          {onGithub?.pr != null && onGithub.prUrl !== null && (
            <a href={onGithub.prUrl}>PR #{onGithub.pr}</a>
          )}
        </span>
      </li>
    );
  };

  // GitHub has it, the runner has not said a word yet: GitHub's step says how far it got.
  const startingRow = (run: LiveRun): React.JSX.Element => (
    <li key={`github-${String(run.id)}`}>
      <span className={`state state-${run.state}`}>
        {/* The same word the route uses for it. */}
        {run.state === 'queued' ? 'Queued' : 'Running'}
      </span>
      <span className="what">
        <strong>{run.agent === null ? run.title : agentName(run.agent)}</strong>
        {run.thought !== null && (
          <a href={`/thoughts/${run.thought}`}>{titles[run.thought] ?? run.thought}</a>
        )}
        <span className="small quiet">
          {run.state === 'queued' ? 'Waiting for GitHub' : 'Getting ready on GitHub'} · for{' '}
          {durationOf(run.started, now)}
        </span>
      </span>
      <span className="links small">
        <a href={run.url}>Log</a>
      </span>
    </li>
  );

  const group = (
    id: string,
    heading: string,
    runs: BoardRun[],
    empty: string | null,
    extra: React.JSX.Element[] = [],
  ): React.JSX.Element | null => {
    const rows = [...runs.map(row), ...extra];
    return rows.length === 0 && empty === null ? null : (
      <section aria-labelledby={id}>
        <h2 className="label" id={id}>
          {heading}
        </h2>
        {rows.length === 0 ? (
          <p className="quiet">{empty}</p>
        ) : (
          <ul className="runs-list">{rows}</ul>
        )}
      </section>
    );
  };

  if (part === 'earlier')
    return (
      <div className="agents-live">
        {group(
          'finished-label',
          'Recently finished',
          board.finished,
          'No run has finished lately.',
        )}
      </div>
    );

  return (
    <div className="agents-live">
      <p className="summary" aria-live="polite">
        {summary}
      </p>
      {error !== null && <p role="alert">{error} The page asks again on its own.</p>}
      {group('needs-label', 'Needs you', answerable, null)}
      {group('shut-label', 'Opens when they finish', shut, null)}
      {group('held-label', 'Held', board.held, null)}
      {group('stopped-label', 'Did not finish', stopped, null)}
      {group(
        'running-label',
        'Running now',
        board.going,
        'Nothing running. A run shows here within seconds of starting, on GitHub or with npm run agent.',
        starting.map(startingRow),
      )}
    </div>
  );
}
