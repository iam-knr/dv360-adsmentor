'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/** One query param as state: setting it replaces the URL, so Back and reload keep the panel (routes.md 5.4). */
export function useParam(name: string): [string | null, (v: string | null) => void] {
  const router = useRouter();
  const path = usePathname();
  const search = useSearchParams();
  const value = search?.get(name) ?? null;
  const set = (v: string | null) => {
    const next = new URLSearchParams(search?.toString() ?? '');
    if (v === null) next.delete(name);
    else next.set(name, v);
    const qs = next.toString();
    router.replace(qs ? `${path}?${qs}` : path);
  };
  return [value, set];
}
