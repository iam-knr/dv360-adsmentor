'use client';

import { ErrorPage } from '@/components/shell/ErrorPage';

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorPage onRetry={reset} />;
}
