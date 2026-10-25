// Why: Today is where Victor sees everything waiting on him, and the agents can wait on him too: a guard's
// hold that still stands (the latest run of that agent on that thought held the post), and a run that asked
// him something. Read live from the page's one feed, so a hold raised on his computer a minute ago is here
// now. Each opens on its run's timeline. When the runs cannot be read it says so, rather than reading as
// nothing waiting; only the count line is announced.
import { agentName, durationOf } from '../lib/agent-runs';
import { waitingOnVictor } from '../lib/run-board';
import { useRunsFeed } from './runs-feed';

const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many);

export interface AgentsWaitingProps {
  /** Thought titles by folder name, so a run names its thought the way the site does. */
  titles: Record<string, string>;
}

export function AgentsWaiting({ titles }: AgentsWaitingProps): React.JSX.Element {
  const { known, error } = useRunsFeed();
  const timeline = (id: string): string => `/studio/agents/run?id=${encodeURIComponent(id)}`;
  const title = (slug: string): string => titles[slug] ?? slug;

  if (known === null)
    return (
      <div className="agents-waiting">
        <h3 className="label">From the agents</h3>
        {error === null ? (
          <p className="quiet small">Reading the runs…</p>
        ) : (
          <p role="alert" className="small">
            Could not read what the agents are waiting on. {error}
          </p>
        )}
      </div>
    );

  const now = new Date().toISOString();
  const { holds, asking } = waitingOnVictor(known);
  const parts = [
    holds.length > 0 && `${String(holds.length)} ${plural(holds.length, 'hold', 'holds')}`,
    asking.length > 0 &&
      `${String(asking.length)} ${plural(asking.length, 'question', 'questions')}`,
  ].filter((p): p is string => p !== false);

  return (
    <div className="agents-waiting">
      <h3 className="label">From the agents</h3>
      <p className="small" aria-live="polite">
        {parts.length === 0 ? 'No agent is waiting on you.' : `${parts.join(' and ')} waiting.`}
        {error !== null && ` As of the last answer; ${error}`}
      </p>
      {parts.length > 0 && (
        <ul className="runs-list">
          {asking.map((run) => (
            <li key={run.id}>
              <span className="state state-needs-you">Needs you</span>
              <span className="what">
                <strong>{agentName(run.agent)}</strong>
                <a href={`/thoughts/${run.thought}`}>{title(run.thought)}</a>
                <span className="small quiet">asked {durationOf(run.updatedAt, now)} ago</span>
              </span>
              <span className="links small">
                <a href={timeline(run.id)}>Timeline</a>
              </span>
            </li>
          ))}
          {holds.map((hold) => (
            <li key={hold.id}>
              <span className="state state-held">Held</span>
              <span className="what">
                <strong>{agentName(hold.agent)}</strong>
                <a href={`/thoughts/${hold.thought}`}>{title(hold.thought)}</a>
                <span className="small quiet">
                  held the post · run started {durationOf(hold.startedAt, now)} ago
                </span>
              </span>
              <span className="links small">
                <a href={timeline(hold.id)}>Timeline</a>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
