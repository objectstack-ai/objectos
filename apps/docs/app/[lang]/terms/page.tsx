import Link from 'next/link';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { baseOptions } from '@/lib/layout.shared';

const content = {
  en: {
    title: 'Terms of Service',
    updated: 'Last updated: May 27, 2026',
    body: [
      {
        heading: 'License',
        text: 'ObjectOS is distributed under the Apache License 2.0. You may use, modify, and redistribute the software in accordance with that license. The "ObjectOS" name and logo are trademarks of ObjectStack AI LLC and are not granted under the Apache 2.0 license — see TRADEMARK.md in the repository.',
      },
      {
        heading: 'Self-hosted deployments',
        text: 'When you run ObjectOS inside your own infrastructure, you are solely responsible for the operation, security, availability, backups, and compliance of that deployment. ObjectStack AI LLC provides no warranty for self-hosted use beyond what the Apache License 2.0 specifies.',
      },
      {
        heading: 'Hosted services',
        text: 'Any hosted services operated by ObjectStack AI LLC (for example, the optional control plane or future SaaS offering) are subject to a separate service agreement that will be presented at the time you sign up. Nothing on this site constitutes such an agreement.',
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
  cn: {
    title: '服务条款',
    updated: '最近更新：2026 年 5 月 27 日',
    body: [
      {
        heading: '许可',
        text: 'ObjectOS 以 Apache License 2.0 发布。你可以在该许可证下使用、修改与再分发本软件。"ObjectOS" 名称与 Logo 为 ObjectStack AI LLC 的商标，不在 Apache 2.0 的授权范围内 —— 详见仓库内的 TRADEMARK.md。',
      },
      {
        heading: '自托管部署',
        text: '当你在自己的基础设施中运行 ObjectOS 时，该部署的运行、安全、可用性、备份与合规性，完全由你自行负责。除 Apache License 2.0 明文约定外，ObjectStack AI LLC 对自托管使用不提供任何保证。',
      },
      {
        heading: '托管服务',
        text: 'ObjectStack AI LLC 运营的任何托管服务（例如可选的控制台、或未来的 SaaS 服务），适用单独的服务协议，将在你注册时另行呈现。本网站的任何内容均不构成此类协议。',
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

export default async function TermsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const t = content[lang === 'cn' ? 'cn' : 'en'];

  return (
    <HomeLayout {...baseOptions()} i18n>
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
