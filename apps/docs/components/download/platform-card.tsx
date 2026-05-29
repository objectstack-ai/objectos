import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { CommandBlock } from './command-block';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface PlatformCardProps {
  icon: React.ReactNode;
  title: string;
  tagline: string;
  description: string;
  command: string;
  commandLabel?: string;
  cta: string;
  href: string;
  copyLabel: string;
  copiedLabel: string;
  className?: string;
}

export function PlatformCard({
  icon,
  title,
  tagline,
  description,
  command,
  commandLabel,
  cta,
  href,
  copyLabel,
  copiedLabel,
  className,
}: PlatformCardProps) {
  return (
    <Card
      className={cn(
        'flex flex-col p-6 h-full border-border/60 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300',
        className,
      )}
    >
      <div className="mb-4 inline-flex w-fit items-center justify-center rounded-lg bg-primary/10 p-3 text-primary">
        {icon}
      </div>
      <div className="text-xs font-mono uppercase tracking-wider text-primary/70 mb-1">
        {tagline}
      </div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-foreground/70 text-sm leading-relaxed mb-4">{description}</p>
      <div className="mt-auto space-y-3">
        <CommandBlock
          command={command}
          label={commandLabel}
          copyLabel={copyLabel}
          copiedLabel={copiedLabel}
        />
        <Link
          href={href}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:gap-2 transition-all"
        >
          <span>{cta}</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </Card>
  );
}
