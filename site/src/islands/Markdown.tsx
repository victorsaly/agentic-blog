// Why: the studio shows Markdown as Victor will read it, not as it was typed: what an agent wrote beside a
// gate, and his own answer before he sends it. It draws the parts markdown-view reads, as elements only,
// so nothing in a file can put HTML on the page.
import { blocksOf, type Block, type Inline } from '../lib/markdown-view';

function Parts({ parts }: { parts: Inline[] }): React.JSX.Element {
  return (
    <>
      {parts.map((part, i) => {
        switch (part.kind) {
          case 'bold':
            return <strong key={i}>{part.text}</strong>;
          case 'italic':
            return <em key={i}>{part.text}</em>;
          case 'code':
            return <code key={i}>{part.text}</code>;
          case 'link':
            return (
              <a key={i} href={part.href}>
                {part.text}
              </a>
            );
          case 'text':
            return <span key={i}>{part.text}</span>;
        }
      })}
    </>
  );
}

function BlockView({ block }: { block: Block }): React.JSX.Element {
  switch (block.kind) {
    case 'heading': {
      const Heading = `h${String(block.level)}` as 'h2' | 'h3' | 'h4';
      return (
        <Heading>
          <Parts parts={block.parts} />
        </Heading>
      );
    }
    case 'para':
      return (
        <p>
          <Parts parts={block.parts} />
        </p>
      );
    case 'code':
      return (
        <pre
          // A line wider than the screen scrolls, and the keyboard can only scroll what takes focus.
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
        >
          <code>{block.text}</code>
        </pre>
      );
    case 'quote':
      return (
        <blockquote>
          <Parts parts={block.parts} />
        </blockquote>
      );
    case 'list': {
      const items = block.items.map((item, i) => (
        <li key={i}>
          <Parts parts={item} />
        </li>
      ));
      return block.ordered ? <ol>{items}</ol> : <ul>{items}</ul>;
    }
    case 'table':
      return (
        <div
          className="markdown-table"
          role="region"
          aria-label="Table"
          // A table wider than the screen scrolls, and the keyboard can only scroll what takes focus.
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                {block.head.map((cell, i) => (
                  <th key={i} scope="col">
                    <Parts parts={cell} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c}>
                      <Parts parts={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

export interface MarkdownProps {
  text: string;
}

export function Markdown({ text }: MarkdownProps): React.JSX.Element {
  return (
    <div className="markdown">
      {blocksOf(text).map((block, i) => (
        <BlockView key={i} block={block} />
      ))}
    </div>
  );
}
