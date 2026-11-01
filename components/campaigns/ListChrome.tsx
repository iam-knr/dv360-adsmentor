'use client';

// Shared chrome of the Campaigns and Insertion orders lists (fidelity audit CAM-003..008): the "Campaigns" and
// "Insertion orders" sub-tabs, the `d` param writer of the date range dropdown, and the Intelligence panel that is
// open when the page loads.
import { useCallback, useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { DvTabs } from '@/components/dv/DvTabs';
import { confirmLeave } from '@/lib/hooks/useUnsavedGuard';
import { advertiserPath } from '@/lib/routes/paths';
import { withSimParams } from '@/lib/routes/sim-params';

export type ListTab = 'campaigns' | 'ios';

export function ListSubTabs({
  partnerId,
  advertiserId,
  active,
}: {
  partnerId: string;
  advertiserId: string;
  active: ListTab;
}) {
  const router = useRouter();
  const search = useSearchParams();
  const href = (segment: string) =>
    withSimParams(advertiserPath(partnerId, advertiserId, segment), search?.toString() ?? null);
  return (
    <DvTabs
      ariaLabel="Campaign lists"
      tabs={[
        { id: 'campaigns', label: 'Campaigns' },
        { id: 'ios', label: 'Insertion orders' },
      ]}
      value={active}
      onChange={(id) => {
        if (id === active) return;
        confirmLeave(() => router.push(href(id === 'campaigns' ? 'cs' : 'explorerios')));
      }}
    />
  );
}

/** Writes the `d` param (the server re-reads the metrics for the new range) and keeps the other params. */
export function useDateParam(): (d: string) => void {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  return useCallback(
    (d: string) => {
      const qs = new URLSearchParams(search?.toString() ?? '');
      qs.set('d', d);
      router.replace(`${pathname}?${qs.toString()}`, { scroll: false });
    },
    [router, pathname, search],
  );
}

/**
 * Real DV360 shows the Intelligence panel (Advertiser health, Optimization suggestions) every time the Campaigns list
 * loads. RailHost opens a panel from `?sim_rail=`; this sets it without a navigation. It only runs on mount.
 */
export function OpenIntelligenceOnLoad() {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('sim_rail')) return;
    url.searchParams.set('sim_rail', 'intelligence');
    window.history.replaceState(window.history.state, '', url.toString());
  }, []);
  return null;
}
