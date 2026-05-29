import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { CommandBlock } from './command-block';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ClientCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  cta: string;
  href: string;
  command?: string;
  copyLabel: string;
  copiedLabel: string;
  className?: string;
}

export function ClientCard({
  icon,
  title,
  description,
  cta,
  href,
  command,
  copyLabel,
  copiedLabel,
  className,
}: ClientCardProps) {
  return (
    <Card
      className={cn(
        'flex flex-col p-6 h-full border-border/60 hover:border-primary/40 hover:shadow-md transition-all',
        className,
      )}
    >
      <div className="mb-3 inline-flex w-fit items-center justify-center rounded-md bg-primary/10 p-2.5 text-primary">
        {icon}
      </div>
      <h3 className="text-base font-semibold mb-1">{title}</h3>
      <p className="text-foreground/70 text-sm leading-relaxed mb-4">{description}</p>
      {command ? (
        <div className="mb-4">
          <CommandBlock
            command={command}
            copyLabel={copyLabel}
            copiedLabel={copiedLabel}
          />
        </div>
      ) : null}
      <Link
        href={href}
        className="mt-auto inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:gap-2 transition-all"
      >
        <span>{cta}</span>
        <ArrowRight className="h-4 w-4" />
      </Link>
    </Card>
  );
}
