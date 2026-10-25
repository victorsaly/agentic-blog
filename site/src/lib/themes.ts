// Why: the theme list in settings.yml is the classification every post is tagged with. These helpers turn
// the tags into the counts and labels the theme navigation shows, and are tested without a build.

/**
 * "ai-changing-work" → "AI changing work". Known initialisms stay in capitals. A name given in `names`
 * (settings.yml topic_names) wins, for a tag that cannot say it alone: "scalable-secure" is "Scalable and secure".
 */
export function themeLabel(theme: string, names: Readonly<Record<string, string>> = {}): string {
  // Only a name set in settings counts; a tag like "constructor" must not find one on Object.prototype.
  if (Object.hasOwn(names, theme)) return names[theme] ?? theme;
  const words = theme
    .split('-')
    .map((w) => (['ai', 'ui', 'api'].includes(w) ? w.toUpperCase() : w));
  const [first = '', ...rest] = words;
  return [first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(' ');
}

/**
 * The one plain line saying what a theme is about (settings.yml topics), or undefined when there is none.
 * Like a name, only a line set in settings counts: "constructor" must not find one on Object.prototype.
 */
export function themeAbout(
  theme: string,
  abouts: Readonly<Record<string, string>> = {},
): string | undefined {
  return Object.hasOwn(abouts, theme) ? abouts[theme] : undefined;
}

/** 1 → "One thought", 12 → "12 thoughts": a count a screen reader says with its unit. */
export function thoughtsLabel(count: number): string {
  return count === 1 ? 'One thought' : `${String(count)} thoughts`;
}

/** Each theme used by at least one post, with how many, most used first, then by name. */
export function themeCounts(themesPerPost: string[][]): [string, number][] {
  const counts = new Map<string, number>();
  for (const themes of themesPerPost)
    for (const theme of new Set(themes)) counts.set(theme, (counts.get(theme) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
