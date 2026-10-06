import { source } from '@/lib/source';
import type { i18n } from '@/lib/i18n';
import { createFromSource } from 'fumadocs-core/search/server';

type Locale = (typeof i18n.languages)[number];

/**
 * A word tokenizer for Chinese, Japanese and Korean, built on `Intl.Segmenter`.
 *
 * Orama, the index behind `createFromSource`, ships tokenizers for about thirty
 * languages, and Chinese, Japanese and Korean are not among them. A locale it
 * does not know fails index creation with `LANGUAGE_NOT_SUPPORTED`, which made
 * `/api/search` answer 500 for `zh-Hans`, `zh-Hant`, `ja` and `ko` (#296). Its
 * English tokenizer is no fallback for these scripts. It splits on every
 * non-Latin character, so a Chinese query tokenizes to nothing and finds
 * nothing.
 *
 * `Intl.Segmenter` does dictionary-based word segmentation for all four. It is
 * built into V8, so it costs no dependency, and it is present in both places
 * this route runs: Node (`next start`) and workerd (the Cloudflare Worker).
 * It is created on first use, not at module load, so Worker startup does not
 * pay for it. fumadocs builds every locale's index on the first search in any
 * locale, so that first search does.
 *
 * Tokens are lowercased and de-duplicated, as Orama's own tokenizer does.
 */
function segmented(locale: Locale) {
  let segmenter: Intl.Segmenter | undefined;
  return {
    tokenizer: {
      language: locale,
      normalizationCache: new Map<string, string>(),
      tokenize(raw: string): string[] {
        segmenter ??= new Intl.Segmenter(locale, { granularity: 'word' });
        const tokens = new Set<string>();
        for (const { segment, isWordLike } of segmenter.segment(raw.toLowerCase())) {
          if (isWordLike) tokens.add(segment);
        }
        return [...tokens];
      },
    },
    // A CJK query segments into several short words. Orama's default
    // threshold (1) returns any page that matches one of them, so 0 requires
    // every word to match. fumadocs already searches with tolerance 0, and it
    // is spelled out here so it stays that way: an edit distance of 1 on a
    // two-character word matches every word that shares one character with it.
    search: { threshold: 0, tolerance: 0 },
  };
}

/**
 * One entry per locale in `lib/i18n.ts`. The `satisfies` makes a missing entry
 * a type error, because a locale without one falls back to a language Orama
 * may not support, and that is how the four 500s above happened.
 * `.github/scripts/check-search-locales.mjs` asks the built route for every
 * locale after each build.
 */
const localeMap = {
  en: 'english',
  de: 'german',
  es: 'spanish',
  fr: 'french',
  'zh-Hans': segmented('zh-Hans'),
  'zh-Hant': segmented('zh-Hant'),
  ja: segmented('ja'),
  ko: segmented('ko'),
} as const satisfies Record<Locale, unknown>;

export const { GET } = createFromSource(source, { localeMap });
