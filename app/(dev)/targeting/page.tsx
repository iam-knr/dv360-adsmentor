import { notFound } from 'next/navigation';
import { TargetingDevClient } from './client';

/** Dev-only page: the real card before the LI form lands (P3-06c). 404 in production unless ENABLE_GALLERY=1. */
export default function Page() {
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_GALLERY !== '1') notFound();
  return <TargetingDevClient />;
}
