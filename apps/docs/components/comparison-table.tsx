import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ComparisonTableProps {
  columns: { criterion: string; saas: string; objectos: string };
  rows: Array<{ criterion: string; saas: string; objectos: string }>;
  className?: string;
}

export function ComparisonTable({ columns, rows, className }: ComparisonTableProps) {
  return (
    <div className={cn('w-full overflow-x-auto rounded-xl border border-border bg-card/40 backdrop-blur-sm', className)}>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="px-6 py-4 font-semibold text-foreground/70">{columns.criterion}</th>
            <th className="px-6 py-4 font-semibold text-foreground/70">{columns.saas}</th>
            <th className="px-6 py-4 font-semibold text-primary">{columns.objectos}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors">
              <td className="px-6 py-4 font-medium text-foreground/90">{row.criterion}</td>
              <td className="px-6 py-4 text-foreground/60">
                <span className="inline-flex items-center gap-2">
                  <X className="h-4 w-4 text-red-500/70 shrink-0" />
                  {row.saas}
                </span>
              </td>
              <td className="px-6 py-4 text-foreground">
                <span className="inline-flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500 shrink-0" />
                  {row.objectos}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
