import Link from 'next/link';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { baseOptions } from '@/lib/layout.shared';

const content = {
  en: {
    title: 'Privacy Policy',
    updated: 'Last updated: May 27, 2026',
    body: [
      {
        heading: 'Overview',
        text: 'ObjectOS is a customer-hosted runtime. When you self-host ObjectOS inside your own infrastructure, ObjectStack AI LLC does not collect, store, or process the data flowing through your deployment. This policy describes the limited information we collect when you interact with our public web properties (objectstack.ai, docs.objectstack.ai) and optional cloud services.',
      },
      {
        heading: 'What we collect',
        text: 'For our public websites we collect standard request logs (IP, user agent, referrer, requested URL) for security and operational purposes. If you create an account on a hosted service we operate, we collect the identifiers and credentials you provide to authenticate you.',
      },
      {
        heading: 'What we do not collect',
        text: 'We do not collect data that lives inside a self-hosted ObjectOS deployment. The runtime does not phone home, and your application records never leave the perimeter you operate.',
      },
      {
        heading: 'Contact',
        text: 'For privacy questions, contact privacy@objectstack.ai.',
      },
    ],
    back: '← Back to home',
  },
  cn: {
    title: '隐私政策',
    updated: '最近更新：2026 年 5 月 27 日',
    body: [
      {
        heading: '概述',
        text: 'ObjectOS 是一款客户自托管的运行时。当你把 ObjectOS 部署在你自己的基础设施中时，ObjectStack AI LLC 不会收集、存储或处理流经你部署的数据。本政策仅描述你访问我们的公开网站（objectstack.ai、docs.objectstack.ai）及任选的云服务时，我们所收集的有限信息。',
      },
      {
        heading: '我们会收集什么',
        text: '我们会出于安全与运营目的，收集公开网站的标准请求日志（IP、User-Agent、Referer、请求 URL）。若你在我们运营的托管服务上注册账号，我们会收集你为完成登录而提供的身份标识与凭证。',
      },
      {
        heading: '我们不会收集什么',
        text: '我们不会收集自托管 ObjectOS 部署内部的数据。运行时不会回传任何信息，你的应用数据始终留在你自己的边界内。',
      },
      {
        heading: '联系方式',
        text: '隐私相关问题请联系 privacy@objectstack.ai。',
      },
    ],
    back: '← 返回首页',
  },
};

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const t = content[lang === 'cn' ? 'cn' : 'en'];

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
