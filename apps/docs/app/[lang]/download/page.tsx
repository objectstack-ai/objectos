import Link from 'next/link';
import {
  Container,
  Boxes,
  Terminal,
  Globe,
  Code2,
  Network,
  Bot,
  ShieldCheck,
  ArrowRight,
  GitBranch,
} from 'lucide-react';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { baseOptions } from '@/lib/layout.shared';
import {
  CLIENT_COMMANDS,
  CLI_INSTALLS,
  SERVER_COMMANDS,
  getDownloadTranslations,
} from '@/lib/download-i18n';
import { PlatformCard } from '@/components/download/platform-card';
import { CommandTabsClient } from '@/components/download/command-tabs-client';
import { DesktopDownloadTable } from '@/components/download/download-table';
import { ClientCard } from '@/components/download/client-card';
import { OsDetectHero } from '@/components/download/os-detect';

export default async function DownloadPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const t = getDownloadTranslations(lang);

  const cliTabs = [
    { key: 'npm', label: t.cli.tabs.npm, commands: CLI_INSTALLS.npm },
    { key: 'pnpm', label: t.cli.tabs.pnpm, commands: CLI_INSTALLS.pnpm },
    { key: 'yarn', label: t.cli.tabs.yarn, commands: CLI_INSTALLS.yarn },
  ];

  return (
    <HomeLayout {...baseOptions()} i18n>
      <main className="relative flex min-h-screen flex-col items-center bg-background text-foreground overflow-hidden">
        <div className="absolute inset-0 -z-10 h-full w-full bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_15%,#000_70%,transparent_100%)] pointer-events-none" />

        {/* Hero */}
        <section className="w-full px-4 pt-20 pb-12 sm:pt-28 flex flex-col items-center text-center">
          <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs text-primary backdrop-blur-sm">
            <span className="flex h-2 w-2 rounded-full bg-primary mr-2 animate-pulse" />
            <span className="font-medium">{t.badge}</span>
          </div>
          <h1 className="mt-6 text-5xl font-extrabold tracking-tight sm:text-6xl bg-gradient-to-br from-foreground via-foreground/90 to-primary/60 bg-clip-text text-transparent pb-2">
            {t.hero.title}
          </h1>
          <p className="mt-4 max-w-2xl text-base text-foreground/70 sm:text-lg leading-relaxed">
            {t.hero.subtitle}
          </p>
          <div className="mt-8 w-full max-w-2xl">
            <OsDetectHero
              primaryCta={t.hero.primaryCta}
              secondaryCta={t.hero.secondaryCta}
              secondaryHref={t.hero.secondaryHref}
              detected={t.hero.detected}
              detecting={t.hero.detecting}
              notSure={t.hero.notSure}
            />
          </div>
        </section>

        {/* Server */}
        <section className="w-full px-4 py-20 max-w-6xl">
          <div className="mb-10 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
              {t.server.heading}
            </h2>
            <p className="text-foreground/70 max-w-2xl mx-auto">{t.server.subheading}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <PlatformCard
              icon={<Container className="h-6 w-6" />}
              title={t.server.docker.title}
              tagline={t.server.docker.tagline}
              description={t.server.docker.description}
              command={SERVER_COMMANDS.docker}
              commandLabel="docker"
              cta={t.server.docker.cta}
              href={t.server.docker.href}
              copyLabel={t.copy.copy}
              copiedLabel={t.copy.copied}
            />
            <PlatformCard
              icon={<Boxes className="h-6 w-6" />}
              title={t.server.kubernetes.title}
              tagline={t.server.kubernetes.tagline}
              description={t.server.kubernetes.description}
              command={SERVER_COMMANDS.kubernetes}
              commandLabel="helm"
              cta={t.server.kubernetes.cta}
              href={t.server.kubernetes.href}
              copyLabel={t.copy.copy}
              copiedLabel={t.copy.copied}
            />
            <PlatformCard
              icon={<GitBranch className="h-6 w-6" />}
              title={t.server.source.title}
              tagline={t.server.source.tagline}
              description={t.server.source.description}
              command={SERVER_COMMANDS.source}
              commandLabel="shell"
              cta={t.server.source.cta}
              href={t.server.source.href}
              copyLabel={t.copy.copy}
              copiedLabel={t.copy.copied}
            />
          </div>
        </section>

        {/* CLI */}
        <section className="w-full px-4 py-20 max-w-5xl">
          <div className="mb-10 text-center">
            <div className="mb-4 inline-flex items-center justify-center rounded-lg bg-primary/10 p-3 text-primary">
              <Terminal className="h-6 w-6" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">{t.cli.heading}</h2>
            <p className="text-foreground/70 max-w-2xl mx-auto">{t.cli.subheading}</p>
          </div>

          <CommandTabsClient
            tabs={cliTabs}
            copyLabel={t.copy.copy}
            copiedLabel={t.copy.copied}
          />
          <p className="mt-3 text-xs text-foreground/50 text-center">{t.cli.requires}</p>
        </section>

        {/* Desktop installers */}
        <section className="w-full px-4 pb-20 max-w-5xl">
          <DesktopDownloadTable
            heading={t.desktop.heading}
            subheading={t.desktop.subheading}
            cols={t.desktop.cols}
          />
        </section>

        {/* Clients / SDKs */}
        <section className="w-full px-4 py-20 max-w-6xl">
          <div className="mb-10 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
              {t.clients.heading}
            </h2>
            <p className="text-foreground/70 max-w-2xl mx-auto">{t.clients.subheading}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <ClientCard
              icon={<Globe className="h-5 w-5" />}
              title={t.clients.items.studio.title}
              description={t.clients.items.studio.description}
              cta={t.clients.items.studio.cta}
              href={t.clients.items.studio.href}
              copyLabel={t.copy.copy}
              copiedLabel={t.copy.copied}
            />
            <ClientCard
              icon={<Code2 className="h-5 w-5" />}
              title={t.clients.items.js.title}
              description={t.clients.items.js.description}
              cta={t.clients.items.js.cta}
              href={t.clients.items.js.href}
              command={CLIENT_COMMANDS.js}
              copyLabel={t.copy.copy}
              copiedLabel={t.copy.copied}
            />
            <ClientCard
              icon={<Network className="h-5 w-5" />}
              title={t.clients.items.rest.title}
              description={t.clients.items.rest.description}
              cta={t.clients.items.rest.cta}
              href={t.clients.items.rest.href}
              copyLabel={t.copy.copy}
              copiedLabel={t.copy.copied}
            />
            <ClientCard
              icon={<Bot className="h-5 w-5" />}
              title={t.clients.items.mcp.title}
              description={t.clients.items.mcp.description}
              cta={t.clients.items.mcp.cta}
              href={t.clients.items.mcp.href}
              command={CLIENT_COMMANDS.mcp}
              copyLabel={t.copy.copy}
              copiedLabel={t.copy.copied}
            />
            <ClientCard
              icon={<Terminal className="h-5 w-5" />}
              title={t.clients.items.vscode.title}
              description={t.clients.items.vscode.description}
              cta={t.clients.items.vscode.cta}
              href={t.clients.items.vscode.href}
              command={CLIENT_COMMANDS.vscode}
              copyLabel={t.copy.copy}
              copiedLabel={t.copy.copied}
            />
          </div>
        </section>

        {/* Verify + requirements */}
        <section className="w-full px-4 py-20 max-w-5xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-border/70 bg-card/40 p-6">
              <div className="mb-3 inline-flex items-center justify-center rounded-md bg-primary/10 p-2 text-primary">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{t.verify.heading}</h3>
              <p className="text-sm text-foreground/70 leading-relaxed mb-4">{t.verify.body}</p>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={t.verify.releaseHref}
                  className="inline-flex h-9 items-center rounded-md border border-border bg-card/60 px-3 text-xs font-medium hover:bg-accent transition-colors"
                >
                  {t.verify.releaseCta} ↗
                </Link>
                <Link
                  href={t.verify.signingHref}
                  className="inline-flex h-9 items-center rounded-md border border-border bg-card/60 px-3 text-xs font-medium hover:bg-accent transition-colors"
                >
                  {t.verify.signingCta} ↗
                </Link>
              </div>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card/40 p-6">
              <h3 className="text-lg font-semibold mb-3">{t.requirements.heading}</h3>
              <dl className="divide-y divide-border/40 text-sm">
                {t.requirements.rows.map((row) => (
                  <div key={row.label} className="flex justify-between gap-4 py-2">
                    <dt className="font-medium text-foreground/80">{row.label}</dt>
                    <dd className="text-foreground/60 text-right">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        {/* Past releases */}
        <section className="w-full px-4 pb-24 max-w-3xl">
          <div className="rounded-2xl border border-border/70 bg-gradient-to-br from-primary/5 via-card to-card p-8 text-center">
            <h3 className="text-xl font-semibold mb-2">{t.past.heading}</h3>
            <p className="text-foreground/70 mb-5">{t.past.body}</p>
            <Link
              href={t.past.href}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-card/60 px-6 text-sm font-medium hover:bg-accent transition-colors"
            >
              {t.past.cta}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>
    </HomeLayout>
  );
}
