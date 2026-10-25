// Why: this decides whether Victor's approval merges the post now, waits, or keeps it out; merging on a
// failing check would publish what a check stopped.
import { describe, expect, it } from 'vitest';
import { readCheckRuns, verdictOf } from './checks-verdict';

const run = (name: string, status: string, conclusion: string | null) => ({
  name,
  status,
  conclusion,
});

describe('verdictOf', () => {
  it('waits while no check has started, or any is still going', () => {
    expect(verdictOf([])).toEqual({ kind: 'wait' });
    expect(
      verdictOf([run('build', 'completed', 'success'), run('axe', 'in_progress', null)]),
    ).toEqual({ kind: 'wait' });
  });

  it('waits for a required check that has not appeared yet, even when the rest passed', () => {
    const early = [run('Why, lint, types, tests, build', 'completed', 'success')];
    const axe = 'Accessibility (axe on every page)';
    expect(verdictOf(early, [axe])).toEqual({ kind: 'wait' });
    expect(verdictOf([...early, run(axe, 'completed', 'success')], [axe])).toEqual({
      kind: 'pass',
    });
  });

  it('passes when every check passed or was not needed', () => {
    expect(
      verdictOf([run('build', 'completed', 'success'), run('deploy', 'completed', 'skipped')]),
    ).toEqual({ kind: 'pass' });
  });

  it('keeps the post out when any check did not pass, and says which', () => {
    expect(
      verdictOf([run('build', 'completed', 'success'), run('axe', 'completed', 'failure')]),
    ).toEqual({ kind: 'fail', failed: ['axe (failure)'] });
  });
});

describe('readCheckRuns', () => {
  it('reads GitHub check runs and leaves out what it cannot read', () => {
    expect(
      readCheckRuns({
        check_runs: [{ name: 'build', status: 'completed', conclusion: 'success' }, { id: 1 }],
      }),
    ).toEqual([{ name: 'build', status: 'completed', conclusion: 'success' }]);
    expect(readCheckRuns({ message: 'Not Found' })).toEqual([]);
  });
});
