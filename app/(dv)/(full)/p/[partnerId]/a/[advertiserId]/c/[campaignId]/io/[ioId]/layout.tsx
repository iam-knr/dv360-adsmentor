import type { ReactNode } from 'react';
import { IoScope } from '@/lib/scope/scopes';

export default function Layout(props: {
  params: Promise<{ partnerId: string; advertiserId: string; campaignId: string; ioId: string }>;
  children: ReactNode;
}) {
  return <IoScope {...props} log={false} />;
}
