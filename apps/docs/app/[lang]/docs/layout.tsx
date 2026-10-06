import { source } from '@/lib/source';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { baseOptions } from '@/lib/layout.shared';
import { i18n } from '@/lib/i18n';
import { uiText } from '@/lib/ui-text';

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
      tree={source.pageTree[lang]}
      {...baseOptions(lang)}
      sidebar={{ footer: <LegalLinks lang={lang} /> }}
      i18n
    >
      {children}
    </DocsLayout>
  );
}
