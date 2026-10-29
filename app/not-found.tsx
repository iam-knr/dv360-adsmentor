import { NotFoundPage } from '@/components/shell/NotFoundPage';

// In-place 404 for missing, foreign or hidden entities (routes.md 6.5): same markup as /404, HTTP 404.
export default function NotFound() {
  return <NotFoundPage />;
}
