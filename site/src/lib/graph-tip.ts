// Why: when a pointer rests on a dot, the idea's own words take the middle of the ring, with the thought it
// came from under them. This sets them to fit inside the topic ring: wrapped to the ring's width, at most six
// lines (the whole idea is in the list), and centred. Pure.
import { wrapLabel } from './graph-labels';

export interface Tip {
  lines: string[];
  baselines: number[];
  from: string[];
  fromBaselines: number[];
}

/** Atkinson Hyperlegible bold, in ems; the words in the middle are set in it. */
const charWidth = 0.56;
const round = (n: number): number => Math.round(n * 10) / 10;

export function tipOf(text: string, title: string, topicRadius: number, size: number): Tip {
  const chars = Math.floor((topicRadius * 1.45) / (charWidth * size));
  const wrapped = wrapLabel(text, chars);
  const lines = wrapped.length > 6 ? [...wrapped.slice(0, 5), `${wrapped[5] ?? ''}…`] : wrapped;
  const fromSize = size * 0.75;
  const from = wrapLabel(`From the thought “${title}”`, Math.floor(chars / 0.75));
  const lineHeight = size * 1.25;
  const fromHeight = fromSize * 1.3;
  const height = lines.length * lineHeight + fromSize * 0.8 + from.length * fromHeight;
  const top = -height / 2 + size * 0.85;
  const fromTop = top + lines.length * lineHeight + fromSize * 0.8;
  return {
    lines,
    baselines: lines.map((_, i) => round(top + i * lineHeight)),
    from,
    fromBaselines: from.map((_, i) => round(fromTop + i * fromHeight)),
  };
}
