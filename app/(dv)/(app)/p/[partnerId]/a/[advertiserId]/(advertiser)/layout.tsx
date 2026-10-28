import type { ReactNode } from 'react';
import { ShellMain } from '@/components/shell/AppChrome';

// Frame A
export default function Layout({ children }: { children: ReactNode }) {
  return <ShellMain nav="advertiser">{children}</ShellMain>;
}
