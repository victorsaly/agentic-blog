// Why: the 60-second pitch video is cut from this one list: what is on screen, when, and what the voice
// says over it. The voice clips in scripts/pitch/audio/vo-<key>.mp3 say exactly the `vo.line` text
// (docs/audio-sources.md records how each was made). Change a line here and its clip must be made again.
// Scenes sit on the music's 120 BPM grid, so every cut lands on a beat.

export interface Zoom {
  /** Seconds into the scene. */
  t: number;
  /** A selector on the page in the frame; the frame scales up until it fills the screen. */
  zoom?: string;
  /** Zoom by exactly this much, for something too tall to fit (a diagram): its middle fills the screen. */
  scale?: number;
  /** Open this closed <details> first, so what is inside it can be shown. */
  open?: string;
  /** Press this button in the frame, as a reader would (Play on the real run). */
  press?: string;
  /** Jump the page in the frame so this selector sits just under the header. */
  at?: string;
  /** Scroll the page in the frame down by this many pixels, slowly, instead of zooming. */
  drift?: number;
}

export interface Voice {
  key: string;
  line: string;
}

interface SceneBase {
  start: number;
  dur: number;
  vo?: Voice;
}

export interface CardScene extends SceneBase {
  kind: 'card';
  lines: string[];
  /** One line under the rule; marked in marigold, the one colour, on the last card only. */
  sub?: string;
}

export interface PageScene extends SceneBase {
  kind: 'page';
  /** A path on the site, opened in a frame. */
  path: string;
  caption: string;
  captionAt: number;
  actions: Zoom[];
}

export type Scene = CardScene | PageScene;

export const BPM = 120;
export const TOTAL = 60;
/** Seconds after a scene starts before its line begins. */
export const VO_AT = 0.35;

export const voice = {
  name: 'Chris W',
  id: 'hoSRtERLhFa8UfJ6P1JP',
  model: 'eleven_v3',
};

export const music = {
  model: 'music_v2_5' as const,
  prompt:
    'Warm, confident modern instrumental at 120 BPM for a short product film about writing: soft felt piano ' +
    'chords, brushed kick and a light clap, round sub bass, plucked acoustic guitar and a gentle rising synth ' +
    'pad. Calm, clear and optimistic, never busy, room left in the mid range for a spoken voice. A quiet ' +
    'four-second intro, the full groove from 8 seconds, a short stripped-back pause at 22 seconds, building ' +
    'from 24 seconds to a lift at 46 seconds, then one clean ending note at 58 seconds. 60 seconds, no vocals.',
};

const post = '/thoughts/2026-10-23-productive-friction-counts-evidence';

export const scenes: Scene[] = [
  {
    start: 0,
    dur: 4,
    kind: 'card',
    lines: ['You have a thought', 'worth sharing.'],
    vo: { key: 'hook', line: 'You have a thought worth sharing.' },
  },
  {
    start: 4,
    dur: 4,
    kind: 'card',
    lines: ['And no time', 'to write it.'],
    vo: { key: 'problem', line: 'And no time to write it.' },
  },
  {
    start: 8,
    dur: 6,
    kind: 'page',
    path: '/studio/talk',
    caption: 'Press record. Talk.',
    captionAt: 1.2,
    actions: [{ t: 1.6, zoom: '.recorder' }],
    vo: { key: 'studio', line: 'So say it out loud. Press record, and talk for two minutes.' },
  },
  {
    start: 14,
    dur: 8,
    kind: 'page',
    path: post,
    caption: 'Message. Idea. Road.',
    captionAt: 2.4,
    actions: [{ t: 2.0, zoom: '.message' }],
    vo: {
      key: 'structure',
      line: 'Agents find the point. The message in three lines, the idea on one screen, and the whole road for anyone who wants it.',
    },
  },
  {
    start: 22,
    dur: 2,
    kind: 'card',
    lines: ['Your words, kept.'],
  },
  {
    start: 24,
    dur: 10,
    kind: 'page',
    path: '/how-it-works',
    caption: 'One job each.',
    captionAt: 1.6,
    // The real run on /how-it-works, played: the agents start one after another on the studio's route.
    actions: [
      { t: 0, at: '#run' },
      { t: 0.4, press: '#run .replay-controls .filled', zoom: '#run .route-replay' },
    ],
    vo: {
      key: 'agents',
      line: 'Each agent does one job, and starts by itself when its work is ready. Two can stop a post.',
    },
  },
  {
    start: 34,
    dur: 6.5,
    kind: 'page',
    path: '/how-it-works',
    caption: 'Every change has a why.',
    captionAt: 1.6,
    actions: [
      { t: 0, at: '#proof' },
      { t: 1, zoom: '.proof' },
    ],
    vo: {
      key: 'trail',
      line: 'Every change carries its reason, and every version links back to what you actually said.',
    },
  },
  {
    start: 40.5,
    dur: 5.5,
    kind: 'page',
    path: '/how-it-works',
    caption: 'You approve it.',
    captionAt: 1.2,
    // The same run, finished: the round steps were Victor's calls, the merge last.
    actions: [
      { t: 0, at: '#run' },
      { t: 0.8, zoom: '#run .route-replay' },
    ],
    vo: { key: 'you', line: 'You answer, you approve, and nothing goes live until you merge it.' },
  },
  {
    start: 46,
    dur: 14,
    kind: 'card',
    lines: ['Talked out loud.', 'Tidied by AI.'],
    sub: 'blog.victorsaly.com',
    vo: { key: 'close', line: 'Talked out loud. Tidied by AI.' },
  },
];

/** Problems with the timeline itself: gaps, overlaps, a wrong total, or two clips with one name. */
export function timelineProblems(list: Scene[], total = TOTAL): string[] {
  const problems: string[] = [];
  let at = 0;
  for (const s of list) {
    if (s.start !== at) problems.push(`a scene starts at ${s.start}s, expected ${at}s`);
    if ((s.start * BPM) % 60 !== 0) problems.push(`the scene at ${s.start}s is off the beat`);
    at = s.start + s.dur;
  }
  if (at !== total) problems.push(`the scenes end at ${at}s, expected ${total}s`);
  const keys = list.flatMap((s) => (s.vo ? [s.vo.key] : []));
  for (const k of new Set(keys)) {
    if (keys.filter((x) => x === k).length > 1) problems.push(`two scenes use the clip "${k}"`);
  }
  return problems;
}

/** Seconds a scene's line has before the next line starts; a line may run over silent scenes. */
export function roomFor(list: Scene[], index: number, total = TOTAL): number {
  const s = list[index];
  if (!s) return 0;
  const next = list.slice(index + 1).find((n) => n.vo);
  return (next ? next.start : total) - s.start - VO_AT;
}

function stamp(seconds: number): string {
  const ms = Math.round(seconds * 1000);
  const mm = String(Math.floor(ms / 60_000)).padStart(2, '0');
  const ss = String(Math.floor((ms % 60_000) / 1000)).padStart(2, '0');
  return `00:${mm}:${ss}.${String(ms % 1000).padStart(3, '0')}`;
}

/** WebVTT captions for the video: each line from when its clip starts until it ends (lengths in seconds). */
export function captions(list: Scene[], lengths: Record<string, number>): string {
  const cues = list.flatMap((s) => {
    const len = s.vo ? lengths[s.vo.key] : undefined;
    if (!s.vo || !len) return [];
    const from = s.start + VO_AT;
    return [`${stamp(from)} --> ${stamp(from + len)}\n${s.vo.line}`];
  });
  return `WEBVTT\n\n${cues.join('\n\n')}\n`;
}
