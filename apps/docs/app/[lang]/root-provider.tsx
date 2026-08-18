'use client';

import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  useParams,
  usePathname as useRoutePathname,
  useRouter,
} from 'next/navigation';
import { FrameworkProvider, type Framework } from 'fumadocs-core/framework';
import { RootProvider } from 'fumadocs-ui/provider/base';
import { i18n as i18nConfig } from '@/lib/i18n';

/**
 * Map an internal Next.js route pathname onto the public URL path the browser
 * shows for it.
 *
 * Every page is routed under `app/[lang]/…`, but `hideLocale: 'default-locale'`
 * keeps the default locale out of the public URL: `/docs/quickstart` is served
 * by rewriting to the `/en/docs/quickstart` route (see `middleware.ts`). The two
 * renderers therefore observe different pathnames for one page — the build-time
 * prerender knows only the internal route (`/en/docs/quickstart`), the browser
 * knows only the public URL (`/docs/quickstart`).
 *
 * Everything a pathname is compared against — the `url` of every page-tree node,
 * produced by `loader({ i18n })` in `lib/source.ts` — is in the *public* space,
 * so the internal form is the one that has to be normalised away. Feeding the
 * raw route pathname to Fumadocs makes the server look the current page up in
 * the page tree and miss, so it renders no active sidebar item, no expanded
 * folder, no page title in the TOC trigger and no prev/next footer — while the
 * client, at the public URL, renders all four. That divergence is the hydration
 * mismatch behind React #418 on unprefixed routes.
 *
 * Mirrors Fumadocs' own URL rules for `hideLocale` (`loader`'s `getUrl`), so the
 * two stay in agreement: `'never'` keeps every prefix, `'default-locale'` hides
 * only the default language, `'always'` hides every supported one. Only a whole
 * leading segment that is a supported locale is removed, so a page such as
 * `/end-to-end` is left alone.
 */
export function toPublicPathname(pathname: string): string {
  const segments = pathname.split('/');
  const locale = segments[1];
  if (!locale || !(i18nConfig.languages as readonly string[]).includes(locale)) {
    return pathname;
  }

  const hidden =
    i18nConfig.hideLocale === 'always' ||
    (i18nConfig.hideLocale === 'default-locale' &&
      locale === i18nConfig.defaultLanguage);
  if (!hidden) return pathname;

  const rest = segments.slice(2).join('/');
  return rest ? `/${rest}` : '/';
}

function usePublicPathname(): string {
  return toPublicPathname(useRoutePathname());
}

/**
 * `RootProvider` wired to Next.js exactly as `fumadocs-ui/provider/next` does,
 * except that the `usePathname` handed to Fumadocs reports the public URL.
 *
 * `FrameworkProvider` is the single point at which a pathname enters Fumadocs —
 * all of its components read it through `usePathname` from
 * `fumadocs-core/framework` — so normalising it here fixes every consumer at
 * once. This is why the provider is assembled by hand rather than imported from
 * `fumadocs-ui/provider/next`: that entry point wraps `RootProvider` in its own
 * `FrameworkProvider`, which would take precedence over one layered outside it.
 */
export function DocsRootProvider({
  locale,
  locales,
  children,
}: {
  locale: string;
  locales: { name: string; locale: string }[];
  children: ReactNode;
}) {
  return (
    <FrameworkProvider
      usePathname={usePublicPathname}
      useRouter={useRouter}
      useParams={useParams}
      // Next's `Link`/`Image` require `href`/`src`; Fumadocs types the same
      // slots with those props optional. Fumadocs always supplies them, so the
      // gap is in the caller's favour and only the declarations disagree —
      // `fumadocs-ui/provider/next` hands Next's components to these very slots
      // at runtime. The casts state that contract; they do not widen it.
      Link={Link as Framework['Link']}
      Image={Image as Framework['Image']}
    >
      <RootProvider i18n={{ locale, locales }}>{children}</RootProvider>
    </FrameworkProvider>
  );
}
