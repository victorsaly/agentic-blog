// Why: the studio is a handful of separate jobs (talk, talk back, review, comments, money), and each one has
// its own page so Victor goes straight to the one he came for instead of scrolling past the rest. This list
// is the one place the areas, their order and their addresses are named; the tab row and the overview read it.

export type StudioAreaId = 'today' | 'talk' | 'feedback' | 'review' | 'comments' | 'runs';

export interface StudioArea {
  id: StudioAreaId;
  href: string;
  name: string;
  /** One line on what the area is for, shown on the overview. */
  hint: string;
}

export const studioAreas: readonly StudioArea[] = [
  { id: 'today', href: '/studio', name: 'Today', hint: 'what is waiting, at a glance' },
  { id: 'talk', href: '/studio/talk', name: 'Talk', hint: 'say a new thought, or paste it' },
  {
    id: 'feedback',
    href: '/studio/feedback',
    name: 'Talk back',
    hint: 'say what an output got wrong',
  },
  { id: 'review', href: '/studio/review', name: 'Review', hint: 'what the agents wrote, unread' },
  {
    id: 'comments',
    href: '/studio/comments',
    name: 'Comments',
    hint: 'what readers wrote, to decide',
  },
  { id: 'runs', href: '/studio/runs', name: 'Runs', hint: 'every run and what it cost' },
];

/** The area a page belongs to, from its address; anything unknown under /studio is the overview. */
export function areaFor(pathname: string): StudioAreaId {
  const path = pathname.replace(/\.html$/, '').replace(/\/+$/, '');
  const found = studioAreas.find((a) => a.id !== 'today' && path === a.href);
  return found ? found.id : 'today';
}
