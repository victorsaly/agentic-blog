// Why: the graph is drawn, never placed by hand, so the same posts always give the same picture and a new
// topic finds its own place. This puts the parts together: the ring (graph-ring.ts) says where each arc
// and each dot go, the labels (graph-labels.ts) place the names clear of both, and here the dots, the
// short lines from each dot to its own arc, the arcs' ticks and the box that holds it all are drawn, with
// the words for the middle (graph-tip.ts). A dot in the gap between two arcs belongs to both and needs no
// line. It also says when the dots would touch, so a small screen can draw the topics alone. Pure.
import type { Graph } from './graph';
import { placeLabels, type Box } from './graph-labels';
import { ringOf } from './graph-ring';
import { tipOf, type Tip } from './graph-tip';
import { themeLabel } from './themes';

export { ringOrder } from './graph-ring';
export { wrapLabel } from './graph-labels';
export type { Box } from './graph-labels';
export type { Tip } from './graph-tip';

export interface LayoutOptions {
  /** The ring the small ideas sit on. */
  ideaRadius: number;
  /** The ring the topic arcs are drawn on. */
  topicRadius: number;
  /** The space kept clear for the mark in the middle. */
  coreRadius: number;
  /** From the idea ring out to where a topic's name starts. */
  labelGap: number;
  fontSize: number;
  /** A topic name wraps at about this many characters a line. */
  lineChars: number;
  dot: number;
  pad: number;
  /** The size of an idea's words when a pointer rests on its dot; 0 draws none (a phone has no pointer). */
  tipSize: number;
  /** The idea count under a topic's name, as a share of the name's size. */
  countScale: number;
}

/** A desk: the names fit on one line. */
export const deskLayout: LayoutOptions = {
  ideaRadius: 300,
  topicRadius: 215,
  coreRadius: 92,
  labelGap: 34,
  fontSize: 27,
  lineChars: 20,
  dot: 6,
  pad: 12,
  tipSize: 25,
  countScale: 0.72,
};

/** A phone: a smaller ring in the same units, so the names stay large when it is scaled to the screen. */
export const phoneLayout: LayoutOptions = {
  ideaRadius: 80,
  topicRadius: 58,
  coreRadius: 28,
  labelGap: 12,
  fontSize: 20,
  lineChars: 11,
  dot: 3.5,
  pad: 10,
  tipSize: 0,
  countScale: 0.82,
};

/** Dots closer than this many radii apart (centre to centre) read as one band: the ring is too full. */
export const CROWDED = 2.5;

export interface PlacedTopic {
  topic: string;
  ideas: number;
  /** The arc on the topic ring, as SVG path data. */
  arc: string;
  start: number;
  end: number;
  lines: string[];
  anchor: 'start' | 'middle' | 'end';
  x: number;
  /** The baseline of each line. */
  baselines: number[];
  box: Box;
  /** The ink tick from the idea ring to the name. */
  leader: string;
  /** How many small ideas hang off the topic, in words, under its name. */
  count: string;
  countBaseline: number;
  /** A short cross stroke at each end of the arc, so two arcs never read as one ring. */
  ticks: string;
}

export interface PlacedIdea {
  id: string;
  x: number;
  y: number;
  angle: number;
  topics: string[];
  post: string;
  /** True when it sits in the gap between two arcs, belonging to both. */
  inGap: boolean;
  tip?: Tip;
}

export interface PlacedEdge {
  d: string;
  topics: string[];
  idea: string;
  post: string;
}

export interface GraphLayout {
  viewBox: string;
  options: LayoutOptions;
  topics: PlacedTopic[];
  ideas: PlacedIdea[];
  edges: PlacedEdge[];
  /** The space between two neighbouring dots, centre to centre, in the layout's units. */
  spacing: number;
  /** True when the dots would touch: draw the topics alone. */
  crowded: boolean;
  /** How far a pointer may be from a dot and still be on it: never so far that two dots' areas meet. */
  hitRadius: number;
}

const round = (n: number): number => Math.round(n * 10) / 10;
const polar = (r: number, a: number): [number, number] => [r * Math.cos(a), r * Math.sin(a)];
const point = (x: number, y: number): string => `${String(round(x))} ${String(round(y))}`;

