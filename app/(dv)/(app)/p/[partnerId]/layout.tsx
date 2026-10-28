import type { ReactNode } from 'react';
import { PartnerScope } from '@/lib/scope/scopes';

export default function Layout(props: {
  params: Promise<{ partnerId: string }>;
  children: ReactNode;
}) {
  return <PartnerScope {...props} />;
}
