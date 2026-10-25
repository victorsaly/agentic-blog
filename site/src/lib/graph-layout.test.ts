// Why: nothing on the graph is placed by hand, so these are the promises the picture keeps: the biggest
// topic at the top, each arc as long as its ideas, a shared idea between its two topics, names that never
// touch, and the same picture for the same posts.
import { describe, expect, it } from 'vitest';
import { graphOf, type GraphPost } from './graph.js';
import { deskLayout, layoutGraph, phoneLayout, ringOrder, wrapLabel } from './graph-layout.js';

const known = [
  'ai-changing-work',
  'accountability',
  'credibility',
  'scalable-secure',
  'apps-and-workflows',
];

const post = (slug: string, rows: string[]): GraphPost => ({
  slug,
  title: slug,
  draft: false,
  body: `## Small ideas\n\n| Idea | Themes |\n| --- | --- |\n${rows.map((r) => `| ${r} |`).join('\n')}\n`,
});

// The shape of the real blog: one big topic, two that share with it, two small ones.
const graph = graphOf(
  [
    post('2026-01-01-a', [
      'A1 | ai-changing-work',
      'A2 | ai-changing-work',
      'A3 | ai-changing-work',
      'A4 | ai-changing-work',
      'AC | ai-changing-work, credibility',
      'AC2 | ai-changing-work, credibility',
      'AX | ai-changing-work, accountability',
      'C1 | credibility',
      'X1 | accountability',
      'S1 | scalable-secure',
      'SP | scalable-secure, apps-and-workflows',
    ]),
  ],
  known,
);

const angleOf = (topic: { start: number; end: number }): number => (topic.start + topic.end) / 2;
const norm = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Points along an SVG path made of M, L and A commands: each straight stretch sampled at ten points, and
 * each arc (always round the centre here) by its radius and its end. Any other command fails the test.
 */
const pointsOf = (d: string): [number, number][] => {
  const tokens = d.match(/[A-Z]|-?\d+(\.\d+)?/g) ?? [];
  const points: [number, number][] = [];
  let command = '';
  let last: [number, number] = [0, 0];
  for (let i = 0; i < tokens.length;) {
    const token = tokens[i] ?? '';
    if (/[A-Z]/.test(token)) {
      if (!'MLA'.includes(token)) throw new Error(`unexpected ${token} in ${d}`);
      command = token;
      i += 1;
      continue;
    }
    if (command === 'A') {
      const r = Number(tokens[i]);
      points.push([r, 0]);
      i += 5;
    }
    const next: [number, number] = [Number(tokens[i]), Number(tokens[i + 1])];
    if (command === 'L')
      for (let t = 1; t < 10; t++)
        points.push([
          last[0] + ((next[0] - last[0]) * t) / 10,
          last[1] + ((next[1] - last[1]) * t) / 10,
        ]);
    points.push(next);
    last = next;
    i += 2;
  }
  return points;
};

describe('ringOrder', () => {
  it('starts from the biggest topic and puts topics that share ideas side by side', () => {
    const order = ringOrder(graph);
    const at = (t: string): number => order.indexOf(t);
    expect(order).toHaveLength(5);
    expect(Math.abs(at('ai-changing-work') - at('credibility'))).toBe(1);
    expect(Math.abs(at('ai-changing-work') - at('accountability'))).toBe(1);
    expect(Math.abs(at('scalable-secure') - at('apps-and-workflows'))).toBe(1);
  });
});

describe('wrapLabel', () => {
  it('wraps a topic name at whole words', () => {
    expect(wrapLabel('AI changing work', 10)).toEqual(['AI', 'changing', 'work']);
    expect(wrapLabel('AI changing work', 11)).toEqual(['AI changing', 'work']);
    expect(wrapLabel('Credibility', 5)).toEqual(['Credibility']);
  });
});

