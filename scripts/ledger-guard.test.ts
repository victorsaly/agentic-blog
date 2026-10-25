// Why: this guard is what keeps the merged record from being rewritten while still letting a waiting gate be
// closed; if it let a finished run grow, or refused a gate closing, the record or the gates would break.
import { describe, expect, it } from 'vitest';
import { refusalOf } from './ledger-guard';

const line = (event: object): string => `${JSON.stringify(event)}\n`;
const waiting =
  line({ type: 'run.started', seq: 0 }) +
  line({ type: 'node.state', node: 'answers', from: 'idle', to: 'needs-you', seq: 1 }) +
  line({ type: 'gate.opened', node: 'answers', seq: 2 });
const finished = line({ type: 'node.state', node: 'seo', from: 'running', to: 'done', seq: 0 });

describe('refusalOf', () => {
  it('lets a waiting run be carried on, byte for byte', () => {
    const closed =
      waiting +
      line({ type: 'gate.closed', seq: 3 }) +
      line({ type: 'node.state', to: 'done', seq: 4 });
    expect(refusalOf(waiting, closed)).toBeNull();
  });

  it('refuses a finished run carried on, a rewrite, a cut, and no change dressed as one', () => {
    expect(refusalOf(finished, finished + line({ type: 'override.given', seq: 1 }))).toMatch(
      /finished/,
    );
    expect(refusalOf(waiting, waiting.replace('needs-you', 'done') + line({ seq: 3 }))).toMatch(
      /changed/,
    );
    expect(refusalOf(waiting, waiting.slice(0, -10))).toMatch(/changed/);
    expect(refusalOf(waiting, waiting)).toMatch(/changed/);
  });
});
