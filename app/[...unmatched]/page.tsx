import { redirect } from 'next/navigation';
import { notFoundPath } from '@/lib/routes/paths';

// Lowest priority catch-all (routes.md 5.1): an unknown path goes to /404?url={path}.
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ unmatched: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { unmatched } = await params;
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) {
    for (const value of Array.isArray(v) ? v : v === undefined ? [] : [v]) query.append(k, value);
  }
  const qs = query.toString();
  redirect(notFoundPath(`/${unmatched.join('/')}${qs ? `?${qs}` : ''}`));
}
