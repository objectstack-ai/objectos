import { i18n } from '@/lib/i18n';
import { SITE_URL } from '@/lib/seo';
import { getLLMText, source } from '@/lib/source';

export const revalidate = false;

/**
 * English only, by `AGENTS.md` rule 1 — English is the single source of truth
 * and every `*.<locale>.mdx` is a derived artifact. This is the same pin
 * `llms.txt` carries, for the same reason: `source.getPages()` filters by
 * locale **only when a language is passed** — called bare it returns every
 * language's page set concatenated, so this route used to emit all 335 pages
 * across 7 locales (4.6 MB, the same page appearing up to seven times) instead
 * of the 79 English ones. The locale text stays reachable per page through the
 * `.mdx` rewrite and the locale URLs announced at the end of `llms.txt`.
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

export async function GET() {
  // Each page is rewritten against its own URL rather than the joined body
  // against the site root: `./objectql` means something different on
  // `/docs/reference/cel` than it does three sections away, and a page whose
  // text left a code fence unclosed cannot then leak that state into the next
  // page's links.
  const scan = source
    .getPages(LANG)
    .map(async (page) =>
      absoluteLinks(await getLLMText(page), `${SITE_URL}${page.url}`),
    );
  const scanned = await Promise.all(scan);

  return new Response(scanned.join('\n\n'));
}
