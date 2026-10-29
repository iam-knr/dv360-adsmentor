import 'server-only';
// Page helper: a service read that fails with NOT_FOUND or FORBIDDEN renders the 404 page in place (routes R10).
import { notFound } from 'next/navigation';
import { ServiceFailure } from '@/lib/campaigns/service-kit';

export async function orNotFound<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ServiceFailure) notFound();
    throw e;
  }
}
