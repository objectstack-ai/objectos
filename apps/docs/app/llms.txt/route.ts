import { flattenTree, type Folder, type Item, type Node, type Root } from 'fumadocs-core/page-tree';
import { llms } from 'fumadocs-core/source/llms';
import { i18n } from '@/lib/i18n';
import { POSITIONING } from '@/lib/positioning';
import { SITE_URL, localeUrl, translatedLocales } from '@/lib/seo';
import { SITE_NAME, source } from '@/lib/source';

export const revalidate = false;

/**
 * The summary line is the positioning paragraph in `lib/positioning.ts` — the
 * one constant this site states ObjectOS in, quoted from the objectstack
 * README (objectos#171, Q4). This file used to carry its own literal, taken
 * from the marketing site's `/llms.txt`, which was a second version of the
 * positioning by construction; both sites now quote the README, and
 * `check-positioning.mjs` compares the BUILT summary line against the
 * constant, so a literal reintroduced here goes red in CI.
 */
const SUMMARY = POSITIONING;

/**
 * Title line: the product this documentation is for, spelled the one way
 * `SITE_NAME` spells it.
 */
const TITLE = SITE_NAME;

/** Heading for the pages that sit at the tree root rather than in a section. */
const ROOT_HEADING = 'Overview';

/**
 * English only, by `AGENTS.md` rule 1 — English is the single source of truth
 * and every `*.<locale>.mdx` is a derived artifact. `source.getPages()` lists
 * *every* language when called without one, which is how this file used to
 * emit all 335 pages across 7 locales as one flat list. `source.getPageTree()`
 * is passed the language too, for a different reason: the tree it returns is
 * already per-locale, and measured against fumadocs-core 16.8.12 it currently
 * resolves to the default language when called bare — but the API contract
 * makes no such promise, so the argument stays explicit rather than relying on
 * an unstated default. The locale URLs are announced at the end of the file
 * instead.
 */
const LANG = i18n.defaultLanguage;

const OTHER_LOCALES = i18n.languages.filter((lang) => lang !== LANG);

function sectionHeading(folder: Folder): string {
  const title = source.getNodeMeta(folder, LANG)?.data.title;
  if (title) return title;
  return typeof folder.name === 'string' ? folder.name : 'Documentation';
}

/**
 * The same page node with an absolute URL.
 *
 * `indexNode` formats each bullet from `node.url`, and fumadocs fills that
 * field with a site-relative path (`/docs/quickstart`). This file exists to be
 * fetched and have its text lifted into a context window where the origin is no
 * longer attached to it, so a site-relative path resolves only if whatever
 * moved it there also carried the base URL — which is precisely what a consumer
 * of an `llms.txt` will not do. The marketing site's own `/llms.txt` has always
 * emitted absolute URLs; this is the docs site catching up to it.
 *
 * Rewriting the node rather than the rendered line confines the edit to the
 * URL: titles, descriptions, indentation and nesting come out of `indexNode`
 * untouched, and no pattern ever runs over an authored description. The node's
 * identity is carried by `$ref`, not `url` — `getNodePage` and `getNodeMeta`
 * both look up by `$ref` — so the spread leaves title and description lookup
 * working.
 *
 * `SITE_URL` and not `localeUrl` on purpose: `node.url` already carries
 * whatever locale prefix the tree was built for, and `localeUrl` would apply a
 * second one. `localeUrl` is the right helper for a *logical* path, which is
 * how the prose examples below use it.
 */
function absolutePage(page: Item): Item {
  return { ...page, url: `${SITE_URL}${page.url}` };
}

function absoluteNode(node: Node): Node {
  if (node.type === 'page') return absolutePage(node);
  if (node.type === 'folder') {
    return {
      ...node,
      index: node.index && absolutePage(node.index),
      children: node.children.map(absoluteNode),
    };
  }
  return node;
}

/**
 * The locale-prefixed URL the Other Languages section gives as its example:
 * the first page, in navigation order, that has a real `lang` translation.
 *
 * It used to be a fixed `docs/quickstart`, and Quickstart has no `zh-Hans`
 * source file, so the one example of a translated page was an English
 * fallback (#301). Deriving it means a page losing its translation cannot
 * leave the example pointing at English again. Navigation order rather than
 * `source.getPages()` order, because the tree is what `meta.json` fixes.
 */
function translatedExample(tree: Root, lang: string): string | undefined {
  for (const node of flattenTree(tree.children)) {
    const page = source.getNodePage(node, LANG);
    if (page && translatedLocales(page.slugs).includes(lang)) {
      return localeUrl(lang, ['docs', ...page.slugs].join('/'));
    }
  }
  return undefined;
}

/**
 * The header's two rules — append `.mdx`, and the locale prefixes announced
 * under Other Languages — are read by a machine that will compose them. So the
 * `.mdx` rule states its own scope: it used to say "appending `.mdx` to its
 * URL", and composed with the locale rule that licensed
 * `/zh-Hans/docs/quickstart.mdx`, which 404s. The rewrite in `next.config.mjs`
 * matches `/docs/:path*.mdx` and nothing else, and the route behind it calls
 * `source.getPage(slug)` with no language, so there is no locale-prefixed
 * `.mdx` URL to advertise and no locale text behind one.
 *
 * Keep any rewording composable with the Other Languages section: a scope this
 * paragraph does not state is a URL this file promises and the site does not
 * serve, and no gate reads prose.
 */
export async function GET() {
  const generator = llms(source);
  const tree = source.getPageTree(LANG);

  const lines: string[] = [
    `# ${TITLE}`,
    '',
    `> ${SUMMARY}`,
    '',
    'This is the ObjectOS product and developer documentation, grouped by the ' +
      'sections used in the site navigation. Every page below is also available ' +
      'as Markdown by appending `.mdx` to the URL exactly as listed (for ' +
      `example \`${localeUrl(LANG, 'docs/quickstart.mdx')}\`), and ` +
      `\`${SITE_URL}/llms-full.txt\` carries the full text of every page in ` +
      'one file. Both are English-only: the locale-prefixed URLs under Other ' +
      'Languages below have no `.mdx` form.',
  ];

  // Root-level pages (index, why, quickstart, ...) come before the section
  // folders in the tree; collect them under one heading so the file opens with
  // a section rather than a bare list.
  const rootPages = tree.children.filter((node) => node.type === 'page');
  if (rootPages.length > 0) {
    lines.push('', `## ${ROOT_HEADING}`, '');
    for (const node of rootPages) {
      lines.push(generator.indexNode(absolutePage(node), LANG));
    }
  }

  for (const node of tree.children) {
    if (node.type !== 'folder') continue;
    lines.push('', `## ${sectionHeading(node)}`, '');
    // The folder's own bullet is dropped: the heading already names it. Its
    // index page and children are rendered at the top level of the section,
    // so nested subfolders keep exactly one level of indentation.
    if (node.index) lines.push(generator.indexNode(absolutePage(node.index), LANG));
    for (const child of node.children) {
      lines.push(generator.indexNode(absoluteNode(child), LANG));
    }
  }

  if (OTHER_LOCALES.length > 0) {
    const example = translatedExample(tree, OTHER_LOCALES[0]);
    lines.push(
      '',
      '## Other Languages',
      '',
      `Every page above is also published under a locale prefix` +
        (example ? ` — for example \`${example}\`` : '') +
        `. Available locales: ` +
        `${OTHER_LOCALES.map((lang) => `\`${lang}\``).join(', ')}. English is the ` +
        `source of truth; a page with no translation yet falls back to English.`,
    );
  }

  lines.push('');

  return new Response(lines.join('\n'));
}
