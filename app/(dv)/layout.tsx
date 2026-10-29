// (dv) guard layout (routes.md 5.1, 5.3): session present, class window open (second line behind middleware.ts),
// view-as. No visual chrome. Provides ViewerContext, the DialogHost and the SnackbarHost to both route trees.
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { DialogHost } from '@/components/shell/DialogHost';
import { ViewerProvider } from '@/components/shell/ViewerProvider';
import { SnackbarHost } from '@/components/dv';
import { requireOpenClass } from '@/lib/access/guard';
import { requireUserOrRedirect } from '@/lib/auth/session';
import { getChromeData } from '@/lib/scope/chrome-data';
import { toViewerInfo } from '@/lib/scope/guard';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { template: '%s - DV360 Simulator by Adsmetor', default: 'DV360 Simulator by Adsmetor' },
  icons: { icon: '/brand/adsmentor-icon.png' },
};

export default async function DvLayout({ children }: { children: ReactNode }) {
  const user = await requireUserOrRedirect();
  await requireOpenClass(user);
  const chrome = await getChromeData(user);
  return (
    <ViewerProvider value={{ viewer: toViewerInfo(user), chrome }}>
      <SnackbarHost>
        <DialogHost>{children}</DialogHost>
      </SnackbarHost>
    </ViewerProvider>
  );
}
