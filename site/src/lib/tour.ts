// Why: the tour on /how-it-works is a narrated walk through the agents, one station at a time. This is the
// one place its words live: the page shows each line as the caption and the voice clip in
// site/public/tour/<id>.mp3 says exactly this text (docs/audio-sources.md records how each clip was made).
// Change a line here and the clip must be made again (npm run tour:voice), or the caption and the voice
// disagree; the time of every word is kept beside it, in tour-words.json. Each station has a linocut,
// site/public/tour/<id>.png (site/src/assets/how-it-works/prompts.md says how it was drawn), and the real
// screen of that step, site/src/assets/tour/<id>.png (npm run tour:screens takes them again).

import type { TimedWord } from './read-along';

export interface TourStation {
  /** The clip's file name, site/public/tour/<id>.mp3. */
  id: string;
  /** The name on the box. */
  name: string;
  /** Who does the work at this station: a person, the site, or the agents by name. */
  who: string[];
  /** One short line, always visible on the box. */
  job: string;
  /** What the voice says while this station is lit; shown as the caption. */
  line: string;
  /** The alt text of the station's linocut, site/public/tour/<id>.png, shown beside its name. */
  print: string;
  /** What the real screen of this step shows, for a reader who cannot see it: its alt text. */
  screen: string;
  /** Where the screen comes from, in a few words, under it. */
  from: string;
}

export const tour: TourStation[] = [
  {
    id: 'studio',
    name: 'Studio',
    who: ['You'],
    job: 'Talk, or paste what you wrote',
    line: "You have a thought worth sharing, and no time to write it. Open the studio, press record and talk for two minutes. Or paste what you already wrote. That's your part done.",
    print: 'A hand pressing the round record button on a phone lying on a table, a cup beside it.',
    screen:
      "The studio's Talk page: one wide black button, Say it, and a smaller one to write or paste instead.",
    from: 'The studio, Talk',
  },
  {
    id: 'origin',
    name: 'Origin',
    who: ['The site'],
    job: 'Kept exactly as it came out',
    line: "Your words land exactly as they came out. That's the origin. It's never edited, and every version of the post links back to it.",
    print: 'A folded sheet of paper sealed in a glass jar on a shelf.',
    screen:
      'The origin page of a post: the note exactly as it was written, marked never edited, with links to what was tidied from it.',
    from: "A post's origin page",
  },
  {
    id: 'interview',
    name: 'Interview',
    who: ['interview'],
    job: 'Asks what a stranger would need',
    line: "The interview agent reads it the way a stranger would and asks what's missing. You answer out loud, while you still remember.",
    print: 'A person seen from behind, a hand cupped to one ear, leaning towards a microphone.',
    screen:
      "The interview agent's questions for the post, numbered one to eight, each asking for a name, a moment or a source.",
    from: 'interview.md on GitHub',
  },
  {
    id: 'structure',
    name: 'Structure',
    who: ['structure'],
    job: 'Message, idea, road; you approve the message',
    line: 'The structure agent finds the point. A message in three lines. An idea that fits one screen. And the road, for anyone who wants all of it. You approve the message before anything is built on it.',
    print: 'Three stones stacked on a table: small, medium and large.',
    screen:
      "A post's opening: its title, and the message in three lines with its first sentence marked in marigold.",
    from: "A post's message",
  },
  {
    id: 'makers',
    name: 'The makers, each when it is ready',
    who: ['convert', 'image', 'diagram', 'citations', 'seo', 'drilldown'],
    job: 'Versions, prints, diagrams, sources, search, wiki',
    line: 'Then the makers start by themselves, each as soon as what it needs is ready. One writes the short and long versions and the LinkedIn post, while one draws a linocut print. Then come the diagrams, a source for every claim, the words search engines read, and a page for each book and person you mention.',
    print:
      'Five hands around one sheet of paper, holding a pen, a carving tool, a ruler, a magnifying glass and a book.',
    screen:
      "A section of a post's road, The bar is raising, with its linocut print of a high-jump bar being lifted a notch.",
    from: 'A section of the road, with its print',
  },
  {
    id: 'gates',
    name: 'Two that can say no',
    who: ['safety', 'security'],
    job: 'Can stop the post, in writing',
    line: 'Two agents can only say no. Safety reads for anything that would land as an attack. Security looks for other people’s private details. Either one can stop the post, and it writes down why.',
    print: 'A hand on the heavy latch of a wooden gate closed across a path.',
    screen:
      "The safety agent's decision: what it checked, the date, the verdict pass, and the words Nothing to hold.",
    from: 'safety.md on GitHub',
  },
  {
    id: 'publish',
    name: 'Read aloud, then publish',
    who: ['voice', 'publish'],
    job: 'A voice for the post, one pull request',
    line: "The voice agent reads the short version aloud, word for word, so the post can be heard as well as read. Then the publish agent gathers everything into one pull request: what's new, what changed from your words, and what to check first.",
    print: 'A hand laying a bundle of papers tied with string into a wire tray.',
    screen:
      'A post read aloud: the Listen row two seconds in, with the word being said underlined in the text.',
    from: 'A post read aloud',
  },
  {
    id: 'you',
    name: 'You approve',
    who: ['You'],
    job: 'Nothing goes live without you',
    line: 'Then it comes back to you. The studio shows the whole route, and where each step stands. You read it, fix what sounds wrong, and approve the merge. Nothing goes live without you.',
    print: 'A hand pressing a rubber stamp down onto a sheet of paper.',
    screen:
      "The studio's route for one thought, scrolled to its end: every step done, the round Merge step that was Victor's call, and Published last.",
    from: 'The studio, a thought’s route',
  },
  {
    id: 'feedback',
    name: 'Talk back',
    who: ['feedback', 'profile'],
    job: 'A complaint fixes the post; a pattern fixes the route',
    line: 'If it went the wrong way, just say so. The feedback agent reworks the post. And when the same note comes up three times, it fixes the instructions that caused it.',
    print: 'A hand pinning a third small note in a row on a cork board.',
    screen:
      "The studio's Talk back page, with a thought chosen and a wide button, Say what is wrong.",
    from: 'The studio, Talk back',
  },
  {
    id: 'close',
    name: 'Published',
    who: ['Readers'],
    job: 'With a switch to the original',
    line: 'Talked out loud, tidied by AI. The thought stays yours, and every post shows how it got there.',
    print: 'A print hanging to dry on a line, held by two pegs.',
    screen:
      'A published post: the switch between the AI version and the original above its title and its message.',
    from: 'A published post',
  },
];

const isTimedWord = (w: unknown): w is TimedWord =>
  Array.isArray(w) &&
  w.length === 3 &&
  typeof w[0] === 'string' &&
  typeof w[1] === 'number' &&
  typeof w[2] === 'number';

/** The time of every word of every clip, as tour-words.json holds it; a station whose entry is malformed has none. */
export function tourWordsFrom(data: unknown): Record<string, TimedWord[]> {
  if (typeof data !== 'object' || data === null) return {};
  return Object.fromEntries(
    Object.entries(data).flatMap(([id, words]: [string, unknown]) =>
      Array.isArray(words) && words.every(isTimedWord) ? [[id, words]] : [],
    ),
  );
}

/** How long a station stays lit when there is no sound: about two and a half words a second, plus a breath. */
export function readingTimeMs(line: string): number {
  const words = line.trim().split(/\s+/).filter(Boolean).length;
  return Math.round((words / 2.5) * 1000) + 1200;
}
