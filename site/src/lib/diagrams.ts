// Why: the diagram agent describes each diagram as data; this turns it into plain HTML the page styles
// with its own tokens: an ordered list for a flow, two ruled lists for a before-and-after. Real text, so
// it reads in the site's font, at any width, in both themes, and to a screen reader. Every value is
// escaped; no markup from the agent reaches the page.

export interface FlowDiagram {
  section: string;
  kind: 'flow';
  title: string;
  caption: string;
  steps: { label: string; detail?: string }[];
}

export interface CompareDiagram {
  section: string;
  kind: 'compare';
  title: string;
  caption: string;
  before: { label: string; items: string[] };
  after: { label: string; items: string[] };
}

export type Diagram = FlowDiagram | CompareDiagram;

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function side(value: unknown): { label: string; items: string[] } | null {
  if (typeof value !== 'object' || value === null) return null;
  const { label, items } = value as { label?: unknown; items?: unknown };
  const l = str(label);
  const list = Array.isArray(items) ? items.map(str).filter((i): i is string => i !== null) : [];
  return l && list.length >= 2 ? { label: l, items: list } : null;
}

/** The diagrams in diagram/diagrams.md front matter that are complete enough to draw. */
export function diagramsFrom(frontMatter: unknown): Diagram[] {
  if (typeof frontMatter !== 'object' || frontMatter === null) return [];
  const list = (frontMatter as { diagrams?: unknown }).diagrams;
  if (!Array.isArray(list)) return [];
  const diagrams: Diagram[] = [];
  for (const item of list) {
    if (typeof item !== 'object' || item === null) continue;
    const d = item as Record<string, unknown>;
    const section = str(d.section);
    const title = str(d.title);
    const caption = str(d.caption) ?? '';
    if (!section || !title) continue;
    if (d.kind === 'flow' && Array.isArray(d.steps)) {
      const steps = d.steps
        .map((s: unknown) => {
          if (typeof s !== 'object' || s === null) return null;
          const label = str((s as { label?: unknown }).label);
          const detail = str((s as { detail?: unknown }).detail);
          return label ? { label, ...(detail ? { detail } : {}) } : null;
        })
        .filter((s): s is { label: string; detail?: string } => s !== null);
      if (steps.length >= 2) diagrams.push({ section, kind: 'flow', title, caption, steps });
    } else if (d.kind === 'compare') {
      const before = side(d.before);
      const after = side(d.after);
      if (before && after)
        diagrams.push({ section, kind: 'compare', title, caption, before, after });
    }
  }
  return diagrams;
}

export function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** One <figure>: the title, the drawing as lists, the caption. */
export function diagramHtml(d: Diagram): string {
  const e = escapeHtml;
  const head = `<p class="diagram-title">${e(d.title)}</p>`;
  const body =
    d.kind === 'flow'
      ? `<ol class="flow">${d.steps
          .map(
            (s) =>
              `<li><span class="step">${e(s.label)}</span>${s.detail ? `<span class="detail">${e(s.detail)}</span>` : ''}</li>`,
          )
          .join('')}</ol>`
      : `<div class="compare">${[d.before, d.after]
          .map(
            (s) =>
              `<div class="side"><p class="side-label">${e(s.label)}</p><ul>${s.items.map((i) => `<li>${e(i)}</li>`).join('')}</ul></div>`,
          )
          .join('')}</div>`;
  const caption = d.caption ? `<figcaption>${e(d.caption)}</figcaption>` : '';
  return `<figure class="diagram diagram-${d.kind}">${head}${body}${caption}</figure>`;
}
