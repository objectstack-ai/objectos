'use client';

import { useEffect, useState } from 'react';
import { CommandTabs, type CommandTab } from './command-tabs';
import { detectOs } from './os-detect';

interface CommandTabsClientProps {
  tabs: CommandTab[];
  copyLabel: string;
  copiedLabel: string;
}

/**
 * Wraps CommandTabs and seeds the default tab based on the detected
 * operating system, so the page lands on the right install method.
 */
export function CommandTabsClient(props: CommandTabsClientProps) {
  const [detected, setDetected] = useState<string | null>(null);

  useEffect(() => {
    setDetected(detectOs());
  }, []);

  return (
    <CommandTabs
      {...props}
      defaultKey={detected ?? props.tabs[0]?.key}
      highlightKey={detected}
    />
  );
}
