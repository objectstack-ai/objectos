import type { ReactNode } from 'react';
import { i18n } from '@/lib/i18n';
import { DocsRootProvider } from './root-provider';

// Language display names mapping
const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  'zh-Hans': '简体中文',
  ja: '日本語',
  de: 'Deutsch',
  es: 'Español',
  fr: 'Français',
  ko: '한국어',
};

/**
 * The value the document declares as its language.
 *
 * The locale codes in `lib/i18n.ts` are already BCP 47 tags, so a supported
 * locale is used verbatim — `zh-Hans` in particular is the correct tag and is
 * deliberately not rewritten to `zh-CN`.
 *
 * `dynamicParams = false` below now means only an enumerated locale ever
 * reaches this layout, so the fallback is unreachable in practice. It stays
 * because this function has to be total over `string` — `lang` is typed as one
 * — and because a language attribute is the wrong place to learn that a
 * routing invariant broke. The default locale is what `middleware.ts` would
 * have negotiated for such a request anyway, so the fallback is the quiet
 * answer rather than a guess.
 */
function documentLanguage(lang: string): string {
  return (i18n.languages as readonly string[]).includes(lang)
    ? lang
    : i18n.defaultLanguage;
}

export default async function LanguageLayout({
  params,
  children,
}: {
  params: Promise<{ lang: string }>;
  children: ReactNode;
}) {
  const { lang } = await params;

  return (
    <html lang={documentLanguage(lang)} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <DocsRootProvider
          locale={lang}
          locales={i18n.languages.map((l) => ({
            name: LANGUAGE_NAMES[l] || l,
            locale: l,
          }))}
        >
          {children}
        </DocsRootProvider>
      </body>
    </html>
  );
}

/**
 * Only the locales `generateStaticParams` enumerates are servable under this
 * segment; every other first segment is answered by the prerendered
 * `/_not-found` route.
 *
 * `middleware.ts` is supposed to put a locale on every path, but its matcher
 * exempts `.*\..*` — unanchored, so it skips any path containing a dot
 * anywhere, not just an asset. A request whose *first* segment carries a dot
 * therefore reaches these routes with `lang` set to something that is not a
 * locale. Measured on the tree before this flag: `/foo.bar/privacy` and
 * `/foo.bar/terms` rendered a full page and answered **200**, `/foo.bar`
 * answered 307 to `/foo.bar/docs`, and `/favicon.ico` answered 307 to
 * `/favicon.ico/docs`. An unbounded family of soft 404s — any dotted first
 * segment produces another one — which for a docs site is a crawl-budget and
 * duplicate-URL hole.
 *
 * The fix is here rather than in that matcher on purpose. The dot exemption is
 * load-bearing for real **routes**, not only assets: `/llms.txt`,
 * `/llms-full.txt`, `/sitemap.xml`, `/robots.txt` and every `.mdx` page route
 * (`page.url` plus `.mdx`, which the copy button links to) all contain dots and
 * are all exempted by it today. Tightening it would send those through locale
 * negotiation, and `check-locale-surface.mjs` reads build output rather than a
 * running server, so nothing in CI would report it. Rejecting the segment here
 * also fixes strictly more, because it does not care how a bad segment arrived.
 *
 * **It has to be this flag and not `notFound()` in the layout.** That was
 * measured, not assumed: with a `notFound()` guard here instead,
 * `/foo.bar/privacy` answers 404 with a 594-byte empty error shell carrying no
 * 404 copy at all, because `notFound()` raised while a request is rendered
 * *dynamically* escapes both the RSC and the SSR render (#182 established this,
 * and these URLs are dynamically rendered by construction — they are in no
 * prerendered param set). The status would have looked correct and the body
 * would have been blank. `dynamicParams = false` instead removes the dynamic
 * render, routing the request to `/_not-found`, an ordinary prerendered page:
 * the served document is byte-identical to the one `/no-such-page` has always
 * returned.
 *
 * The behavioural cost, stated plainly: a locale that is not in `i18n.languages`
 * needs a rebuild to appear. `lib/i18n.ts` is a checked-in constant and AGENTS.md
 * names it the authority for the locale list, so that is already true in
 * practice. `app/[lang]/docs/[[...slug]]/page.tsx` and `app/og/docs/[...slug]`
 * set the same flag for the same reason.
 */
export const dynamicParams = false;

export async function generateStaticParams() {
  return i18n.languages.map((lang) => ({ lang }));
}
