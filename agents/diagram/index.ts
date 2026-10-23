// Why: see PROMPT.md. The model describes each diagram as data; the code checks it (a known section, the
// right number of steps or items, nothing empty) and writes diagram/diagrams.md. The site draws it, so no
// markup the model wrote ever reaches a page.
import matter from 'gray-matter';
import { z } from 'zod';
import { unfence } from '../_lib/claude.js';
import { markdownFile } from '../_lib/files.js';
import { readOrThrow, userMessage } from '../_lib/generic.js';
import type { AgentRun } from '../_lib/types.js';
import { sectionsOf } from '../image/index.js';

const text = (max: number) => z.string().trim().min(1).max(max);

const flow = z.object({
  section: z.string(),
  kind: z.literal('flow'),
  title: text(60),
  caption: text(240),
  steps: z
    .array(z.object({ label: text(60), detail: text(120).optional() }))
    .min(2)
    .max(6),
});

const compare = z.object({
  section: z.string(),
  kind: z.literal('compare'),
  title: text(60),
  caption: text(240),
  before: z.object({ label: text(40), items: z.array(text(80)).min(2).max(5) }),
  after: z.object({ label: text(40), items: z.array(text(80)).min(2).max(5) }),
});

export const plan = z.object({
  why: z.string().min(20),
  diagrams: z.array(z.discriminatedUnion('kind', [flow, compare])).max(3),
});

export type Diagram = z.infer<typeof plan>['diagrams'][number];

/** Keeps only diagrams whose section really is a heading of the long version. */
export function inKnownSections(diagrams: Diagram[], sections: string[]): Diagram[] {
  return diagrams.filter((d) => sections.includes(d.section.trim()));
}

export const run: AgentRun = async (ctx) => {
  const long = readOrThrow(ctx, 'versions/long.md');
  const sections = sectionsOf(long);
  const message = userMessage(
    {
      structure: readOrThrow(ctx, 'structure.md'),
      long_version: long,
      sections: sections.join('\n'),
    },
    `Today is ${ctx.today}. Decide which sections, if any, earn a diagram, as the prompt describes. Reply with front matter only.`,
  );
  const reply = unfence(await ctx.ask(message, { maxOutputTokens: 4000 }));
  const parsed = plan.safeParse(matter(reply).data);
  if (!parsed.success) throw new Error(`the diagram plan did not parse: ${parsed.error.message}`);

  const diagrams = inKnownSections(parsed.data.diagrams, sections);
  if (diagrams.length === 0)
    return {
      status: 'nothing-to-do',
      summary: `No diagram earned its place. ${parsed.data.why}`,
      files: [],
    };
  return {
    status: 'done',
    summary: `Described ${String(diagrams.length)} diagram(s): ${diagrams.map((d) => d.title).join('; ')}. The site draws them.`,
    files: [
      {
        path: 'diagram/diagrams.md',
        content: markdownFile(
          { why: parsed.data.why, generated_by: 'diagram', reviewed: false, diagrams },
          diagrams.map((d) => `- ${d.section}: ${d.title} (${d.kind})`).join('\n'),
        ),
      },
    ],
  };
};
