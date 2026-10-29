import type { ReactNode } from 'react';
import { IoHeader } from '@/components/insertion-orders/IoHeader';

// Frame IO: "Overview ›", IO name with status, tabs (module 07 2.6)
export default function Layout({ children }: { children: ReactNode }) {
  return <IoHeader>{children}</IoHeader>;
}
