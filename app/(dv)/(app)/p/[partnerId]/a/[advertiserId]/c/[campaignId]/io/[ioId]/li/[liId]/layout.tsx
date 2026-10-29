import type { ReactNode } from 'react';
import { LiFrame } from '@/components/shell/Frames';
import { LiScope } from '@/lib/scope/scopes';

// Frame LI: "Overview › {IO name} ›", LI name, tabs by type
export default function Layout(props: {
  params: Promise<{
    partnerId: string;
    advertiserId: string;
    campaignId: string;
    ioId: string;
    liId: string;
  }>;
  children: ReactNode;
}) {
  return (
    <LiScope params={props.params}>
      <LiFrame>{props.children}</LiFrame>
    </LiScope>
  );
}
