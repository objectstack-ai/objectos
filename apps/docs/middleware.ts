import { NextRequest, NextResponse } from 'next/server';
import Negotiator from 'negotiator';
import { i18n } from '@/lib/i18n';

const LOCALE_COOKIE = 'FD_LOCALE';

/**
 * The canonical docs host, and the legacy host that redirects to it.
 *
 * `CANONICAL_HOST` holds the same value as `SITE_URL` in `lib/seo.ts`, written
 * out a second time on purpose. This file runs in the **edge runtime**, and
 * `lib/seo.ts` imports `lib/source.ts` — so importing the constant from there
 * would pull the fumadocs loader and all 413 compiled MDX modules into this
 * bundle. Measured on this tree: the edge bundle goes from 149 KB to 14.7 MB of
 * JavaScript, and `next build` still exits 0, so nothing in CI would say so.
 *
 * Two copies of one hostname is the smaller cost, and the copy belongs on this
 * side: this redirect answers "which host is canonical" for every request
 * before any page code runs, and that answer should not depend on the module
 * graph that builds pages. Collapsing the two would take a leaf module both
 * runtimes can import — not an import from `lib/seo.ts`.
 *
 * Nothing enforces that the two agree. That is the residual cost of the
 * decision, stated here so it is visible rather than discovered.
 */
const CANONICAL_HOST = 'docs.objectos.ai';
const LEGACY_HOST = 'www.objectos.app';

/**
 * Supported languages extracted from i18n configuration
 */
const SUPPORTED_LANGUAGES = i18n.languages as readonly string[];

/**
 * Set locale cookie with consistent options
 */
function setLocaleCookie(response: NextResponse, locale: string): void {
  response.cookies.set(LOCALE_COOKIE, locale, {
    sameSite: 'lax',
    path: '/',
  });
}

/**
 * Language code mapping
 * Maps browser language codes to our supported language codes
 */
const LANGUAGE_MAPPING: Record<string, string> = {
  'zh': 'zh-Hans',      // Chinese -> Simplified
  'zh-CN': 'zh-Hans',   // Chinese (China) -> Simplified
  'zh-SG': 'zh-Hans',   // Chinese (Singapore) -> Simplified
  'zh-Hans': 'zh-Hans', // already Simplified
  'zh-Hant': 'zh-Hant', // already Traditional
  'zh-TW': 'zh-Hant',   // Chinese (Taiwan) -> Traditional
  'zh-HK': 'zh-Hant',   // Chinese (Hong Kong) -> Traditional
  'zh-MO': 'zh-Hant',   // Chinese (Macau) -> Traditional
  'ko': 'ko',           // Korean
  'ko-KR': 'ko',        // Korean (Korea) -> Korean
};

/**
 * Legacy locale redirects: old locale code -> current BCP 47 tag.
 * Permanent (308) so search engines transfer ranking to the new path.
 */
const LEGACY_LOCALE_REDIRECTS: Record<string, string> = {
  cn: 'zh-Hans',
};

/**
 * Normalize language code to match our supported languages
 */
function normalizeLanguage(lang: string): string {
  // Check direct mapping first
  if (LANGUAGE_MAPPING[lang]) {
    return LANGUAGE_MAPPING[lang];
  }
  
  // Check if the base language (without region) is mapped
  const baseLang = lang.split('-')[0];
  if (LANGUAGE_MAPPING[baseLang]) {
    return LANGUAGE_MAPPING[baseLang];
  }
  
  return lang;
}

/**
 * Get the preferred language from the request
 */
function getPreferredLanguage(request: NextRequest): string {
  // Check cookie first
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  if (cookieLocale && SUPPORTED_LANGUAGES.includes(cookieLocale)) {
    return cookieLocale;
  }

  // Then check Accept-Language header
  const negotiatorHeaders = Object.fromEntries(request.headers.entries());
  const negotiator = new Negotiator({ headers: negotiatorHeaders });
  const browserLanguages = negotiator.languages();
  
  // Normalize browser languages to match our supported languages
  const normalizedLanguages = browserLanguages.map(normalizeLanguage);
  
  // Find the first match
  for (const lang of normalizedLanguages) {
    if (SUPPORTED_LANGUAGES.includes(lang)) {
      return lang;
    }
  }
  
  return i18n.defaultLanguage;
}

