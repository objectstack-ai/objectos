import { Server, Container, ShieldOff, KeyRound, Lock, LineChart, Wrench, ShieldCheck, Briefcase } from 'lucide-react';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { baseOptions } from '@/lib/layout.shared';
import { getHomepageTranslations } from '@/lib/homepage-i18n';
import { HeroSection } from '@/components/hero-section';
import { CodePreview } from '@/components/code-preview';
import { FeatureCard } from '@/components/feature-card';
import { PersonaCard } from '@/components/persona-card';

export default async function HomePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const t = getHomepageTranslations(lang);

  const features = [
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
    <HomeLayout {...baseOptions()} i18n>
      <main className="flex min-h-screen flex-col items-center justify-center text-center px-4 py-16 sm:py-24 md:py-32 overflow-hidden bg-background text-foreground selection:bg-primary/20">
        
        {/* Hero Section */}
        <HeroSection
          badge={t.badge}
          title={t.hero.title}
          subtitle={t.hero.subtitle}
          cta={t.hero.cta}
          quickStart={t.hero.quickStart}
        />

        {/* Code Preview */}
        <CodePreview />

        {/* Grid Pattern Background */}
        <div className="absolute inset-0 -z-10 h-full w-full bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

        {/* Feature Grid */}
        <div className="mt-24 grid grid-cols-1 gap-6 text-left sm:grid-cols-2 lg:grid-cols-3 max-w-6xl w-full">
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

        {/* Personas Section */}
        <div className="mt-32 mb-16 w-full max-w-5xl px-4">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-12 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            {t.personas.heading}
          </h2>
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
        </div>

      </main>
    </HomeLayout>
  );
}

