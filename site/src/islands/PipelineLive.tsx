// Why: where every thought stands, one line each, and behind one press the grid of every agent against every
// thought. It is drawn first from the ledgers as of the last deploy, so it says something true with no
// script and before the studio answers; then the page's one feed brings each cell up to date from the
// runner's live copy, so a run on Victor's computer moves its thought's line while it happens. The note
// above it always says which of the two it shows, and when the live copy cannot be read it says so and
// keeps the deploy's picture rather than an empty one. Each thought's line is read from its route (the
// workflow drawn left to right, every step with where it stands, gates included, RouteDrawing), so the line
// and the picture never disagree; a thought with work going on, or waiting on Victor, shows its route open.
import { agentName } from '../lib/agent-runs';
import {
  standingOf,
  withLive,
  type CellEnding,
  type PipelineAgent,
  type PipelineRow,
} from '../lib/pipeline';
import { formatDate } from '../lib/content';
import { useRunsFeed } from './runs-feed';
import { RouteDrawing, stepName } from './RouteDrawing';
import { liveRoute, standingOfRoute, type BuiltStep, type RouteStanding } from '../lib/route-live';
import type { RouteLayout } from '@roadbook/core/route';

const words: Record<CellEnding, string> = {
  done: 'Done',
  held: 'Held',
  failed: 'Did not finish',
  waiting: 'Needs you',
  running: 'Running',
  'not-run': 'Not run',
};
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
  /** Each phase's name, by its number. */
  phaseNames: Record<number, string>;
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
  phaseNames,
  builtAt,
  layout,
  builtStates,
}: PipelineLiveProps): React.JSX.Element {
  const { known, error } = useRunsFeed();
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

  // The phase heads span their agents' columns; the first agent of each phase opens it with a rule.
  const groups = [...new Set(agents.map((a) => a.phase))].map((phase) => ({
    phase,
    name: phaseNames[phase] ?? `Phase ${String(phase)}`,
    span: agents.filter((a) => a.phase === phase).length,
  }));
  const opensPhase = agents.map((a, i) => i === 0 || agents[i - 1]?.phase !== a.phase);

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
          const { route, links } = liveRoute(
            layout,
            builtStates[r.slug] ?? {},
            known?.standing ?? [],
            r.slug,
          );
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
                <td className="corner" />
                {groups.map((g) => (
                  <th key={g.phase} scope="colgroup" colSpan={g.span} className="phase opens">
                    {g.name}
                  </th>
                ))}
              </tr>
              <tr>
                <th scope="col">Thought</th>
                {agents.map((a, i) => (
                  <th key={a.name} scope="col" className={opensPhase[i] ? 'opens' : undefined}>
                    {agentName(a.name)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.slug}>
                  <th scope="row">
                    <a href={`/thoughts/${r.slug}`}>{r.title}</a>
                  </th>
                  {r.cells.map((cell, i) => {
                    const opens = opensPhase[i] ? 'opens' : '';
                    const key = agents[i]?.name ?? String(i);
                    return cell === null ? (
                      <td key={key} className={`none ${opens}`.trim()}>
                        <span aria-hidden="true">·</span>
                        <span className="visually-hidden">Not run</span>
                      </td>
                    ) : (
                      <td key={key} className={opens || undefined}>
                        <span className={`state state-${stateClass(cell.ended)}`}>
                          {words[cell.ended]}
                        </span>
                        <span className="when quiet">
                          {short(cell.on)}
                          {cell.runs > 1 && ` · ${String(cell.runs)} runs`}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
