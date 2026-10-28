'use client';

// Left navigation (routes.md 4.2 to 4.5, design-system 2.2). The tree comes from lib/nav/trees.ts for the level and
// the viewer's access level. Group open state persists in localStorage `sim.nav.open.{level}`; on load the group of
// the active item is open, and on a first visit only that group is open (RT Q4).
import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { DvNav, type NavItem } from '@/components/dv';
import { activeKey, buildTree, groupOf, type NavLevel } from '@/lib/nav/trees';
import { AppLink } from '@/lib/routes/AppLink';
import { basePath } from '@/lib/routes/paths';
import { idsOf, useRegisterNav, useScope } from '@/lib/scope/context';
import { readStorage, savePrefsQuietly, useChromeState, writeStorage } from './ChromeState';
import { useViewer } from './ViewerProvider';

export const navOpenKey = (level: NavLevel) => `sim.nav.open.${level}`;

function readOpen(level: NavLevel): string[] | null {
  const raw = readStorage(navOpenKey(level));
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : null;
  } catch {
    return null;
  }
}

export function SideNav({ level }: { level: NavLevel }) {
  useRegisterNav(true);
  const scope = useScope();
  const ids = idsOf(scope);
  const pathname = usePathname();
  const { viewer } = useViewer();
  const { navCollapsed } = useChromeState();

  const items = useMemo(
    () =>
      ids.partnerId ? buildTree(level, { ...ids, partnerId: ids.partnerId }, viewer.dvRole) : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ids are primitives inside
    [level, ids.partnerId, ids.advertiserId, ids.campaignId, viewer.dvRole],
  );
  const base = basePath(level, ids) ?? '';
  const active = activeKey(level, pathname, base) ?? '';
  const activeGroup = active ? groupOf(level, active) : null;

  const [open, setOpen] = useState<string[]>(activeGroup ? [activeGroup] : []);
  useEffect(() => {
    const stored = readOpen(level);
    const next = new Set(stored ?? []);
    if (activeGroup) next.add(activeGroup);
    setOpen([...next]);
  }, [level, activeGroup]);

  const toggle = (id: string) => {
    const next = open.includes(id) ? open.filter((g) => g !== id) : [...open, id];
    setOpen(next);
    writeStorage(navOpenKey(level), JSON.stringify(next));
    savePrefsQuietly({ navOpen: Object.fromEntries(next.map((g) => [`${level}.${g}`, true])) });
  };

  return (
    <DvNav
      items={items as NavItem[]}
      mode={navCollapsed ? 'rail' : 'expanded'}
      activeId={active}
      openGroupIds={open}
      onToggleGroup={toggle}
      linkComponent={AppLink}
    />
  );
}
