// Why: the model writes YAML front matter, and a plain value with ": " in it (`title: Support agent: two ways
// to design it`) either stops YAML reading the whole reply or quietly turns a quoted passage into a map,
// which failed a diagram run. Every agent that reads the model's front matter reads it through here, so one
// colon in a title or a quote never stops a run.
import matter from 'gray-matter';

// gray-matter caches each string before parsing it, so asking again for one that failed returns empty data
// instead of the error. Passing options (even none) skips that cache.
const parse = (text: string) => matter(text, {});

const KEY = /^(\s*)(-\s+)?([A-Za-z_][\w-]*):(?:\s+(.*?))?\s*$/;

const needsQuotes = (value: string) =>
  !/^["'>|[{&*!]/.test(value) && (/: |:$| #/.test(value) || value.startsWith('- '));
const quoted = (value: string) => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
const indentOf = (line: string) => line.length - line.trimStart().length;

/**
 * A plain YAML value that holds ": " (or ends in ":", or has " #") stops being one string. This wraps such a
 * value in double quotes and leaves every other line alone (values already quoted, block scalars, flow
 * lists and maps). A list item `- word: rest` is kept as a map only when the next line carries on that map
 * at the key's column; otherwise the whole item is one string (`- Speed: slow`, a quoted passage).
 */
export function quoteColonValues(yaml: string): string {
  const lines = yaml.split('\n');
  return lines
    .map((line, i) => {
      const keyed = KEY.exec(line);
      const dash = keyed?.[2];
      if (keyed?.[1] !== undefined && keyed[3] !== undefined) {
        const value = keyed[4] ?? '';
        if (dash !== undefined && value !== '') {
          const column = keyed[1].length + dash.length;
          const next = lines.slice(i + 1).find((l) => l.trim() !== '');
          const continues =
            next !== undefined && indentOf(next) === column && KEY.exec(next)?.[2] === undefined;
          if (!continues) return `${keyed[1]}${dash}${quoted(`${keyed[3]}: ${value}`)}`;
        }
        if (value === '' || !needsQuotes(value)) return line;
        return `${keyed[1]}${dash ?? ''}${keyed[3]}: ${quoted(value)}`;
      }
      const item = /^(\s*-\s+)(.+?)\s*$/.exec(line);
      if (item?.[1] !== undefined && item[2] !== undefined && needsQuotes(item[2]))
        return item[1] + quoted(item[2]);
      return line;
    })
    .join('\n');
}

const reads = (text: string, accepts: (data: Record<string, unknown>) => boolean) => {
  try {
    return accepts(parse(text).data);
  } catch {
    return false;
  }
};

/**
 * The text as given when YAML reads its front matter and `accepts` takes what it says; otherwise the same
 * text with colon-holding values in the front matter quoted (the body after it is never touched), when
 * that is accepted. When neither is, the text as given, so the caller reports its own reason; and when YAML
 * cannot read it at all, YAML's first error, naming the model's own line.
 */
export function repairFrontMatter(
  text: string,
  accepts: (data: Record<string, unknown>) => boolean = () => true,
): string {
  if (reads(text, accepts)) return text;
  const block = /^(\s*---[^\S\n]*\n)([\s\S]*?)(\n---[^\S\n]*(?:\n|$))/.exec(text);
  if (block?.[1] !== undefined && block[2] !== undefined && block[3] !== undefined) {
    const repaired = block[1] + quoteColonValues(block[2]) + block[3] + text.slice(block[0].length);
    if (reads(repaired, accepts)) return repaired;
  }
  parse(text);
  return text;
}

/** The model's front matter and body, read as written, or once more with colon-holding values quoted. */
export function readFrontMatter(
  text: string,
  accepts?: (data: Record<string, unknown>) => boolean,
): { data: Record<string, unknown>; content: string } {
  const { data, content } = parse(repairFrontMatter(text, accepts));
  return { data, content };
}
