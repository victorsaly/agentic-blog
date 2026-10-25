// Why: where everything sits around the ring, before anything is drawn. Topics that share ideas are put
// side by side; each topic's arc is as long as the ideas it holds; an idea on two neighbouring topics sits
// in the gap between their arcs, and every other idea sits over its own arc (an idea whose topics are not
// neighbours sits over the first of them, and the list says where else it belongs). Pure, and the same posts
// always give the same ring.
import type { Graph } from './graph';

export const TAU = Math.PI * 2;

export interface RingArc {
  topic: string;
  /** Angles in radians, the biggest topic centred at the top (−π/2). */
  start: number;
  end: number;
}

export interface Ring {
  /** The topics in the order they go round. */
  order: string[];
  arcs: RingArc[];
  /** Each idea's angle on the idea ring. */
  angles: ReadonlyMap<string, number>;
  /** Ideas that sit in the gap between two neighbouring arcs, and belong to both. */
  inGap: ReadonlySet<string>;
  /** The angle one idea takes: the spacing of the dots. */
  slot: number;
}

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

/** Which ideas sit over each topic's arc, and which in the gap after it, every topic keeping one of its own. */
function buckets(graph: Graph, order: readonly string[]): { own: string[][]; gaps: string[][] } {
  const n = order.length;
  const index = new Map(order.map((t, k) => [t, k]));
  const own = order.map((): string[] => []);
  const gaps = order.map((): string[] => []);
  for (const idea of graph.ideas) {
    const ks = idea.topics.map((t) => index.get(t) ?? 0).sort((a, b) => a - b);
    const pair = n > 1 ? ks.find((k) => idea.topics.includes(order[(k + 1) % n] ?? '')) : undefined;
    if (ks.length > 1 && pair !== undefined) gaps[pair]?.push(idea.id);
    else own[ks[0] ?? 0]?.push(idea.id);
  }
  // A topic with no idea of its own takes one of its ideas, first from a gap beside it, then from a topic
  // that keeps others, so every topic has dots over its arc.
  const topicsOf = new Map(graph.ideas.map((i) => [i.id, i.topics]));
  for (let k = 0; k < n; k++) {
    if ((own[k]?.length ?? 0) > 0) continue;
    const topic = order[k] ?? '';
    const holds = (id: string): boolean => topicsOf.get(id)?.includes(topic) ?? false;
    const others = order.map((_, j) => j).filter((j) => j !== k && (own[j]?.length ?? 0) > 1);
    const sources = [gaps[k], gaps[(k - 1 + n) % n], ...others.map((j) => own[j])];
    const from = sources.find((bucket) => bucket?.some(holds));
    const id = from?.find(holds);
    if (from === undefined || id === undefined) continue;
    from.splice(from.indexOf(id), 1);
    own[k]?.push(id);
  }
  return { own, gaps };
}

/**
 * The ring: every topic's arc as long as all the ideas it holds (shared ones included, so an arc and its
 * count agree), a gap between neighbours as wide as the ideas they share or one idea wide, and each idea's
 * angle, the biggest topic centred at the top.
 */
export function ringOf(graph: Graph): Ring {
  const order = ringOrder(graph);
  const { own, gaps } = buckets(graph, order);
  const counts = new Map(graph.topics.map((t) => [t.topic, t.ideas]));
  const arcUnits = order.map((t) => Math.max(counts.get(t) ?? 0, 1));
  const gapUnits = order.map((_, k) => Math.max(gaps[k]?.length ?? 0, 1));
  const total = [...arcUnits, ...gapUnits].reduce((sum, u) => sum + u, 0);
  const slot = total > 0 ? TAU / total : TAU;

  const spans: [number, number][] = [];
  const raw = new Map<string, number>();
  let at = 0;
  order.forEach((_, k) => {
    const length = (arcUnits[k] ?? 1) * slot;
    spans.push([at, at + length]);
    const mine = own[k] ?? [];
    mine.forEach((id, i) => raw.set(id, at + ((i + 0.5) * length) / mine.length));
    at += length;
    const width = (gapUnits[k] ?? 1) * slot;
    const shared = gaps[k] ?? [];
    shared.forEach((id, i) => raw.set(id, at + ((i + 0.5) * width) / shared.length));
    at += width;
  });

  const biggest = order.indexOf(graph.topics[0]?.topic ?? '');
  const [topA, topB] = spans[biggest] ?? [0, 0];
  const turn = -Math.PI / 2 - (topA + topB) / 2;
  // Each arc is drawn a little short of its share, so two arcs never touch even across an empty gap.
  const inset = slot * 0.12;
  const arcs = order.map((topic, k): RingArc => {
    const [a, b] = spans[k] ?? [0, slot];
    const span = Math.max(b - a - 2 * inset, slot * 0.25);
    const start = (a + b) / 2 - span / 2 + turn;
    return { topic, start, end: start + span };
  });
  return {
    order,
    arcs,
    angles: new Map([...raw].map(([id, angle]) => [id, angle + turn])),
    inGap: new Set(gaps.flat()),
    slot,
  };
}
