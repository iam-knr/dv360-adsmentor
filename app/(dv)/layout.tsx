// (dv) guard layout (routes.md 5.1, 5.3): session present (second line behind middleware.ts),
// view-as. No visual chrome. Provides ViewerContext, the DialogHost and the SnackbarHost to both route trees.
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { DialogHost } from '@/components/shell/DialogHost';
import { ViewerProvider } from '@/components/shell/ViewerProvider';
import { SnackbarHost } from '@/components/dv';
import { ScreenshotGuardMount } from '@/components/security/ScreenshotGuardMount';
import { requireUserOrRedirect } from '@/lib/auth/session';
import { scheduleMaybeAdvance } from '@/lib/sandbox/maybe-advance';
import { getChromeData } from '@/lib/scope/chrome-data';
import { toViewerInfo } from '@/lib/scope/guard';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  // Real DV360 shows the same tab title on every page (CAM-021, 050, 071, REP-021); the template drops the page name.
  title: { template: 'Display & Video 360', default: 'Display & Video 360' },
};

export default async function DvLayout({ children }: { children: ReactNode }) {
  const user = await requireUserOrRedirect();
  // lazy engine catch-up and provisioning, after the response (docs/gaps/prov-drive.md)
  scheduleMaybeAdvance(user.viewAs ? null : user.sandboxId);
  const chrome = await getChromeData(user);
  return (
    <ViewerProvider value={{ viewer: toViewerInfo(user), chrome }}>
      <ScreenshotGuardMount user={user} />
      <SnackbarHost>
        <DialogHost>{children}</DialogHost>
      </SnackbarHost>
    </ViewerProvider>
  );
}