/**
 * Middleware for automatic language detection and redirection
 * 
 * This middleware:
 * - Detects the user's preferred language from browser settings or cookies
 * - Redirects users to the appropriate localized version
 * - For default language (en): keeps URL as "/" (with internal rewrite)
 * - For other languages (e.g. zh-Hans): redirects to "/zh-Hans/"
 * - Redirects legacy locale paths (e.g. /cn/*) to their new tag
 * - Stores language preference as a cookie
 */
export default function middleware(request: NextRequest) {
  // Canonical domain redirect: legacy docs host -> canonical host (permanent).
  const host = request.headers.get('host');
  if (host === LEGACY_HOST) {
    const target = new URL(request.url);
    target.protocol = 'https:';
    target.host = CANONICAL_HOST;
    target.port = '';
    return NextResponse.redirect(target, 308);
  }

  const { pathname } = request.nextUrl;

  // Legacy locale redirect (e.g. /cn/... -> /zh-Hans/...), permanent for SEO.
  const legacySeg = pathname.split('/')[1];
  if (legacySeg && LEGACY_LOCALE_REDIRECTS[legacySeg]) {
    const target = LEGACY_LOCALE_REDIRECTS[legacySeg];
    const url = new URL(request.url);
    url.pathname = pathname.replace(
      new RegExp(`^/${legacySeg}(/|$)`),
      `/${target}$1`,
    );
    const response = NextResponse.redirect(url, 308);
    setLocaleCookie(response, target);
    return response;
  }

  // Check if the pathname already has a locale
  const pathnameHasLocale = i18n.languages.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (pathnameHasLocale) {
    // Extract the locale from the pathname
    const locale = pathname.split('/')[1];
    
    // If it's the default locale and hideLocale is 'default-locale', redirect to remove locale prefix
    if (locale === i18n.defaultLanguage && i18n.hideLocale === 'default-locale') {
      const url = new URL(request.url);
      // Remove locale prefix more precisely to avoid issues with partial matches
      url.pathname = pathname.replace(new RegExp(`^/${i18n.defaultLanguage}(/|$)`), '$1') || '/';
      const response = NextResponse.redirect(url);
      setLocaleCookie(response, locale);
      return response;
    }
    
    return NextResponse.next();
  }

  // Pathname doesn't have a locale, determine preferred language
  const preferredLanguage = getPreferredLanguage(request);

  // If preferred language is the default, rewrite internally (keep URL clean)
  if (preferredLanguage === i18n.defaultLanguage && i18n.hideLocale === 'default-locale') {
    const url = new URL(request.url);
    // Handle root path specially to avoid double slashes
    url.pathname = pathname === '/' ? `/${i18n.defaultLanguage}` : `/${i18n.defaultLanguage}${pathname}`;
    const response = NextResponse.rewrite(url);
    // This is a locale-negotiated response for a prefix-less path (e.g. "/").
    // The underlying page is statically cached with a long s-maxage, but the
    // *result here depends on the visitor's language* — so it must never be
    // stored in a shared cache, or the CDN would serve this (default-locale)
    // HTML to every visitor and non-English browsers would stop being
    // redirected to their localized path. Mark it private so the edge skips it
    // and middleware re-runs language detection on every request.
    response.headers.set('Cache-Control', 'private, no-cache, must-revalidate');
    return response;
  }

  // For non-default languages, redirect to the localized path
  const url = new URL(request.url);
  // Handle root path specially to avoid double slashes
  url.pathname = pathname === '/' ? `/${preferredLanguage}` : `/${preferredLanguage}${pathname}`;
  const response = NextResponse.redirect(url);
  setLocaleCookie(response, preferredLanguage);
  return response;
}

export const config = {
  // Match all routes except:
  // - API routes (/api/*)
  // - Next.js static files (/_next/static/*)
  // - Next.js image optimization (/_next/image/*)
  // - Favicon and other static assets
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
