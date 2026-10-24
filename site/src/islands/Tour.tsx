// Why: the tour shows the road a thought takes, one station at a time, with a voice saying what happens
// there. It only moves when the reader presses Play (motion on request), it works with the sound off, and
// every line it says is on screen as text. React because the station, the clip and the timer move together.
// Each station's linocut opens with its line, so the picture changes as the tour moves.
import { useCallback, useEffect, useRef, useState } from 'react';
import { readingTimeMs, type TourStation } from '../lib/tour';

export interface TourProps {
  stations: TourStation[];
}

/** The pause between one station's line ending and the next station lighting. */
const BREATH_MS = 450;

export function Tour({ stations }: TourProps): React.JSX.Element {
  // null: nothing lit yet, the whole route is visible as a still diagram.
  const [current, setCurrent] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [sound, setSound] = useState(true);
  const audio = useRef<HTMLAudioElement | null>(null);
  const timer = useRef<number | null>(null);
  const items = useRef<(HTMLLIElement | null)[]>([]);
  const last = stations.length - 1;
  const currentRef = useRef(current);
  currentRef.current = current;

  const clearTimer = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const advance = useCallback(() => {
    clearTimer();
    timer.current = window.setTimeout(() => {
      const i = currentRef.current;
      if (i === null || i >= last) setPlaying(false);
      else setCurrent(i + 1);
    }, BREATH_MS);
  }, [clearTimer, last]);

  // Each time the lit station changes while playing: say its line, or wait as long as reading it takes.
  useEffect(() => {
    const el = audio.current;
    clearTimer();
    if (!playing || current === null) {
      el?.pause();
      return;
    }
    const station = stations[current];
    if (!station) return;
    const silent = (): void => {
      timer.current = window.setTimeout(advance, readingTimeMs(station.line) - BREATH_MS);
    };
    if (!sound || !el) {
      silent();
      return;
    }
    el.src = `/tour/${station.id}.mp3`;
    el.currentTime = 0;
    el.play().catch(silent); // blocked or missing: carry on in silence
  }, [current, playing, sound, stations, advance, clearTimer]);

  // While playing, bring the lit station to the top (below the sticky controls, see scroll-margin in
  // tour.css) so its print and line are in view. On a phone they open under it while the last station's
  // close above it, so wait for that to settle (--duration-travel) or the page moves after the scroll.
  useEffect(() => {
    if (!playing || current === null) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const wait = window.setTimeout(
      () => {
        items.current[current]?.scrollIntoView({
          block: 'start',
          behavior: reduce ? 'auto' : 'smooth',
        });
      },
      reduce ? 0 : 560,
    );
    return () => {
      window.clearTimeout(wait);
    };
  }, [current, playing]);

  useEffect(() => clearTimer, [clearTimer]);

  const play = (): void => {
    if (playing) {
      setPlaying(false);
      return;
    }
    setCurrent((i) => (i === null || i >= last ? 0 : i));
    setPlaying(true);
  };

  const go = (i: number): void => {
    setCurrent(Math.max(0, Math.min(last, i)));
  };

  const state = (i: number): 'done' | 'current' | 'ahead' =>
    current === null || i > current ? 'ahead' : i === current ? 'current' : 'done';

  const lit = current === null ? null : stations[current];

  return (
    <div className="tour" data-started={current !== null}>
      <div className="tour-controls">
        <button type="button" className="control filled big-play" onClick={play}>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16">
            {playing ? (
              <path d="M3 2h3v12H3zM10 2h3v12h-3z" fill="currentColor" />
            ) : (
              <path d="M4 2l10 6-10 6z" fill="currentColor" />
            )}
          </svg>
          {playing
            ? 'Pause'
            : current === null
              ? 'Play the tour'
              : current >= last
                ? 'Play again'
                : 'Play'}
        </button>
        <button
          type="button"
          className="control"
          onClick={() => {
            go((current ?? 1) - 1);
          }}
          disabled={current === null || current === 0}
        >
          Back
        </button>
        <button
          type="button"
          className="control"
          onClick={() => {
            go(current === null ? 0 : current + 1);
          }}
          disabled={current === last}
        >
          Next
        </button>
        <button
          type="button"
          className="control"
          aria-pressed={sound}
          onClick={() => {
            setSound((s) => !s);
          }}
        >
          <svg aria-hidden="true" width="18" height="16" viewBox="0 0 18 16" fill="none">
            <path d="M1 5h4l5-4v14l-5-4H1z" fill="currentColor" />
            {sound && (
              <path
                d="M13 4.5a5 5 0 0 1 0 7M15.5 2a8.5 8.5 0 0 1 0 12"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            )}
          </svg>
          Voice
        </button>
        <p className="tour-count small quiet" aria-live="polite">
          {lit && current !== null
            ? `Station ${String(current + 1)} of ${String(stations.length)}: ${lit.name}`
            : `${String(stations.length)} stations, under two minutes`}
        </p>
      </div>

      <ol className="tour-route">
        {stations.map((s, i) => (
          <li
            key={s.id}
            data-state={state(i)}
            ref={(el) => {
              items.current[i] = el;
            }}
          >
            <button
              type="button"
              className="station"
              aria-current={state(i) === 'current' ? 'step' : undefined}
              onClick={() => {
                go(i);
              }}
            >
              <span className="num" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="name">{s.name}</span>
              <span className="job">{s.job}</span>
              <span className="who">
                {s.who.map((w) => (
                  <span key={w}>{w}</span>
                ))}
              </span>
            </button>
            <div className="said" aria-hidden={state(i) !== 'current'}>
              <div>
                <img
                  className="said-print"
                  src={`/tour/${s.id}.png`}
                  alt={s.print}
                  width={720}
                  height={720}
                  loading="lazy"
                />
                <p>
                  <mark>{s.line}</mark>
                </p>
              </div>
            </div>
          </li>
        ))}
      </ol>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- every line is on screen as text beside it */}
      <audio
        ref={audio}
        preload="none"
        onEnded={() => {
          if (playing) advance();
        }}
      />
    </div>
  );
}
