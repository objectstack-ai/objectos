import type { Folder, Item, Node } from 'fumadocs-core/page-tree';
import { llms } from 'fumadocs-core/source/llms';
import { i18n } from '@/lib/i18n';
import { SITE_URL, localeUrl } from '@/lib/seo';
import { source } from '@/lib/source';

export const revalidate = false;

/**
 * The one place this site states what ObjectOS is.
 *
 * Taken verbatim from the marketing site's own `/llms.txt`
 * (`www.objectos.ai`, `src/pages/llms.txt.ts`) — the current authoritative
 * positioning string for the two products. It is deliberately NOT re-derived
 * from `content/docs/index.mdx`: that page's framing is itself under review,
 * and `llms.txt` must not become the place a second version of it appears.
 *
 * If the positioning changes, change this constant. Nothing else in this file
 * encodes it.
 */
const SUMMARY =
  'ObjectStack is the open target format and runtime for AI-written enterprise software; ObjectOS is the commercial production platform where teams build, review, deploy, and operate ObjectStack applications.';

/** Title line: the product this documentation is for. */
const TITLE = 'ObjectOS';

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
      'as Markdown by appending `.mdx` to its URL (for example ' +
      `\`${localeUrl(LANG, 'docs/quickstart.mdx')}\`), and ` +
      `\`${SITE_URL}/llms-full.txt\` carries the full text of every page in ` +
      'one file.',
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
    lines.push(
      '',
      '## Other Languages',
      '',
      `Every page above is also published under a locale prefix — for example ` +
        `\`${localeUrl(OTHER_LOCALES[0], 'docs/quickstart')}\`. Available locales: ` +
        `${OTHER_LOCALES.map((lang) => `\`${lang}\``).join(', ')}. English is the ` +
        `source of truth; a page with no translation yet falls back to English.`,
    );
  }

  lines.push('');

  return new Response(lines.join('\n'));
}
