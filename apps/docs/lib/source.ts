import { docs } from 'fumadocs-mdx:collections/server';
import { type InferPageType, loader } from 'fumadocs-core/source';
import { lucideIconsPlugin } from 'fumadocs-core/source/lucide-icons';
import { i18n } from '@/lib/i18n';

export const source = loader({
  baseUrl: '/docs',
  i18n,
  source: docs.toFumadocsSource(),
  plugins: [lucideIconsPlugin()],
});

/**
 * The product name, as it should appear to a reader — in `og:site_name`, on the
 * generated share card, anywhere the brand is spelled out.
 *
 * It is a constant rather than a literal at each use site because the two use
 * sites had already drifted: the share-card generator was passing "ObjectStack
 * Protocol", a different product, while the metadata said "ObjectOS". One
 * exported string is what stops the next consumer from inventing a fourth
 * spelling. It lives here, next to `getPageImage`, because `lib/seo.ts` — the
 * other plausible home — imports this module, and putting it there would make
 * the dependency circular.
 */
export const SITE_NAME = 'ObjectOS';

/**
 * The generated share card for `page`, as seen from `lang`.
 *
 * The locale is a path segment because the card is a rendered artifact of the
 * page's text, not a decoration attached to it: a Japanese page and its English
 * source produce two different 1200x630 images, so they need two URLs. Building
 * the segments from `page.slugs` alone gave all seven locales one URL, and
 * whichever card was generated first was the one every locale served.
 *
 * `lang` is spelled out for every locale, English included, rather than hidden
 * the way `localeUrl` hides the default language from reader-facing URLs. Two
 * reasons, both about the route rather than the reader: `hideLocale` exists so
 * `/docs/x` reads as the plain English URL, and nothing reads an image asset
 * path; and an omitted `en` would make the first segment ambiguous — the route
 * handler would have to guess whether `/og/docs/es/...` means the Spanish card
 * for `…/…` or the English card for a page slugged `es`. That guess is wrong
 * the day someone adds `content/docs/es.mdx`, and it fails silently.
 *
 * `lang` is required rather than optional-with-a-default for the same reason
 * `languageAlternates` requires its `locales`: the defect being fixed here is a
 * call site that did not pass a language, and a default value is exactly what
 * lets the next call site reproduce it without anyone noticing. Required makes
 * `tsc` the thing that notices.
 */
export function getPageImage(page: InferPageType<typeof source>, lang: string) {
  const segments = [lang, ...page.slugs, 'image.png'];

  return {
    segments,
    url: `/og/docs/${segments.join('/')}`,
  };
}

export async function getLLMText(page: InferPageType<typeof source>) {
  const processed = await page.data.getText('processed');

  return `# ${page.data.title}

${processed}`;
}
