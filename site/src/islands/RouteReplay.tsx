// Why: a reader believes the route when they watch a real thought go down it. This plays one thought's
// ledger on the studio's own picture of the route (RouteDrawing): each moment in the order it happened,
// how far in it was, and what happened in words, so the steps that start by themselves, the three calls
// that waited on a person and the steps that failed and were run again all show as they really went. It
// opens finished, the picture of where the post ended, and only moves when the reader presses Play; Back
// and Next step through it by hand. React because the picture and the line move together.
import { useEffect, useState } from 'react';
import type { RouteLayout } from '@roadbook/core/route';
import type { ReplayFrame } from '../lib/route-replay';
import { RouteDrawing } from './RouteDrawing';

export interface RouteReplayProps {
  layout: RouteLayout;
  frames: ReplayFrame[];
  /** What the picture is of, for a screen reader. */
  label: string;
  /** Said under the finished picture, before anything is played. */
  ending: string;
}

const clock = (minute: number): string =>
  minute < 60
    ? `${String(minute)} min in`
    : `${String(Math.floor(minute / 60))} h ${String(minute % 60).padStart(2, '0')} min in`;

export function RouteReplay({
  layout,
  frames,
  label,
  ending,
}: RouteReplayProps): React.JSX.Element {
  const last = frames.length - 1;
  const [at, setAt] = useState(last);
  const [playing, setPlaying] = useState(false);
  // True until the reader first plays or steps, so the finished picture says how it ended.
  const [fresh, setFresh] = useState(true);

  useEffect(() => {
    if (!playing) return;
    if (at >= last) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setAt((i) => i + 1);
    }, frames[at]?.hold ?? 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [playing, at, last, frames]);

  const frame = frames[at];
  if (!frame) return <div className="route-replay" />;

  const play = (): void => {
    setFresh(false);
    if (playing) {
      setPlaying(false);
      return;
    }
    if (at >= last) setAt(0);
    setPlaying(true);
  };
  const go = (i: number): void => {
    setFresh(false);
    setPlaying(false);
    setAt(Math.max(0, Math.min(last, i)));
  };

  return (
    <div className="route-replay">
      <div className="replay-controls">
        <button type="button" className="control filled" onClick={play}>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16">
            {playing ? (
              <path d="M3 2h3v12H3zM10 2h3v12h-3z" fill="currentColor" />
            ) : (
              <path d="M4 2l10 6-10 6z" fill="currentColor" />
            )}
          </svg>
          {playing ? 'Pause' : at >= last ? 'Play it from the start' : 'Play on'}
        </button>
        <button
          type="button"
          className="control"
          onClick={() => {
            go(at - 1);
          }}
          disabled={at === 0}
        >
          Back
        </button>
        <button
          type="button"
          className="control"
          onClick={() => {
            go(at + 1);
          }}
          disabled={at === last}
        >
          Next
        </button>
      </div>
      <p className="replay-line" aria-live={playing ? 'off' : 'polite'}>
        {fresh ? (
          ending
        ) : (
          <>
            <span className="replay-clock">{clock(frame.minute)}</span> {frame.said}
          </>
        )}
      </p>
      <RouteDrawing layout={layout} states={frame.states} label={label} />
    </div>
  );
}
