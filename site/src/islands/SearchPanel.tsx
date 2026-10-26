// Why: search docks beside the page like Ask, so finding something never loses your place. It runs on the
// static index Pagefind builds with the site: nothing typed is sent anywhere. Results arrive into rows that
// are already drawn, so the list never jumps; a match is marked in marigold, and following a result marks
// the words on the page it opens. Without a script the header's Search is a plain link to /search.
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useDock } from './use-dock';

interface Hit {
  key: string;
  url: string;
  where: string;
  title: string;
  excerpt: string;
}

interface Pagefind {
  options: (options: Record<string, unknown>) => Promise<void>;
  debouncedSearch: (
    query: string,
    options: { filters?: Record<string, string> },
    timeout: number,
  ) => Promise<{ results: { id: string; data: () => Promise<unknown> }[] } | null>;
}

interface PageData {
  url: string;
  meta: { title?: string };
  excerpt: string;
  sub_results?: { title: string; url: string; excerpt: string }[];
}

function isPagefind(module: unknown): module is Pagefind {
  return (
    typeof module === 'object' &&
    module !== null &&
    typeof (module as { debouncedSearch?: unknown }).debouncedSearch === 'function'
  );
}

function isPageData(data: unknown): data is PageData {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as { url?: unknown }).url === 'string' &&
    typeof (data as { excerpt?: unknown }).excerpt === 'string'
  );
}

/** Pagefind's excerpt marks matches with <mark>; turn it into text pieces without trusting it as HTML. */
function pieces(excerpt: string): { text: string; hit: boolean }[] {
  // A detached textarea decodes entities and keeps every space; nothing in it runs or renders.
  const box = document.createElement('textarea');
  const decode = (html: string): string => {
    box.innerHTML = html;
    return box.value;
  };
  return excerpt
    .split(/(<mark>.*?<\/mark>)/g)
    .filter((p) => p !== '')
    .map((p) => {
      const hit = p.startsWith('<mark>');
      return { text: decode(hit ? p.slice(6, -7) : p), hit };
    });
}

/** The result's address, with the words to mark once the page opens. */
function withHighlight(url: string, query: string): string {
  const target = new URL(url, location.origin);
  for (const word of query.split(/\s+/).filter((w) => w.length > 1))
    target.searchParams.append('highlight', word);
  return target.pathname + target.search + target.hash;
}

const MAX_HITS = 8;

export interface SearchPanelProps {
  /** The linocut magnifying glass shown on the header button. */
  iconSrc: string;
  /** The linocut speech bubble, for "Ask this instead". */
  askIconSrc: string;
}

