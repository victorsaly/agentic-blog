---
why: >
  A page that says every change carries its source has to say where its own voice came from. This file
  records how each narration clip on /how-it-works was made, with which model and voice, so a clip can be
  made again the same way when its line changes.
---

# Audio sources

All audio was generated with ElevenLabs on Victor's account. The tour is made by `npm run tour:voice` and
the pitch video's audio by `npm run pitch:voice`; both read the key from `site/.env.local` (never
committed). Nothing in the site's build calls ElevenLabs.

## The tour on /how-it-works (`site/public/tour/`)

Made again on 25 October 2026 in the blogger's own voice, the one that reads the posts, so the tour sounds
like the blog. `npm run tour:voice` makes them the way the voice agent makes a post's reading:

|         |                                                                                                                 |
| ------- | --------------------------------------------------------------------------------------------------------------- |
| Voice   | `settings.yml → media.voice_id` ("Victor Saly"), model `eleven_v3`                                              |
| Pace    | `media.voice_speed` (1.1×), applied with ffmpeg after speaking, as for a post                                   |
| Timings | ElevenLabs with the time of every character, turned into the time of every word: `site/src/lib/tour-words.json` |
| Check   | each clip says its line word for word, or nothing is saved; `site/src/lib/tour.test.ts` checks it again         |
| Takes   | one per clip                                                                                                    |

One clip per station, named by the station's `id`. The exact words of every clip are the `line` of that
station in [`site/src/lib/tour.ts`](../site/src/lib/tour.ts); the page shows the same text, and underlines the
word being said. To change a line: edit it there, then `npm run tour:voice -- <id>`.

`structure`, `makers` and `you` were made again on 25 October 2026, when the route began to run by itself
and the merge moved into the studio.

| File            | Words | Length |
| --------------- | ----- | ------ |
| `studio.mp3`    | 32    | 10.9 s |
| `origin.mp3`    | 24    | 7.7 s  |
| `interview.mp3` | 22    | 8.2 s  |
| `structure.mp3` | 37    | 11.7 s |
| `makers.mp3`    | 56    | 18.3 s |
| `gates.mp3`     | 34    | 11.1 s |
| `publish.mp3`   | 43    | 13.7 s |
| `you.mp3`       | 33    | 10.0 s |
| `feedback.mp3`  | 31    | 9.3 s  |
| `close.mp3`     | 18    | 5.9 s  |

The first tour (24 October 2026) was read by "Chris W" (`hoSRtERLhFa8UfJ6P1JP`) through the ElevenLabs
connector; the pitch video below still is.

## The pitch video (`scripts/pitch/audio/`)

The 60-second pitch, `site/public/media/pitch.mp4`, is cut from `scripts/pitch/scenes.ts`: what is on
screen, when, and the exact words of every voice line. Same voice as the tour.

|       |                                                                                            |
| ----- | ------------------------------------------------------------------------------------------ |
| Voice | "Chris W" (`hoSRtERLhFa8UfJ6P1JP`), model `eleven_v3`, one clip per line: `vo-<key>.mp3`   |
| Music | `music.mp3`, model `music_v2_5`, instrumental; the prompt is `music.prompt` in `scenes.ts` |
| Made  | 24 October 2026, one take each; `agents` and `you` again on 25 October 2026                |

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
