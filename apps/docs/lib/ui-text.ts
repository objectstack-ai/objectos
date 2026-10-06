import type { Translations } from 'fumadocs-ui/i18n';
import { i18n } from '@/lib/i18n';
import de from './ui-text/de.json';
import es from './ui-text/es.json';
import fr from './ui-text/fr.json';
import ja from './ui-text/ja.json';
import ko from './ui-text/ko.json';
import zhHans from './ui-text/zh-Hans.json';
import zhHant from './ui-text/zh-Hant.json';

/**
 * The docs site's interface copy — the chrome around a page, never the page.
 *
 * Two kinds of string live here. The first ten keys are Fumadocs' own
 * `Translations` (the search box, "On this page", "Choose a language", the
 * previous/next footer, …); `fumadocsTranslations()` hands exactly those to
 * `RootProvider`, which is the only channel Fumadocs reads them through. The
 * rest are this app's own controls and notices, read by the docs page.
 *
 * English is the source, written here and nowhere else (AGENTS.md rule 1). The
 * Fumadocs values are its built-in defaults verbatim, so the English site
 * renders byte-identically to before this table existed.
 *
 * The locale tables are UI copy in app code — the shape `app/not-found.tsx`
 * and `app/[lang]/privacy/page.tsx` already use — not `content/docs/`
 * translations, which the separate pass in `docs/TRANSLATION.md` produces. They
 * are JSON rather than TypeScript for one reason: `ui-text/zh-Hant.json` is
 * GENERATED from `ui-text/zh-Hans.json` by `scripts/gen-zh-hant.mjs` (OpenCC
 * `s2twp`, the converter and preset that produce every `*.zh-Hant.mdx` and
 * `meta.zh-Hant.json`), and that generator converts a data file. Never edit the
 * Traditional file by hand; CI runs `gen-zh-hant --check` and fails on any byte
 * of drift.
 */
const en = {
  search: 'Search',
  searchNoResult: 'No results found',
  toc: 'On this page',
  tocNoHeadings: 'No Headings',
  lastUpdate: 'Last updated on',
  chooseLanguage: 'Choose a language',
  nextPage: 'Next Page',
  previousPage: 'Previous Page',
  chooseTheme: 'Theme',
  editOnGithub: 'Edit on GitHub',

  copyMarkdown: 'Copy Markdown',
  openMenu: 'Open',
  openInGitHub: 'Open in GitHub',
  openInChatGPT: 'Open in ChatGPT',
  openInClaude: 'Open in Claude',
  /**
   * The notice on a locale URL whose page has no source file in that locale,
   * so the body below it is the English page. Never rendered in English — an
   * English page is never a fallback — but it is the source every locale's
   * string is translated from, so it is kept.
   */
  notTranslated: 'This page is not yet translated; showing English.',
} satisfies Translations & Record<string, string>;

export type UiText = Record<keyof typeof en, string>;

/**
 * Fumadocs' `Translations`, restated as a type alias. Same keys, same values;
 * the difference is that an alias satisfies the index signature of the
 * provider's `translations` prop (`TranslationsOption`) and an interface
 * cannot, so the interface would not type-check at the one place it is used.
 */
export type FumadocsTranslations = { [K in keyof Translations]: Translations[K] };

type Locale = (typeof i18n.languages)[number];

/**
 * A locale table, held to EXACTLY the English key set.
 *
 * A JSON import is not a fresh object literal, so assigning one to `UiText`
 * catches a missing key but lets an extra one through. The second half of the
 * parameter type closes that: any key English does not have must be `never`,
 * which a JSON string value is not, so a stale or misspelled key is a type
 * error instead of dead weight nobody reads.
 */
function table<T extends UiText>(text: T & Record<Exclude<keyof T, keyof UiText>, never>): UiText {
  return text;
}

/**
 * Every locale `lib/i18n.ts` declares, and no other: keyed by its literal
 * union, so a locale added there without a table here fails `tsc` rather than
 * rendering English chrome.
 */
const TEXT: Record<Locale, UiText> = {
  en,
  'zh-Hans': table(zhHans),
  'zh-Hant': table(zhHant),
  ja: table(ja),
  de: table(de),
  es: table(es),
  fr: table(fr),
  ko: table(ko),
};

function isLocale(lang: string): lang is Locale {
  return (i18n.languages as readonly string[]).includes(lang);
}

/**
 * The interface copy for a route locale.
 *
 * Total over `string` for the same reason `documentLanguage` in
 * `app/[lang]/layout.tsx` is: `dynamicParams = false` means only an enumerated
 * locale reaches a caller, and the default-language branch is the quiet answer
 * for a routing invariant that broke, not a fallback anything relies on.
 */
export function uiText(lang: string): UiText {
  return TEXT[isLocale(lang) ? lang : i18n.defaultLanguage];
}

/**
 * Exactly the strings Fumadocs reads, for `RootProvider`'s `i18n.translations`.
 *
 * Picked rather than spread: the provider merges whatever it is given into the
 * context every Fumadocs component reads, and this app's own keys have no
 * business there. It also keeps the serialized client prop to ten strings.
 */
export function fumadocsTranslations(text: UiText): FumadocsTranslations {
  return {
    search: text.search,
    searchNoResult: text.searchNoResult,
    toc: text.toc,
    tocNoHeadings: text.tocNoHeadings,
    lastUpdate: text.lastUpdate,
    chooseLanguage: text.chooseLanguage,
    nextPage: text.nextPage,
    previousPage: text.previousPage,
    chooseTheme: text.chooseTheme,
    editOnGithub: text.editOnGithub,
  };
}
