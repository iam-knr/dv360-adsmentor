// Simulator query params that follow the person from page to page (routes.md 6.1, 7.3).
// View-as reaches the server only through the URL (middleware.ts copies it into a header per request),
// so every in-app link must carry it. Per-page params (`sim_panel`, `sim_rail`, `sim_aid`) are not carried.

export const STICKY_SIM_PARAMS = ['sim_as', 'sim_act', 'sim_class'] as const;

/** Add the sticky `sim_*` params of `current` to `href` unless `href` sets them itself. External links pass through. */
export function withSimParams(href: string, current: URLSearchParams | string | null): string {
  if (!current || !href.startsWith('/') || href.startsWith('//')) return href;
  const from = typeof current === 'string' ? new URLSearchParams(current) : current;
  const sticky = STICKY_SIM_PARAMS.filter((k) => from.get(k));
  if (sticky.length === 0) return href;

  const hashAt = href.indexOf('#');
  const hash = hashAt >= 0 ? href.slice(hashAt) : '';
  const noHash = hashAt >= 0 ? href.slice(0, hashAt) : href;
  const qAt = noHash.indexOf('?');
  const path = qAt >= 0 ? noHash.slice(0, qAt) : noHash;
  const query = new URLSearchParams(qAt >= 0 ? noHash.slice(qAt + 1) : '');
  for (const k of sticky) {
    if (!query.has(k)) query.set(k, from.get(k) ?? '');
  }
  const qs = query.toString();
  return `${path}${qs ? `?${qs}` : ''}${hash}`;
}
