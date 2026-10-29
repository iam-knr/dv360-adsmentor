'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { parseListParams, serializeListParams, type ListParams } from './list-params';

export interface UseListParams {
  params: ListParams;
  /** Merge a change into the URL. Changing anything but `page` goes back to page 1. */
  update: (patch: Partial<ListParams>) => void;
}

/** URL-backed list state for grids (routes.md 6.1). Bad values fall back to the defaults and the URL is cleaned. */
export function useListParams(defaults: Partial<ListParams> = {}): UseListParams {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const key = JSON.stringify(defaults);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` stands for `defaults`
  const stable = useMemo(() => defaults, [key]);
  const { params, dirty } = useMemo(
    () => parseListParams(new URLSearchParams(search.toString()), stable),
    [search, stable],
  );

  const go = useCallback(
    (next: ListParams) => {
      const qs = serializeListParams(
        next,
        stable,
        new URLSearchParams(search.toString()),
      ).toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, search, stable],
  );

  useEffect(() => {
    if (dirty) go(params);
  }, [dirty, go, params]);

  const update = useCallback(
    (patch: Partial<ListParams>) => {
      const next = { ...params, ...patch };
      if (!('page' in patch)) next.page = 1;
      go(next);
    },
    [go, params],
  );

  return { params, update };
}
