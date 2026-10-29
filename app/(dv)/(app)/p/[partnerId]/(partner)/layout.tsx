import type { ReactNode } from 'react';
import { ShellMain } from '@/components/shell/AppChrome';

// Frame P
export default function Layout({ children }: { children: ReactNode }) {
  return <ShellMain nav="partner">{children}</ShellMain>;
}
