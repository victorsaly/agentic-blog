// Why: where every thought stands, one line each, and behind one press the grid of every agent against every
// thought. It is drawn first from the ledgers as of the last deploy, so it says something true with no
// script and before the studio answers; then the page's one feed brings each cell up to date from the
// runner's live copy, so a run on Victor's computer moves its thought's line while it happens. The note
// above it always says which of the two it shows, and when the live copy cannot be read it says so and
// keeps the deploy's picture rather than an empty one. Each thought's line is read from its route (the
// workflow drawn left to right, every step with where it stands, gates included, RouteDrawing), so the line
// and the picture never disagree; a thought with work going on, or waiting on Victor, shows its route open.
import { agentName } from '../lib/agent-runs';
import { standingOf, withLive, type PipelineAgent, type PipelineRow } from '../lib/pipeline';
import { formatDate } from '../lib/content';
import { useRunsFeed } from './runs-feed';
import { useGithubFeed } from './github-feed';
import { RouteDrawing, stateWords, stepName } from './RouteDrawing';
import { liveRoute, standingOfRoute, type BuiltStep, type RouteStanding } from '../lib/route-live';
import type { RouteLayout } from '@roadbook/core/route';

const standingWords: Record<RouteStanding['state'], string> = {
  held: 'Held',
  stopped: 'Did not finish',
  waiting: 'Needs you',
  running: 'Running',
  moving: 'Moving',
  untouched: 'Not started',
};
// A run waiting on Victor looks the same here as on the board and on Today.
const stateClass = (state: string): string => (state === 'waiting' ? 'needs-you' : state);
const day = (iso: string): string => formatDate(new Date(`${iso}T12:00:00Z`));
const short = (iso: string): string =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const clock = (iso: string): string =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export interface PipelineLiveProps {
  /** The pipeline from the ledgers, as of the build. */
  rows: PipelineRow[];
  agents: PipelineAgent[];
  /** When the site was built, as an ISO time. */
  builtAt: string;
  /** The workflow's route, laid out once at build time. */
  layout: RouteLayout;
  /** Each thought's steps as the ledgers left them at build time, gates included, by folder name. */
  builtStates: Record<string, Record<string, BuiltStep>>;
}

export function PipelineLive({
  rows: built,
  agents,
  builtAt,
  layout,
  builtStates,
}: PipelineLiveProps): React.JSX.Element {
  const { known, error } = useRunsFeed();
  const github = useGithubFeed();
  const kindOf = (id: string) => layout.steps.find((step) => step.id === id)?.kind ?? 'agent';
  const rows = known === null ? built : withLive(built, known.standing, agents);
  const asOf = `From the ledgers as of ${formatDate(new Date(builtAt))}, the last deploy`;
  const note =
    known === null
      ? error === null
        ? `${asOf}. Reading the live runs…`
        : `${asOf}. The live runs could not be read: ${error}`
      : error === null
        ? `Live: every run the runner has sent, as of ${clock(known.at)}.`
        : `Live as of ${clock(known.at)}, the last answer. ${error}`;

  // Every thought's live route, worked out once: its line, its picture and the grid all read it.
  const routes = new Map(
    rows.map((r) => [
      r.slug,
      liveRoute(
        layout,
        builtStates[r.slug] ?? {},
        known?.standing ?? [],
        r.slug,
        github.known?.runs ?? [],
      ),
    ]),
  );
  // The grid has the route's steps as its columns, so it can never list a step the route does not.
  const columns = [...layout.steps]
    .filter((step) => step.kind === 'agent' || step.kind === 'guard' || step.kind === 'gate')
    .sort((a, b) => a.column - b.column || a.row - b.row);

  return (
    <section className="pipeline" aria-labelledby="pipeline-label">
      <h2 className="label" id="pipeline-label">
        Where each thought stands
      </h2>
      <p className="small quiet">{note}</p>
      <ul className="runs-list standings">
        {rows.map((r) => {
          const s = standingOf(r, agents);
          // The route is the one answer: the line says what the route says, gates included.
          const { route, links } = routes.get(r.slug) ?? liveRoute(layout, {}, [], r.slug);
          const at = standingOfRoute(route);
          const going = at.state !== 'moving' && at.state !== 'untouched';
          return (
            <li key={r.slug}>
              <span
                className={`state state-${stateClass(at.state === 'stopped' ? 'failed' : at.state)}`}
              >
                {standingWords[at.state]}
              </span>
              <span className="what">
                <a href={`/thoughts/${r.slug}`}>{r.title}</a>
                <span className="small quiet">
                  {at.at !== null && `at ${stepName({ id: at.at, kind: kindOf(at.at) })} · `}
                  {s.last !== null && `last: ${agentName(s.last.agent)}, ${day(s.last.on)} · `}
                  {`${String(at.done)} of ${String(at.of)} steps done`}
                </span>
              </span>
              {/* A thought with work going on, or waiting on Victor, shows its route without a press. */}
              <details className="show-route" open={going}>
                <summary>{going ? 'The route' : 'Show the route'}</summary>
                <RouteDrawing
                  layout={route}
                  states={route.states}
                  links={links}
                  label={`The route of ${r.title}`}
                />
              </details>
            </li>
          );
        })}
      </ul>

      <details className="every-agent">
        <summary className="control">Show every agent</summary>
        {/* A table wider than the screen scrolls, and the keyboard can only scroll what takes focus. */}
        <div
          className="scroll"
          role="region"
          aria-label="Every agent on every thought"
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
        >
          <table className="small">
            <thead>
              <tr>
                <th scope="col">Thought</th>
                {columns.map((step) => (
                  <th key={step.id} scope="col">
                    {stepName(step)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const states = routes.get(r.slug)?.route.states ?? {};
                return (
                  <tr key={r.slug}>
                    <th scope="row">
                      <a href={`/thoughts/${r.slug}`}>{r.title}</a>
                    </th>
                    {columns.map((step) => {
                      const state = states[step.id] ?? 'not-run';
                      // When the step is an agent with runs, when it last ran and how often.
                      const cell = r.cells[agents.findIndex((a) => a.name === step.id)] ?? null;
                      return state === 'not-run' ? (
                        <td key={step.id} className="none">
                          <span aria-hidden="true">·</span>
                          <span className="visually-hidden">Not run</span>
                        </td>
                      ) : (
                        <td key={step.id}>
                          <span className={`state state-${state}`}>{stateWords[state]}</span>
                          {cell !== null && (
                            <span className="when quiet">
                              {short(cell.on)}
                              {cell.runs > 1 && ` · ${String(cell.runs)} runs`}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
