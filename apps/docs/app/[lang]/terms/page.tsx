import type { Metadata } from 'next';
import Link from 'next/link';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { baseOptions } from '@/lib/layout.shared';
import { staticPageMetadata } from '@/lib/seo';

const content = {
  en: {
    title: 'Terms of Service',
    description: "How ObjectOS editions are licensed, the Apache-2.0 license of this site's content, the ObjectOS trademark, and responsibility for self-managed deployments.",
    updated: 'Last updated: October 6, 2026',
    body: [
      {
        heading: 'License',
        text: 'ObjectOS is a commercial product with no open-source edition. Your use of ObjectOS is governed by the license or service agreement of the edition you use — ObjectOS Cloud or ObjectOS Enterprise. The contents of the repository behind this documentation site (the documentation and the site code) are licensed under the Apache License 2.0, and the open-source ObjectStack framework and its runtime are licensed under the Apache License 2.0 in their own repository. The "ObjectOS" name and logo are trademarks of ObjectStack AI LLC and are not granted under the Apache 2.0 license — see TRADEMARK.md in the repository.',
      },
      {
        heading: 'Self-hosted deployments',
        text: 'When you run ObjectOS self-managed inside your own infrastructure (ObjectOS Enterprise), you are solely responsible for the operation, security, availability, backups, and compliance of that deployment, and ObjectStack AI LLC provides no warranty for it beyond what your commercial agreement specifies. When you self-host the open-source ObjectStack runtime instead, it is licensed under the Apache License 2.0, and ObjectStack AI LLC provides no warranty beyond what that license specifies.',
      },
      {
        heading: 'Hosted services',
        text: 'Any hosted services operated by ObjectStack AI LLC (for example, ObjectOS Cloud) are subject to a separate service agreement that will be presented at the time you sign up. Nothing on this site constitutes such an agreement.',
      },
      {
        heading: 'Changes',
        text: 'We may update these terms from time to time. Material changes will be reflected in the "Last updated" date above.',
      },
      {
        heading: 'Contact',
        text: 'For questions about these terms, contact legal@objectstack.ai.',
      },
    ],
    back: '← Back to home',
  },
  'zh-Hans': {
    title: '服务条款',
    description: 'ObjectOS 各版本的许可方式、本站内容采用的 Apache-2.0 许可、ObjectOS 商标，以及自管部署的责任归属。',
    updated: '最近更新：2026 年 10 月 6 日',
    body: [
      {
        heading: '许可',
        text: 'ObjectOS 是商业产品，没有开源版本。你对 ObjectOS 的使用，受你所使用版本（ObjectOS Cloud 或 ObjectOS Enterprise）的许可协议或服务协议约束。本文档站点所在仓库的内容（文档与站点代码）以 Apache License 2.0 授权；开源的 ObjectStack 框架及其运行时在其自己的仓库中以 Apache License 2.0 授权。"ObjectOS" 名称与 Logo 为 ObjectStack AI LLC 的商标，不在 Apache 2.0 的授权范围内 —— 详见仓库内的 TRADEMARK.md。',
      },
      {
        heading: '自托管部署',
        text: '当你在自己的基础设施中自管运行 ObjectOS（ObjectOS Enterprise）时，该部署的运行、安全、可用性、备份与合规性，完全由你自行负责；除你的商业协议明文约定外，ObjectStack AI LLC 对该部署不提供任何保证。若你自托管的是开源的 ObjectStack 运行时，则其以 Apache License 2.0 授权，除该许可证明文约定外，ObjectStack AI LLC 不提供任何保证。',
      },
      {
        heading: '托管服务',
        text: 'ObjectStack AI LLC 运营的任何托管服务（例如 ObjectOS Cloud），适用单独的服务协议，将在你注册时另行呈现。本网站的任何内容均不构成此类协议。',
      },
      {
        heading: '条款变更',
        text: '本条款可能不时更新。重大变更将通过上方的"最近更新"日期反映。',
      },
      {
        heading: '联系方式',
        text: '关于本条款的问题，请联系 legal@objectstack.ai。',
      },
    ],
    back: '← 返回首页',
  },
};

/**
 * The locales this page is actually written in: the keys of the `content`
 * record above, which is where this page's copy lives.
 *
 * `app/sitemap.ts` reads this rather than restating the pair, so a translation
 * added to `content` is advertised to crawlers by that edit alone. The renderer
 * below still serves English for any other locale, but that fallback is not a
 * translation and must not be advertised as one — which is why this is derived
 * from `content`, not from `i18n.languages`.
 *
 * A named export next to a page's default is valid App Router: Next's generated
 * route validator (`.next/types/validator.ts`) constrains the *known* page
 * exports and ignores additional ones.
 */
export const contentLocales = Object.keys(content);

/** Title, description, canonical and hreflang from `content`; see `staticPageMetadata`. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  return staticPageMetadata('terms', lang, content);
}

export default async function TermsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const t = content[lang as keyof typeof content] ?? content.en;

  return (
    <HomeLayout {...baseOptions(lang)} i18n>
      <main className="mx-auto w-full max-w-3xl px-4 py-16 sm:py-24">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">{t.title}</h1>
        <p className="text-sm text-foreground/60 mb-12">{t.updated}</p>
        <div className="space-y-8">
          {t.body.map((s) => (
            <section key={s.heading}>
              <h2 className="text-xl font-semibold mb-3">{s.heading}</h2>
              <p className="text-foreground/80 leading-relaxed">{s.text}</p>
            </section>
          ))}
        </div>
        <div className="mt-16 pt-8 border-t border-border/60">
          <Link href={`/${lang}`} className="text-sm text-primary hover:underline">
            {t.back}
          </Link>
        </div>
      </main>
    </HomeLayout>
  );
}
