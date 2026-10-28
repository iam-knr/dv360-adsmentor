import type { ReactNode } from 'react';
import { CampaignScope } from '@/lib/scope/scopes';

export default function Layout(props: {
  params: Promise<{ partnerId: string; advertiserId: string; campaignId: string }>;
  children: ReactNode;
}) {
  return <CampaignScope {...props} log={false} />;
}
