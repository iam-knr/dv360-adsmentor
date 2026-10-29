import type { ReactNode } from 'react';
import { FullChrome } from '@/components/shell/AppChrome';

export default function FullLayout({ children }: { children: ReactNode }) {
  return <FullChrome>{children}</FullChrome>;
}
