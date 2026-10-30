'use client';

// Global shortcuts of routes.md 4.7 (behaviour per design-system 5.4). `?` opens the shortcuts dialog, `/` the search
// overlay, Shift+N the create page of the current list (none on other pages, and none without write access).
// The grid shortcuts (Download SDF, CSV, Duplicate) belong to the grids; here they let the browser have the key.
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useHotkeys } from '@/lib/hooks/useHotkeys';
import { confirmLeave } from '@/lib/hooks/useUnsavedGuard';
import { newIoTarget, newLiTarget, newTargetFor } from '@/lib/routes/paths';
import { withSimParams } from '@/lib/routes/sim-params';
import { usePageScope } from '@/lib/scope/context';
import { useShellDialogs } from './DialogHost';
import { useViewer } from './ViewerProvider';

export function ShellHotkeys() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const { ids } = usePageScope();
  const { viewer } = useViewer();
  const { openShortcuts, setSearchOpen } = useShellDialogs();

  const go = (href: string | null) => {
    if (!href || viewer.readOnly) return false;
    const target = withSimParams(href, search?.toString() ?? null);
    confirmLeave(() => router.push(target));
    return true;
  };

  useHotkeys([
    { key: '?', inModal: true, handler: () => openShortcuts() },
    { key: '/', handler: () => setSearchOpen(true) },
    { key: 'N', shift: true, handler: () => go(newTargetFor(pathname, ids)) },
    { key: 'I', shift: true, handler: () => go(newIoTarget(ids)) },
    { key: 'L', shift: true, handler: () => go(newLiTarget(ids)) },
    { key: 'K', mod: true, shift: true, handler: () => false },
    { key: 'L', mod: true, shift: true, handler: () => false },
    { key: 'D', mod: true, handler: () => false },
  ]);
  return null;
}
