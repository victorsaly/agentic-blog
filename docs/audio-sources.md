---
why: >
  A page that says every change carries its source has to say where its own voice came from. This file
  records how each narration clip on /how-it-works was made, with which model and voice, so a clip can be
  made again the same way when its line changes.
---

# Audio sources

All audio was generated with ElevenLabs on Victor's account. The tour was made through the ElevenLabs
connector in Claude Code; the pitch video's audio is made by `npm run pitch:voice`, which reads the key
from `site/.env.local` (never committed). Nothing in the site's build calls ElevenLabs.

## The tour on /how-it-works (`site/public/tour/`)

Generated on 24 October 2026.

|                 |                                                                                                 |
| --------------- | ----------------------------------------------------------------------------------------------- |
| Model           | `eleven_v3`                                                                                     |
| Voice           | "Chris W", a warm British English male voice (`hoSRtERLhFa8UfJ6P1JP`)                           |
| Takes           | two per clip; take 1 kept for every clip                                                        |
| Credits         | 2,948 for all twenty takes (1,474 for the ten kept)                                             |
| ElevenLabs flow | "Agentic blog — how it works tour" (`e1pFLtDxeRpoN5rpC0VZ`); take 2 of each clip is still there |

`publish.mp3` was made again on 25 October 2026, when the voice agent joined that station: same voice and
model, one take, through the ElevenLabs API (`text-to-speech`, `mp3_44100_128`) with the key in
`site/.env.local`, and checked by transcribing it back (`scribe_v1`) against the line, word for word.

One clip per station, named by the station's `id`. The exact words of every clip are the `line` of that
station in [`site/src/lib/tour.ts`](../site/src/lib/tour.ts); the page shows the same text as the caption.

| File            | Length | Credits   |
| --------------- | ------ | --------- |
| `studio.mp3`    | 11.1 s | 170       |
| `origin.mp3`    | 8.1 s  | 127       |
| `interview.mp3` | 8.1 s  | 125       |
| `structure.mp3` | 11.0 s | 138       |
| `makers.mp3`    | 17.4 s | 240       |
| `gates.mp3`     | 16.2 s | 188       |
| `publish.mp3`   | 16.0 s | see below |
| `you.mp3`       | 7.4 s  | 104       |
| `feedback.mp3`  | 10.7 s | 162       |
| `close.mp3`     | 7.4 s  | 94        |

## The pitch video (`scripts/pitch/audio/`)

The 60-second pitch, `site/public/media/pitch.mp4`, is cut from `scripts/pitch/scenes.ts`: what is on
screen, when, and the exact words of every voice line. Same voice as the tour.

|       |                                                                                            |
| ----- | ------------------------------------------------------------------------------------------ |
| Voice | "Chris W" (`hoSRtERLhFa8UfJ6P1JP`), model `eleven_v3`, one clip per line: `vo-<key>.mp3`   |
| Music | `music.mp3`, model `music_v2_5`, instrumental; the prompt is `music.prompt` in `scenes.ts` |
| Made  | 24 October 2026, one take each                                                             |

```
npm run pitch:voice   # makes any clip or the music that is missing (spends credits)
npm run pitch         # films the site and mixes the audio (free; needs ffmpeg)
```

To change a line: edit it in `scenes.ts`, delete its `vo-<key>.mp3`, and run both again.

The clips and the music are not committed (`.gitignore`): they live only on the machine that made them. Only
the finished `pitch.mp4`, its captions `pitch.vtt` and its still `pitch.jpg` are in the repo. On a fresh clone,
`npm run pitch:voice` makes them again, which spends the credits again.

## Read-aloud audio on a post (`thoughts/<slug>/voice/`)

Made by the `voice` agent (`agents/voice/`), not by hand. It sends the approved `versions/short.md`, as written,
to ElevenLabs and writes `short.mp3`, `short.json` (the start and end, in seconds, of every word) and `short.md`
(the spoken text, the voice and model, and a fingerprint of the text). Unlike the tour, this runs in GitHub
Actions on the `agent:voice` label and needs the `ELEVENLABS_API_KEY` secret; the site's build still never
calls ElevenLabs.

|       |                                                                                                                          |
| ----- | ------------------------------------------------------------------------------------------------------------------------ |
| Model | `eleven_v3`                                                                                                              |
| Voice | Victor's own, cloned in ElevenLabs (`eHHUhFBxuo0yMYCOGHks`), set in `settings.yml` → `media.voice_id`; Chris W when null |
| Redo  | only when the spoken text changes (its fingerprint differs) or a file is missing; otherwise skipped                      |

Victor listens to the audio in the pull request before merging; `reviewed: false` in `short.md` is flipped by
hand when he has.

## To replace a tour clip

1. Change the station's `line` in `site/src/lib/tour.ts`.
2. Generate the new mp3 with the same model and voice, and save it under the same file name.
3. Update its row above (length, credits, date if it changed).

`npm run test` fails if a station has no clip. It cannot tell whether a clip still says its line; that is
checked by listening.
