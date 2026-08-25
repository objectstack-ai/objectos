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

export function getPageImage(page: InferPageType<typeof source>) {
  const segments = [...page.slugs, 'image.png'];

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
