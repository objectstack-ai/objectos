import { defineConfig, defineDocs } from 'fumadocs-mdx/config';
import { metaSchema, pageSchema } from 'fumadocs-core/source/schema';
import path from 'node:path';

export const docs = defineDocs({
  dir: path.resolve(process.cwd(), '../../content/docs'),
  docs: {
    schema: pageSchema.extend({
      /**
       * Optional SEO title: what the `<title>` tag should say, when that is not
       * what the H1 and the sidebar should say.
       *
       * `title` stays the short navigational noun ("Views") because it is what
       * renders in the sidebar, the breadcrumb and the H1. That same noun makes
       * a title tag carrying no query term at all, so a page may declare a
       * longer, keyword-bearing `seoTitle` here and `generateMetadata` prefers
       * it. Declaring nothing is the norm: the fallback is `title`, so a page
       * that says nothing renders exactly what it rendered before.
       *
       * Extending is not optional bookkeeping — the base `pageSchema` is a Zod
       * object with the default "strip" behaviour, so a `seoTitle:` in
       * frontmatter that is not declared here is silently dropped at parse time
       * rather than reaching `page.data`.
       *
       * Built from `pageSchema.shape.title` rather than a fresh `z.string()`
       * because `zod` is a *peer* dependency of fumadocs-core and is not
       * resolvable from this workspace — `require.resolve('zod')` fails in
       * `apps/docs`. Reusing the shape keeps the field's type identical to
       * `title`'s without adding a dependency to declare it.
       *
       * `.trim().min(1)` is deliberate: an empty or whitespace-only `seoTitle`
       * is an authoring mistake, and rejecting it at build time is what lets
       * the consumer use a plain `??` fallback instead of a tolerant one that
       * would quietly paper over the empty string.
       */
      seoTitle: pageSchema.shape.title.trim().min(1).optional(),
    }),
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    schema: metaSchema,
  },
});

export default defineConfig({
  mdxOptions: {
    // MDX options
  },
});
