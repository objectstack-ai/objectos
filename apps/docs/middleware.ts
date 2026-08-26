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
 * Tags whose correct locale is NOT the one BCP 47 truncation would reach.
 *
 * This is an exceptions list, not a catalogue of browser tags. Truncation
 * (see `resolveSupportedLanguage`) already resolves every tag whose answer is
 * its own base language: `de-AT` reaches `de`, `ja-JP` reaches `ja`, `ko-KR`
 * reaches `ko`, `zh-Hans-CN` reaches `zh-Hans`. Rows for those are not
 * shorthand, they are noise — and they teach the next reader that region tags
 * belong in this table, which is how `de-AT`, `fr-CA`, `es-MX` and `ja-JP`
 * came to negotiate to English while four translated locales sat unused.
 * Enumerating them is a set with no end (#217).
 *
 * What is left is the one decision truncation cannot make, because the
 * information is not in the tag:
 *
 *   - `zh` on its own is not a supported tag at all, and the house answer for
 *     unqualified Chinese is Simplified.
 *   - `zh-TW` / `zh-HK` / `zh-MO` name a region that implies the Traditional
 *     script. Truncation would drop the region, reach `zh`, and hand back
 *     Simplified — a wrong answer rather than an absent one.
 *
 * Add a row here only when the mechanical answer is WRONG. If it is merely
 * missing, the fix belongs in `i18n.languages`, not here.
 */
const LANGUAGE_MAPPING: Record<string, string> = {
  'zh': 'zh-Hans',    // unqualified Chinese -> Simplified (house default)
  'zh-TW': 'zh-Hant', // Taiwan    -> Traditional
  'zh-HK': 'zh-Hant', // Hong Kong -> Traditional
  'zh-MO': 'zh-Hant', // Macau     -> Traditional
};

/**
 * Legacy locale redirects: old locale code -> current BCP 47 tag.
 * Permanent (308) so search engines transfer ranking to the new path.
 */
const LEGACY_LOCALE_REDIRECTS: Record<string, string> = {
  cn: 'zh-Hans',
};

/**
 * Resolve one browser language tag to a supported locale, or `undefined` when
 * the tag names nothing we publish.
 *
 * BCP 47 truncation, as RFC 4647 section 3.4 defines lookup: try the whole
 * tag, drop the last subtag, repeat — `zh-Hant-TW`, then `zh-Hant`, then `zh`.
 *
 * The function this replaced took two shots only: the exact tag, and the
 * substring before the first hyphen. Since `LANGUAGE_MAPPING` held nothing but
 * Chinese and Korean, `de-AT`, `fr-CA`, `es-MX` and `ja-JP` missed both and
 * fell through to English — four locales we translate, unreachable. And
 * `zh-Hant-TW`, whose MIDDLE subtag names the script, skipped straight past
 * `zh-Hant` to `zh` and landed on Simplified. Most browsers send
 * `de-AT,de;q=0.9`, and the bare `de` in the second list entry rescued them,
 * which is why this survived unnoticed (#217).
 *
 * Two orderings decide every answer here, and both are settled on purpose
 * rather than by accident:
 *
 * 1. **Most specific first.** The walk runs long to short, so `zh-Hant-TW`
 *    reaches `zh-Hant` before it can reach `zh`. Short to long would answer
 *    Simplified for every Traditional tag that carries a region.
 *
 * 2. **The table beats truncation, at every step of the walk.**
 *    `LANGUAGE_MAPPING` is a ruling about what a tag MEANS; truncation is the
 *    mechanical default for tags nobody has ruled on. Where the two disagree
 *    the ruling wins — that is what keeps `zh-TW` on Traditional instead of
 *    the Simplified that dropping `TW` would reach. Consulting the table at
 *    every step, not only on the full tag, is also what lets a longer tag
 *    built on a ruled one (`zh-TW-x-anything`) still land on Traditional.
 *
 * Both paths leave through the same check against `i18n.languages`, and that
 * check is the only exit from this function. Neither mechanism can hand back a
 * locale the site does not publish: truncation manufactures strings from
 * whatever the client sent (`xx`, `tlh`), and a table row outliving the locale
 * it names would do the same. Either one would otherwise produce a redirect to
 * a path that 404s.
 *
 * Matching is case-sensitive, so a client that lowercases its tags still
 * misses the Chinese rows (`zh-tw` reaches Simplified). Pre-existing, out of
 * scope here, tracked separately.
 */
function resolveSupportedLanguage(tag: string): string | undefined {
  const subtags = tag.split('-');

  for (let length = subtags.length; length > 0; length -= 1) {
    const candidate = subtags.slice(0, length).join('-');

    const ruled = LANGUAGE_MAPPING[candidate];
    if (ruled && SUPPORTED_LANGUAGES.includes(ruled)) return ruled;

    if (SUPPORTED_LANGUAGES.includes(candidate)) return candidate;
  }

  return undefined;
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

  // Then the Accept-Language header, in the browser's own order of preference.
  // The first tag that resolves to a supported locale wins; a tag that
  // resolves to nothing is skipped rather than ending the search, so
  // `xx-YY,de` still reaches German.
  const negotiatorHeaders = Object.fromEntries(request.headers.entries());
  const negotiator = new Negotiator({ headers: negotiatorHeaders });

  for (const tag of negotiator.languages()) {
    const supported = resolveSupportedLanguage(tag);
    if (supported) return supported;
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
