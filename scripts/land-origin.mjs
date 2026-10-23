// Why: the one script allowed to create files under origin/. It runs in the origin workflow from a studio
// dispatch, writes the transcript exactly as it arrived with the front matter the schema requires, and
// names the branch and the pull request. It never modifies an existing origin; a second note for a
// thought is a second file.
import { appendFile, mkdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const event = process.env.EVENT ?? 'new-origin';
const payload = JSON.parse(process.env.PAYLOAD ?? '{}');
const { key, transcript, thought, by, recorded } = payload;

if (typeof key !== 'string' || typeof transcript !== 'string' || transcript.trim().length === 0) {
  console.error('dispatch payload needs a key and a transcript');
  process.exit(1);
}

const date = (typeof recorded === 'string' ? recorded : new Date().toISOString()).slice(0, 10);
const stamp = (typeof recorded === 'string' ? recorded : new Date().toISOString()).replaceAll(
  /[:.]/g,
  '-',
);

function slugFromTranscript(text) {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(
      (w) =>
        w.length > 3 &&
        ![
          'that',
          'this',
          'with',
          'have',
          'they',
          'about',
          'there',
          'where',
          'which',
          'when',
          'what',
          'from',
          'your',
          'want',
          'like',
          'just',
          'know',
          'then',
          'into',
          'also',
          'will',
          'been',
          'were',
          'them',
          'than',
          'because',
        ].includes(w),
    )
    .slice(0, 4);
  return words.length > 0 ? words.join('-') : 'thought';
}

function yamlFold(text) {
  return text
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');
}

const outputs = [];

if (event === 'new-origin') {
  const slug =
    typeof thought === 'string' && thought.length > 0
      ? thought
      : `${date}-${slugFromTranscript(transcript)}`;
  const dir = join('thoughts', slug, 'origin');
  await mkdir(dir, { recursive: true });
  const existing = await stat(join(dir, 'transcript.md')).then(
    () => true,
    () => false,
  );
  const file = existing ? `transcript-${stamp}.md` : 'transcript.md';
  const why = `This is the origin of the thought "${slug}", kept exactly as it was spoken${by ? ` by ${by}` : ''} on ${date}. Nothing has been edited. Every published version points back here.`;
  const content = [
    '---',
    'why: >',
    yamlFold(why),
    `recorded: ${date}`,
    'language: en',
    `audio: ${key}`,
    'speakers: [victor]',
    'edited: false',
    '---',
    '',
    transcript.trim(),
    '',
  ].join('\n');
  await writeFile(join(dir, file), content, 'utf8');
  outputs.push(
    ['branch', `origin/${slug}`],
    ['title', `content: new origin for ${slug}`],
    ['label', 'origin'],
    [
      'body',
      `A new voice note landed from the studio.\n\n- Folder: \`thoughts/${slug}\`\n- Recording: \`${key}\` in R2\n- Recorded: ${date}\n\nThe transcript is unedited. Merging makes it an origin. The interview agent runs next: add the label \`agent:interview\` to ask the questions, or merge and let the schedule pick it up.`,
    ],
  );
} else {
  if (typeof thought !== 'string' || thought.length === 0) {
    console.error('feedback needs the thought it is about');
    process.exit(1);
  }
  const dir = join('thoughts', thought, 'feedback');
  await mkdir(dir, { recursive: true });
  const file = `${stamp}.md`;
  const why = `Feedback about the output of "${thought}", spoken${by ? ` by ${by}` : ''} on ${date}. The feedback agent treats it as an instruction and reworks the versions it names.`;
  const content = [
    '---',
    'why: >',
    yamlFold(why),
    `recorded: ${date}`,
    `audio: ${key}`,
    'handled: false',
    '---',
    '',
    transcript.trim(),
    '',
  ].join('\n');
  await writeFile(join(dir, file), content, 'utf8');
  outputs.push(
    ['branch', `feedback/${thought}-${stamp}`],
    ['title', `content: feedback on ${thought}`],
    ['label', 'feedback'],
    [
      'body',
      `A feedback note about \`thoughts/${thought}\` landed from the studio.\n\n- File: \`${file}\`\n- Recording: \`${key}\` in R2\n\nMerging records it. Add the label \`agent:feedback\` to have the versions reworked from it.`,
    ],
  );
}

const outFile = process.env.GITHUB_OUTPUT;
if (outFile) {
  for (const [name, value] of outputs) {
    await appendFile(outFile, `${name}<<EOF\n${value}\nEOF\n`);
  }
}
console.info(outputs.map(([n, v]) => `${n}: ${v.split('\n')[0]}`).join('\n'));
