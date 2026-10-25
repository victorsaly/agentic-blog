// Why: the graph is drawn, never placed by hand, so the same posts always give the same picture and a new
// topic finds its own place. Every small idea gets an equal slot on the outer ring, so each topic's arc is
// as long as the ideas it holds, and an idea on two neighbouring topics sits on the line between them.
// Topics that share ideas are put side by side. Pure geometry, tested without a build.
import type { Graph } from './graph';
import { themeLabel } from './themes';

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
};

/** A phone: a smaller ring in the same units, so the names stay large when it is scaled to the screen. */
export const phoneLayout: LayoutOptions = {
  ideaRadius: 112,
  topicRadius: 80,
  coreRadius: 36,
  labelGap: 14,
  fontSize: 15,
  lineChars: 11,
  dot: 3.5,
  pad: 6,
  tipSize: 0,
};

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

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
}

/** An idea's words and its post, set in the middle of the ring while a pointer rests on its dot. */
export interface Tip {
  lines: string[];
  baselines: number[];
  from: string[];
  fromBaselines: number[];
}

export interface PlacedIdea {
  id: string;
  x: number;
  y: number;
  angle: number;
  topics: string[];
  post: string;
  tip?: Tip;
}

export interface PlacedEdge {
  d: string;
  topics: string[];
  /** The idea this line starts from, and its post; none for a fork or a line from the middle. */
  idea?: string;
  post?: string;
  /** A line from the middle to a topic; it steps aside while an idea's words take the middle. */
  spoke?: boolean;
}

export interface GraphLayout {
  viewBox: string;
  options: LayoutOptions;
  topics: PlacedTopic[];
  ideas: PlacedIdea[];
  edges: PlacedEdge[];
}

const TAU = Math.PI * 2;
const charWidth = 0.56; // Atkinson Hyperlegible bold, in ems, generous so Lexend fits too

const round = (n: number): number => Math.round(n * 10) / 10;
const polar = (r: number, a: number): [number, number] => [r * Math.cos(a), r * Math.sin(a)];
const wrap = (a: number): number => ((a % TAU) + TAU) % TAU;

/**
 * The order of the topics around the ring: the biggest first, then each next one added to whichever end
 * it shares the most ideas with, so ideas on two topics usually sit between neighbours.
 */
export function ringOrder(graph: Graph): string[] {
  const topics = graph.topics.map((t) => t.topic);
  const [first, ...rest] = topics;
  if (first === undefined) return [];
  const shared = (a: string, b: string): number =>
    graph.ideas.filter((i) => i.topics.includes(a) && i.topics.includes(b)).length;

  const chain = [first];
  const left = new Set(rest);
  while (left.size > 0) {
    let best: { topic: string; tail: boolean; n: number } | undefined;
    for (const topic of topics) {
      if (!left.has(topic)) continue;
      for (const tail of [true, false]) {
        const end = tail ? chain[chain.length - 1] : chain[0];
        const n = end === undefined ? 0 : shared(topic, end);
        if (best === undefined || n > best.n) best = { topic, tail, n };
      }
    }
    if (best === undefined) break;
    if (best.tail) chain.push(best.topic);
    else chain.unshift(best.topic);
    left.delete(best.topic);
  }
  return chain;
}

/** "AI changing work" → ["AI changing", "work"] at ten characters a line. */
export function wrapLabel(text: string, lineChars: number): string[] {
  const lines: string[] = [];
  for (const word of text.split(' ')) {
    const last = lines[lines.length - 1];
    if (last !== undefined && last.length + 1 + word.length <= lineChars) {
      lines[lines.length - 1] = `${last} ${word}`;
    } else lines.push(word);
  }
  return lines;
}

const overlaps = (a: Box, b: Box, gap: number): boolean =>
  a.x0 < b.x1 + gap && b.x0 < a.x1 + gap && a.y0 < b.y1 + gap && b.y0 < a.y1 + gap;

