import { NextRequest, NextResponse } from 'next/server';
import Negotiator from 'negotiator';
import { i18n } from '@/lib/i18n';
import { SITE_HOST } from '@/lib/site';

const LOCALE_COOKIE = 'FD_LOCALE';

/**
 * The legacy docs host, which redirects permanently to the canonical one.
 *
 * The canonical host is `SITE_HOST`, imported above from `lib/site.ts` — the
 * same constant `lib/seo.ts` builds `SITE_URL` on. The redirect target and every
 * canonical tag, `og:url` and hreflang alternate the site renders are therefore
 * one definition, where they used to be two literals with nothing enforcing that
 * they agreed. Drift would have pointed this redirect at one host while the
 * whole rendered surface named another.
 *
 * Import the host from `@/lib/site` and never from `@/lib/seo`. This file runs
 * in the **edge runtime**, and its bundle is whatever its import graph reaches:
 * `lib/seo.ts` imports `lib/source.ts`, so reaching the host through it pulls
 * the fumadocs loader and every compiled MDX module in here. Measured on this
 * tree, one build apart: 149,745 B of edge JavaScript becomes 17,375,914 B,
 * roughly 116x, and `next build` exits 0 either way — so nothing in CI reports
 * it and the cost lands at deploy time on Cloudflare Workers. `lib/site.ts`
 * exists to be the one import that cannot do that; it imports nothing, and the
 * comment at the top of it is what keeps it that way.
 */
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
 * The locales this site publishes, keyed by their case-folded spelling.
 *
 * The value is always the string `i18n.languages` itself holds. This map is
 * the one place a folded spelling is turned back into a canonical one, and it
 * is what makes both the header side and the path side below case-insensitive
 * without either of them inventing a locale.
 */
const PUBLISHED_BY_FOLDED_LOCALE: ReadonlyMap<string, string> = new Map(
  SUPPORTED_LANGUAGES.map((locale) => [locale.toLowerCase(), locale]),
);

/**
 * Every browser tag we answer to, case-folded, mapped to the canonical locale.
 *
 * BCP 47 tags are case-insensitive — RFC 5646 section 2.1.1: "the tags and
 * their subtags ... are not case sensitive". The casing the spec recommends
 * (lowercase language, Titlecase script, UPPERCASE region) is a writing
 * convention, not a constraint on the wire. Both tables above are written in
 * that convention, so before this index existed, matching them with plain
 * string equality meant a client spelling its tags differently missed rows
 * that name it exactly (#220).
 *
 * Measured on the pre-fix tree, one tag, no q-list, `GET /docs/quickstart`:
 * `zh-tw`, `zh-hk`, `zh-mo`, `zh-hant` and `zh-hant-tw` all negotiated to
 * Simplified, because the Chinese keys are the only ones carrying a script or
 * region subtag. Those are the rows #220 was filed for.
 *
 * The same run showed the defect is wider than the card's picture of it: it
 * is the LOWERCASE direction that is Chinese-only. `DE-AT`, `JA-jp`, `KO-kr`
 * and `ZH-TW` all fell through to English, because a bare `de` is lowercase
 * by convention too — any other casing missed every locale, not just the
 * Chinese ones. Folding the key closes the whole space at once.
 *
 * ## The KEY is folded. The value never is.
 *
 * The payload is the canonical string taken from `i18n.languages`, never the
 * folded key and never the caller's spelling. A folded value would build a
 * redirect to `/zh-hant/...`, which this site does not publish: it 404s, that
 * 404 re-enters negotiation, and a wrong-script page becomes a loop.
 *
 * ## The membership check is still the only exit
 *
 * #217 made a single check against `i18n.languages` the one door out of
 * `resolveSupportedLanguage`, so that neither truncation nor a table row
 * outliving its locale could return something unpublished. That check is not
 * removed here, it is moved to where this index is built and paid once: a
 * supported locale enters as itself, and a `LANGUAGE_MAPPING` row enters only
 * if its target resolves through the published map. Every value in this index
 * is therefore a member of `i18n.languages` by construction — the same
 * invariant, established at module load instead of re-checked per lookup.
 *
 * Insertion order carries ordering decision 2 of `resolveSupportedLanguage`:
 * the ruled rows are written last, so where a tag is both published and ruled
 * the ruling wins. No such tag exists today — `zh`, `zh-TW`, `zh-HK` and
 * `zh-MO` are none of them published locales — and the order is fixed here so
 * that adding one cannot silently reverse the rule.
 *
 * Folded keys collide only if `i18n.languages` publishes one locale under two
 * spellings, which would be a defect in that file: two BCP 47 tags differing
 * only in case are the same tag.
 */