/**
 * Places every node of the graph around the centre (0, 0) and returns the box that holds it all. `names`
 * are the topics' reader names from settings.yml, for the tags that cannot say it alone.
 */
export function layoutGraph(
  graph: Graph,
  o: LayoutOptions,
  names: Readonly<Record<string, string>> = {},
): GraphLayout {
  const ring = ringOf(graph);
  const counts = new Map(graph.topics.map((t) => [t.topic, t.ideas]));
  const labels = placeLabels(
    ring.arcs,
    new Map(ring.order.map((t) => [t, themeLabel(t, names)])),
    counts,
    o,
  );

  const topics = ring.arcs.map((arc, k): PlacedTopic => {
    const label = labels[k];
    if (!label) throw new Error(`no label for ${arc.topic}`);
    const span = arc.end - arc.start;
    const tick = (angle: number): string => {
      const [ix, iy] = polar(o.topicRadius - o.dot * 1.2, angle);
      const [ox, oy] = polar(o.topicRadius + o.dot * 1.2, angle);
      return `M${point(ix, iy)}L${point(ox, oy)}`;
    };
    const [sx, sy] = polar(o.topicRadius, arc.start);
    const [ex, ey] = polar(o.topicRadius, arc.end);
    return {
      ...label,
      ideas: counts.get(arc.topic) ?? 0,
      arc: `M${point(sx, sy)}A${String(o.topicRadius)} ${String(o.topicRadius)} 0 ${span > Math.PI ? '1' : '0'} 1 ${point(ex, ey)}`,
      start: arc.start,
      end: arc.end,
      ticks: tick(arc.start) + tick(arc.end),
    };
  });

  const ideas = graph.ideas.map((idea): PlacedIdea => {
    const angle = ring.angles.get(idea.id) ?? 0;
    const [x, y] = polar(o.ideaRadius, angle);
    return {
      id: idea.id,
      x: round(x),
      y: round(y),
      angle,
      topics: idea.topics,
      post: idea.slug,
      inGap: ring.inGap.has(idea.id),
      ...(o.tipSize > 0 ? { tip: tipOf(idea.text, idea.title, o.topicRadius, o.tipSize) } : {}),
    };
  });

  // A dot over an arc has one short line straight down to it; a dot in a gap needs none, the gap says it.
  const arcs = new Map(topics.map((t) => [t.topic, t]));
  const edges = ideas.flatMap((idea): PlacedEdge[] => {
    if (idea.inGap) return [];
    const own = idea.topics
      .map((t) => arcs.get(t))
      .find((t) => t !== undefined && isOver(idea.angle, t.start, t.end));
    if (!own) return [];
    const [fx, fy] = polar(o.ideaRadius - o.dot * 1.5, idea.angle);
    const [tx, ty] = polar(o.topicRadius + 2, idea.angle);
    return [
      {
        topics: idea.topics,
        idea: idea.id,
        post: idea.post,
        d: `M${point(fx, fy)}L${point(tx, ty)}`,
      },
    ];
  });

  const spacing = ring.slot * o.ideaRadius;
  const reach = o.ideaRadius + o.dot;
  const x0 = Math.min(-reach, ...topics.map((t) => t.box.x0)) - o.pad;
  const y0 = Math.min(-reach, ...topics.map((t) => t.box.y0)) - o.pad;
  const x1 = Math.max(reach, ...topics.map((t) => t.box.x1)) + o.pad;
  const y1 = Math.max(reach, ...topics.map((t) => t.box.y1)) + o.pad;

  return {
    viewBox: [x0, y0, x1 - x0, y1 - y0].map((v) => String(Math.round(v))).join(' '),
    options: o,
    topics,
    ideas,
    edges,
    spacing,
    crowded: graph.ideas.length > 0 && spacing < CROWDED * o.dot,
    hitRadius: Math.min(o.dot * 2.6, spacing / 2),
  };
}

/** Whether an angle falls on an arc, going round the ring from its start. */
function isOver(angle: number, start: number, end: number): boolean {
  const tau = Math.PI * 2;
  const d = (((angle - start) % tau) + tau) % tau;
  return d <= end - start + 1e-9;
}
