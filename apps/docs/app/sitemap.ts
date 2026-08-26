import type { MetadataRoute } from 'next';
import { source } from '@/lib/source';
import { i18n } from '@/lib/i18n';
import { languageAlternates, localeUrl, translatedLocales } from '@/lib/seo';
import { contentLocales as privacyLocales } from './[lang]/privacy/page';
import { contentLocales as termsLocales } from './[lang]/terms/page';

export const revalidate = false;

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  // Top-level static pages (paths are locale-independent slugs).
  const staticPaths: Array<{ path: string; priority: number; locales: readonly string[] }> = [
    // The root exists in every locale: it is a language dispatch page that
    // redirects to that locale's /docs.
    { path: '', priority: 1, locales: i18n.languages },
    // `privacy` and `terms` carry their copy in a `content` record inside their
    // own route component, and render `content[lang] ?? content.en` for every
    // other locale — the same fallback shape the docs pages had. So the locales
    // they can honestly advertise are the keys of those records, and each module
    // exports its own: this file derives the set instead of restating it, and a
    // translation added to either record reaches the sitemap by that edit alone.
    // Read separately because they are separate records — they agree today, and
    // nothing makes them have to.
    { path: 'privacy', priority: 0.3, locales: privacyLocales },
    { path: 'terms', priority: 0.3, locales: termsLocales },
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

  // Sort by url so the route is a function of the content rather than of the
  // build. `source.getPages()` enumerates in file-read completion order, which
  // varies between builds of an identical tree: two consecutive builds of an
  // untouched tree emitted different bytes for the same 346 entries, so every
  // `deploy-docs.yml` push rewrote the served sitemap whether or not any
  // content changed. Entry order carries no meaning to a crawler; the point is
  // that the bytes stop carrying noise. Compared by code unit rather than with
  // `localeCompare`, whose result depends on the runtime's ICU data and default
  // locale — a machine-dependent comparator would reintroduce exactly the
  // irreproducibility this removes.
  return entries.sort((a, b) => (a.url < b.url ? -1 : a.url > b.url ? 1 : 0));
}
