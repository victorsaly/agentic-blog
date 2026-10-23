// Why: one command runs any agent on any thought, locally or in GitHub Actions, the same way:
//   npm run agent -- <agent> <thought-slug>
// It loads the context, runs the agent, writes what it returns (never under origin/), and prints a
// summary the workflow turns into a pull request body. A held result exits non-zero on purpose.
import { resolve } from 'node:path';
import { createAskClient } from './_lib/claude.js';
import {
  loadProfile,
  loadPrompt,
  loadSettings,
  loadThought,
  systemMessage,
} from './_lib/context.js';
import { writeOutputs } from './_lib/files.js';
import { agentNames, type AgentContext, type AgentName, type AgentRun } from './_lib/types.js';

function isAgentName(value: string): value is AgentName {
  return (agentNames as readonly string[]).includes(value);
}

async function main(): Promise<void> {
  const [agent, slug] = process.argv.slice(2);
  if (!agent || !isAgentName(agent) || !slug) {
    console.error(`usage: npm run agent -- <${agentNames.join('|')}> <thought-slug>`);
    process.exitCode = 2;
    return;
  }

  const root = resolve(import.meta.dirname, '..');
  const [settings, profile, prompt, thought] = await Promise.all([
    loadSettings(root),
    loadProfile(root),
    loadPrompt(root, agent),
    loadThought(root, slug),
  ]);

  const system = systemMessage(profile, prompt, settings);
  const client = createAskClient(system, {
    model: prompt.meta.model ?? settings.agents.model,
    maxOutputTokens: prompt.meta.max_output_tokens ?? settings.agents.max_output_tokens,
  });

  const ctx: AgentContext = {
    agent,
    prompt,
    settings,
    profile,
    thought,
    ask: client.ask,
    today: new Date().toISOString().slice(0, 10),
  };

  const module = (await import(`./${agent}/index.js`)) as { run: AgentRun };
  const result = await module.run(ctx);

  const fallback = agent === 'profile' || agent === 'drilldown' ? 'repo' : 'thought';
  const written = await writeOutputs({ thought: thought.dir, repo: root, fallback }, result.files);

  console.info(
    JSON.stringify({
      agent,
      slug,
      status: result.status,
      summary: result.summary,
      written,
      holdReason: result.holdReason ?? null,
    }),
  );
  if (result.status === 'held') process.exitCode = 3;
  if (result.status === 'not-implemented') process.exitCode = 4;
}

await main();
