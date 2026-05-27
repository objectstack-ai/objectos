import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface DeployModeCardProps {
  icon: React.ReactNode;
  title: string;
  tagline: string;
  description: string;
  href: string;
  cta: string;
  className?: string;
}

export function DeployModeCard({ icon, title, tagline, description, href, cta, className }: DeployModeCardProps) {
  return (
    <Link href={href} className="block h-full group">
      <Card className={cn(
        "flex flex-col items-start p-7 h-full border-border/60 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300",
        className
      )}>
        <div className="mb-5 inline-flex items-center justify-center rounded-lg bg-primary/10 p-3 text-primary transition-transform duration-300 group-hover:scale-110">
          {icon}
        </div>
        <div className="text-xs font-mono uppercase tracking-wider text-primary/70 mb-2">
          {tagline}
        </div>
        <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors">
          {title}
        </h3>
        <p className="text-foreground/70 text-sm leading-relaxed mb-6 flex-grow">
          {description}
        </p>
        <div className="flex items-center gap-2 text-sm font-semibold text-primary mt-auto group-hover:gap-3 transition-all duration-300">
          <span>{cta}</span>
          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
        </div>
      </Card>
    </Link>
  );
}
