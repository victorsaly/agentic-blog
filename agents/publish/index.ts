// Why: see PROMPT.md. The checks that can be counted are counted in code (verdicts, whys, origin links,
// the badge); the model only assembles the road and the pull request body from what is there.
import { resolve } from 'node:path';
import matter from 'gray-matter';
import { hasWhy, markdownFile } from '../_lib/files.js';
import {
  badgeLine,
  fencedFiles,
  readIfPresent,
  userMessage,
  verdictProblem,
  withBadge,
} from '../_lib/generic.js';
import { agentHistory } from '../_lib/git.js';
import type { AgentRun, OutputFile } from '../_lib/types.js';

export const run: AgentRun = async (ctx) => {
  const problems = [verdictProblem(ctx, 'safety.md'), verdictProblem(ctx, 'security.md')].filter(
    (p): p is string => p !== null,
  );
  for (const [path, content] of ctx.thought.files) {
    if (!hasWhy(content)) problems.push(`${path} has no why.`);
    if (path.startsWith('versions/') && typeof matter(content).data['converted_from'] !== 'string')
      problems.push(`${path} has no converted_from.`);
  }
  if (problems.length > 0)
    return {
      status: 'held',
      summary: 'Not ready to publish.',
      files: [],
      holdReason: problems.join('\n'),
    };

  const files: OutputFile[] = [];
  const linkedin = readIfPresent(ctx, 'versions/linkedin.md');
  const badge = badgeLine(ctx);
  if (linkedin !== undefined) {
    const fixed = withBadge(linkedin, badge, ctx.settings.site.domain);
    if (fixed !== (linkedin.endsWith('\n') ? linkedin : `${linkedin}\n`))
      files.push({ path: 'versions/linkedin.md', content: fixed });
  }

  const repo = resolve(ctx.thought.dir, '..', '..');
  const listing = [...ctx.thought.files.keys()].sort().join('\n');
  const message = userMessage(
    {
      structure: readIfPresent(ctx, 'structure.md'),
      long_version: readIfPresent(ctx, 'versions/long.md'),
      files_in_thought: listing,
      agents_that_ran: (await agentHistory(repo, ctx.thought.slug)) || 'No agent commits found.',
      models: `Reasoning agents run on ${ctx.settings.agents.model} unless their PROMPT.md says otherwise. seo makes no model call while the index switch is off. image writes its prompt with that model and draws with Workers AI only when image/picture.png exists.`,
      checked_by_code: [
        'safety.md verdict: pass',
        'security.md verdict: pass',
        'every Markdown file in the thought has a why',
        'every version has converted_from',
        `versions/linkedin.md ends with: ${badge}`,
        'Do not ask the reviewer to re-check these; they are verified.',
      ].join('\n'),
      existing_road: readIfPresent(ctx, 'road.md'),
    },
    `Today is ${ctx.today}. Assemble as the prompt describes: road.md in one fenced block (with front matter that starts with a why), then the pull request body in a second block fenced as \`\`\`pr.`,
  );
  const blocks = fencedFiles(await ctx.ask(message, { maxOutputTokens: 6000 }));
  const road = blocks.find((b) => b.label !== 'pr');
  const pr = blocks.find((b) => b.label === 'pr');
  if (!road || !pr) throw new Error('publish must return road.md and a pr block');
  files.push({ path: 'road.md', content: road.content });
  files.push({
    path: 'pull-request.md',
    content: markdownFile(
      {
        why: 'The body of the pull request that brings this thought to the blogger for review, assembled by the publish agent from what the other agents wrote.',
        assembled: ctx.today,
      },
      pr.content,
    ),
  });
  return {
    status: 'done',
    summary: `Ready for review: road.md and pull-request.md written${files[0]?.path === 'versions/linkedin.md' ? ', badge added to linkedin.md' : ''}.`,
    files,
  };
};
