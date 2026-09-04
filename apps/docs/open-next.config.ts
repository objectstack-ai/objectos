import { defineCloudflareConfig } from '@opennextjs/cloudflare';
import staticAssetsIncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache';

/**
 * ## Why this app needs an incremental cache, and what happens without one
 *
 * Every page this site serves lives under `app/[lang]/`, so every page route is
 * a **dynamic** route as far as Next is concerned, prerendered through
 * `generateStaticParams()` — 1139 paths in the prerender manifest.
 *
 * OpenNext runs Next in *minimal mode*: Next does not read prerendered HTML off
 * a filesystem, it asks the configured incremental cache for it. And
 * `defineCloudflareConfig()` with no arguments resolves `incrementalCache` to
 * `"dummy"`, whose `get()` throws on every call by design. So the lookup for a
 * prerendered page always misses.
 *
 * What happens next depends on one route-segment flag:
 *
 *   - `dynamicParams` unset (Next's default, `true`): the miss falls through to
 *     an on-demand render. Pages are re-rendered on every request, wastefully
 *     but correctly, and the site works.
 *   - `dynamicParams = false`: Next refuses the on-demand render and raises
 *     `NoFallbackError`, which OpenNext answers with the prerendered
 *     `_not-found` route. **The page 404s. Every page, every locale.**
 *
 * `content/docs/` is never re-read at runtime and nothing here revalidates, so
 * the on-demand render was pure waste — but it was load-bearing waste, and
 * nothing recorded that.
 *
 * ## The outage this comment exists to stop repeating
 *
 * `export const dynamicParams = false` was added to `app/[lang]/layout.tsx`,
 * `app/[lang]/docs/[[...slug]]/page.tsx` and `app/og/docs/[...slug]/route.tsx`
 * on 2026-08-26, across five separate PRs about 404 semantics, each correct in
 * itself. The last deploy Cloudflare accepted was 2026-08-25 — the Worker went
 * over the 64 MiB limit that evening and every upload after it was rejected, so
 * the flag sat on `main` for nine days without ever reaching production.
 *
 * On 2026-09-04 the size fix landed (PR #263, `async: true` in
 * `source.config.ts`), the upload was accepted for the first time in nine days,
 * and the site 404'd. `async: true` was blamed, reverted, and is innocent:
 * measured on this tree under real workerd, `main` WITHOUT it fails the
 * repository's own `smoke-docs.mjs` with 21 findings — `/`, `/en/docs`,
 * `/docs/quickstart` and `/docs/build/interface/views` all 404 — and `main`
 * WITH it fails with the same 21. The size fix published a defect that was
 * already merged; it did not introduce one.
 *
 * ## Why the static-assets cache specifically
 *
 * It reads prerendered entries straight out of the Workers static assets this
 * Worker already binds as `ASSETS` (under `cdn-cgi/_next_cache`, a prefix only
 * the Worker can reach). No R2 bucket, no KV namespace, no new binding, no
 * spend — `opennextjs-cloudflare deploy` copies `.open-next/cache` into
 * `.open-next/assets` before uploading, and `preview` does the same locally.
 *
 * Its one documented restriction — read-only, for apps that "do NOT want
 * revalidation and ONLY want to serve prerendered data" — is exactly this app:
 * `revalidate = false` on every route handler, no ISR anywhere, no on-demand
 * revalidation, and content that only changes when the site is rebuilt.
 *
 * ⚠️ If a future page ever needs real revalidation, this override is the wrong
 * one and its `set()` will log an error rather than cache anything. Move to
 * `r2IncrementalCache` then — do not remove this line and go back to no cache
 * at all, because that is the configuration that 404s every page.
 *
 * Measured after this change, under real workerd (`opennextjs-cloudflare
 * preview`): `smoke-docs.mjs` passes all four pages with its negative control
 * still going red. Before it: 21 findings.
 */
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});
