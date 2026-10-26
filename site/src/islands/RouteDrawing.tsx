// Why: where a thought stands, as a picture of its route: every step of the workflow left to right in working
// order, a line from each step to the ones that wait for it, gates (Victor's calls) drawn round, and each
// step's state as a word and a mark, in the studio's ink: filled while it works or waits on him, a heavier
// rule where it held or failed, quiet where it has not run. The step this page is about carries a heavy rule
// under it. Each step opens its latest run. Drawn by hand from the layout core gives (no graph library: the
// picture is the same every time, and a screen reader reads each step as a link with its state). On a phone
// the same route is a numbered list. Work in progress moves, in marigold, the one colour: ink dashes flow along
// a marigold band into a running step, and an ink bar sweeps along the foot of the step itself, so a glance
// says something is happening and where (Victor asked for it; still when the reader asks for less motion).
// A route wider than the frame opens scrolled to where the work is: the
// step this page is about, or else the furthest step that has run, once the frame is shown.
import { useEffect, useId, useRef } from 'react';
import type { RouteLayout, RouteStep, StepState } from '@roadbook/core/route';
import { agentName } from '../lib/agent-runs';

const W = 116;
const H = 52;
const GAP_X = 32;
const GAP_Y = 16;

export const stateWords: Record<StepState, string> = {
  'not-run': 'Not run',
  running: 'Running',
  'needs-you': 'Needs you',
  done: 'Done',
  held: 'Held',
  failed: 'Did not finish',
};

/** A step's name as the studio says it; the way out is where the post goes. */
export function stepName(step: Pick<RouteStep, 'id' | 'kind'>): string {
  return step.kind === 'sink' ? 'Published' : agentName(step.id);
}

export interface RouteDrawingProps {
  layout: RouteLayout;
  states: Record<string, StepState>;
  /** Where each step's latest run opens, by step. */
  links?: Record<string, string>;
  /** The step this page is about, marked with a heavy rule. */
  current?: string;
  /** What the picture is of, for a screen reader: "The route of …". */
  label: string;
}

