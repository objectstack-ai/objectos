import Link from 'next/link';
import { Download } from 'lucide-react';
import { MANUAL_DOWNLOADS } from '@/lib/download-i18n';

interface DownloadTableProps {
  heading: string;
  cols: { arch: string; file: string; size: string; sha: string };
  shaHref: string;
  shaLabel: string;
}

export function DownloadTable({ heading, cols, shaHref, shaLabel }: DownloadTableProps) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/40 overflow-hidden">
      <div className="flex items-center justify-between gap-4 border-b border-border/60 px-5 py-3">
        <h3 className="text-sm font-semibold">{heading}</h3>
        <Link
          href={shaHref}
          className="text-xs text-foreground/60 hover:text-foreground transition-colors"
        >
          {shaLabel} ↗
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-foreground/50">
              <th className="px-5 py-2 font-medium">{cols.arch}</th>
              <th className="px-5 py-2 font-medium">{cols.file}</th>
              <th className="px-5 py-2 font-medium text-right">{cols.size}</th>
              <th className="px-5 py-2 font-medium text-right">{''}</th>
            </tr>
          </thead>
          <tbody>
            {MANUAL_DOWNLOADS.map((d) => (
              <tr key={`${d.os}-${d.arch}`} className="border-t border-border/40 hover:bg-accent/30">
                <td className="px-5 py-2.5 whitespace-nowrap">
                  <span className="font-medium">{d.os}</span>{' '}
                  <span className="text-foreground/50 text-xs">{d.arch}</span>
                </td>
                <td className="px-5 py-2.5 font-mono text-xs text-foreground/80">{d.file}</td>
                <td className="px-5 py-2.5 text-right text-foreground/60 text-xs">{d.size}</td>
                <td className="px-5 py-2.5 text-right">
                  <Link
                    href={d.href}
                    className="inline-flex items-center gap-1 text-primary hover:underline text-xs font-medium"
                  >
                    <Download className="h-3.5 w-3.5" /> .tar.gz
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
