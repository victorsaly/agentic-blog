// Why: the home page, the theme pages and the archive show each post's cover as a small print beside it.
// The cover is whichever drawing the image agent marked "cover" in image/prompts.md; this finds it once
// per build so every list uses the same picture and the same alt text.
import type { ImageMetadata } from 'astro';
import { getCollection } from 'astro:content';
import { thoughtSlugOf } from './content';
import { coverOf, picturesFrom } from './pictures';

const drawings = import.meta.glob<ImageMetadata>('../../../thoughts/*/image/*.png', {
  eager: true,
  import: 'default',
});

export interface Cover {
  image: ImageMetadata;
  alt: string;
}

/** Slug → cover, for every thought that has a drawn cover. */
export async function coversBySlug(): Promise<Map<string, Cover>> {
  const lists = await getCollection('pictures');
  const covers = new Map<string, Cover>();
  for (const list of lists) {
    const slug = thoughtSlugOf(list.id);
    const cover = coverOf(picturesFrom(list.data));
    if (!cover) continue;
    const image = Object.entries(drawings).find(([path]) =>
      path.endsWith(`/thoughts/${slug}/${cover.file}`),
    )?.[1];
    if (image) covers.set(slug, { image, alt: cover.alt });
  }
  return covers;
}
