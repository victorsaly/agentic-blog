// Why: a reader who wants the next thought without checking back can follow the blog in any feed reader.
// The feed is a few lines of RSS 2.0 (with the author, the topics and the share card for readers that show
// them), built here as a pure function (no dependency) so it can be tested.

export interface FeedItem {
  title: string;
  /** Absolute URL of the post. */
  link: string;
  /** The message: what a reader gets in three lines. */
  description: string;
  date: Date;
  /** Who wrote it, as dc:creator: RSS's own author field wants an email address. */
  author?: string;
  /** Its topics, one category each. */
  categories?: string[];
  /** The picture a reader or an aggregator shows beside it (Media RSS). */
  image?: { url: string; type: string; width: number; height: number };
}

export interface Feed {
  title: string;
  /** Absolute URL of the site. */
  link: string;
  /** Absolute URL of this feed. */
  self: string;
  description: string;
  language: string;
  items: FeedItem[];
}

/** Escapes the five characters XML cares about. */
export function escapeXml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

/** The feed as RSS 2.0, newest item first. */
export function rssXml(feed: Feed): string {
  const items = [...feed.items]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .map((item) => {
      const lines = [
        `<title>${escapeXml(item.title)}</title>`,
        `<link>${escapeXml(item.link)}</link>`,
        `<guid isPermaLink="true">${escapeXml(item.link)}</guid>`,
        `<description>${escapeXml(item.description)}</description>`,
        `<pubDate>${item.date.toUTCString()}</pubDate>`,
        ...(item.author ? [`<dc:creator>${escapeXml(item.author)}</dc:creator>`] : []),
        ...(item.categories ?? []).map((c) => `<category>${escapeXml(c)}</category>`),
        ...(item.image
          ? [
              `<media:content url="${escapeXml(item.image.url)}" type="${escapeXml(item.image.type)}" medium="image" width="${String(item.image.width)}" height="${String(item.image.height)}" />`,
            ]
          : []),
      ];
      return `    <item>\n${lines.map((l) => `      ${l}`).join('\n')}\n    </item>`;
    });
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>${escapeXml(feed.title)}</title>
    <link>${escapeXml(feed.link)}</link>
    <atom:link href="${escapeXml(feed.self)}" rel="self" type="application/rss+xml" />
    <description>${escapeXml(feed.description)}</description>
    <language>${escapeXml(feed.language)}</language>
${items.join('\n')}
  </channel>
</rss>
`;
}
