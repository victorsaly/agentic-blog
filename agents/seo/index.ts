// Why: see PROMPT.md. With the index switch off there is nothing to optimise and nothing to ask a model,
// so the file says so without a call. With it on, the built page's head is checked against the list.
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { askForFile, readIfPresent, userMessage } from '../_lib/generic.js';
import { markdownFile } from '../_lib/files.js';
import type { AgentRun } from '../_lib/types.js';

export const run: AgentRun = async (ctx) => {
  if (!ctx.settings.publishing.index) {
    const content = markdownFile(
      {
        why: 'The index switch in settings.yml is off, so the site asks search engines to stay away and there is nothing to optimise yet.',
        checked: ctx.today,
        index: false,
      },
      'The switch is off. Nothing was changed. Run this agent again after turning `publishing.index` on.',
    );
    return {
      status: 'done',
      summary: 'Index switch is off; nothing to do.',
      files: [{ path: 'seo.md', content }],
    };
  }

  const repo = resolve(ctx.thought.dir, '..', '..');
  const html = await readFile(
    join(repo, 'site', 'dist', 'thoughts', `${ctx.thought.slug}.html`),
    'utf8',
  ).catch(() => null);
  const head = html?.slice(0, html.indexOf('</head>') + 7);
  const message = userMessage(
    {
      index_switch:
        'settings.yml publishing.index is true: the site is public, so do the full checklist.',
      site: `https://${ctx.settings.site.domain}, author ${ctx.settings.site.author}`,
      structure: readIfPresent(ctx, 'structure.md'),
      built_head: head ?? 'The page is not built yet (it is a draft, or the site was not built).',
    },
    `Today is ${ctx.today}. Write seo.md as the prompt describes.`,
  );
  const file = await askForFile(ctx, message, 'seo.md');
  return { status: 'done', summary: 'Checked the page metadata; see seo.md.', files: [file] };
};
