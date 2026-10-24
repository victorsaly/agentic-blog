// Why: the theme list in settings.yml is the classification every post is tagged with. These helpers turn
// the tags into the counts and labels the theme navigation shows, and are tested without a build.

/** "ai-changing-work" → "AI changing work". Known initialisms stay in capitals. */
export function themeLabel(theme: string): string {
  const words = theme
    .split('-')
    .map((w) => (['ai', 'ui', 'api'].includes(w) ? w.toUpperCase() : w));
  const [first = '', ...rest] = words;
  return [first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(' ');
}

/** Each theme used by at least one post, with how many, most used first, then by name. */
export function themeCounts(themesPerPost: string[][]): [string, number][] {
  const counts = new Map<string, number>();
  for (const themes of themesPerPost)
    for (const theme of new Set(themes)) counts.set(theme, (counts.get(theme) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
