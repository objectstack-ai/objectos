import { i18n } from '@/lib/i18n';

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
 * hreflang alternates map for a logical path: every supported locale plus an
 * x-default pointing at the English (canonical) URL. Shape matches the
 * `alternates.languages` field of Next.js Metadata and MetadataRoute.Sitemap.
 */
export function languageAlternates(path: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const lang of i18n.languages) {
    languages[lang] = localeUrl(lang, path);
  }
  languages['x-default'] = localeUrl(i18n.defaultLanguage, path);
  return languages;
}
