import { SITE_NAME, getPageImage, source } from '@/lib/source';
import { i18n } from '@/lib/i18n';
import { translatedLocales } from '@/lib/seo';
import { notFound } from 'next/navigation';
import { ImageResponse } from 'next/og';
import { generate as DefaultImage } from 'fumadocs-ui/og';

export const revalidate = false;

/**
 * Only the cards `generateStaticParams` enumerates are servable.
 *
 * Without this the route stays willing to render any locale for any page on
 * demand, so `/og/docs/ja/operate/backup/image.png` — a page with no Japanese
 * translation — would render the English fallback text under a `ja` URL, which
 * is the exact incoherence this route is being fixed to stop asserting. The
 * prerendered set is not merely the cards we bothered to build ahead of time;
 * it is the set of cards that exist.
 *
 * Safe because both sides of the contract derive their locale the same way. A
 * page's metadata asks for the card at its `contentLang`, and `contentLang` is
 * a member of `translatedLocales(slugs)` by construction — `canonicalLocale`
 * returns either a locale already in that list or the default language, which
 * the list always contains for a page that has an English source. So no card
 * URL this site emits can fall outside the enumeration below.
 */
export const dynamicParams = false;

/** Locale tags, as the narrow union `i18n.languages` is actually typed with. */
type Locale = (typeof i18n.languages)[number];

/**
 * Whether a raw first path segment names a supported locale.
 *
 * A predicate rather than a bare `.includes` so the check also narrows: past
 * it, `lang` is a `Locale` and the loader is being handed a language it has
 * declared, not an arbitrary string that happened to arrive in a URL.
 */
function isLocale(value: string): value is Locale {
  return (i18n.languages as readonly string[]).includes(value);
}

/** A character that renders about twice as wide as a Latin one: Han, kana, Hangul, CJK punctuation, full-width forms. */
const WIDE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}　-〿＀-￯]/u;

/** Width units the card's 82px title fits on one line, and its 52px description on one line. */
const TITLE_LINE = 26;
const DESCRIPTION_LINE = 40;

function widthOf(text: string): number {
  let units = 0;
  for (const char of text) units += WIDE.test(char) ? 2 : 1;
  return units;
}

/**
 * The description as the card can show it: whole when it fits, otherwise cut at
 * the last word boundary inside the budget, with an ellipsis (#299).
 *
 * `fumadocs-ui/og` puts the title, the description and the brand line in a
 * fixed 1200x630 flex column and does not clip any of them. Text that does not
 * fit is drawn on top of the next element. A 511-character index description
 * covered the divider and the brand line, and a 186-character one went over a
 * two-line title.
 *
 * The budget is in width units, so a CJK card is cut at the same width as an
 * English one rather than at the same character count. It is three description
 * lines, about 120 Latin characters, under a one-line title, and one line fewer
 * for each extra line the title takes. Scripts without spaces have no word
 * boundary to find, so they are cut between characters, which is where they
 * wrap anyway.
 */
function clampDescription(description: string | undefined, title: string): string | undefined {
  if (!description) return description;
  const lines = Math.max(1, 4 - Math.ceil(widthOf(title) / TITLE_LINE));
  const budget = lines * DESCRIPTION_LINE;
  if (widthOf(description) <= budget) return description;

  let head = '';
  let units = 1; // the ellipsis
  for (const char of description) {
    units += WIDE.test(char) ? 2 : 1;
    if (units > budget) break;
    head += char;
  }
  const space = head.lastIndexOf(' ');
  if (space > head.length / 2) head = head.slice(0, space);
  return `${head.replace(/[\s,.;:–—\-、。，：；]+$/u, '')}…`;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  // `[lang, ...page slugs, 'image.png']` — the shape `getPageImage` builds.
  const [lang, ...rest] = slug;
  if (!isLocale(lang)) notFound();

  // The language argument whose absence was the defect: without it the loader
  // resolves the default-language page and every locale's card renders the
  // English title and description.
  const page = source.getPage(rest.slice(0, -1), lang);
  if (!page) notFound();

  return new ImageResponse(
    <DefaultImage
      title={page.data.title}
      description={clampDescription(page.data.description, page.data.title)}
      site={SITE_NAME}
    />,
    {
      width: 1200,
      height: 630,
    },
  );
}

/**
 * One card per (page, locale that really translates it).
 *
 * Enumerated from the English page set because English is the authored source
 * — `getPages()` with no argument returns all seven locales' page sets
 * concatenated, and `getPages(lang)` cannot tell a real translation from a
 * fallback copy, so neither answers "which pages exist". `translatedLocales`
 * is the function that can, and using it is what keeps a page that exists only
 * in English at exactly one card instead of seven.
 */
export function generateStaticParams() {
  return source.getPages(i18n.defaultLanguage).flatMap((page) =>
    translatedLocales(page.slugs).map((lang) => ({
      slug: getPageImage(page, lang).segments,
    })),
  );
}
