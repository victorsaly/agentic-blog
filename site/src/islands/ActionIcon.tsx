// Why: the studio's controls are a bordered box with an icon and a word, and the actions that matter most
// (decide, approve, run again, send back) carried only a word, filled black like a control that is on. One
// set of small line drawings, in the text colour, gives each its icon, so black fill can mean only "on" and
// "your turn".
export type ActionName = 'decide' | 'approve' | 'again' | 'back' | 'lock';

const drawings: Record<ActionName, React.JSX.Element> = {
  // A tick in a box: a decision to make.
  decide: (
    <>
      <rect x="3" y="3" width="14" height="14" rx="1" />
      <path d="M6.5 10.5l2.5 2.5 4.5-5.5" />
    </>
  ),
  // A tick: yes.
  approve: <path d="M4 10.5l4 4 8-9" />,
  // Round again.
  again: (
    <>
      <path d="M15.5 6.5A6 6 0 1 0 16 12" />
      <path d="M16 3v4h-4" />
    </>
  ),
  // Back the way it came.
  back: (
    <>
      <path d="M8 5L4 9l4 4" />
      <path d="M4 9h8a4 4 0 0 1 0 8H9" />
    </>
  ),
  // Shut for now.
  lock: (
    <>
      <rect x="4.5" y="9" width="11" height="8" rx="1" />
      <path d="M7 9V6.5a3 3 0 0 1 6 0V9" />
    </>
  ),
};

export function ActionIcon({ name }: { name: ActionName }): React.JSX.Element {
  return (
    <svg
      className="action-icon"
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {drawings[name]}
    </svg>
  );
}
