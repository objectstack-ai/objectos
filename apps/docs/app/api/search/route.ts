import { source } from '@/lib/source';
import { i18n } from '@/lib/i18n';
import {
  createSearchAPI,
  type AdvancedIndex,
  type AdvancedOptions,
  type SearchAPI,
} from 'fumadocs-core/search/server';
import { findPath } from 'fumadocs-core/page-tree';

type Locale = (typeof i18n.languages)[number];

/** One hit as Orama hands it to a custom `sortBy`: id, BM25 score, document. */
type Hit = [id: unknown, score: number, document: { type: string }];

/**
 * A word tokenizer for Chinese, Japanese and Korean, built on `Intl.Segmenter`.
 *
 * Orama, the index behind fumadocs search, ships tokenizers for about thirty
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
 * pay for it.
 *
 * Tokens are lowercased and de-duplicated, as Orama's own tokenizer does.
 */
function segmented(locale: Locale): Partial<AdvancedOptions> {
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
 * How much a hit counts for, by what it matched (#301).
 *
 * fumadocs indexes every page as several documents in one `content` field: the
 * page's title (`type: 'page'`), each heading, and each paragraph. Orama ranks
 * them all on that one field by BM25, so a page's title and a heading
 * elsewhere that reads the same scored the same, and the tie went to whichever
 * page was indexed first — an order fumadocs-mdx does not keep stable between
 * builds, so two builds of one tree ranked such ties differently. Measured on
 * `main` @ `601bb37`: "permissions" ranked `/docs/configure/permissions`
 * outside the top eight pages, "air-gapped" ranked Marketplace and Packages
 * above the Air-gapped page, and only 30 of the 79 English pages came first
 * for their own title.
 * With these weights 76 do; the other three share their title with a second
 * page (Approvals, Dashboards, Notifications) and come second to it.
 *
 * A per-property `boost` cannot tell the three apart, because they are one
 * property, so the weight is applied to each hit's score in a custom `sortBy`.
 * Results are grouped by page in score order, so a page whose title matches
 * comes first, and a heading match outranks the same word in passing.
 */
const WEIGHT: Record<string, number> = { page: 4, heading: 2, text: 1 };

function byWeightedScore(a: Hit, b: Hit): number {
  const weighted = ([, score, doc]: Hit) => score * (WEIGHT[doc.type] ?? 1);
  // Orama's own default order, with the weight applied: score descending, then
  // insertion order.
  return weighted(b) - weighted(a) || Number(a[0]) - Number(b[0]);
}

/**
 * One entry per locale in `lib/i18n.ts`. The `satisfies` makes a missing entry
 * a type error, because a locale without one falls back to a language Orama
 * may not support, and that is how the four 500s above happened.
 * `.github/scripts/check-search-locales.mjs` asks the built route for every
 * locale after each build.
 */
const localeOptions = {
  en: { language: 'english' },
  de: { language: 'german' },
  es: { language: 'spanish' },
  fr: { language: 'french' },
  'zh-Hans': segmented('zh-Hans'),
  'zh-Hant': segmented('zh-Hant'),
  ja: segmented('ja'),
  ko: segmented('ko'),
} as const satisfies Record<Locale, Partial<AdvancedOptions>>;

/**
 * The breadcrumbs fumadocs' `createFromSource` gives a page — the tree's name,
 * then each folder above the page — built the same way from the public
 * page-tree API, so the search dialog shows what it showed before.
 */
function breadcrumbs(locale: Locale, url: string): string[] | undefined {
  const tree = source.getPageTree(locale);
  const path = findPath(tree.children, (node) => node.type === 'page' && node.url === url);
  if (!path) return undefined;
  path.pop();
  const names = [tree.name, ...path.map((node) => node.name)];
  return names.filter((name): name is string => typeof name === 'string' && name.length > 0);
}

/** `locale`'s pages, indexed as `createFromSource` indexes them. */
async function indexes(locale: Locale): Promise<AdvancedIndex[]> {
  return Promise.all(
    source.getPages(locale).map(async (page) => ({
      id: page.url,
      url: page.url,
      title: page.data.title,
      description: page.data.description,
      structuredData: (await page.data.load()).structuredData,
      breadcrumbs: breadcrumbs(locale, page.url),
    })),
  );
}

/**
 * One index per locale, built on that locale's first search (#301).
 *
 * `createFromSource` with i18n builds every locale's index on the first search
 * in any locale, so the first reader after a cold start paid for all eight:
 * loading the compiled body of all 79 pages eight times over and segmenting
 * four CJK corpora. Building only the requested locale makes the first search
 * pay for one. Measured on one box, `main` @ `601bb37` against this change,
 * first search after boot: 8.7–10.1 s → 0.6–1.4 s under `next start`, and
 * 4.7–5.1 s → 0.8–1.0 s under workerd (`opennextjs-cloudflare preview`). The
 * first search in each further locale costs that locale's build, 0.5–2.2 s;
 * a warm one, 23–222 ms either way. The results are identical: with the
 * weights above set to 1, every locale and query compared byte for byte
 * against `createFromSource` in one process.
 *
 * Built in the request, not at build time, on purpose. fumadocs' build-time
 * export (`staticGET`) is a client-side search: it ships every locale's index
 * to the browser and moves the query out of this route, so `/api/search`
 * would stop answering queries — the contract `check-search-locales.mjs` and
 * the post-deploy smoke test both call — and the CJK tokenizer above would
 * have to be rebuilt in the browser bundle.
 */
const servers = new Map<Locale, SearchAPI>();

function server(locale: Locale): SearchAPI {
  let found = servers.get(locale);
  if (!found) {
    const options: Partial<AdvancedOptions> = localeOptions[locale];
    found = createSearchAPI('advanced', {
      ...options,
      search: { ...options.search, sortBy: byWeightedScore },
      indexes: () => indexes(locale),
    });
    servers.set(locale, found);
  }
  return found;
}

function isLocale(value: string): value is Locale {
  return (i18n.languages as readonly string[]).includes(value);
}

/**
 * The same contract as fumadocs' i18n search endpoint: `?query=` and
 * `?locale=`, the default language when no locale is given, and an empty
 * list for an empty query or a locale this site does not have.
 */
export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const locale = params.get('locale') ?? i18n.defaultLanguage;
  if (!params.get('query') || !isLocale(locale)) return Response.json([]);
  return server(locale).GET(request);
}
