import { flattenTree } from 'fumadocs-core/page-tree';
import { i18n } from '@/lib/i18n';
import { SITE_URL } from '@/lib/seo';
import { getLLMText, source } from '@/lib/source';

export const revalidate = false;

/**
 * English only, by `AGENTS.md` rule 1 — English is the single source of truth
 * and every `*.<locale>.mdx` is a derived artifact. This is the same pin
 * `llms.txt` carries, for the same reason: `source.getPages()` lists every
 * language when called without one, which is how this route once emitted all
 * 335 pages across 7 locales (4.6 MB, the same page appearing up to seven
 * times) instead of the 79 English ones. `source.getPageTree()`, which this
 * route now walks, is passed the language too, for a different reason: the
 * tree it returns is already per-locale, and it currently resolves to the
 * default language when called bare — but nothing in the API contract
 * promises that, so the argument stays explicit rather than relying on an
 * unstated default. The locale text stays reachable as HTML, through the
 * locale URLs announced at the end of `llms.txt` — and *not* through the
 * `.mdx` rewrite, which is English-only in both halves: `next.config.mjs`
 * rewrites `/docs/:path*.mdx` and no locale-prefixed form of it, and
 * `llms.mdx/docs/[[...slug]]` calls `source.getPage(slug)` with no language
 * argument, so the default language is the only thing it can serve. This
 * comment used to claim the opposite, and that belief reached the served
 * `/llms.txt`, whose header told every machine reader to build
 * `/zh-Hans/docs/quickstart.mdx` — a 404.
 */
const LANG = i18n.defaultLanguage;

/** Opening or closing line of a fenced code block. */
const FENCE = /^[ \t]{0,3}(`{3,}|~{3,})/;

/**
 * A markdown link whose target is a page on this site: site-root (`/docs/x`),
 * page-relative (`./x`, `../x`), or a bare fragment (`#x`).
 *
 * Anything carrying a scheme — `https:`, `mailto:` — cannot match, so an
 * already-absolute URL is never re-parsed and re-serialized. Nor can a
 * protocol-relative `//host/x`, which names a different origin and is not this
 * file's business: `\.{0,2}\/` matches the first slash and `(?!\/)` then
 * rejects the second.
 */
const SITE_LINK = /(\]\()((?:\.{0,2}\/(?!\/)|#)[^)\s]*)(\))/g;

/**
 * `text`, with every link to a page on this site resolved against `pageUrl`.
 *
 * Why the fix belongs here and not in `content/docs`: a relative link is
 * *correct* on the website, where the origin is attached to the document the
 * reader is looking at. It stops being correct the moment this route lifts the
 * text out of that document and concatenates it into a file whose whole purpose
 * is to be read somewhere else. The defect is a property of this surface, so
 * the repair is too — and the authored MDX stays the plain, portable thing it
 * should be.
 *
 * Fenced code blocks are skipped. A code sample containing markdown link syntax
 * is documenting that syntax, and rewriting it would be a silent edit to
 * authored content. No page has one today — of the 549 on-site links in the
 * served body, 0 sit inside a fence — so this is a guard against the page that
 * gets written next, not a fix for one that exists.
 */
function absoluteLinks(text: string, pageUrl: string): string {
  const lines = text.split('\n');
  let fence: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const marker = FENCE.exec(lines[i])?.[1];
    if (marker) {
      if (fence === undefined) fence = marker[0];
      else if (marker[0] === fence) fence = undefined;
      continue;
    }
    if (fence !== undefined) continue;

    lines[i] = lines[i].replace(
      SITE_LINK,
      (_match, open: string, href: string, close: string) =>
        `${open}${new URL(href, pageUrl).href}${close}`,
    );
  }

  return lines.join('\n');
}

/**
 * Every English page, in the order the site navigation puts them.
 *
 * `source.getPages(LANG)` — what this route used to enumerate — hands back
 * pages in whatever order the loader finished reading them. That is stable
 * within one build and not across builds: two consecutive builds of an
 * untouched tree emitted this file with the whole `configure/` group and the
 * whole `deploy/` group swapped, so the bytes changed for the same 79 pages
 * and nothing in the repository had moved.
 *
 * The repair is not "sort it". Unlike `sitemap.xml`, where entry order carries
 * nothing to a crawler, **the order pages appear in here is read** — this file
 * is one long document. So a deterministic order is necessary and not
 * sufficient: alphabetical would be reproducible and *worse* than the accident
 * it replaced, scattering `build/`, `deploy/` and `operate/` through a flat
 * A-to-Z list.
 *
 * `source.getPageTree(LANG)` is `meta.json` order, which is the site
 * navigation, which is the order a reader of these pages already knows. It is
 * also what `llms.txt` already walks, so the index and the full text now agree
 * on sequence instead of contradicting each other. Reproducibility follows
 * from fixing the meaning rather than the other way round.
 *
 * Membership is unchanged. `flattenTree` yields a folder's index page followed
 * by its children, recursively, and every one of the 79 English pages is
 * reachable from a `meta.json`. What decides membership is now the tree rather
 * than the file system — the same rule the sidebar and `llms.txt` already
 * follow, so a page that no `meta.json` lists is absent from all three
 * together rather than from two of them quietly.
 */
function navigationPages() {
  return flattenTree(source.getPageTree(LANG).children).map((node) => {
    const page = source.getNodePage(node, LANG);

    // Unreachable unless fumadocs hands back a page node whose `$ref` resolves
    // to nothing. Loud on purpose: the alternative is a page dropping out of
    // this file without a trace, which is a worse defect than the ordering one
    // this function exists to fix.
    if (!page) {
      throw new Error(
        `llms-full.txt: page tree node ${String(node.$id ?? node.url)} resolves to no page`,
      );
    }

    return page;
  });
}

export async function GET() {
  // Each page is rewritten against its own URL rather than the joined body
  // against the site root: `./objectql` means something different on
  // `/docs/reference/cel` than it does three sections away, and a page whose
  // text left a code fence unclosed cannot then leak that state into the next
  // page's links.
  const scan = navigationPages().map(async (page) =>
    absoluteLinks(await getLLMText(page), `${SITE_URL}${page.url}`),
  );
  const scanned = await Promise.all(scan);

  return new Response(scanned.join('\n\n'));
}
