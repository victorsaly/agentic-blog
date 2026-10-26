// Why: what the agents are doing on GitHub right now, without waiting for a deploy: what is running and on
// which step, what is queued, and how the latest runs ended, each with its log and pull request. The page's
// GitHub feed asks again every few seconds while something is going and the page is in view, less often
// when all is quiet, and never while the page is hidden. When GitHub cannot be asked it says so, and what it showed before is
// marked with the time it was true: a failure never reads as all quiet. Only the summary line is announced, so a screen reader is not
// talked over by every refresh.
import { agentName, durationOf, type LiveRun, type LiveState } from '../lib/agent-runs';
import { useGithubFeed } from './github-feed';

const RECENT = 10;

const words: Record<LiveState, string> = {
  queued: 'Queued',
  running: 'Running',
  done: 'Done',
  held: 'Held',
  failed: 'Did not finish',
  stopped: 'Stopped',
};

export interface AgentsLiveProps {
  /** Thought titles by folder name, so a run names its thought the way the site does. */
  titles: Record<string, string>;
  /** Its own count; left out where the page above already says what runs, so the two never disagree. */
  summary?: boolean;
}

export function AgentsLive({ titles, summary: counts = true }: AgentsLiveProps): React.JSX.Element {
  // The page's one GitHub asker (github-feed.ts), shared with the board above.
  const status = useGithubFeed();
  const { known, error } = status;
  if (known === null && error === null)
    return <p className="quiet">Asking GitHub what the agents are doing…</p>;
  if (known === null)
    return (
      <div className="agents-live">
        <p className="summary" aria-live="polite">
          Could not ask GitHub what the agents are doing.
        </p>
        <p role="alert">{error} The page asks again on its own.</p>
      </div>
    );

  const now = new Date().toISOString();
  const runs = known.runs;
  const going = runs.filter((r) => r.state === 'running' || r.state === 'queued');
  const recent = runs.filter((r) => r.state !== 'running' && r.state !== 'queued').slice(0, RECENT);
  const running = going.filter((r) => r.state === 'running').length;
  const counted =
    going.length === 0
      ? 'No agent is working on GitHub'
      : `${String(running)} running, ${String(going.length - running)} queued`;
  // A failed ask keeps what was known, and says how old it is instead of passing it off as now.
  const seen = new Date(known.at).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const summary =
    error === null ? `${counted} right now.` : `${counted} at ${seen}, the last answer.`;

  const row = (run: LiveRun): React.JSX.Element => {
    const thought = run.thought === null ? null : (titles[run.thought] ?? run.thought);
    const live = run.state === 'running' || run.state === 'queued';
    return (
      <li key={run.id}>
        <span className={`state state-${run.state}`}>{words[run.state]}</span>
        <span className="what">
          <strong>{run.agent === null ? run.title : agentName(run.agent)}</strong>
          {thought !== null && run.thought !== null && (
            <a href={`/thoughts/${run.thought}`}>{thought}</a>
          )}
          <span className="small quiet">
            {live
              ? `${run.step ?? 'waiting for a runner'} · for ${durationOf(run.started, now)}`
              : `took ${durationOf(run.started, run.updated)} · ${durationOf(run.updated, now)} ago`}
          </span>
        </span>
        <span className="links small">
          <a href={run.url}>Log</a>
          {run.pr !== null && run.prUrl !== null && <a href={run.prUrl}>PR #{run.pr}</a>}
        </span>
      </li>
    );
  };

  return (
    <div className="agents-live">
      {counts && (
        <p className="summary" aria-live="polite">
          {summary}
        </p>
      )}
      {error !== null && <p role="alert">{error} The page asks again on its own.</p>}

      <section aria-labelledby="going-label">
        <h2 className="label" id="going-label">
          Queued and running on GitHub
        </h2>
        {going.length === 0 ? (
          <p className="quiet">
            Nothing queued or running. Add an <code>agent:</code> label to a pull request, or run
            one with <code>npm run agent</code>.
          </p>
        ) : (
          <ul className="runs-list">{going.map(row)}</ul>
        )}
      </section>

      <section aria-labelledby="recent-label">
        <h2 className="label" id="recent-label">
          Lately on GitHub
        </h2>
        {recent.length === 0 ? (
          <p className="quiet">No agent has run on GitHub lately.</p>
        ) : (
          <ul className="runs-list">{recent.map(row)}</ul>
        )}
      </section>
    </div>
  );
}
