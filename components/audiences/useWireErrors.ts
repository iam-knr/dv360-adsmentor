'use client';

import { useState } from 'react';
import type { WireIssue } from '@/lib/audiences/wire';

/** Field errors of a create call that ran without the page-level save hook (the stacked panel). */
export function useWireErrors() {
  const [issues, set] = useState<WireIssue[]>([]);
  const err = (path: string): string | undefined =>
    issues.find((i) => i.severity === 'error' && (i.path === path || i.path.startsWith(`${path}[`)))?.message;
  return { issues, set, err };
}
