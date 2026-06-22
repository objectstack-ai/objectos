import type { MetadataRoute } from 'next';
import { source } from '@/lib/source';
import { i18n } from '@/lib/i18n';

// Canonical production host. Keep in sync with middleware's domain redirect.
const BASE = 'https://docs.objectos.ai';

// Build an absolute URL for a given locale, hiding the prefix for the
// default language (matches i18n.hideLocale = 'default-locale').
function localize(lang: string, path: string): string {
  const suffix = path ? `/${path}` : '';
  return lang === i18n.defaultLanguage
    ? `${BASE}${suffix}`
    : `${BASE}/${lang}${suffix}`;
}

// hreflang alternates map for a logical path, linking every locale version
// plus an x-default that points at the English (canonical) URL.
function alternates(path: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const lang of i18n.languages) {
    languages[lang] = localize(lang, path);
  }
  languages['x-default'] = localize(i18n.defaultLanguage, path);
  return languages;
}

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
    const langAlternates = alternates(path);
    for (const lang of i18n.languages) {
      entries.push({
        url: localize(lang, path),
        changeFrequency: 'weekly',
        priority,
        alternates: { languages: langAlternates },
      });
    }
  }

  return entries;
}