const CANONICAL_BY_FOLDED_TAG: ReadonlyMap<string, string> = (() => {
  const index = new Map(PUBLISHED_BY_FOLDED_LOCALE);

  for (const [tag, target] of Object.entries(LANGUAGE_MAPPING)) {
    const published = PUBLISHED_BY_FOLDED_LOCALE.get(target.toLowerCase());
    if (published) index.set(tag.toLowerCase(), published);
  }

  return index;
})();

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
 *    Both tables are merged into one folded index, and that merge carries
 *    this ordering: the ruled rows are written last, so a ruling still wins.
 *
 * Tags are matched case-insensitively (#220). The walk folds each candidate
 * and takes a single look at `CANONICAL_BY_FOLDED_TAG` — see there for why
 * the KEY is folded and the returned value never is.
 *
 * That lookup is the only exit from this function, and every value in the
 * index is a member of `i18n.languages` by construction, so neither mechanism
 * can hand back a locale the site does not publish. Truncation manufactures
 * strings out of whatever the client sent (`xx`, `tlh`), and a table row
 * outliving the locale it names would do the same; either would otherwise
 * produce a redirect to a path that 404s.
 */
function resolveSupportedLanguage(tag: string): string | undefined {
  const subtags = tag.split('-');

  for (let length = subtags.length; length > 0; length -= 1) {
    const candidate = subtags.slice(0, length).join('-');

    const canonical = CANONICAL_BY_FOLDED_TAG.get(candidate.toLowerCase());
    if (canonical) return canonical;
  }

  return undefined;
}

/**
 * Get the preferred language from the request
 */
function getPreferredLanguage(request: NextRequest): string {
  // Check cookie first. Deliberately NOT case-folded: this cookie is written
  // by this file and nowhere else, always in canonical form, so folding it
  // would widen only what a hand-set cookie can say — no real client is
  // helped. The fold belongs where strings arrive from outside: the
  // Accept-Language header below, and the URL path in `middleware`.
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
    target.host = SITE_HOST;
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

  // Does the pathname already carry a locale?
  //
  // Matched case-insensitively, and a non-canonical spelling is redirected to
  // the canonical one. #220 asked for this to be settled either way rather
  // than left to fall out of the matcher, so the reasoning is recorded here.
  //
  // Both answers are defensible on their face. URL path segments ARE
  // case-sensitive (RFC 3986 section 6.2.2.1), so reading `/zh-hant/...` as a
  // different resource is legitimate, and an extra redirect hop is a real
  // cost. What decided it is what the file actually did, measured rather than
  // reasoned about. On the pre-fix tree:
  //
  //   GET /zh-hant/docs/quickstart                            404
  //   GET /zh-hant/docs/quickstart  (Accept-Language: zh-Hant)
  //       307 to /zh-Hant/zh-hant/docs/quickstart, which 404s
  //
  // The second row is the one that settles it. A lowercase locale path did not
  // fail as an unknown URL — it fell through to negotiation, which prepended a
  // locale to a path that already named one and produced a URL nobody could
  // have meant. That is the header-side defect's own shape: a wrong answer
  // rather than an absent one, arrived at by accident. And it is reachable the
  // same way, by a proxy that lowercases what it forwards.
  //
  // So the segment is folded, and a non-canonical spelling gets a 308 to the
  // spelling this site publishes. `/zh-Hant/...` still costs zero hops; only a
  // URL that is broken today pays anything. 308 rather than 307 for the same
  // reason as the legacy `/cn/` rows above: it is permanent, and it collapses
  // the aliases onto one indexable URL.
  //
  // Three things this deliberately does NOT do:
  //
  //   - It matches published locales only, never `LANGUAGE_MAPPING`. That
  //     table rules on what a browser TAG means; it is not a list of URL
  //     aliases. `/zh-TW/docs` stays a 404 rather than becoming a second name
  //     for `/zh-Hant/docs` — publishing one page under two URLs is an SEO
  //     problem this file has no mandate to create.
  //   - It does not set the locale cookie. A locale-bearing path does not set
  //     one today (this branch ends in `next()`); the hop is URL
  //     normalisation, not negotiation, and `/zh-hant/x` should not carry a
  //     side effect that `/zh-Hant/x` does not.
  //   - It cannot loop. The target segment comes from `i18n.languages`, so the
  //     redirected request matches canonically and falls straight through.
  //
  // `/EN/docs` therefore takes two hops — 308 to `/en/docs`, then the
  // default-locale strip below. Same shape as the pre-existing two-hop `/cn/`
  // case; each rule stays responsible for one thing.
  const localeSegment = pathname.split('/')[1];
  const pathLocale = localeSegment
    ? PUBLISHED_BY_FOLDED_LOCALE.get(localeSegment.toLowerCase())
    : undefined;

  if (pathLocale) {
    // Non-canonical casing: normalise the spelling first, permanently.
    if (localeSegment !== pathLocale) {
      const url = new URL(request.url);
      url.pathname = `/${pathLocale}${pathname.slice(localeSegment.length + 1)}`;
      return NextResponse.redirect(url, 308);
    }

    // If it's the default locale and hideLocale is 'default-locale', redirect to remove locale prefix
    if (pathLocale === i18n.defaultLanguage && i18n.hideLocale === 'default-locale') {
      const url = new URL(request.url);
      // Remove locale prefix more precisely to avoid issues with partial matches
      url.pathname = pathname.replace(new RegExp(`^/${i18n.defaultLanguage}(/|$)`), '$1') || '/';
      const response = NextResponse.redirect(url);
      setLocaleCookie(response, pathLocale);
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
