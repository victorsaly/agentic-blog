// Why: the tour on /how-it-works is a narrated walk through the agents, one station at a time. This is the
// one place its words live: the page shows each line as the caption and the voice clip in
// site/public/tour/<id>.mp3 says exactly this text (docs/audio-sources.md records how each clip was made).
// Change a line here and the clip must be made again, or the caption and the voice disagree. Each station
// also has a linocut, site/public/tour/<id>.png (site/src/assets/how-it-works/prompts.md says how it was drawn).

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
  /** The alt text of the station's linocut, site/public/tour/<id>.png, shown above the line while it is lit. */
  print: string;
}

export const tour: TourStation[] = [
  {
    id: 'studio',
    name: 'Studio',
    who: ['You'],
    job: 'Talk, or paste what you wrote',
    line: "You have a thought worth sharing, and no time to write it. Open the studio, press record and talk for two minutes. Or paste what you already wrote. That's your part done.",
    print: 'A hand pressing the round record button on a phone lying on a table, a cup beside it.',
  },
  {
    id: 'origin',
    name: 'Origin',
    who: ['The site'],
    job: 'Kept exactly as it came out',
    line: "Your words land exactly as they came out. That's the origin. It's never edited, and every version of the post links back to it.",
    print: 'A folded sheet of paper sealed in a glass jar on a shelf.',
  },
  {
    id: 'interview',
    name: 'Interview',
    who: ['interview'],
    job: 'Asks what a stranger would need',
    line: "The interview agent reads it the way a stranger would and asks what's missing. You answer out loud, while you still remember.",
    print: 'A person seen from behind, a hand cupped to one ear, leaning towards a microphone.',
  },
  {
    id: 'structure',
    name: 'Structure',
    who: ['structure'],
    job: 'Message, idea, road',
    line: 'The structure agent finds the point. A message in three lines. An idea that fits one screen. And the road, for anyone who wants all of it.',
    print: 'Three stones stacked on a table: small, medium and large.',
  },
  {
    id: 'makers',
    name: 'Five makers, side by side',
    who: ['convert', 'image', 'diagram', 'citations', 'drilldown'],
    job: 'Versions, drawings, diagrams, sources, wiki',
    line: 'Then five agents work side by side. One writes the short and long versions and the LinkedIn post. One draws a linocut print. One draws the diagrams. One finds a source for every claim. One writes a page for each book and person you mention.',
    print:
      'Five hands around one sheet of paper, holding a pen, a carving tool, a ruler, a magnifying glass and a book.',
  },
  {
    id: 'gates',
    name: 'Two that can say no',
    who: ['safety', 'security'],
    job: 'Can stop the post, in writing',
    line: 'Two agents can only say no. Safety reads for anything that would land as an attack. Security looks for other people’s private details. Either one can stop the post, and it writes down why.',
    print: 'A hand on the heavy latch of a wooden gate closed across a path.',
  },
  {
    id: 'publish',
    name: 'Read aloud, then publish',
    who: ['voice', 'publish', 'seo'],
    job: 'A voice for the post, one pull request',
    line: "The voice agent reads the short version aloud, word for word, so the post can be heard as well as read. Then the publish agent gathers everything into one pull request: what's new, what changed from your words, and what to check first.",
    print: 'A hand laying a bundle of papers tied with string into a wire tray.',
  },
  {
    id: 'you',
    name: 'You merge',
    who: ['You'],
    job: 'Nothing goes live without you',
    line: 'Then it comes back to you. You read it, fix what sounds wrong, and merge. Nothing goes live without you.',
    print: 'A hand pressing a rubber stamp down onto a sheet of paper.',
  },
  {
    id: 'feedback',
    name: 'Talk back',
    who: ['feedback', 'profile'],
    job: 'A complaint fixes the post; a pattern fixes the route',
    line: 'If it went the wrong way, just say so. The feedback agent reworks the post. And when the same note comes up three times, it fixes the instructions that caused it.',
    print: 'A hand pinning a third small note in a row on a cork board.',
  },
  {
    id: 'close',
    name: 'Published',
    who: ['Readers'],
    job: 'With a switch to the original',
    line: 'Talked out loud, tidied by AI. The thought stays yours, and every post shows how it got there.',
    print: 'A print hanging to dry on a line, held by two pegs.',
  },
];

/** How long a station stays lit when there is no sound: about two and a half words a second, plus a breath. */
export function readingTimeMs(line: string): number {
  const words = line.trim().split(/\s+/).filter(Boolean).length;
  return Math.round((words / 2.5) * 1000) + 1200;
}
