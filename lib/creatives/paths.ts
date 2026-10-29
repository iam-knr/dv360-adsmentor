// Path builders of the creative routes (routes.md 3.7, tabs are path segments, RT R3). Client safe.
import { advertiserPath } from '@/lib/routes/paths';

export type CreativeTab = 'details' | 'status' | 'history';

export function creativesPath(pid: string, aid: string): string {
  return advertiserPath(pid, aid, 'creatives');
}

export function creativePath(
  pid: string,
  aid: string,
  cid: string,
  tab: CreativeTab = 'details',
): string {
  return tab === 'details'
    ? advertiserPath(pid, aid, 'creatives', cid)
    : advertiserPath(pid, aid, 'creatives', cid, tab);
}

export function newCreativePath(pid: string, aid: string, kind: string): string {
  return `${advertiserPath(pid, aid, 'creatives', 'new')}?kind=${encodeURIComponent(kind)}`;
}
