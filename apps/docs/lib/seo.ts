import { i18n } from '@/lib/i18n';
import { source } from '@/lib/source';

// Canonical production host. Keep in sync with middleware's domain redirect.
export const SITE_URL = 'https://docs.objectos.ai';

/**
 * Absolute URL for a logical (locale-independent) path, hiding the locale
 * prefix for the default language (matches i18n.hideLocale = 'default-locale').
 * `path` has no leading slash, e.g. '' (home) or 'docs/architecture'.
 */
export function localeUrl(lang: string, path: string): string {
  const suffix = path ? `/${path}` : '';
  return lang === i18n.defaultLanguage
    ? `${SITE_URL}${suffix}`
    : `${SITE_URL}/${lang}${suffix}`;
}

/**
 * The locales that have a *real* translated source file for `slugs`.
 *
 * Why this cannot be read off the loader's own per-language APIs: `defineI18n`
 * leaves `fallbackLanguage` unset, which fumadocs resolves to `defaultLanguage`
 * — so every non-English locale's in-memory file system is constructed by
 * copying the English files in and letting real translations overwrite them.
 * The consequences, measured against fumadocs-core 16.8.12 with this repo's
 * content:
 *
 * - `source.getPages(lang)` and `source.getLanguages()` report 79 pages for
 *   *all seven* locales — they cannot tell a translation from a fallback.
 * - `source.getPages()` with no argument returns every locale's page set
 *   concatenated (553), not the default-language set.
 *
 * What does survive the copy is the file identity: `page.path` keeps the
 * ORIGINAL locale-suffixed filename it was authored under. A real Japanese page
 * is `operate/backup.ja.mdx`; an inherited fallback is the English
 * `operate/backup.mdx` under a `ja` lookup. Comparing against the English
 * page's path is therefore the discriminator, and it needs no filesystem access
 * at request time.
 *
 * English is the authored source (AGENTS.md: "English is the single source of
 * truth"), so it is present for every real page — and absent here only for a
 * translation-only file, which AGENTS.md forbids and which this function
 * correctly reports as having no English URL to advertise.
 */
export function translatedLocales(slugs: string[]): string[] {
  const englishPath = source.getPage(slugs, i18n.defaultLanguage)?.path;

  return i18n.languages.filter((lang) => {
    const page = source.getPage(slugs, lang);
    if (!page) return false;
    return lang === i18n.defaultLanguage || page.path !== englishPath;
  });
}

/**
 * hreflang alternates map for a logical path, over the locales that actually
 * have a translation of it, plus an x-default pointing at the English
 * (canonical) URL. Shape matches the `alternates.languages` field of Next.js
 * Metadata and MetadataRoute.Sitemap.
 *
 * `locales` is required on purpose. It used to be implicit — every caller got
 * all seven — and that is the defect this signature removes; a default value
 * would let a future call site silently reproduce it.
 */
export function languageAlternates(
  path: string,
  locales: Iterable<string>,
): Record<string, string> {
  const available = new Set(locales);
  const languages: Record<string, string> = {};
  // Iterate i18n.languages rather than `locales` so the map order is the
  // declared locale order regardless of what the caller passes.
  for (const lang of i18n.languages) {
    if (available.has(lang)) languages[lang] = localeUrl(lang, path);
  }
  languages['x-default'] = localeUrl(i18n.defaultLanguage, path);
  return languages;
}
