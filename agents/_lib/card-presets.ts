// Why: most agents fail, retry and are scored the same way, and repeating it in every card hides the few
// that differ. These presets name the common policies so a card reads as "a core step" or "an optional
// extra", and the exceptions (images falling back to Workers AI) stand out.
import type { AgentCardInput } from '@roadbook/core';

type Behaviour = AgentCardInput['behaviour'];
type Metrics = AgentCardInput['metrics'];

/** A step the post cannot do without: retry once, then stop the run and tell Victor. */
export function coreStep(needsApproval: boolean): Behaviour {
  return {
    needsApproval,
    retry: { max: 1, backoffSeconds: 30, withFeedback: true, on: ['check-failed', 'provider-error', 'timeout'] },
    onFailure: 'stop-run',
    escalate: {
      when: ['retries-exhausted', 'held', 'over-budget'],
      to: 'owner',
      says: 'A step the post cannot do without has stopped; the run waits for you.',
    },
  };
}

/** A step the post is better with but can go without: retry once, then skip it and say so in the road. */
export function optionalStep(): Behaviour {
  return {
    needsApproval: false,
    retry: { max: 1, backoffSeconds: 30, withFeedback: true, on: ['check-failed', 'provider-error', 'timeout'] },
    onFailure: 'skip-node',
    escalate: {
      when: ['retries-exhausted', 'over-budget'],
      to: 'owner',
      says: 'An optional step was skipped; the post goes on without it, and the road says so.',
    },
  };
}

/** A guard: never skipped. If it cannot decide, the run stops and Victor looks. */
export function guardStep(): Behaviour {
  return {
    needsApproval: false,
    retry: { max: 1, backoffSeconds: 30, withFeedback: false, on: ['provider-error', 'timeout'] },
    onFailure: 'stop-run',
    escalate: {
      when: ['retries-exhausted', 'held'],
      to: 'owner',
      says: 'A guard held the post or could not decide; nothing leaves until you have looked.',
    },
  };
}

/** The three numbers every agent is scored on: approvals as written, checks passed, and cost. */
export function standardMetrics(approvedWithoutRewrite: number, usdPerRun: number): Metrics {
  return [
    {
      id: 'approved-without-rewrite',
      says: 'Share of outputs Victor approved without rewriting them.',
      target: approvedWithoutRewrite,
      direction: 'at-least',
      unit: 'share',
    },
    {
      id: 'checks-passed',
      says: 'Share of outputs that passed every done-means check on the first try.',
      target: 0.95,
      direction: 'at-least',
      unit: 'share',
    },
    {
      id: 'cost-per-run',
      says: 'Average spend per run, retries included.',
      target: usdPerRun,
      direction: 'at-most',
      unit: 'USD',
    },
  ];
}
