import type { Metadata } from 'next';
import { NotFoundPage } from '@/components/shell/NotFoundPage';

export const metadata: Metadata = { title: 'Page not found - DV360 Simulator by Adsmetor' };

// Destination of the catch-all: /404?url={path} (routes.md 6.5, matches DV360 /ng_nav/404?url=).
export default function Page() {
  return <NotFoundPage />;
}
