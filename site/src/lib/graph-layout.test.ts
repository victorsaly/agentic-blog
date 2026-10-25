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

      it('joins every idea to each of its topics, and every topic to the middle', () => {
        const ideaEdges = graph.ideas.reduce((sum, i) => sum + i.topics.length, 0);
        expect(layout.edges).toHaveLength(ideaEdges + graph.topics.length);
      });

      it('draws the same picture for the same posts', () => {
        expect(layoutGraph(graph, options)).toEqual(layout);
      });
    });
  }

  it('draws nothing but the middle when there are no ideas', () => {
    const empty = layoutGraph(graphOf([], known), deskLayout);
    expect(empty.topics).toEqual([]);
    expect(empty.edges).toEqual([]);
  });
});