/** The words of an idea, wrapped to fit inside the topic ring, with the post it came from under them. */
function tipOf(text: string, title: string, o: LayoutOptions): Tip {
  const chars = Math.floor((o.topicRadius * 1.45) / (charWidth * o.tipSize));
  const lines = wrapLabel(text, chars);
  const fromSize = o.tipSize * 0.75;
  const from = wrapLabel(`From ${title}`, Math.floor(chars / 0.75));
  const lineHeight = o.tipSize * 1.25;
  const fromHeight = fromSize * 1.3;
  const height = lines.length * lineHeight + fromSize * 0.8 + from.length * fromHeight;
  const top = -height / 2 + o.tipSize * 0.85;
  const baselines = lines.map((_, i) => round(top + i * lineHeight));
  const fromTop = top + lines.length * lineHeight + fromSize * 0.8;
  return {
    lines,
    baselines,
    from,
    fromBaselines: from.map((_, i) => round(fromTop + i * fromHeight)),
  };
}

/**
 * Places every node of the graph around the centre (0, 0) and returns the box that holds it all. `names`
 * are the topics' reader names from settings.yml, for the tags that cannot say it alone.
 */
export function layoutGraph(
  graph: Graph,
  o: LayoutOptions,
  names: Readonly<Record<string, string>> = {},
): GraphLayout {
  const order = ringOrder(graph);
  const n = order.length;
  const index = new Map(order.map((t, k) => [t, k]));

  // Each idea goes in one bucket: on its own topic, or between two topics that are neighbours on the ring.
  const single = order.map((): string[] => []);
  const between = order.map((): string[] => []);
  for (const idea of graph.ideas) {
    const ks = idea.topics.map((t) => index.get(t) ?? 0).sort((a, b) => a - b);
    const pair = n > 1 ? ks.find((k) => idea.topics.includes(order[(k + 1) % n] ?? '')) : undefined;
    if (ks.length > 1 && pair !== undefined) between[pair]?.push(idea.id);
    else single[ks[0] ?? 0]?.push(idea.id);
  }

  const sequence: string[] = [];
  const spans: { k: number; a: number; b: number }[] = [];
  const groups: { k: number; next: number; ids: string[]; mid: number }[] = [];
  const slot = graph.ideas.length > 0 ? TAU / graph.ideas.length : TAU;
  for (let k = 0; k < n; k++) {
    for (const id of single[k] ?? []) {
      spans.push({ k, a: sequence.length * slot, b: (sequence.length + 1) * slot });
      sequence.push(id);
    }
    const group = between[k] ?? [];
    if (group.length > 0) {
      const a = sequence.length * slot;
      const b = (sequence.length + group.length) * slot;
      const mid = (a + b) / 2;
      // The last group sits between the last topic and the first, which starts again at zero.
      const next = (k + 1) % n;
      const shift = next === 0 ? TAU : 0;
      spans.push({ k, a, b: mid }, { k: next, a: mid - shift, b: b - shift });
      groups.push({ k, next, ids: group, mid });
      sequence.push(...group);
    }
  }

  // The biggest topic is centred at the top.
  const arcOf = (k: number): [number, number] => {
    const own = spans.filter((s) => s.k === k);
    if (own.length > 0) return [Math.min(...own.map((s) => s.a)), Math.max(...own.map((s) => s.b))];
    // Every idea of this topic also sits on a topic that is not its neighbour: a short arc on the first.
    const topic = order[k] ?? '';
    const at = sequence.findIndex((id) =>
      graph.ideas.find((i) => i.id === id)?.topics.includes(topic),
    );
    return [Math.max(at, 0) * slot, (Math.max(at, 0) + 1) * slot];
  };
  const biggest = index.get(graph.topics[0]?.topic ?? '');
  const [topA = 0, topB = 0] = biggest === undefined ? [] : arcOf(biggest);
  const turn = -Math.PI / 2 - (topA + topB) / 2;
  const gap = Math.min(slot * 0.18, 0.05);

  const angleOf = new Map(sequence.map((id, i) => [id, (i + 0.5) * slot + turn]));
  const ideas: PlacedIdea[] = graph.ideas.map((idea) => {
    const angle = angleOf.get(idea.id) ?? 0;
    const [x, y] = polar(o.ideaRadius, angle);
    return {
      id: idea.id,
      x: round(x),
      y: round(y),
      angle,
      topics: idea.topics,
      post: idea.slug,
      ...(o.tipSize > 0 ? { tip: tipOf(idea.text, idea.title, o) } : {}),
    };
  });

  const counts = new Map(graph.topics.map((t) => [t.topic, t.ideas]));
  const lineHeight = o.fontSize * 1.15;
  const placed: PlacedTopic[] = order.map((topic, k) => {
    const [a, b] = arcOf(k);
    const span = Math.max(b - a - 2 * gap, slot * 0.25);
    const start = (a + b) / 2 - span / 2 + turn;
    const end = start + span;
    const [sx, sy] = polar(o.topicRadius, start);
    const [ex, ey] = polar(o.topicRadius, end);
    const arc = `M${String(round(sx))} ${String(round(sy))}A${String(o.topicRadius)} ${String(o.topicRadius)} 0 ${span > Math.PI ? '1' : '0'} 1 ${String(round(ex))} ${String(round(ey))}`;

    const mid = (start + end) / 2;
    const cos = Math.cos(mid);
    const sin = Math.sin(mid);
    const anchor = cos > 0.3 ? 'start' : cos < -0.3 ? 'end' : 'middle';
    const lines = wrapLabel(themeLabel(topic, names), o.lineChars);
    const width = Math.max(...lines.map((l) => l.length)) * charWidth * o.fontSize;
    const height = lines.length * lineHeight;
    const [x, y] = polar(o.ideaRadius + o.labelGap, mid);
    const x0 = anchor === 'start' ? x : anchor === 'end' ? x - width : x - width / 2;
    const y0 = anchor !== 'middle' ? y - height / 2 : sin < 0 ? y - height : y;
    return {
      topic,
      ideas: counts.get(topic) ?? 0,
      arc,
      start,
      end,
      lines,
      anchor,
      x: round(x),
      baselines: [],
      box: { x0, y0, x1: x0 + width, y1: y0 + height },
      leader: '',
    };
  });

  // Two names centred at the top or the bottom that would touch are set side by side instead: the left one
  // ends at its tick, the right one starts at its own, so neither leader crosses the other's name.
  const centred = placed.filter((p) => p.anchor === 'middle');
  for (const p of centred) {
    for (const q of centred) {
      if (p === q || p.anchor !== 'middle' || q.anchor !== 'middle') continue;
      if (!overlaps(p.box, q.box, o.fontSize * 0.3)) continue;
      const [left, right] = p.x <= q.x ? [p, q] : [q, p];
      const lw = left.box.x1 - left.box.x0;
      const rw = right.box.x1 - right.box.x0;
      left.anchor = 'end';
      left.box = { ...left.box, x0: left.x - o.fontSize * 0.3 - lw, x1: left.x - o.fontSize * 0.3 };
      right.anchor = 'start';
      right.box = {
        ...right.box,
        x0: right.x + o.fontSize * 0.3,
        x1: right.x + o.fontSize * 0.3 + rw,
      };
    }
  }

  // Names that still touch are moved apart, down the page, keeping the order the ring gives them.
  const byTop = [...placed].sort((p, q) => p.box.y0 - q.box.y0);
  for (let i = 1; i < byTop.length; i++) {
    const p = byTop[i];
    if (p === undefined) continue;
    for (const q of byTop.slice(0, i)) {
      if (overlaps(p.box, q.box, o.fontSize * 0.3)) {
        const down = q.box.y1 + o.fontSize * 0.3 - p.box.y0;
        p.box = { ...p.box, y0: p.box.y0 + down, y1: p.box.y1 + down };
      }
    }
  }

  for (const p of placed) {
    p.baselines = p.lines.map((_, i) => round(p.box.y0 + o.fontSize * 0.85 + i * lineHeight));
    const mid = (p.start + p.end) / 2;
    const [qx, qy] = polar(o.ideaRadius + o.dot + o.labelGap * 0.2, mid);
    const toX =
      p.anchor === 'start'
        ? p.box.x0 - o.fontSize * 0.2
        : p.anchor === 'end'
          ? p.box.x1 + o.fontSize * 0.2
          : p.x;
    const toY =
      p.anchor !== 'middle'
        ? (p.box.y0 + p.box.y1) / 2
        : Math.sin(mid) < 0
          ? p.box.y1 + o.fontSize * 0.1
          : p.box.y0 - o.fontSize * 0.1;
    p.leader = `M${String(round(qx))} ${String(round(qy))}L${String(round(toX))} ${String(round(toY))}`;
    p.box = {
      x0: round(p.box.x0),
      y0: round(p.box.y0),
      x1: round(p.box.x1),
      y1: round(p.box.y1),
    };
  }

  // Lines are bundled so they read as a few strands, not a tangle. Ideas between two neighbouring topics
  // run down into one knot over the gap between the arcs, and one short fork joins the knot to each arc.
  // A line to a topic across the ring dives through the middle and arrives along the same last stretch as
  // every other line to that topic. Every other idea drops straight onto its own arc.
  const arcs = new Map(placed.map((p) => [p.topic, p]));
  const edges: PlacedEdge[] = [];
  const path = (...points: [string, number, number][]): string =>
    points.map(([c, x, y]) => `${c}${String(round(x))} ${String(round(y))}`).join('');
  const from = (angle: number): [number, number] => polar(o.ideaRadius - o.dot * 1.5, angle);
  const joined = new Set<string>();

  const knotRadius = o.topicRadius + (o.ideaRadius - o.topicRadius) * 0.42;
  for (const g of groups) {
    const left = placed[g.k];
    const right = placed[g.next];
    if (left === undefined || right === undefined) continue;
    const at = g.mid + turn;
    const [kx, ky] = polar(knotRadius, at);
    for (const id of g.ids) {
      const idea = ideas.find((i) => i.id === id);
      if (idea === undefined) continue;
      const [fx, fy] = from(idea.angle);
      const [cx, cy] = polar(knotRadius + (o.ideaRadius - knotRadius) * 0.35, idea.angle);
      edges.push({
        topics: [left.topic, right.topic],
        idea: idea.id,
        post: idea.post,
        d: path(['M', fx, fy], ['Q', cx, cy], [' ', kx, ky]),
      });
      joined.add(`${id} ${left.topic}`).add(`${id} ${right.topic}`);
    }
    for (const [p, end] of [
      [left, left.end],
      [right, right.start],
    ] as const) {
      const [tx, ty] = polar(o.topicRadius + 2, end);
      edges.push({ topics: [p.topic], d: path(['M', kx, ky], ['L', tx, ty]) });
    }
  }

  for (const idea of ideas) {
    for (const topic of idea.topics) {
      const p = arcs.get(topic);
      if (p === undefined || joined.has(`${idea.id} ${topic}`)) continue;
      const span = p.end - p.start;
      const d = wrap(idea.angle - p.start);
      const to = d <= span ? idea.angle : TAU - d < d - span ? p.start : p.end;
      const [fx, fy] = from(idea.angle);
      const turnBy = Math.abs(Math.atan2(Math.sin(to - idea.angle), Math.cos(to - idea.angle)));
      if (turnBy < 0.5) {
        const [tx, ty] = polar(o.topicRadius + 2, to);
        edges.push({
          topics: [topic],
          idea: idea.id,
          post: idea.post,
          d: path(['M', fx, fy], ['L', tx, ty]),
        });
      } else {
        const [ax, ay] = polar(o.topicRadius * 0.5, idea.angle);
        const [bx, by] = polar(o.topicRadius * 0.5, to);
        const [tx, ty] = polar(o.topicRadius - 2, to);
        edges.push({
          topics: [topic],
          idea: idea.id,
          post: idea.post,
          d: path(['M', fx, fy], ['C', ax, ay], [' ', bx, by], [' ', tx, ty]),
        });
      }
    }
  }
  for (const p of placed) {
    const mid = (p.start + p.end) / 2;
    const [fx, fy] = polar(o.coreRadius, mid);
    const [tx, ty] = polar(o.topicRadius - 4, mid);
    edges.push({ topics: [p.topic], spoke: true, d: path(['M', fx, fy], ['L', tx, ty]) });
  }

  const reach = o.ideaRadius + o.dot;
  const x0 = Math.min(-reach, -o.coreRadius, ...placed.map((p) => p.box.x0)) - o.pad;
  const y0 = Math.min(-reach, -o.coreRadius, ...placed.map((p) => p.box.y0)) - o.pad;
  const x1 = Math.max(reach, o.coreRadius, ...placed.map((p) => p.box.x1)) + o.pad;
  const y1 = Math.max(reach, o.coreRadius, ...placed.map((p) => p.box.y1)) + o.pad;
  const viewBox = [x0, y0, x1 - x0, y1 - y0].map((v) => String(Math.round(v))).join(' ');

  return { viewBox, options: o, topics: placed, ideas, edges };
}
