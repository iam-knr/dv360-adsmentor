// Synthetic app catalogue search for the Mobile app install pre-step (module 08 Δ-08-6, L19; explore 19 2.4).
// Reads data/reference/apps.json (P3-05b). The publisher line is derived, so "demo" finds every app (PW-08-07).
import appsJson from '../../data/reference/apps.json';
import type { AppSearchRow } from './types';

interface AppRef {
  id: string;
  name: string;
  platform: 'IOS' | 'ANDROID';
  category: string;
}

const APPS = appsJson as AppRef[];

function toRow(a: AppRef): AppSearchRow {
  const publisher = `${a.name.split(' ')[0] ?? a.name} Demo Studios`;
  return {
    id: a.id,
    store: a.platform,
    name: a.name,
    publisher,
    storeLine: a.platform === 'ANDROID' ? `Android - ${a.id}` : `iOS - ${a.id}`,
  };
}

/** Apps whose name, publisher or store id contains `q` (case-insensitive), filtered by platform. */
export function searchApps(platform: 'ALL' | 'IOS' | 'ANDROID', q: string, limit = 20) {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  return APPS.filter((a) => platform === 'ALL' || a.platform === platform)
    .map(toRow)
    .filter((r) =>
      [r.name, r.publisher, r.id].some((field) => field.toLowerCase().includes(needle)),
    )
    .slice(0, limit);
}

export function findApp(id: string | null | undefined): AppSearchRow | null {
  const a = id ? APPS.find((x) => x.id === id) : undefined;
  return a ? toRow(a) : null;
}
