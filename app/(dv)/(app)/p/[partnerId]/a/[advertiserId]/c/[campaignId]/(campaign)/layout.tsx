import type { ReactNode } from 'react';
import { ShellMain } from '@/components/shell/AppChrome';

// Frame C
export default function Layout({ children }: { children: ReactNode }) {
  return <ShellMain nav="campaign">{children}</ShellMain>;
}
