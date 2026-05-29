import Link from 'next/link';
import { ArrowRight, Terminal, ShieldCheck, Server, Tag, Boxes } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HeroSectionProps {
  badge: {
    status: string;
    version: string;
  };
  title: {
    line1: string;
    line2: string;
  };
  subtitle: {
    line1: string;
    line2: string;
  };
  cta: {
    primary: string;
    primaryHref: string;
    secondary: string;
    secondaryHref: string;
  };
  quickStart?: {
    label: string;
    commands: string[];
  };
  trustStrip?: {
    license: string;
    selfHosted: string;
    version: string;
    runtime: string;
  };
  className?: string;
}

export function HeroSection({ badge, title, subtitle, cta, quickStart, trustStrip, className }: HeroSectionProps) {
  return (
    <div className={cn("relative z-10 max-w-5xl space-y-8 animate-fade-in-up", className)}>
      {/* Layered radial glow backdrop — gives the hero depth without an image */}
      <div className="pointer-events-none absolute inset-x-0 -top-32 -z-10 flex justify-center" aria-hidden="true">
        <div className="h-[36rem] w-[36rem] rounded-full bg-primary/20 blur-[120px] opacity-60" />
      </div>
      <div className="pointer-events-none absolute -top-10 left-1/4 -z-10 h-72 w-72 rounded-full bg-blue-500/10 blur-[100px]" aria-hidden="true" />
      <div className="pointer-events-none absolute -top-20 right-1/4 -z-10 h-72 w-72 rounded-full bg-purple-500/10 blur-[100px]" aria-hidden="true" />

      {/* Badge */}
      <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary backdrop-blur-sm transition-all duration-300 hover:bg-primary/10 hover:border-primary/30 hover:scale-105">
        <span className="flex h-2 w-2 rounded-full bg-primary mr-2 animate-pulse"></span>
        <span className="font-medium">{badge.status}</span>
        <span className="mx-2 text-primary/50">&bull;</span>
        <span className="font-semibold">{badge.version}</span>
      </div>

      {/* Title */}
      <h1 className="text-5xl font-extrabold tracking-tight sm:text-7xl md:text-8xl bg-gradient-to-br from-foreground via-foreground/90 to-primary/60 bg-clip-text text-transparent pb-4 leading-tight">
        {title.line1}
        <br/>
        {title.line2}
      </h1>
      
      {/* Subtitle */}
      <p className="mx-auto max-w-2xl text-lg text-foreground/80 sm:text-xl leading-relaxed">
        {subtitle.line1}
        <br className="hidden sm:inline" />
        <span className="text-foreground font-semibold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
          {subtitle.line2}
        </span>
      </p>

      {/* Quick Start Terminal — with glow halo */}
      {quickStart && (
        <div className="relative mx-auto max-w-lg">
          <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-primary/30 via-blue-500/20 to-purple-500/30 blur-lg opacity-50 group-hover:opacity-70 transition-opacity" aria-hidden="true" />
          <div className="relative rounded-lg border border-border bg-card/80 backdrop-blur-sm overflow-hidden shadow-lg">
            <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-2">
              <div className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
              <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/60" />
              <div className="h-2.5 w-2.5 rounded-full bg-green-500/60" />
              <span className="ml-2 text-[11px] text-muted-foreground font-mono">{quickStart.label}</span>
            </div>
            <div className="px-4 py-3 font-mono text-sm leading-7 text-left">
              {quickStart.commands.map((cmd, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-primary/60 select-none">$</span>
                  <span className="text-foreground/90">{cmd}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CTA Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
        <Link
          href={cta.primaryHref}
          className="group relative inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-8 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          {cta.primary}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
        <Link
          href={cta.secondaryHref}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-border bg-card/50 px-8 text-sm font-medium shadow-sm transition-all hover:bg-accent hover:text-accent-foreground backdrop-blur-sm hover:scale-[1.03] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Terminal className="h-4 w-4" />
          {cta.secondary}
        </Link>
      </div>

      {/* Trust strip — small chips that anchor the hero in real facts */}
      {trustStrip && (
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-6 text-xs text-foreground/60">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-primary/70" />
            {trustStrip.license}
          </span>
          <span className="text-foreground/20">•</span>
          <span className="inline-flex items-center gap-1.5">
            <Server className="h-3.5 w-3.5 text-primary/70" />
            {trustStrip.selfHosted}
          </span>
          <span className="text-foreground/20">•</span>
          <span className="inline-flex items-center gap-1.5 font-mono">
            <Tag className="h-3.5 w-3.5 text-primary/70" />
            {trustStrip.version}
          </span>
          <span className="text-foreground/20 hidden sm:inline">•</span>
          <span className="inline-flex items-center gap-1.5">
            <Boxes className="h-3.5 w-3.5 text-primary/70" />
            {trustStrip.runtime}
          </span>
        </div>
      )}
    </div>
  );
}
