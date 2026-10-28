import type { ReactNode } from 'react';
import { ShellMain } from '@/components/shell/AppChrome';
import { IoScope } from '@/lib/scope/scopes';

// IO and LI pages have no left nav (routes.md 4.4).
export default function Layout(props: {
  params: Promise<{ partnerId: string; advertiserId: string; campaignId: string; ioId: string }>;
  children: ReactNode;
}) {
  return (
    <IoScope params={props.params}>
      <ShellMain>{props.children}</ShellMain>
    </IoScope>
  );
}
