/**
 * The canonical production host. One string, no imports, no dependents of its
 * own — that is the entire contract of this file.
 *
 * ## Why it exists
 *
 * The host used to be written out twice. `SITE_URL` in `lib/seo.ts` builds every
 * canonical tag, `og:url` and hreflang alternate the site renders; `middleware.ts`
 * answers "which host is canonical" for every request before any page code runs.
 * Nothing made the two agree, and nothing failed if they drifted — the redirect
 * would have sent traffic to one host while the whole rendered surface named
 * another, which is the specific failure the surrounding run of cards has been
 * closing.
 *
 * ## Why it must import NOTHING
 *
 * `middleware.ts` runs in the **edge runtime**, and its bundle is whatever its
 * import graph reaches. `lib/seo.ts` imports `lib/source.ts`, so reaching the
 * host through that module pulls the fumadocs loader and every compiled MDX
 * module into the edge bundle. Measured on this tree, one build apart:
 * 149,745 B of edge JavaScript becomes 17,375,914 B — roughly 116x — and
 * `next build` still exits 0, so no gate in CI reports it. This app deploys to
 * Cloudflare Workers, so that cost arrives at deploy time on a change that read
 * like an import cleanup.
 *
 * Both figures are the sum of the JS chunks the middleware entry names in
 * `.next/server/middleware-manifest.json`, which is what actually ships to the
 * edge. The route table `next build` prints reports no size for middleware, so
 * there is nothing to read there instead — which is part of why this is easy to
 * do by accident.
 *
 * This module is therefore a leaf by requirement, not by accident:
 *
 * - Never add an `import` here. Not `@/lib/source`, not `@/lib/i18n`, not
 *   fumadocs, not anything that transitively reaches the MDX collection.
 * - Never add a helper that would want one. `localeUrl`, the hreflang map and
 *   everything else that needs `i18n.languages` belongs in `lib/seo.ts`, which
 *   only the node runtime imports.
 *
 * The bare host is what the edge needs and it is the smaller of the two facts,
 * so it is the one that lives here. The `https://` origin is derived from it in
 * `lib/seo.ts`, the only place that needs that form.
 */
export const SITE_HOST = 'docs.objectos.ai';
