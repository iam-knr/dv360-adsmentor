import type { ReactNode } from 'react';
import { ShellMain } from '@/components/shell/AppChrome';

// Frame G: top bar and rail, no left nav.
export default function GlobalLayout({ children }: { children: ReactNode }) {
  return <ShellMain>{children}</ShellMain>;
}
