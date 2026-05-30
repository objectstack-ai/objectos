import Link from 'next/link';
import { Server, Container, ShieldOff, KeyRound, Lock, LineChart, Wrench, ShieldCheck, Briefcase, Ship, Boxes, WifiOff, ArrowRight, Database } from 'lucide-react';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { baseOptions } from '@/lib/layout.shared';
import { getHomepageTranslations } from '@/lib/homepage-i18n';
import { HeroSection } from '@/components/hero-section';
import { CodePreview } from '@/components/code-preview';
import { FeatureCard } from '@/components/feature-card';
import { PersonaCard } from '@/components/persona-card';
import { DeployModeCard } from '@/components/deploy-mode-card';

export default async function HomePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const t = getHomepageTranslations(lang);

  const deployModes = [
    {
      key: 'docker',
      icon: Ship,
      ...t.deployModes.docker,
    },
    {
      key: 'kubernetes',
      icon: Boxes,
      ...t.deployModes.kubernetes,
    },
    {
      key: 'airGapped',
      icon: WifiOff,
      ...t.deployModes.airGapped,
    },
  ];

  const features = [
    {
      key: 'connectSystems',
      icon: Database,
      href: '/docs/configure/data-sources',
      title: t.features.connectSystems.title,
      description: t.features.connectSystems.description,
    },
    {
      key: 'selfHosted',
      icon: Server,
      href: '/docs/architecture',
      title: t.features.selfHosted.title,
      description: t.features.selfHosted.description,
    },
    {
      key: 'deployAnywhere',
      icon: Container,
      href: '/docs/deploy',
      title: t.features.deployAnywhere.title,
      description: t.features.deployAnywhere.description,
    },
    {
      key: 'airGapped',
      icon: ShieldOff,
      href: '/docs/deploy/air-gapped',
      title: t.features.airGapped.title,
      description: t.features.airGapped.description,
    },
    {
      key: 'identity',
      icon: KeyRound,
      href: '/docs/configure/authentication',
      title: t.features.identity.title,
      description: t.features.identity.description,
    },
    {
      key: 'permissions',
      icon: Lock,
      href: '/docs/configure/permissions',
      title: t.features.permissions.title,
      description: t.features.permissions.description,
    },
    {
      key: 'observability',
      icon: LineChart,
      href: '/docs/operate/observability',
      title: t.features.observability.title,
      description: t.features.observability.description,
    },
  ];

  const personas = [
    {
      key: 'itOps',
      icon: Wrench,
      color: 'text-blue-500',
      href: '/docs/deploy',
      title: t.personas.itOps.title,
      description: t.personas.itOps.description,
      action: t.personas.itOps.action,
    },
    {
      key: 'security',
      icon: ShieldCheck,
      color: 'text-purple-500',
      href: '/docs/configure/permissions',
      title: t.personas.security.title,
      description: t.personas.security.description,
      action: t.personas.security.action,
    },
    {
      key: 'business',
      icon: Briefcase,
      color: 'text-green-500',
      href: '/docs/architecture',
      title: t.personas.business.title,
      description: t.personas.business.description,
      action: t.personas.business.action,
    },
  ];

  return (
    <HomeLayout {...baseOptions(lang)} i18n>
      <main className="relative flex min-h-screen flex-col items-center text-center bg-background text-foreground selection:bg-primary/20 overflow-hidden">

        {/* Grid Pattern Background */}
        <div className="absolute inset-0 -z-10 h-full w-full bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_30%,#000_70%,transparent_100%)] pointer-events-none" />

        {/* Hero */}
        <section className="w-full px-4 pt-16 pb-12 sm:pt-24 md:pt-32 flex flex-col items-center">
          <HeroSection
            badge={t.badge}
            title={t.hero.title}
            subtitle={t.hero.subtitle}
            cta={t.hero.cta}
            quickStart={t.hero.quickStart}
            trustStrip={t.hero.trustStrip}
          />
          <CodePreview t={t.agentPreview} />
        </section>

        {/* Deploy Modes */}
        <section className="w-full px-4 py-24 max-w-6xl">
          <div className="mb-12 text-center">
            <div className="text-xs font-mono uppercase tracking-[0.18em] text-primary/70 mb-3">
              {t.deployModes.eyebrow}
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              {t.deployModes.heading}
            </h2>
            <p className="text-foreground/70 max-w-2xl mx-auto">
              {t.deployModes.subheading}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            {deployModes.map((m) => (
              <DeployModeCard
                key={m.key}
                icon={<m.icon className="h-6 w-6" />}
                title={m.title}
                tagline={m.tagline}
                description={m.description}
                href={m.href}
                cta={m.cta}
              />
            ))}
          </div>
        </section>

        {/* Capabilities */}
        <section className="w-full px-4 py-24 max-w-6xl">
          <div className="mb-12 text-center">
            <div className="text-xs font-mono uppercase tracking-[0.18em] text-primary/70 mb-3">
              {t.capabilities.eyebrow}
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              {t.capabilities.heading}
            </h2>
            <p className="text-foreground/70 max-w-2xl mx-auto">
              {t.capabilities.subheading}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 text-left sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <FeatureCard
                key={feature.key}
                icon={<feature.icon className="h-6 w-6" />}
                title={feature.title}
                href={feature.href}
                description={feature.description}
              />
            ))}
          </div>
        </section>

        {/* Personas */}
        <section className="w-full px-4 py-24 max-w-5xl">
          <div className="mb-12 text-center">
            <div className="text-xs font-mono uppercase tracking-[0.18em] text-primary/70 mb-3">
              {t.personas.eyebrow}
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              {t.personas.heading}
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {personas.map((persona) => (
              <PersonaCard
                key={persona.key}
                icon={<persona.icon className={`w-8 h-8 ${persona.color}`} />}
                title={persona.title}
                description={persona.description}
                href={persona.href}
                action={persona.action}
              />
            ))}
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="w-full px-4 py-32 max-w-4xl">
          <div className="relative rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-10 sm:p-16 text-center overflow-hidden">
            <div className="absolute -inset-1 -z-10 bg-primary/10 blur-3xl opacity-40 rounded-full" />
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              {t.bottomCta.heading}
            </h2>
            <p className="text-foreground/70 mb-8 max-w-2xl mx-auto">
              {t.bottomCta.subheading}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href={t.bottomCta.primaryHref}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
              >
                {t.bottomCta.primary}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href={t.bottomCta.secondaryHref}
                className="inline-flex h-12 items-center justify-center rounded-lg border border-border bg-card/50 px-8 text-sm font-medium shadow-sm transition-all hover:bg-accent hover:text-accent-foreground backdrop-blur-sm"
              >
                {t.bottomCta.secondary}
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="w-full border-t border-border/60 mt-12">
          <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-foreground/60">
            <div>{t.footer.copyright}</div>
            <div className="flex items-center gap-6">
              <Link href={`/${lang}${t.footer.privacyHref}`} className="hover:text-foreground transition-colors">
                {t.footer.privacy}
              </Link>
              <Link href={`/${lang}${t.footer.termsHref}`} className="hover:text-foreground transition-colors">
                {t.footer.terms}
              </Link>
            </div>
          </div>
        </footer>

      </main>
    </HomeLayout>
  );
}
