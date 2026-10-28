import type { ReactNode } from 'react';
import { IoFrame } from '@/components/shell/Frames';

// Frame IO: "Overview ›", IO name, tabs
export default function Layout({ children }: { children: ReactNode }) {
  return <IoFrame>{children}</IoFrame>;
}
