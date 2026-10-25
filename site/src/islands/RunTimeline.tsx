// Why: one run, event for event, while it happens: who did what, when, what it cost, and the words that came
// with it (a reason, a question, what was written and why). It reads the live copy the runner fills, which
// is checked against the chain as it is kept, so the timeline matches the run's ledger file line for line.
// While the run is going it asks for what is new every few seconds and the clock ticks as numbers; once the
// run has finished it stops asking. A run gone silent is said to be so. Only the state is announced. A
// gate's run that is still waiting carries the control to answer it (GateAnswer).
import { useCallback, useEffect, useRef, useState } from 'react';
import { agentName } from '../lib/agent-runs';
import {
  clockOf,
  isGoing,
  isQuiet,
  readRunDetail,
  stateWord,
  timelineOf,
  type ShownEvent,
} from '../lib/run-board';
import type { LiveRunRow } from '../lib/live-runs';
import { moneyOf, type Currency } from '../lib/money';
import { formatDate } from '../lib/content';
import { usePoll } from './use-poll';
import { GateAnswer } from './GateAnswer';
import { gateOf } from '../lib/gates';

const GOING_MS = 3_000;
/** A run waiting on Victor, a gate say, changes when he answers; asking every few seconds would be waste. */
const WAITING_MS = 30_000;
/** Once Victor has sent a decision, the gate closes within a minute or so; worth asking about often. */
const SENT_MS = 5_000;
const RETRY_MS = 10_000;

interface Status {
  run: LiveRunRow | null;
  events: ShownEvent[];
  /** Why the page cannot show the run (no such run, a bad address), so it stops asking. */
  missing: string | null;
  error: string | null;
}

function errorOf(data: unknown, fallback: string): string {
  return typeof data === 'object' &&
    data !== null &&
    typeof (data as { error?: unknown }).error === 'string'
    ? (data as { error: string }).error
    : fallback;
}

/** Both the day and the time in the reader's own time zone, so they never come from two different clocks. */
const here = Intl.DateTimeFormat().resolvedOptions().timeZone;

const timeOf = (iso: string): string =>
  new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

export interface RunTimelineProps {
  /** Thought titles by folder name, so the run names its thought the way the site does. */
  titles: Record<string, string>;
  currency: Currency;
}

