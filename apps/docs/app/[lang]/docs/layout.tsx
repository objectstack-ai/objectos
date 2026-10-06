import { source } from '@/lib/source';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import type * as PageTree from 'fumadocs-core/page-tree';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { baseOptions } from '@/lib/layout.shared';
import { i18n } from '@/lib/i18n';
import { translatedLocales } from '@/lib/seo';
import { uiText } from '@/lib/ui-text';

/**
 * A page-tree name or description in the language it is really written in.
 *
 * The default language is the only one a page-tree entry can fall back to:
 * fumadocs seeds every locale's tree from the English files (see
 * `translatedLocales`), so an entry that is not in the route locale is English.
 */
function inDefaultLanguage(text: ReactNode): ReactNode {
  return <span lang={i18n.defaultLanguage}>{text}</span>;
}

/**
 * Whether a page entry in `lang`'s tree names a page `lang` has no source file
 * for — the English page, served as a fallback.
 *
 * The detection the docs page uses for its own body (#298), and deliberately
 * the same function: `translatedLocales` compares the page's AUTHORED file
 * (`operate/backup.ja.mdx` or the inherited `operate/backup.mdx`) with the
 * English one. The page `getNodePage` resolves is the page the entry was built
 * from — its `$ref` is the locale-independent storage key — so the sidebar,
 * the breadcrumb and the footer agree with the page body about which pages are
 * English, entry by entry, with no second rule to drift from the first.
 */
function isFallbackPage(node: PageTree.Item, lang: string): boolean {
  const page = source.getNodePage(node, lang);
  return page !== undefined && !translatedLocales(page.slugs).includes(lang);
}

/**
 * Whether a folder entry's name is English in `lang`'s tree.
 *
 * Fumadocs names a folder from its `meta` title, else from its index page,
 * else from the directory name. The same file-identity rule applies to the
 * first: a `meta.<lang>.json` is the locale's own, an inherited `meta.json` is
 * English. Every folder in `content/docs` has a `meta.<locale>.json` with a
 * title today, so this marks nothing on the current tree; it is here so a
 * folder added without one is marked rather than silently read as the locale.
 */
function isEnglishFolderName(node: PageTree.Folder, lang: string): boolean {
  const meta = source.getNodeMeta(node, lang);
  if (meta && typeof (meta.data as { title?: unknown }).title === 'string') {
    return meta.path === source.getNodeMeta(node, i18n.defaultLanguage)?.path;
  }
  if (node.index) return isFallbackPage(node.index, lang);
  return true;
}

function markItem(node: PageTree.Item, lang: string): PageTree.Item {
  if (!isFallbackPage(node, lang)) return node;
  return {
    ...node,
    name: inDefaultLanguage(node.name),
    ...(node.description ? { description: inDefaultLanguage(node.description) } : {}),
  };
}

function markNode(node: PageTree.Node, lang: string): PageTree.Node {
  if (node.type === 'page') return markItem(node, lang);
  if (node.type !== 'folder') return node;
  return {
    ...node,
    ...(isEnglishFolderName(node, lang) ? { name: inDefaultLanguage(node.name) } : {}),
    ...(node.index ? { index: markItem(node.index, lang) } : {}),
    children: node.children.map((child) => markNode(child, lang)),
  };
}

const markedTrees = new Map<string, PageTree.Root>();

/**
 * `lang`'s page tree with every English entry marked `lang="en"` (#305).
 *
 * On a locale route the sidebar, the breadcrumb and the previous/next footer
 * all render names from this tree, inside `<html lang>` declaring the route
 * locale. A page the locale has no translation of is named by its English
 * title (and described by its English description, which the footer shows), so
 * without a mark a screen reader reads "Backup and Disaster Recovery" with
 * Chinese pronunciation rules — the language-of-parts defect (WCAG 3.1.2) the
 * page body already avoids. axe has no rule for it, so nothing else reports it.
 *
 * One transform here reaches all three, because all three read the tree this
 * layout hands to `DocsLayout`; the `llms` routes read `source.getPageTree`
 * for English directly and are not affected. Only the name and description
 * are wrapped: `url`, `$id` and `$ref` stay as they were, so active-item
 * matching and every lookup by node are untouched. An English route returns
 * the tree it was given.
 *
 * Memoized per locale: the tree and the content are fixed for the life of the
 * build, and the layout renders once per page.
 */
function treeWithLanguages(lang: string): PageTree.Root {
  const tree = source.pageTree[lang];
  if (lang === i18n.defaultLanguage || !tree) return tree;
  let marked = markedTrees.get(lang);
  if (!marked) {
    marked = { ...tree, children: tree.children.map((node) => markNode(node, lang)) };
    markedTrees.set(lang, marked);
  }
  return marked;
}

/**
 * Links to `/privacy` and `/terms`, at the foot of the docs sidebar (#299).
 *
 * Before this, nothing on the site linked to either page; only the sitemap
 * reached them. The app has no footer of its own, and every docs page renders
 * this layout's sidebar, on mobile as the drawer, so its `footer` slot reaches
 * both pages from every docs page in every locale.
 *
 * Each link stays in the reader's locale. A locale the page is not written in
 * renders the English text, and that route names the English URL as canonical.
 * The labels are interface copy, so they come from `lib/ui-text.ts` in the
 * reader's locale like the rest of the sidebar's chrome.
 */
function LegalLinks({ lang }: { lang: string }) {
  const prefix = lang === i18n.defaultLanguage ? '' : `/${lang}`;
  const text = uiText(lang);

  return (
    <nav aria-label={text.legalNav} className="flex gap-4 px-2 pt-3 text-xs text-fd-muted-foreground">
      <Link href={`${prefix}/privacy`} className="hover:text-fd-foreground">
        {text.privacy}
      </Link>
      <Link href={`${prefix}/terms`} className="hover:text-fd-foreground">
        {text.terms}
      </Link>
    </nav>
  );
}

export default async function Layout({
  params,
  children,
}: {
  params: Promise<{ lang: string }>;
  children: ReactNode;
}) {
  const { lang } = await params;

  return (
    <DocsLayout
      tree={treeWithLanguages(lang)}
      {...baseOptions(lang)}
      sidebar={{ footer: <LegalLinks lang={lang} /> }}
      i18n
    >
      {children}
    </DocsLayout>
  );
}
