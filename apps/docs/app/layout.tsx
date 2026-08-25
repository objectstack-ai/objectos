import './global.css';
import type { ReactNode } from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  metadataBase: new URL('https://docs.objectos.ai'),
  title: {
    template: '%s | ObjectOS',
    default: 'ObjectOS',
  },
  description: 'Customer-hosted runtime for ObjectStack applications. Private, compliant, yours.',
  icons: {
    icon: '/logo.svg',
  },
};

/**
 * Pass-through root layout — the document shell lives in `app/[lang]/layout.tsx`.
 *
 * The document's language attribute has to be the locale, and the locale only
 * exists as the `[lang]` route segment *below* this file. A layout only ever
 * receives params for its own segment and the ones above it, so this layout
 * cannot see `lang`, and neither of the two ways of reaching around that works
 * here:
 *
 * - `next/root-params` collects params only down to the first layout it meets
 *   walking from the top of the tree (`getRootParamsImpl`). While this file
 *   exists, that first layout is this one, so `lang` is an ordinary route param
 *   and never a root param.
 * - Reading a middleware-set request header via `headers()` would see it, but
 *   `headers()` is a dynamic API: it would opt every docs page out of static
 *   generation to decide one attribute.
 *
 * So the shell moves down to the segment that owns the locale instead. Every
 * user-facing route is nested under `[lang]` (`hideLocale: 'default-locale'`
 * only hides the prefix from the URL — the internal route still carries it, see
 * `middleware.ts`), so each rendered document still has exactly one root
 * element, now declaring the language it is actually written in.
 *
 * This layout stays because the app has root-level entry points that are not
 * under `[lang]` — `app/page.tsx`, plus the metadata and route handlers — and
 * it keeps owning what is genuinely locale-independent: the global stylesheet
 * and the default metadata, both inherited by every route below.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