export function RouteDrawing({
  layout,
  states,
  links = {},
  current,
  label,
}: RouteDrawingProps): React.JSX.Element {
  // A column with fewer steps sits in the middle of the tallest, so a join reads as one.
  const inColumn = new Map<number, number>();
  for (const s of layout.steps) inColumn.set(s.column, (inColumn.get(s.column) ?? 0) + 1);
  const box = (s: RouteStep): { x: number; y: number } => ({
    x: s.column * (W + GAP_X),
    y: ((layout.rows - (inColumn.get(s.column) ?? 1)) / 2 + s.row) * (H + GAP_Y),
  });
  const at = new Map(layout.steps.map((s) => [s.id, box(s)]));
  const width = layout.columns * (W + GAP_X) - GAP_X;
  const height = layout.rows * (H + GAP_Y) - GAP_Y + 12;
  const ordered = [...layout.steps].sort((a, b) => a.column - b.column || a.row - b.row);
  // Where the work is: this page's step, or else the furthest one that has run.
  const reached = ordered.filter((s) => (states[s.id] ?? 'not-run') !== 'not-run').at(-1);
  const focus = current ?? reached?.id;
  const focusX = focus === undefined ? 0 : (at.get(focus)?.x ?? 0);
  const scroller = useRef<HTMLDivElement | null>(null);
  // Clip ids are page-wide, and the pipeline draws one route per thought.
  const clip = `route-clip${useId().replace(/:/g, '')}`;
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const place = (): boolean => {
      if (el.clientWidth === 0) return false;
      if (focusX > el.clientWidth / 2) el.scrollLeft = focusX - el.clientWidth / 3;
      return true;
    };
    if (place()) return;
    // Inside a closed disclosure the frame has no width yet: it is placed the first time it gets one.
    const watch = new ResizeObserver(() => {
      if (place()) watch.disconnect();
    });
    watch.observe(el);
    return () => {
      watch.disconnect();
    };
  }, [focusX]);

  return (
    <div className="route">
      {/* A route wider than the frame scrolls, and the keyboard can scroll what takes focus. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
      <div ref={scroller} className="route-scroll" role="region" aria-label={label} tabIndex={0}>
        <svg
          className="route-picture"
          width={width}
          height={height}
          viewBox={`0 0 ${String(width)} ${String(height)}`}
          role="group"
          aria-label={label}
        >
          {layout.edges.map(({ from, to }) => {
            const a = at.get(from);
            const b = at.get(to);
            if (!a || !b) return null;
            const x1 = a.x + W;
            const y1 = a.y + H / 2;
            const x2 = b.x;
            const y2 = b.y + H / 2;
            const mid = x1 + GAP_X / 2;
            const lit = states[to] !== 'not-run';
            const d =
              y1 === y2
                ? `M${String(x1)} ${String(y1)}H${String(x2)}`
                : `M${String(x1)} ${String(y1)}H${String(mid)}V${String(y2)}H${String(x2)}`;
            // Into a running step the line carries the work: a marigold band with ink flowing along it.
            return states[to] === 'running' ? (
              <g key={`${from}-${to}`}>
                <path className="route-line band" d={d} />
                <path className="route-line flow" d={d} />
              </g>
            ) : (
              <path key={`${from}-${to}`} className={lit ? 'route-line lit' : 'route-line'} d={d} />
            );
          })}
          {layout.steps.map((s) => {
            const { x, y } = at.get(s.id) ?? { x: 0, y: 0 };
            const state = states[s.id] ?? 'not-run';
            const name = stepName(s);
            const gate = s.kind === 'gate';
            const drawn = (
              <g className={`route-step state-${state}${gate ? ' gate' : ''}`}>
                <rect x={x} y={y} width={W} height={H} rx={gate ? H / 2 : 0} />
                {state === 'running' && (
                  <>
                    <clipPath id={`${clip}-${s.id}`}>
                      <rect x={x} y={y} width={W} height={H} rx={gate ? H / 2 : 0} />
                    </clipPath>
                    <rect
                      className="sweep"
                      clipPath={`url(#${clip}-${s.id})`}
                      x={x}
                      y={y + H - 5}
                      width={W / 3}
                      height={5}
                    />
                  </>
                )}
                {/* One text, two lines: read as "Citations Running", the same words its link is named by. */}
                <text textAnchor="middle">
                  <tspan x={x + W / 2} y={y + 22} className="name">
                    {name}
                  </tspan>
                  {/* The space between the two words, for the name only: drawn at no size, so a link's
                      underline does not run past the step's name. */}
                  <tspan fontSize="0"> </tspan>
                  <tspan x={x + W / 2} y={y + 39} className="word">
                    {stateWords[state]}
                  </tspan>
                </text>
                {current === s.id && (
                  <rect className="here" x={x} y={y + H + 4} width={W} height={8} />
                )}
              </g>
            );
            const href = links[s.id];
            // Starts with the words on the step, so what is seen and what is said match.
            const said = `${name} ${stateWords[state]}${gate ? ', your call' : ''}${current === s.id ? ', this run' : ''}`;
            return href ? (
              <a key={s.id} href={href} aria-label={said}>
                {drawn}
              </a>
            ) : (
              <g key={s.id} role="img" aria-label={said}>
                {drawn}
              </g>
            );
          })}
        </svg>
      </div>
      <ol className="route-list" aria-label={label}>
        {ordered.map((s) => {
          const state = states[s.id] ?? 'not-run';
          const href = links[s.id];
          return (
            <li
              key={s.id}
              className={current === s.id ? 'here' : undefined}
              aria-current={current === s.id ? 'step' : undefined}
            >
              {href ? <a href={href}>{stepName(s)}</a> : <span>{stepName(s)}</span>}
              {s.kind === 'gate' && <span className="small quiet"> · your call</span>}
              <span className={`state state-${state}`}>{stateWords[state]}</span>
            </li>
          );
        })}
      </ol>
      <p className="route-key small quiet">
        Round: your call. Marigold and moving: working now. Filled: waiting on you. Heavy rule: held
        or did not finish.
      </p>
    </div>
  );
}
