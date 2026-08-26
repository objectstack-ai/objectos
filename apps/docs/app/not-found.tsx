import { i18n } from '@/lib/i18n';

/**
 * 404 shell for routes that are not under the `[lang]` segment.
 *
 * The document shell lives in `app/[lang]/layout.tsx` so that the language
 * attribute can be derived from the locale route segment (see the comment in
 * `app/layout.tsx`). That leaves the root layout a pass-through, and this is the
 * one route reaching it that renders HTML rather than a redirect or a route
 * handler — so without a shell here a 404 would carry no root element at all.
 *
 * Two paths land on this file, and neither of them renders the `[lang]` layout:
 *
 * - a path that matches no route (`/no-such-page`), which Next serves from the
 *   root `_not-found` entry;
 * - a first segment that is not an enumerated locale (`/foo.bar/privacy`) or an
 *   unknown docs slug (`/docs/no-such-page`), both of which `dynamicParams =
 *   false` rejects at the routing level and routes to that same entry.
 *
 * This boundary is above the locale segment and cannot read it. The server
 * markup below therefore declares `en` — what `main` has always declared here —
 * and the locale is applied in the browser instead, by the script at the end of
 * the body.
 *
 * ## Why the locale is applied client-side and not server-side
 *
 * The obvious fix is to have `middleware.ts` put the negotiated locale in a
 * request header and read it here through `headers()`. It was built and
 * measured, and it is not viable: this file is the root not-found boundary, so
 * it sits in *every* route's tree, and a dynamic API in it opts the whole app
 * out of static generation. Measured on this tree, with `middleware.ts` left
 * byte-identical to `main` so the reading is attributable to this file alone:
 *
 *   - prerendered HTML documents fall from **577 to 1**;
 *   - `/`, `/[lang]`, `/[lang]/docs/[[...slug]]`, `/[lang]/privacy` and
 *     `/[lang]/terms` all go from prerendered to server-rendered on demand;
 *   - `dynamicParams = false` stops rejecting anything, because there is no
 *     prerendered param set left to reject against. `/foo.bar/privacy` answers
 *     **200** again and `/foo.bar/docs` answers **500** again, undoing #209 and
 *     #180;
 *   - `/docs/no-such-page` and `/zh-Hans/docs/no-such-page` come back as the
 *     594-byte empty error shell, undoing #182 and #192.
 *
 * The comment in `app/layout.tsx` predicted the first of those. The rest was
 * only visible by building it.
 *
 * `app/[lang]/not-found.tsx` is not an alternative either — #182 measured it as
 * a no-op with byte-identical output and an identical route table.
 *
 * ## What the script does, and what it deliberately does not
 *
 * `middleware.ts` already redirects a prefix-less path to the reader's
 * negotiated locale before anything renders, so a non-English reader who
 * follows a stale link is at `/zh-Hans/...` by the time this page is served.
 * The locale is therefore in the URL for every request that has one at all, and
 * reading it from `location.pathname` needs no header and no dynamic render.
 *
 * The page stays `○` prerendered: one document, served byte-identical for every
 * unmatched URL, which is the property #209 measured and pinned.
 *
 * The cost, stated plainly: the document declares `en` at parse time and is
 * corrected once the script runs. That is invisible to indexing (a 404 body is
 * not indexed, and a crawler is told 404 either way) and it never produces an
 * inconsistent document — `lang` and the copy are set together in one
 * synchronous block, so the page is either English-declaring-English or
 * Chinese-declaring-Chinese, never one over the other. With scripting off it
 * stays exactly what `main` serves today.
 *
 * The markup reproduces the Next.js built-in 404. It is not a designed error
 * page and should not grow navigation or search.
 */

/**
 * 404 copy per locale. English is the source; a locale missing from this table
 * keeps English, which is the same fallback Fumadocs applies to an untranslated
 * page. `content/docs/` translations are derived artifacts refreshed by a
 * separate pass (AGENTS.md, "Translation workflow"); this table is UI copy in
 * app code, the shape `app/[lang]/privacy/page.tsx` already uses.
 */
const COPY: Record<string, string> = {
  en: 'This page could not be found.',
  'zh-Hans': '找不到此页面。',
  ja: 'このページは見つかりませんでした。',
  de: 'Diese Seite konnte nicht gefunden werden.',
  es: 'No se ha podido encontrar esta página.',
  fr: 'Cette page est introuvable.',
  ko: '이 페이지를 찾을 수 없습니다.',
};

/**
 * Inlined verbatim into a `script` element, so it must stay free of anything
 * that could close that element early. Every value it embeds is a compile-time
 * constant in this file and in `lib/i18n.ts`; none carries markup.
 *
 * `i18n.languages` is read rather than `Object.keys(COPY)` on purpose: the
 * locale list is the authority for what may appear as a first segment, and a
 * locale that is in the list but not yet in `COPY` must fall through to English
 * rather than be treated as an unknown segment.
 */
const APPLY_LOCALE = `(function(){try{
var copy=${JSON.stringify(COPY)};
var langs=${JSON.stringify(i18n.languages)};
var seg=location.pathname.split('/')[1];
if(langs.indexOf(seg)===-1||!copy[seg])return;
document.documentElement.lang=seg;
document.title='404: '+copy[seg];
var el=document.getElementById('nf-message');
if(el)el.textContent=copy[seg];
}catch(e){}})();`;

export default function NotFound() {
  return (
    <html lang={i18n.defaultLanguage} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <title>404: This page could not be found.</title>
        <div
          style={{
            fontFamily:
              'system-ui,"Segoe UI",Roboto,Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji"',
            height: '100vh',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div>
            <style
              dangerouslySetInnerHTML={{
                __html:
                  'body{color:#000;background:#fff;margin:0}.next-error-h1{border-right:1px solid rgba(0,0,0,.3)}@media (prefers-color-scheme:dark){body{color:#fff;background:#000}.next-error-h1{border-right:1px solid rgba(255,255,255,.3)}}',
              }}
            />
            <h1
              className="next-error-h1"
              style={{
                display: 'inline-block',
                margin: '0 20px 0 0',
                padding: '0 23px 0 0',
                fontSize: 24,
                fontWeight: 500,
                verticalAlign: 'top',
                lineHeight: '49px',
              }}
            >
              404
            </h1>
            <div style={{ display: 'inline-block' }}>
              {/*
                `suppressHydrationWarning` because the script below rewrites this
                text before React hydrates. Without it React treats the rewritten
                text as a mismatch and patches English back in — measured in a
                real browser, which is the only place that difference is visible.
              */}
              <h2
                id="nf-message"
                suppressHydrationWarning
                style={{
                  fontSize: 14,
                  fontWeight: 400,
                  lineHeight: '49px',
                  margin: 0,
                }}
              >
                This page could not be found.
              </h2>
            </div>
          </div>
        </div>
        <script dangerouslySetInnerHTML={{ __html: APPLY_LOCALE }} />
      </body>
    </html>
  );
}
