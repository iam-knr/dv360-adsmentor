'use client';

import { ErrorPage } from '@/components/shell/ErrorPage';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorPage onRetry={reset} digest={error.digest} />;
}
