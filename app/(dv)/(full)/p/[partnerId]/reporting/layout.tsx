import type { ReactNode } from 'react';
import { ReportsFrame } from '@/components/shell/Frames';

// Frame R
export default function Layout({ children }: { children: ReactNode }) {
  return <ReportsFrame>{children}</ReportsFrame>;
}
