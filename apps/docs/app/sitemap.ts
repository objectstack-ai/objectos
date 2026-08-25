import type { MetadataRoute } from 'next';
import { source } from '@/lib/source';
import { i18n } from '@/lib/i18n';
import { languageAlternates, localeUrl, translatedLocales } from '@/lib/seo';

export const revalidate = false;

/**
 * Locales in which `privacy` and `terms` are actually written. Those two pages
 * carry their copy in a `content` record inside their own route component
 * (`app/[lang]/privacy/page.tsx`, `app/[lang]/terms/page.tsx`), which falls back
 * to English (`content[lang] ?? content.en`) for anything not listed there —
 * the same fallback-shaped defect the docs pages have. Keep this in sync with
 * those two records.
 */
const STATIC_PAGE_LOCALES = ['en', 'zh-Hans'];

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  // Top-level static pages (paths are locale-independent slugs).
  const staticPaths: Array<{ path: string; priority: number; locales: readonly string[] }> = [
    // The root exists in every locale: it is a language dispatch page that
    // redirects to that locale's /docs.
    { path: '', priority: 1, locales: i18n.languages },
    { path: 'privacy', priority: 0.3, locales: STATIC_PAGE_LOCALES },
    { path: 'terms', priority: 0.3, locales: STATIC_PAGE_LOCALES },
  ];

  // Documentation pages. `source.getPages()` with no argument returns every
  // locale's page set concatenated — the same logical page once per language —
  // so it must be pinned to the default language to enumerate pages rather than
  // page/locale pairs. Slugs are the same across locales, so we reconstruct
  // each locale URL from page.slugs.
  const docPaths = source.getPages(i18n.defaultLanguage).map((page) => ({
    path: ['docs', ...page.slugs].join('/'),
    priority: 0.8,
    locales: translatedLocales(page.slugs),
  }));

  for (const { path, priority, locales } of [...staticPaths, ...docPaths]) {
    // One reciprocal hreflang cluster per logical path, listing only the
    // locales that really have this page, and shared by every entry in it.
    const languages = languageAlternates(path, locales);
    for (const lang of locales) {
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