export function RunTimeline({ titles, currency }: RunTimelineProps): React.JSX.Element {
  const [status, setStatus] = useState<Status>({
    run: null,
    events: [],
    missing: null,
    error: null,
  });
  const [now, setNow] = useState(() => new Date().toISOString());
  /** The last position shown, so each ask carries only what is new. */
  const last = useRef(-1);
  /** Whether a decision on this gate has been sent and not yet recorded. */
  const sent = useRef(false);

  const ask = useCallback(async (): Promise<number | null> => {
    const id = new URL(window.location.href).searchParams.get('id');
    if (id === null || id === '') {
      setStatus((s) => ({ ...s, missing: 'This address does not name a run.' }));
      return null;
    }
    try {
      const response = await fetch(
        `/api/runs/${encodeURIComponent(id)}?after=${String(last.current)}`,
      );
      const data: unknown = await response.json().catch(() => null);
      if (response.status === 404 || response.status === 400) {
        setStatus((s) => ({ ...s, missing: errorOf(data, 'The studio has no run by that name.') }));
        return null;
      }
      const detail = response.ok ? readRunDetail(data) : null;
      if (detail === null) throw new Error(errorOf(data, 'The studio could not read the run.'));
      const fresh = detail.events.filter((e) => e.seq > last.current);
      last.current = fresh.at(-1)?.seq ?? last.current;
      setStatus((s) => ({
        run: detail.run,
        events: [...s.events, ...fresh],
        missing: null,
        error: null,
      }));
      if (detail.more) return 0;
      if (detail.run.state === 'needs-you') return sent.current ? SENT_MS : WAITING_MS;
      return isGoing(detail.run.state) ? GOING_MS : null;
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message !== 'Failed to fetch'
          ? error.message
          : 'The studio could not be reached. Check the connection.';
      setStatus((s) => ({ ...s, error: message }));
      return RETRY_MS;
    }
  }, []);
  usePoll(ask);

  const { run, events, missing, error } = status;
  const going = run !== null && isGoing(run.state);
  const gate = run === null ? null : gateOf(events, run.state);

  // The clock ticks only while the run is going; a finished run shows how long it took.
  useEffect(() => {
    if (!going) return;
    const timer = setInterval(() => {
      setNow(new Date().toISOString());
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, [going]);

  if (missing !== null)
    return (
      <>
        <h1>A run</h1>
        <p role="alert">{missing}</p>
        <p>
          <a href="/studio/agents">Back to the agents</a>
        </p>
      </>
    );
  if (run === null)
    return (
      <>
        <h1>A run</h1>
        {error === null ? (
          <p className="quiet">Reading the run…</p>
        ) : (
          <p role="alert">{error} The page asks again on its own.</p>
        )}
      </>
    );

  const title = titles[run.thought] ?? run.thought;
  const quiet = isQuiet(run, now);
  const lines = timelineOf(events, currency);

  return (
    <div className="run-page">
      <p className="small">
        <a href="/studio/agents">Agents</a>
      </p>
      <h1>
        {agentName(run.agent)} on <a href={`/thoughts/${run.thought}`}>{title}</a>
      </h1>
      <p className="summary">
        <span className={`state state-${quiet ? 'quiet' : run.state}`} aria-live="polite">
          {quiet ? 'Quiet' : stateWord(run.state)}
        </span>
        <span className="clock">
          {going ? clockOf(run.startedAt, now) : clockOf(run.startedAt, run.updatedAt)}
        </span>
      </p>
      {quiet && (
        <p>
          Nothing sent since {timeOf(run.updatedAt)}. The run may have stopped without saying so;
          its ledger file is the record.
        </p>
      )}
      {error !== null && <p role="alert">{error} The page asks again on its own.</p>}

      <dl className="facts small">
        <div>
          <dt>Started</dt>
          <dd>
            {formatDate(new Date(run.startedAt), 'en-GB', here)}, {timeOf(run.startedAt)}
          </dd>
        </div>
        <div>
          <dt>{going ? 'Spent so far' : 'Spent'}</dt>
          <dd>{moneyOf(run.usd, currency)}</dd>
        </div>
        <div>
          <dt>Events</dt>
          <dd>{run.events}</dd>
        </div>
        <div>
          <dt>Chain</dt>
          <dd>
            <code title={run.head}>{run.head.slice(0, 12)}</code>, checked as each event was kept
          </dd>
        </div>
      </dl>

      {gate?.open === true && (
        <GateAnswer
          run={run.id}
          gate={gate}
          onSent={() => {
            sent.current = true;
          }}
        />
      )}

      <section aria-labelledby="timeline-label">
        <h2 className="label" id="timeline-label">
          Timeline
        </h2>
        <ol className="timeline">
          {lines.map((line) => (
            <li key={line.seq}>
              <span className="at quiet small">
                <time dateTime={line.at} title={timeOf(line.at)}>
                  +{clockOf(run.startedAt, line.at)}
                </time>
              </span>
              <span className="told">
                <span>
                  {line.who !== null && <strong>{line.who} </strong>}
                  {line.what}
                  {line.link !== null && (
                    <>
                      {' '}
                      <a href={line.link}>{line.link}</a>
                    </>
                  )}
                </span>
                {line.detail !== null && (
                  <span className={line.text ? 'streamed' : 'detail quiet'}>{line.detail}</span>
                )}
              </span>
            </li>
          ))}
        </ol>
      </section>
      <p className="small quiet">
        Run <code>{run.id}</code>. The ledger file in git is the record; this is its live copy.
      </p>
    </div>
  );
}
