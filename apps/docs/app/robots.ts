import type { MetadataRoute } from 'next';

const BASE = 'https://docs.objectos.ai';

export const revalidate = false;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Generated text endpoints duplicate page content; keep them out of the index.
      disallow: ['/api/', '/llms.txt', '/llms-full.txt'],
    },
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