describe('layoutGraph', () => {
  for (const [name, options] of [
    ['desk', deskLayout],
    ['phone', phoneLayout],
  ] as const) {
    describe(name, () => {
      const layout = layoutGraph(graph, options);
      const topic = (t: string) => {
        const found = layout.topics.find((p) => p.topic === t);
        if (found === undefined) throw new Error(`no ${t}`);
        return found;
      };

      it('puts the biggest topic at the top', () => {
        expect(norm(angleOf(topic('ai-changing-work')))).toBeCloseTo(-Math.PI / 2, 5);
      });

      it('gives each topic an arc as long as the ideas it holds', () => {
        const big = topic('ai-changing-work');
        const small = topic('credibility');
        expect(big.end - big.start).toBeGreaterThan(small.end - small.start);
      });

      it('sits an idea on two neighbouring topics between their arcs', () => {
        const idea = layout.ideas.find((i) => i.id === 'idea:2026-01-01-a:5');
        if (idea === undefined) throw new Error('no idea');
        const a = norm(idea.angle - angleOf(topic('ai-changing-work')));
        const c = norm(idea.angle - angleOf(topic('credibility')));
        expect(Math.sign(a)).not.toBe(Math.sign(c));
      });

      it('keeps every topic name clear of the others and inside the picture', () => {
        const [vx, vy, vw, vh] = layout.viewBox.split(' ').map(Number) as [
          number,
          number,
          number,
          number,
        ];
        for (const p of layout.topics) {
          expect(p.box.x0).toBeGreaterThanOrEqual(vx);
          expect(p.box.y0).toBeGreaterThanOrEqual(vy);
          expect(p.box.x1).toBeLessThanOrEqual(vx + vw);
          expect(p.box.y1).toBeLessThanOrEqual(vy + vh);
          for (const q of layout.topics) {
            if (q === p) continue;
            const apart =
              p.box.x1 <= q.box.x0 ||
              q.box.x1 <= p.box.x0 ||
              p.box.y1 <= q.box.y0 ||
              q.box.y1 <= p.box.y0;
            expect(apart, `${p.topic} and ${q.topic}`).toBe(true);
          }
        }
      });

      it('joins every idea to each of its topics, and draws no line through the middle', () => {
        for (const idea of layout.ideas) {
          const reached = layout.edges.filter((e) => e.idea === idea.id).flatMap((e) => e.topics);
          for (const t of idea.topics) expect(reached, `${idea.id} → ${t}`).toContain(t);
        }
        // Every point a line passes through stays outside the space kept for the mark and the words.
        for (const e of layout.edges) {
          for (const [x, y] of pointsOf(e.d)) {
            expect(Math.hypot(x, y), e.d).toBeGreaterThan(options.topicRadius * 0.9);
          }
        }
      });

      it('leaves a gap of at least one idea between any two arcs', () => {
        const slot = (2 * Math.PI) / (layout.ideas.length + layout.topics.length);
        const arcs = [...layout.topics].sort((p, q) => norm(p.start) - norm(q.start));
        arcs.forEach((p, i) => {
          const q = arcs[(i + 1) % arcs.length];
          if (q === undefined || q === p) return;
          const between = (((q.start - p.end) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
          expect(between, `${p.topic} → ${q.topic}`).toBeGreaterThan(slot * 0.9);
        });
      });

      it('writes the count of each topic under its name, and ticks both ends of its arc', () => {
        expect(topic('ai-changing-work').count).toBe('7 ideas');
        expect(topic('apps-and-workflows').count).toBe('1 idea');
        for (const p of layout.topics) expect(p.ticks.match(/M/g)).toHaveLength(2);
      });

      it('bundles ideas between two neighbouring topics into one knot', () => {
        const shared = layout.edges.filter(
          (e) => e.topics.includes('ai-changing-work') && e.topics.includes('credibility'),
        );
        expect(shared).toHaveLength(2);
        const knots = new Set(shared.map((e) => e.d.split(' ').slice(-2).join(' ')));
        expect(knots.size).toBe(1);
      });

      it('draws the same picture for the same posts', () => {
        expect(layoutGraph(graph, options)).toEqual(layout);
      });
    });
  }

  it('sets the words of each idea inside the topic ring on a desk, and none on a phone', () => {
    const desk = layoutGraph(graph, deskLayout);
    for (const idea of desk.ideas) {
      const tip = idea.tip;
      if (tip === undefined) throw new Error(`no words for ${idea.id}`);
      const last = tip.fromBaselines[tip.fromBaselines.length - 1] ?? 0;
      expect(Math.abs(tip.baselines[0] ?? 0)).toBeLessThan(deskLayout.topicRadius);
      expect(Math.abs(last)).toBeLessThan(deskLayout.topicRadius);
      expect(tip.from.join(' ')).toBe(`From ${idea.post}`);
    }
    expect(layoutGraph(graph, phoneLayout).ideas.every((i) => i.tip === undefined)).toBe(true);
  });

  it('gives every topic its own arc, even one whose ideas all sit with another topic', () => {
    // Order c, a, b, d: the idea on a and d has no neighbouring pair, so d would have had no stretch.
    const lonely = graphOf(
      [
        post('2026-01-01-a', [
          'AB | ai-changing-work, accountability',
          'AC | ai-changing-work, credibility',
          'AD | ai-changing-work, scalable-secure',
        ]),
      ],
      known,
    );
    const arcs = layoutGraph(lonely, deskLayout).topics;
    expect(arcs).toHaveLength(4);
    const inside = (angle: number, arc: { start: number; end: number }): boolean => {
      const d = (((angle - arc.start) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      return d > 1e-6 && d < arc.end - arc.start - 1e-6;
    };
    for (const p of arcs)
      for (const q of arcs) {
        if (p === q) continue;
        for (const angle of [q.start, q.end, (q.start + q.end) / 2]) {
          expect(inside(angle, p), `${q.topic} inside ${p.topic}`).toBe(false);
        }
      }
  });

  it('makes an arc longer when its topic holds more ideas, shared ones included', () => {
    // Two topics that share three ideas, and a third with two of its own (from the review on #98).
    const shared = layoutGraph(
      graphOf(
        [
          post('2026-01-01-a', [
            'S1 | credibility, accountability',
            'S2 | credibility, accountability',
            'S3 | credibility, accountability',
            'O1 | scalable-secure',
            'O2 | scalable-secure',
          ]),
        ],
        known,
      ),
      deskLayout,
    );
    const length = (t: string): number => {
      const p = shared.topics.find((q) => q.topic === t);
      if (p === undefined) throw new Error(`no ${t}`);
      return p.end - p.start;
    };
    expect(length('credibility')).toBeGreaterThan(length('scalable-secure'));
    expect(length('accountability')).toBeGreaterThan(length('scalable-secure'));
  });

  it('keeps every line out of the middle even when two topics share many ideas', () => {
    const many = layoutGraph(
      graphOf(
        [
          post('2026-01-01-a', [
            ...Array.from({ length: 15 }, (_, i) => `M${String(i)} | credibility, accountability`),
            'A1 | ai-changing-work',
            'A2 | ai-changing-work, scalable-secure',
          ]),
        ],
        known,
      ),
      deskLayout,
    );
    for (const e of many.edges)
      for (const [x, y] of pointsOf(e.d))
        expect(Math.hypot(x, y), e.d).toBeGreaterThan(deskLayout.topicRadius * 0.9);
  });

  it('draws nothing but the middle when there are no ideas', () => {
    const empty = layoutGraph(graphOf([], known), deskLayout);
    expect(empty.topics).toEqual([]);
    expect(empty.edges).toEqual([]);
  });
});
