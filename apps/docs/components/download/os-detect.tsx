'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Apple, Monitor, ArrowRight } from 'lucide-react';
import type { OsKey } from '@/lib/download-i18n';
import { MANUAL_DOWNLOADS } from '@/lib/download-i18n';
import { cn } from '@/lib/utils';

interface OsDetectHeroProps {
  primaryCta: string;
  secondaryCta: string;
  secondaryHref: string;
  detected: string;
  detecting: string;
  notSure: string;
  onDetect?: (os: OsKey) => void;
}

const OS_LABEL: Record<OsKey, string> = {
  macos: 'macOS',
  linux: 'Linux',
  windows: 'Windows',
};

function detectOs(): OsKey | null {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent.toLowerCase();
  const platform = (navigator.platform || '').toLowerCase();
  if (platform.includes('mac') || ua.includes('mac os')) return 'macos';
  if (platform.includes('win') || ua.includes('windows')) return 'windows';
  if (platform.includes('linux') || ua.includes('linux')) return 'linux';
  return null;
}

function detectArch(os: OsKey): 'arm64' | 'x64' {
  if (typeof navigator === 'undefined') return 'x64';
  const ua = navigator.userAgent.toLowerCase();
  if (os === 'macos') {
    // Apple Silicon Macs still report x86_64; assume arm64 by default on macOS.
    return 'arm64';
  }
  if (ua.includes('arm64') || ua.includes('aarch64')) return 'arm64';
  return 'x64';
}

function downloadFor(os: OsKey, arch: 'arm64' | 'x64') {
  const wanted = os === 'macos' ? 'macOS' : os === 'linux' ? 'Linux' : 'Windows';
  return (
    MANUAL_DOWNLOADS.find((d) => d.os === wanted && d.arch === arch) ??
    MANUAL_DOWNLOADS.find((d) => d.os === wanted) ??
    null
  );
}

export function OsDetectHero({
  primaryCta,
  secondaryCta,
  secondaryHref,
  detected,
  detecting,
  notSure,
  onDetect,
}: OsDetectHeroProps) {
  const [os, setOs] = useState<OsKey | null>(null);
  const [arch, setArch] = useState<'arm64' | 'x64'>('x64');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const detectedOs = detectOs();
    setOs(detectedOs);
    if (detectedOs) {
      setArch(detectArch(detectedOs));
      onDetect?.(detectedOs);
    }
    setReady(true);
  }, [onDetect]);

  const dl = os ? downloadFor(os, arch) : null;
  const Icon = os === 'macos' ? Apple : os === 'windows' ? Monitor : Monitor;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link
          href={dl?.href ?? secondaryHref}
          className={cn(
            'group inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-primary/30',
            !ready && 'opacity-80',
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
          <span>
            {primaryCta} {ready && os ? `${OS_LABEL[os]} (${arch})` : '…'}
          </span>
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
        <Link
          href={secondaryHref}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-border bg-card/50 px-6 text-sm font-medium shadow-sm transition-all hover:bg-accent hover:text-accent-foreground backdrop-blur-sm"
        >
          {secondaryCta}
        </Link>
      </div>
      <div className="text-xs text-foreground/60">
        {ready
          ? os
            ? `${detected}: ${OS_LABEL[os]} · ${arch}${dl ? ` · ${dl.file} (${dl.size})` : ''}`
            : notSure
          : detecting}
      </div>
    </div>
  );
}

export { detectOs };
