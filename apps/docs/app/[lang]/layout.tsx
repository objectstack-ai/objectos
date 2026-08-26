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
 * The `[lang]` segment is dynamic, so it is not guaranteed to hold one of them.
 * `middleware.ts` normalises every path it sees, but its matcher skips paths
 * containing a dot, so `/foo.bar/privacy` reaches this layout with `lang` set to
 * a string that is not a locale — and that route answers 200, it does not 404.
 * An arbitrary URL segment must not become the document's declared language, so
 * unsupported segments fall back to the default locale, which is the locale
 * `middleware.ts` would have chosen for that request anyway.
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

export const dynamicParams = false;

export async function generateStaticParams() {
  return i18n.languages.map((lang) => ({ lang }));
}
