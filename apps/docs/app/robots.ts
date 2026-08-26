import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

export const revalidate = false;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // `/llms.txt` and `/llms-full.txt` are deliberately crawlable. They exist to be
      // fetched by AI crawlers and answer engines, which is the audience a blanket
      // `User-agent: *` disallow shuts out; and a plain-text endpoint does not compete
      // with the HTML page for a position in a result list the way a duplicate HTML
      // page would. `/api/` stays out: it serves the search index, not readable content.
      disallow: ['/api/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
