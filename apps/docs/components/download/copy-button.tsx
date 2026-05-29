'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CopyButtonProps {
  value: string;
  copyLabel: string;
  copiedLabel: string;
  className?: string;
}

export function CopyButton({ value, copyLabel, copiedLabel, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          /* ignore */
        }
      }}
      aria-label={copied ? copiedLabel : copyLabel}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-md border border-border/70 bg-card/60 px-2.5 text-xs font-medium text-foreground/70 backdrop-blur-sm transition-colors hover:bg-accent hover:text-foreground',
        className,
      )}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
      <span>{copied ? copiedLabel : copyLabel}</span>
    </button>
  );
}
