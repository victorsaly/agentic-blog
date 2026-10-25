// Why: where every thought stands, one line each, and behind one press the grid of every agent against every
// thought. It is drawn first from the ledgers as of the last deploy, so it says something true with no
// script and before the studio answers; then the page's one feed brings each cell up to date from the
// runner's live copy, so a run on Victor's computer moves its thought's line while it happens. The note
// above it always says which of the two it shows, and when the live copy cannot be read it says so and
// keeps the deploy's picture rather than an empty one.
import { agentName } from '../lib/agent-runs';
import {
  standingOf,
  withLive,
  type PipelineAgent,
  type PipelineRow,
  type Standing,
} from '../lib/pipeline';
import { formatDate } from '../lib/content';
import type { Ending } from '../lib/how-made';
import { useRunsFeed } from './runs-feed';

const words: Record<Ending, string> = {
  done: 'Done',
  held: 'Held',
  failed: 'Did not finish',
  running: 'Running',
  'not-run': 'Not run',
};
const standingWords: Record<Standing['state'], string> = {
  held: 'Held',
  stopped: 'Did not finish',
  running: 'Running',
  moving: 'Moving',
  untouched: 'Not started',
};
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
}

export function PipelineLive({
  rows: built,
  agents,
  phaseNames,
  builtAt,
}: PipelineLiveProps): React.JSX.Element {
  const { known, error } = useRunsFeed();
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
          return (
            <li key={r.slug}>
              <span className={`state state-${s.state === 'stopped' ? 'failed' : s.state}`}>
                {standingWords[s.state]}
              </span>
              <span className="what">
                <a href={`/thoughts/${r.slug}`}>{r.title}</a>
                <span className="small quiet">
                  {s.at !== null && `at ${agentName(s.at)} · `}
                  {s.last !== null && `last: ${agentName(s.last.agent)}, ${day(s.last.on)} · `}
                  {`${String(s.ran)} of ${String(s.of)} agents have run`}
                </span>
              </span>
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
                        <span className={`state state-${cell.ended}`}>{words[cell.ended]}</span>
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
