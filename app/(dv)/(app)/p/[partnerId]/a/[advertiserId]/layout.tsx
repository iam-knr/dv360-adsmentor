import type { ReactNode } from 'react';
import { AdvertiserScope } from '@/lib/scope/scopes';

export default function Layout(props: {
  params: Promise<{ partnerId: string; advertiserId: string }>;
  children: ReactNode;
}) {
  return <AdvertiserScope {...props} />;
}
