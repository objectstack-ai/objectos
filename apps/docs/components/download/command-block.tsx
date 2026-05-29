import { CopyButton } from './copy-button';
import { cn } from '@/lib/utils';

interface CommandBlockProps {
  command: string;
  label?: string;
  copyLabel: string;
  copiedLabel: string;
  className?: string;
}

/**
 * Terminal-style command block with a copy button. Renders the
 * command on multiple lines (split on newline) with a `$` prompt
 * per line for visual fidelity.
 */
export function CommandBlock({ command, label, copyLabel, copiedLabel, className }: CommandBlockProps) {
  const lines = command.split('\n');
  return (
    <div className={cn('rounded-lg border border-border bg-card/80 overflow-hidden shadow-sm', className)}>
      <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/50 px-3 py-1.5">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-red-500/50" />
          <div className="h-2 w-2 rounded-full bg-yellow-500/50" />
          <div className="h-2 w-2 rounded-full bg-green-500/50" />
          {label ? (
            <span className="ml-2 text-[11px] font-mono text-muted-foreground">{label}</span>
          ) : null}
        </div>
        <CopyButton value={command} copyLabel={copyLabel} copiedLabel={copiedLabel} />
      </div>
      <pre className="m-0 overflow-x-auto px-4 py-3 font-mono text-sm leading-6 text-left">
        {lines.map((line, i) => (
          <div key={i} className="flex gap-2">
            <span className="text-primary/60 select-none">$</span>
            <span className="text-foreground/90 whitespace-pre">{line}</span>
          </div>
        ))}
      </pre>
    </div>
  );
}
