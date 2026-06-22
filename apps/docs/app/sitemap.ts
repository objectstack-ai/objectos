import type { MetadataRoute } from 'next';
import { source } from '@/lib/source';
import { i18n } from '@/lib/i18n';
import { languageAlternates, localeUrl } from '@/lib/seo';

export const revalidate = false;

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  // Top-level static pages (paths are locale-independent slugs).
  const staticPaths: Array<{ path: string; priority: number }> = [
    { path: '', priority: 1 },
    { path: 'download', priority: 0.6 },
    { path: 'privacy', priority: 0.3 },
    { path: 'terms', priority: 0.3 },
  ];

  // Documentation pages, enumerated from the Fumadocs source. Slugs are the
  // same across locales, so we reconstruct each locale URL from page.slugs.
  const docPaths = source
    .getPages()
    .map((page) => ({ path: ['docs', ...page.slugs].join('/'), priority: 0.8 }));

  for (const { path, priority } of [...staticPaths, ...docPaths]) {
    const languages = languageAlternates(path);
    for (const lang of i18n.languages) {
      entries.push({
        url: localeUrl(lang, path),
        changeFrequency: 'weekly',
        priority,
        alternates: { languages },
      });
    }
  }

  return entries;
}
