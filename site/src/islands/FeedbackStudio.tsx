// Why: feedback is a voice note about one specific output, so the thought has to be named before the
// recorder appears. Keeping the name and the recorder in one island keeps that rule in one place.
import { useId, useState } from 'react';
import { Recorder } from './Recorder';

const SLUG = /^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/;

export function FeedbackStudio(): React.JSX.Element {
  const [slug, setSlug] = useState('');
  const id = useId();
  const valid = SLUG.test(slug);

  return (
    <div>
      <label htmlFor={id} className="field">
        Thought folder
        <input
          id={id}
          type="text"
          inputMode="text"
          autoComplete="off"
          placeholder="2026-10-23-converted-with-ai"
          value={slug}
          onChange={(event) => {
            setSlug(event.target.value.trim());
          }}
          aria-describedby={`${id}-hint`}
        />
      </label>
      <p id={`${id}-hint`} className="small quiet">
        The folder name under thoughts/, date first.
      </p>
      {valid && <Recorder mode="feedback" thoughtSlug={slug} />}
    </div>
  );
}
