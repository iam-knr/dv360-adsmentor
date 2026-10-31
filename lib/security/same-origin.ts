/** The Origin header (or, when a client sends none, Sec-Fetch-Site) must name this site. Pure. */
export function isSameOrigin(req: { headers: { get(name: string): string | null } }): boolean {
  const origin = req.headers.get('origin');
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (origin) {
    try {
      return !!host && new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  return req.headers.get('sec-fetch-site') === 'same-origin';
}