export function SearchPanel({ iconSrc, askIconSrc }: SearchPanelProps): React.JSX.Element {
  // Taken apart so only the two refs count as refs: the compiler treats a whole object as one once any
  // field of it is handed to ref=.
  const {
    dialog,
    trigger,
    isOpen,
    open: openDock,
    close: closeDock,
    dialogProps,
  } = useDock('search');
  const input = useRef<HTMLInputElement | null>(null);
  const engine = useRef<Pagefind | null>(null);
  const [query, setQuery] = useState('');
  const [origins, setOrigins] = useState(false);
  // What the last finished search found, and for which query; until one finishes for the current query, the
  // panel is looking, and the hits it shows stay those of the query before.
  const [result, setResult] = useState<{
    key: string;
    state: 'done' | 'missing';
    hits: Hit[];
  } | null>(null);
  const q = query.trim();
  const key = `${String(origins)}:${q}`;
  const short = q.length < 2;
  const state = short ? 'idle' : result?.key === key ? result.state : 'looking';
  const hits = short ? [] : (result?.hits ?? []);
  const id = useId();

  const load = useCallback(async (): Promise<Pagefind | null> => {
    if (engine.current) return engine.current;
    try {
      const path = '/pagefind/pagefind.js';
      const module: unknown = await import(/* @vite-ignore */ path);
      if (!isPagefind(module)) return null;
      await module.options({ excerptLength: 24 });
      engine.current = module;
      return module;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (short) return;
    // A newer query makes this one stale; checked after every await.
    const run = { live: true };
    const stale = (): boolean => !run.live;
    void (async () => {
      const pagefind = await load();
      if (stale()) return;
      if (!pagefind) {
        setResult({ key, state: 'missing', hits: [] });
        return;
      }
      const search = await pagefind.debouncedSearch(
        q,
        origins ? {} : { filters: { kind: 'post' } },
        200,
      );
      if (stale() || search === null) return;
      const pages = await Promise.all(search.results.slice(0, MAX_HITS).map((r) => r.data()));
      if (stale()) return;
      const found: Hit[] = [];
      for (const page of pages) {
        if (!isPageData(page)) continue;
        const title = page.meta.title ?? page.url;
        const subs = (page.sub_results ?? []).filter((s) => s.url !== page.url).slice(0, 2);
        if (subs.length === 0)
          found.push({ key: page.url, url: page.url, where: title, title, excerpt: page.excerpt });
        else
          for (const sub of subs)
            found.push({
              key: sub.url,
              url: sub.url,
              where: title,
              title: sub.title,
              excerpt: sub.excerpt,
            });
      }
      setResult({ key, state: 'done', hits: found.slice(0, MAX_HITS) });
    })();
    return () => {
      run.live = false;
    };
  }, [q, key, short, origins, load]);

  const openPanel = (): void => {
    openDock();
    input.current?.focus();
    void load();
  };

  const status =
    state === 'looking'
      ? 'Looking through the thoughts…'
      : state === 'missing'
        ? 'Search works on the built site. In local development, build it and open the built copy.'
        : state === 'done'
          ? hits.length === 0
            ? `Nothing found for “${query.trim()}”. Try fewer words, or ask instead.`
            : `${hits.length === 1 ? 'One place' : `${String(hits.length)} places`} found`
          : 'Type two letters or more.';

  return (
    <>
      <a
        className="control"
        href="/search"
        ref={trigger}
        onClick={(event) => {
          event.preventDefault();
          if (isOpen) closeDock();
          else openPanel();
        }}
        aria-expanded={isOpen}
        aria-controls={`${id}-dock`}
      >
        <img src={iconSrc} alt="" width={20} height={20} />
        <span className="word">Search</span>
      </a>

      <dialog
        ref={dialog}
        id={`${id}-dock`}
        className="dock search"
        aria-labelledby={`${id}-title`}
        {...dialogProps}
      >
        <div className="dock-head">
          <h2 id={`${id}-title`}>Search</h2>
          <button
            type="button"
            className="control"
            aria-label="Close search"
            onClick={() => {
              closeDock();
            }}
          >
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="2" />
            </svg>
          </button>
        </div>

        <form
          role="search"
          className="dock-section"
          onSubmit={(event) => {
            event.preventDefault();
          }}
        >
          <label htmlFor={`${id}-q`} className="small-label">
            Words to find
          </label>
          <div className="welded">
            <input
              id={`${id}-q`}
              ref={input}
              type="search"
              value={query}
              autoComplete="off"
              onChange={(event) => {
                setQuery(event.target.value);
                // Too short to search: the last hits go, so the next search starts from nothing.
                if (event.target.value.trim().length < 2) setResult(null);
              }}
            />
            {query !== '' && (
              <button
                type="button"
                className="plain"
                aria-label="Clear"
                onClick={() => {
                  setQuery('');
                  setResult(null);
                  input.current?.focus();
                }}
              >
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14">
                  <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="2" />
                </svg>
              </button>
            )}
          </div>
          <fieldset className="choice where">
            <legend className="visually-hidden">Where to look</legend>
            <div className="segmented">
              <label>
                <input
                  type="radio"
                  name={`${id}-where`}
                  checked={!origins}
                  onChange={() => {
                    setOrigins(false);
                  }}
                />
                Posts
              </label>
              <label>
                <input
                  type="radio"
                  name={`${id}-where`}
                  checked={origins}
                  onChange={() => {
                    setOrigins(true);
                  }}
                />
                Posts and originals
              </label>
            </div>
          </fieldset>
        </form>

        <div className="dock-scroll" aria-live="polite" aria-busy={state === 'looking'}>
          <p className="count small quiet">
            {state === 'looking' && (
              <span className="dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            )}
            {status}
          </p>
          {state === 'looking' &&
            hits.length === 0 &&
            [0, 1, 2].map((n) => (
              <div key={n} className="result" aria-hidden="true">
                <span className="skeleton" style={{ width: '46%', height: 12 }} />
                <span className="skeleton" style={{ width: '70%', height: 18 }} />
                <span className="skeleton" style={{ width: '100%' }} />
                <span className="skeleton" style={{ width: '58%' }} />
              </div>
            ))}
          {hits.map((hit) => (
            <a key={hit.key} className="result arrive" href={withHighlight(hit.url, query)}>
              <span className="where small quiet">{hit.where}</span>
              <span className="title">{hit.title}</span>
              <span className="snippet small">
                {pieces(hit.excerpt).map((p, i) =>
                  p.hit ? <mark key={i}>{p.text}</mark> : p.text,
                )}
              </span>
            </a>
          ))}
        </div>

        <div className="dock-foot search-foot">
          <p className="small quiet">Nothing you type is sent anywhere.</p>
          <button
            type="button"
            className="control"
            disabled={query.trim() === ''}
            onClick={() => {
              dispatchEvent(new CustomEvent('ask:open', { detail: { question: query.trim() } }));
            }}
          >
            <img src={askIconSrc} alt="" width={18} height={18} />
            Ask this instead
          </button>
        </div>
      </dialog>
    </>
  );
}
