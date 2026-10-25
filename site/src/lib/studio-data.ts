// Why: several studio pages need the same build-time facts (what waits for review, what every run cost), and
// the tab row shows counts from them on every page. Reading the content and checking every ledger once per
// build, here, keeps the pages from each doing it again and keeps their numbers the same.
import { getCollection } from 'astro:content';
import { join } from 'node:path';
import { readRuns } from '@roadbook/core/node';
import { leafOf, thoughtSlugOf } from './content';
import { runRows, type RunRow } from './how-made';
import { waitingForReview, type ThoughtWaiting } from './review';

export interface CostedThought {
  slug: string;
  title: string;
  rows: RunRow[];
}

// Typed at the boundary: on a fresh checkout Astro has not generated its content types yet when lint runs.
interface ThoughtEntry {
  id: string;
  data: { title: string; date: Date; draft: boolean };
}
interface VersionEntry {
  id: string;
  data: { kind: string; reviewed: boolean };
}
interface SourcesEntry {
  id: string;
  data: { reviewed: boolean };
}
interface VoiceEntry {
  id: string;
  data: { audio: string; reviewed: boolean };
}

// The voice agent's recordings by their path in the thought folder, so an unreviewed one can be heard here.
const recordings = import.meta.glob<string>('../../../thoughts/*/voice/*.mp3', {
  eager: true,
  query: '?url',
  import: 'default',
});

async function thoughtEntries(): Promise<ThoughtEntry[]> {
  const entries: unknown = await getCollection('thoughts');
  return entries as ThoughtEntry[];
}

let waitingOnce: Promise<ThoughtWaiting[]> | undefined;
let costedOnce: Promise<CostedThought[]> | undefined;

/** What the agents wrote that Victor has not read, drafts included: their versions wait for review too. */
export function loadWaiting(): Promise<ThoughtWaiting[]> {
  waitingOnce ??= (async () => {
    const thoughts = (await thoughtEntries()).map((t) => ({
      slug: thoughtSlugOf(t.id),
      title: t.data.title,
      date: t.data.date,
      draft: t.data.draft,
    }));
    const versions = ((await getCollection('versions')) as unknown as VersionEntry[]).map((v) => ({
      slug: thoughtSlugOf(v.id),
      leaf: leafOf(v.id),
      kind: v.data.kind,
      reviewed: v.data.reviewed,
    }));
    const sources = ((await getCollection('sources')) as unknown as SourcesEntry[]).map((s) => ({
      slug: thoughtSlugOf(s.id),
      reviewed: s.data.reviewed,
    }));
    const voices = ((await getCollection('voices')) as unknown as VoiceEntry[]).map((v) => {
      const slug = thoughtSlugOf(v.id);
      const audio = Object.entries(recordings).find(([path]) =>
        path.endsWith(`/thoughts/${slug}/voice/${v.data.audio}`),
      )?.[1];
      const voice = { slug, leaf: leafOf(v.id), reviewed: v.data.reviewed };
      return audio ? { ...voice, audio } : voice;
    });
    return waitingForReview(thoughts, versions, sources, voices);
  })();
  return waitingOnce;
}

/** Every thought's runs, drafts included (a draft's runs cost money too). A run that does not verify stops the build. */
export function loadCosted(): Promise<CostedThought[]> {
  costedOnce ??= (async () => {
    const thoughts = await thoughtEntries();
    return Promise.all(
      thoughts.map(async (t) => {
        const slug = thoughtSlugOf(t.id);
        const ledger = await readRuns(
          join(process.cwd(), '..', 'thoughts', slug),
          `thoughts/${slug}`,
        );
        if (ledger.issues.length > 0) throw new Error(ledger.issues.join('\n'));
        return { slug, title: t.data.title, rows: runRows(ledger.runs) };
      }),
    );
  })();
  return costedOnce;
}
