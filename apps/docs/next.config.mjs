import { createMDX } from 'fumadocs-mdx/next';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

initOpenNextCloudflareForDev();

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  turbopack: {
    resolveAlias: {
      // MDX content lives in ../../content/docs/ (outside the app directory).
      // Turbopack resolves modules starting from the file's directory, so it
      // can't find packages installed under this app's node_modules/.
      // Alias lucide-react so external MDX files can import it.
      'lucide-react': './node_modules/lucide-react',
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'objectstack.ai',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/docs/:path*.mdx',
        destination: '/llms.mdx/docs/:path*',
      },
    ];
  },
};

export default withMDX(config);
