// Why: the tour shows the road a thought takes, one station at a time, like slides: the real screen of that
// step, who works there, and what the voice says about it. The voice is the blogger's own, the one that reads
// the posts, and while it speaks the word being said is underlined exactly as on a post, so a reader can
// follow or just listen. It only moves when the reader presses Play (motion on request), it works with the
// sound off, and every line it says is on screen as text. A rail of every station sits under the slide and
// takes a reader to any of them. The controls sit right under the screen, so Next stays where the thumb
// is however long the line is. React because the slide, the clip, the timer and the word move together.
import { useCallback, useEffect, useRef, useState } from 'react';
import { wordAt, type TimedWord } from '../lib/read-along';
import { readingTimeMs, type TourStation } from '../lib/tour';

export interface TourSlide extends TourStation {
  /** Every spoken word of the line with its start and end, from the clip. */
  words: readonly TimedWord[];
  /** The real screen of the step, already sized by the build. */
  image: { src: string; srcSet: string; width: number; height: number };
}

export interface TourProps {
  stations: TourSlide[];
}

/** The pause between one station's line ending and the next station lighting. */
const BREATH_MS = 450;

export function Tour({ stations }: TourProps): React.JSX.Element {
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [sound, setSound] = useState(true);
  // The word being said, while the voice speaks; -1 when no word is.
  const [said, setSaid] = useState(-1);
  // True only when the tour ran to the end by itself; then Play starts again from the first station.
  const [finished, setFinished] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const timer = useRef<number | null>(null);
  const frame = useRef<number | null>(null);
  const region = useRef<HTMLDivElement | null>(null);
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
      if (i >= last) {
        setPlaying(false);
        setFinished(true);
      } else setCurrent(i + 1);
    }, BREATH_MS);
  }, [clearTimer, last]);

  // Each time the slide changes while playing: say its line, or wait as long as reading it takes.
  // A paused clip resumes where it stopped; only a new station (or a clip already finished) starts over.
  useEffect(() => {
    const el = audio.current;
    let live = true; // false once this run is replaced, so a late play() failure cannot start a timer
    clearTimer();
    const station = stations[current];
    if (!playing || !station) {
      el?.pause();
      return;
    }
    const silent = (): void => {
      if (!live) return;
      timer.current = window.setTimeout(advance, readingTimeMs(station.line) - BREATH_MS);
    };
    if (!sound || !el) {
      el?.pause();
      silent();
      return () => {
        live = false;
      };
    }
    if (el.dataset.station !== station.id) {
      el.src = `/tour/${station.id}.mp3`;
      el.dataset.station = station.id;
    } else if (el.ended) {
      el.currentTime = 0;
    }
    el.play().catch(silent); // blocked or missing: carry on in silence
    return () => {
      live = false;
    };
  }, [current, playing, sound, stations, advance, clearTimer]);

  // While the voice speaks, follow it word by word, every frame, as the read-along on a post does.
  useEffect(() => {
    const el = audio.current;
    const words = stations[current]?.words ?? [];
    const stop = (): void => {
      if (frame.current !== null) window.cancelAnimationFrame(frame.current);
      frame.current = null;
    };
    if (!playing || !sound || !el || words.length === 0) {
      stop();
      return stop;
    }
    const tick = (): void => {
      if (el.dataset.station === stations[current]?.id && !el.paused)
        setSaid(wordAt(words, el.currentTime));
      frame.current = window.requestAnimationFrame(tick);
    };
    tick();
    return stop;
  }, [current, playing, sound, stations]);

  // A new slide starts with no word underlined.
  useEffect(() => {
    setSaid(-1);
  }, [current]);

  useEffect(() => clearTimer, [clearTimer]);

  // The arrow keys turn the slides, as in any presentation, while the focus is anywhere in the tour.
  useEffect(() => {
    const el = region.current;
    if (!el) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      event.preventDefault();
      setFinished(false);
      setCurrent((i) => Math.max(0, Math.min(last, i + (event.key === 'ArrowRight' ? 1 : -1))));
    };
    el.addEventListener('keydown', onKey);
    return () => {
      el.removeEventListener('keydown', onKey);
    };
  }, [last]);

  const play = (): void => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (finished) setCurrent(0);
    setFinished(false);
    setPlaying(true);
  };

  const go = (i: number): void => {
    setFinished(false);
    setCurrent(Math.max(0, Math.min(last, i)));
  };

  const slide = stations[current];
  if (!slide) return <div className="tour" />;
  const spoken = slide.line.split(/\s+/).filter((w) => w !== '');
  const number = (i: number): string => String(i + 1).padStart(2, '0');

  return (
    <div
      className="tour"
      role="region"
      aria-roledescription="slides"
      aria-label="The tour"
      ref={region}
    >
      <article
        className="slide"
        aria-roledescription="slide"
        aria-label={`${number(current)} of ${String(stations.length)}: ${slide.name}`}
      >
        <header className="slide-head">
          <img
            className="slide-print"
            src={`/tour/${slide.id}.png`}
            alt={slide.print}
            width={720}
            height={720}
          />
          <div>
            <p className="slide-count small quiet">
              Station {number(current)} of {String(stations.length)}
            </p>
            <h3 className="slide-name">{slide.name}</h3>
            <p className="slide-who">
              {slide.who.map((w) => (
                <span key={w}>{w}</span>
              ))}
            </p>
          </div>
        </header>
        <figure className="slide-screen">
          <img
            src={slide.image.src}
            srcSet={slide.image.srcSet}
            sizes="(min-width: 64rem) 40rem, 100vw"
            alt={slide.screen}
            width={slide.image.width}
            height={slide.image.height}
          />
          <figcaption className="small quiet">The real screen: {slide.from}</figcaption>
        </figure>
        <div className="tour-controls">
          <button type="button" className="control filled big-play" onClick={play}>
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16">
              {playing ? (
                <path d="M3 2h3v12H3zM10 2h3v12h-3z" fill="currentColor" />
              ) : (
                <path d="M4 2l10 6-10 6z" fill="currentColor" />
              )}
            </svg>
            {playing ? 'Pause' : finished ? 'Play again' : 'Play the tour'}
          </button>
          <button
            type="button"
            className="control"
            onClick={() => {
              go(current - 1);
            }}
            disabled={current === 0}
          >
            Back
          </button>
          <button
            type="button"
            className="control"
            onClick={() => {
              go(current + 1);
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
        </div>
        <p className="slide-line" aria-live={playing ? 'off' : 'polite'}>
          {spoken.map((word, i) => (
            <span key={i}>
              <span data-said={i === said ? '' : undefined}>{word}</span>{' '}
            </span>
          ))}
        </p>
      </article>

      <ol
        className="tour-rail"
        style={
          {
            '--stops': stations.length,
            '--reached': current / Math.max(last, 1),
          } as React.CSSProperties
        }
      >
        {stations.map((s, i) => (
          <li key={s.id} data-state={i < current ? 'done' : i === current ? 'current' : 'ahead'}>
            <button
              type="button"
              aria-current={i === current ? 'step' : undefined}
              onClick={() => {
                go(i);
              }}
            >
              <span className="stop" aria-hidden="true" />
              <span className="num">{number(i)}</span>
              <span className="rail-name">{s.name}</span>
            </button>
          </li>
        ))}
      </ol>

      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- every line is on screen as text above it */}
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
