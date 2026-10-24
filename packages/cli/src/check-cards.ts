// Why: phase, reads and writes belong to each agent's card; this check keeps its model instructions
// front matter in step without making the prompt a second source of facts.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { agentCard } from '@roadbook/core';
import { parse } from 'yaml';

const factsSchema = agentCard.pick({ name: true, phase: true, reads: true, writes: true });
type Facts = ReturnType<typeof factsSchema.parse>;

function fieldText(value: number | string[]): string {
  return typeof value === 'number' ? String(value) : JSON.stringify(value);
}

export function compareCardFacts(prompt: string, card: unknown, where: string): string[] {
  const frontMatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(prompt)?.[1];
  if (frontMatter === undefined) {
    return [`${where}: PROMPT.md has no front matter. Fix: add front matter matching card.ts.`];
  }

  let promptResult: ReturnType<typeof factsSchema.safeParse>;
  try {
    promptResult = factsSchema.safeParse(parse(frontMatter));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return [`${where}: PROMPT.md front matter is not valid YAML (${message}).`];
  }
  const cardResult = factsSchema.safeParse(card);
  if (!promptResult.success) {
    return [
      `${where}: PROMPT.md must define name, phase, reads and writes. Fix: copy those facts from card.ts.`,
    ];
  }
  if (!cardResult.success) {
    return [`${where}: card.ts must export a card with name, phase, reads and writes.`];
  }

  const promptFacts: Facts = promptResult.data;
  const cardFacts: Facts = cardResult.data;
  const issues: string[] = [];
  if (promptFacts.name !== cardFacts.name) {
    issues.push(
      `${where}: name differs (PROMPT.md: ${promptFacts.name}; card.ts: ${cardFacts.name}). Fix: make PROMPT.md use the card name.`,
    );
  }
  for (const field of ['phase', 'reads', 'writes'] as const) {
    const promptValue = promptFacts[field];
    const cardValue = cardFacts[field];
    if (JSON.stringify(promptValue) !== JSON.stringify(cardValue)) {
      issues.push(
        `${where}: ${field} differs (PROMPT.md: ${fieldText(promptValue)}; card.ts: ${fieldText(cardValue)}). Fix: make PROMPT.md match card.ts.`,
      );
    }
  }
  return issues;
}

export async function checkCards(root: string): Promise<string[]> {
  const agentsPath = join(root, 'agents');
  const directories = await readdir(agentsPath, { withFileTypes: true });
  const issues: string[] = [];

  for (const directory of directories.filter((entry) => entry.isDirectory())) {
    const agentPath = join(agentsPath, directory.name);
    const files = await readdir(agentPath);
    const hasPrompt = files.includes('PROMPT.md');
    const hasCard = files.includes('card.ts');
    if (!hasPrompt && !hasCard) continue;
    if (!hasPrompt) {
      issues.push(`agents/${directory.name}: missing PROMPT.md. Fix: add the agent's model instructions.`);
      continue;
    }
    if (!hasCard) {
      issues.push(`agents/${directory.name}: missing card.ts. Fix: add the agent facts to its card.`);
      continue;
    }

    try {
      const [prompt, module] = await Promise.all([
        readFile(join(agentPath, 'PROMPT.md'), 'utf8'),
        import(pathToFileURL(join(agentPath, 'card.ts')).href) as Promise<{ card?: unknown }>,
      ]);
      issues.push(...compareCardFacts(prompt, module.card, `agents/${directory.name}`));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      issues.push(
        `agents/${directory.name}: could not check its card (${message}). Fix: ensure card.ts exports a valid card.`,
      );
    }
  }

  return issues.sort();
}
