// Why: a run that did not finish, or that a guard held, is run again from its own page, on the thought's open
// pull request, instead of someone starting it by hand. The press says what it may cost first, and the studio
// refuses it when that would pass the month's cap (functions/api/runs/again.ts). Starting only asks GitHub,
// so the page says it was started and where to watch, never that it is done.
import { useState } from 'react';
import { ActionIcon } from './ActionIcon';
import { agentName } from '../lib/agent-runs';
import { moneyOf, type Currency } from '../lib/money';

type Asking =
  | { state: 'idle' }
  | { state: 'asking' }
  | { state: 'started'; pull: { number: number; url: string } | null }
  | { state: 'failed'; error: string };

function errorOf(data: unknown): string {
  return typeof data === 'object' &&
    data !== null &&
    typeof (data as { error?: unknown }).error === 'string'
    ? (data as { error: string }).error
    : 'The studio could not start it.';
}

export interface RunAgainProps {
  agent: string;
  thought: string;
  /** What one run may cost, by the agent's card. */
  allowance: number;
  currency: Currency;
}

export function RunAgain({
  agent,
  thought,
  allowance,
  currency,
}: RunAgainProps): React.JSX.Element {
  const [asking, setAsking] = useState<Asking>({ state: 'idle' });

  const start = async (): Promise<void> => {
    setAsking({ state: 'asking' });
    try {
      const response = await fetch('/api/runs/again', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ agent, thought }),
      });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(errorOf(data));
      const pull = (data as { pull?: { number?: unknown; url?: unknown } } | null)?.pull;
      setAsking({
        state: 'started',
        pull:
          typeof pull?.number === 'number' && typeof pull.url === 'string'
            ? { number: pull.number, url: pull.url }
            : null,
      });
    } catch (error: unknown) {
      setAsking({
        state: 'failed',
        error:
          error instanceof Error && error.message !== 'Failed to fetch'
            ? error.message
            : 'The studio could not be reached. Nothing was started; try again.',
      });
    }
  };

  return (
    <section className="run-again" aria-labelledby="again-label">
      <h2 className="label" id="again-label">
        Run it again
      </h2>
      <p className="small">
        Runs {agentName(agent)} again on this thought&rsquo;s pull request; it may cost up to{' '}
        {moneyOf(allowance, currency)}. What comes after it starts by itself when it is done.
      </p>
      <button
        type="button"
        className="control strong"
        disabled={asking.state === 'asking' || asking.state === 'started'}
        onClick={() => void start()}
      >
        <ActionIcon name="again" />
        {asking.state === 'asking' ? 'Starting…' : 'Run again'}
      </button>
      <p role="status" className="small">
        {asking.state === 'started' && (
          <>
            Started. GitHub runs it in a minute or so; it shows on the Agents page
            {asking.pull && (
              <>
                {' '}
                and lands on <a href={asking.pull.url}>pull request #{asking.pull.number}</a>
              </>
            )}
            .
          </>
        )}
        {asking.state === 'failed' && asking.error}
      </p>
    </section>
  );
}
