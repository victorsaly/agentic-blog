// Why: the studio's one big action, saying something, carries the same microphone wherever it appears (the
// overview's start, the recorder itself), drawn in the text colour so it inverts with a filled button. One
// drawing in one place keeps the two from drifting apart.
export function MicIcon(): React.JSX.Element {
  return (
    <svg
      className="mic"
      aria-hidden="true"
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </svg>
  );
}
