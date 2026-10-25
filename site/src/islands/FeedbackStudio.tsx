// Why: feedback is a voice note about one specific output, so the thought has to be named before the
// recorder appears. Victor picks it by its title from the thoughts the site knows, newest first, instead of
// typing a dated folder name from memory on a phone; a list cannot be mistyped. While feedback is in hand
// (recording, written, waiting to send) the choice holds still, so switching thought cannot throw it away;
// sending or discarding it frees the choice again. Keeping the choice and the recorder in one island keeps
// those rules in one place.
import { useId, useState } from 'react';
import { Recorder } from './Recorder';

export interface FeedbackStudioProps {
  /** Every thought, newest first. */
  thoughts: { slug: string; title: string }[];
}

export function FeedbackStudio({ thoughts }: FeedbackStudioProps): React.JSX.Element {
  const [slug, setSlug] = useState('');
  const [busy, setBusy] = useState(false);
  const id = useId();
  const chosen = thoughts.some((t) => t.slug === slug);

  return (
    <div>
      <label htmlFor={id} className="field">
        Which thought
        <select
          id={id}
          value={slug}
          disabled={busy}
          aria-describedby={busy ? `${id}-held` : undefined}
          onChange={(event) => {
            setSlug(event.target.value);
          }}
        >
          <option value="">Choose a thought</option>
          {thoughts.map((t) => (
            <option key={t.slug} value={t.slug}>
              {t.title}
            </option>
          ))}
        </select>
      </label>
      {busy && (
        <p id={`${id}-held`} className="small quiet">
          Send or discard this feedback to choose another thought.
        </p>
      )}
      {chosen && <Recorder key={slug} mode="feedback" thoughtSlug={slug} onBusyChange={setBusy} />}
    </div>
  );
}
