// Why: see PROMPT.md. This agent is planned for phase 3; the prompt is the design, the code arrives with
// the phase. The runner reports not-implemented so a workflow can never mistake a stub for a result.
import { notImplemented } from '../_lib/generic.js';
import type { AgentRun } from '../_lib/types.js';

export const run: AgentRun = (ctx) => Promise.resolve(notImplemented(ctx));
