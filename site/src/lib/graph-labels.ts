// Why: a topic's name and count sit outside the ring, by its arc, where a reader looks for them, and they
// must never sit on the dots or on another name, in either face, however long the name. This places them:
// at most three lines, sized to the wider of the two faces with room for the paper halo, two names that
// would meet at the top or bottom set side by side, and any name that still touches the ring or another
// name moved outwards along its own angle until it does not. Pure; each name is placed once and returned.
import type { RingArc } from './graph-ring';

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface LabelOptions {
  /** Where the dots sit, and how big they are: names keep clear of them. */
  ideaRadius: number;
  dot: number;
  /** From the idea ring out to where a name starts. */
  labelGap: number;
  fontSize: number;
  lineChars: number;
  countScale: number;
}

export interface PlacedLabel {
  topic: string;
  lines: string[];
  count: string;
  anchor: 'start' | 'middle' | 'end';
  /** The anchor's x, for the lines' x. */
  x: number;
  box: Box;
  baselines: number[];
  countBaseline: number;
  /** The ink tick from the idea ring to the name. */
  leader: string;
}

/** Lexend runs up to 0.58 em a character in bold, Atkinson about 0.52: sized to the wider. */
const charWidth = 0.58;
/** The paper halo round every letter (stroke 0.45em, half of it outside the glyph). */
const halo = 0.225;
const maxLines = 3;

const round = (n: number): number => Math.round(n * 10) / 10;
const polar = (r: number, a: number): [number, number] => [r * Math.cos(a), r * Math.sin(a)];

/** "AI changing work" → ["AI changing", "work"] at eleven characters a line. */
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

/** A name in at most three lines; a longer one ends in an ellipsis, and the list says it whole. */
export function capped(lines: readonly string[]): string[] {
  if (lines.length <= maxLines) return [...lines];
  return [...lines.slice(0, maxLines - 1), `${lines[maxLines - 1] ?? ''}…`];
}

const overlaps = (a: Box, b: Box, gap: number): boolean =>
  a.x0 < b.x1 + gap && b.x0 < a.x1 + gap && a.y0 < b.y1 + gap && b.y0 < a.y1 + gap;

/** How near the box comes to the centre: the distance from (0, 0) to its closest point. */
export const reachOf = (b: Box): number =>
  Math.hypot(Math.max(b.x0, Math.min(0, b.x1)), Math.max(b.y0, Math.min(0, b.y1)));

const moved = (b: Box, dx: number, dy: number): Box => ({
  x0: b.x0 + dx,
  y0: b.y0 + dy,
  x1: b.x1 + dx,
  y1: b.y1 + dy,
});

interface Draft {
  topic: string;
  lines: string[];
  count: string;
  anchor: 'start' | 'middle' | 'end';
  angle: number;
  x: number;
  box: Box;
}

function draftOf(arc: RingArc, name: string, ideas: number, o: LabelOptions): Draft {
  const angle = (arc.start + arc.end) / 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const anchor = cos > 0.3 ? 'start' : cos < -0.3 ? 'end' : 'middle';
  const lines = capped(wrapLabel(name, o.lineChars));
  const count = ideas === 1 ? '1 idea' : `${String(ideas)} ideas`;
  const pad = halo * o.fontSize;
  const width =
    Math.max(...lines.map((l) => l.length), count.length * o.countScale) * charWidth * o.fontSize +
    2 * pad;
  const height = lines.length * o.fontSize * 1.15 + o.fontSize * o.countScale * 1.25 + 2 * pad;
  const [x, y] = polar(o.ideaRadius + o.labelGap, angle);
  const x0 = anchor === 'start' ? x - pad : anchor === 'end' ? x - width + pad : x - width / 2;
  const y0 = anchor !== 'middle' ? y - height / 2 : sin < 0 ? y - height : y;
  return {
    topic: arc.topic,
    lines,
    count,
    anchor,
    angle,
    x,
    box: { x0, y0, x1: x0 + width, y1: y0 + height },
  };
}

/** Every topic's name and count by its arc, clear of the dots and of each other. */
export function placeLabels(
  arcs: readonly RingArc[],
  names: ReadonlyMap<string, string>,
  counts: ReadonlyMap<string, number>,
  o: LabelOptions,
): PlacedLabel[] {
  const room = o.fontSize * 0.3;
  let drafts = arcs.map((arc) =>
    draftOf(arc, names.get(arc.topic) ?? arc.topic, counts.get(arc.topic) ?? 0, o),
  );

  // Two names centred at the top or the bottom that would touch are set side by side: the left one ends at
  // its tick, the right one starts at its own, so neither leader crosses the other's name.
  drafts = drafts.map((p) => {
    if (p.anchor !== 'middle') return p;
    const q = drafts.find((d) => d !== p && d.anchor === 'middle' && overlaps(p.box, d.box, room));
    if (!q) return p;
    const width = p.box.x1 - p.box.x0;
    return p.x <= q.x
      ? { ...p, anchor: 'end', box: { ...p.box, x0: p.x - room - width, x1: p.x - room } }
      : { ...p, anchor: 'start', box: { ...p.box, x0: p.x + room, x1: p.x + room + width } };
  });

  // Anything still touching the ring or another name moves outwards along its own angle, a step at a time,
  // in ring order, so the same posts always give the same places.
  const clear = o.ideaRadius + o.dot * 1.5 + room;
  const step = o.fontSize * 0.25;
  for (let pass = 0; pass < 60; pass++) {
    const before = drafts;
    drafts = before.map((p, i) => {
      const touchesRing = reachOf(p.box) < clear;
      const touchesName = before.some((q, j) => j < i && overlaps(p.box, q.box, room));
      if (!touchesRing && !touchesName) return p;
      return { ...p, box: moved(p.box, Math.cos(p.angle) * step, Math.sin(p.angle) * step) };
    });
    if (drafts.every((p, i) => p === before[i])) break;
  }

  const pad = halo * o.fontSize;
  return drafts.map((p): PlacedLabel => {
    const top = p.box.y0 + pad;
    const baselines = p.lines.map((_, i) => round(top + o.fontSize * 0.85 + i * o.fontSize * 1.15));
    const countBaseline = round(
      top +
        o.fontSize * 0.85 +
        (p.lines.length - 1) * o.fontSize * 1.15 +
        o.fontSize * o.countScale * 1.25,
    );
    const x =
      p.anchor === 'start'
        ? p.box.x0 + pad
        : p.anchor === 'end'
          ? p.box.x1 - pad
          : (p.box.x0 + p.box.x1) / 2;
    const [qx, qy] = polar(o.ideaRadius + o.dot + o.labelGap * 0.2, p.angle);
    const toX = p.anchor === 'start' ? p.box.x0 : p.anchor === 'end' ? p.box.x1 : x;
    const toY =
      p.anchor !== 'middle'
        ? (p.box.y0 + p.box.y1) / 2
        : Math.sin(p.angle) < 0
          ? p.box.y1
          : p.box.y0;
    return {
      topic: p.topic,
      lines: p.lines,
      count: p.count,
      anchor: p.anchor,
      x: round(x),
      box: { x0: round(p.box.x0), y0: round(p.box.y0), x1: round(p.box.x1), y1: round(p.box.y1) },
      baselines,
      countBaseline,
      leader: `M${String(round(qx))} ${String(round(qy))}L${String(round(toX))} ${String(round(toY))}`,
    };
  });
}
