'use client';

import { useState } from 'react';
import { CommandBlock } from './command-block';
import type { InstallCommand } from '@/lib/download-i18n';
import { cn } from '@/lib/utils';

export interface CommandTab {
  key: string;
  label: string;
  commands: InstallCommand[];
}

interface CommandTabsProps {
  tabs: CommandTab[];
  defaultKey?: string;
  copyLabel: string;
  copiedLabel: string;
  highlightKey?: string | null;
}

export function CommandTabs({
  tabs,
  defaultKey,
  copyLabel,
  copiedLabel,
  highlightKey,
}: CommandTabsProps) {
  const initial = defaultKey ?? highlightKey ?? tabs[0]?.key;
  const [active, setActive] = useState(initial);
  const current = tabs.find((t) => t.key === active) ?? tabs[0];

  return (
    <div className="rounded-2xl border border-border/70 bg-card/40 p-1.5 shadow-sm">
      <div role="tablist" aria-label="Install method" className="flex flex-wrap gap-1">
        {tabs.map((tab) => {
          const isActive = tab.key === current.key;
          const isDetected = tab.key === highlightKey;
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={isActive}
              type="button"
              onClick={() => setActive(tab.key)}
              className={cn(
                'relative inline-flex items-center gap-2 rounded-xl px-4 py-1.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-foreground/70 hover:bg-accent/60 hover:text-foreground',
              )}
            >
              <span>{tab.label}</span>
              {isDetected ? (
                <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
              ) : null}
            </button>
          );
        })}
      </div>
      <div className="space-y-3 p-3">
        {current.commands.map((cmd, i) => (
          <CommandBlock
            key={`${current.key}-${i}`}
            label={cmd.label}
            command={cmd.command}
            copyLabel={copyLabel}
            copiedLabel={copiedLabel}
          />
        ))}
      </div>
    </div>
  );
}
