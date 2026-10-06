import type { Metadata } from 'next';
import Link from 'next/link';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { baseOptions } from '@/lib/layout.shared';
import { staticPageMetadata } from '@/lib/seo';

const content = {
  en: {
    title: 'Privacy Policy',
    description: 'What ObjectStack AI LLC collects from its public websites and hosted accounts, and the data inside a self-managed deployment that it does not collect.',
    updated: 'Last updated: October 6, 2026',
    body: [
      {
        heading: 'Overview',
        text: 'ObjectOS runs hosted (ObjectOS Cloud) or self-managed on your own infrastructure (ObjectOS Enterprise). When you run ObjectOS self-managed inside your own infrastructure, ObjectStack AI LLC does not collect, store, or process the data flowing through your deployment. The data handling of ObjectOS Cloud is governed by its service agreement, presented at the time you sign up. This policy describes the limited information we collect when you interact with our public web properties (objectstack.ai, docs.objectstack.ai) and optional cloud services.',
      },
      {
        heading: 'What we collect',
        text: 'For our public websites we collect standard request logs (IP, user agent, referrer, requested URL) for security and operational purposes. If you create an account on a hosted service we operate, we collect the identifiers and credentials you provide to authenticate you.',
      },
      {
        heading: 'What we do not collect',
        text: 'We do not collect data that lives inside a self-managed ObjectOS deployment (ObjectOS Enterprise) or inside a deployment of the open-source ObjectStack runtime, and your application records never leave the perimeter you operate. ObjectOS Self-Managed validates its license online (Enterprise air-gapped licenses are offline-validated); the open-source ObjectStack runtime has no telemetry, no license check, and no update ping.',
      },
      {
        heading: 'Contact',
        text: 'For privacy questions, contact privacy@objectstack.ai.',
      },
    ],
    back: '← Back to home',
  },
  'zh-Hans': {
    title: '隐私政策',
    description: 'ObjectStack AI LLC 从公开网站和托管账号收集哪些信息，以及不会收集的自管部署内部数据。',
    updated: '最近更新：2026 年 10 月 6 日',
    body: [
      {
        heading: '概述',
        text: 'ObjectOS 以托管方式运行（ObjectOS Cloud），或由你自管部署在自己的基础设施中（ObjectOS Enterprise）。当你在自己的基础设施中自管运行 ObjectOS 时，ObjectStack AI LLC 不会收集、存储或处理流经你部署的数据。ObjectOS Cloud 的数据处理，受其在你注册时呈现的服务协议约束。本政策仅描述你访问我们的公开网站（objectstack.ai、docs.objectstack.ai）及任选的云服务时，我们所收集的有限信息。',
      },
      {
        heading: '我们会收集什么',
        text: '我们会出于安全与运营目的，收集公开网站的标准请求日志（IP、User-Agent、Referer、请求 URL）。若你在我们运营的托管服务上注册账号，我们会收集你为完成登录而提供的身份标识与凭证。',
      },
      {
        heading: '我们不会收集什么',
        text: '我们不会收集自管 ObjectOS 部署（ObjectOS Enterprise）内部的数据，也不会收集开源 ObjectStack 运行时部署内部的数据；你的应用数据始终留在你自己运营的边界内。ObjectOS Self-Managed 会在线校验许可证（Enterprise 隔离网络许可证为离线校验）；开源的 ObjectStack 运行时没有遥测、没有许可证校验、没有更新探活。',
      },
      {
        heading: '联系方式',
        text: '隐私相关问题请联系 privacy@objectstack.ai。',
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
  return staticPageMetadata('privacy', lang, content);
}

export default async function PrivacyPage({
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
