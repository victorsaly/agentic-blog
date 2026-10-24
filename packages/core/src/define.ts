// Why: the setup file should read like a description, not like code. These helpers give
// roadbook.config.ts autocomplete and type checking while it is being written, the way Bicep's editor
// does, and leave every real check to validate() so a file written by hand, by the builder or by Claude
// through the MCP server is judged by exactly the same rules.
import type { AgentCardInput, Provider, ProjectInput, Sink, WorkflowInput } from './schema.js';

export function defineProject(project: ProjectInput): ProjectInput {
  return project;
}

export function defineWorkflow(workflow: WorkflowInput): WorkflowInput {
  return workflow;
}

export function defineAgentCard(card: AgentCardInput): AgentCardInput {
  return card;
}

// ---------------------------------------------------------------------------------------------- providers

export function claude(options: { model?: string } = {}): Provider {
  return { kind: 'claude', secret: 'ANTHROPIC_API_KEY', ...options };
}

export function openai(options: { model?: string } = {}): Provider {
  return { kind: 'openai', secret: 'OPENAI_API_KEY', ...options };
}

export function openaiImages(options: { model?: string } = {}): Provider {
  return { kind: 'openai-images', secret: 'OPENAI_API_KEY', ...options };
}

export function workersAi(
  options: { model?: string; drawModel?: string; secret?: string } = {},
): Provider {
  return { kind: 'workers-ai', ...options };
}

export function azureOpenai(options: { endpoint: string; model?: string }): Provider {
  return { kind: 'azure-openai', secret: 'AZURE_OPENAI_API_KEY', ...options };
}

export function openaiCompatible(options: {
  endpoint: string;
  model?: string;
  secret?: string;
}): Provider {
  return { kind: 'openai-compatible', ...options };
}

// ---------------------------------------------------------------------------------------------- sinks

export function githubPullRequest(options: { repo: string }): Sink {
  return { kind: 'github-pr', repo: options.repo };
}

export function azureReposPullRequest(options: {
  organisation: string;
  project: string;
  repo: string;
}): Sink {
  return { kind: 'azure-repos-pr', ...options };
}

export function dryRun(): Sink {
  return { kind: 'dry-run' };
}
