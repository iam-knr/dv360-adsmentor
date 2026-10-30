'use client';

import { ErrorPage } from '@/components/shell/ErrorPage';

// Replaces the root layout when it fails, so it brings its own <html> and <body>.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html lang="en">
      <body>
        <ErrorPage digest={error.digest} />
      </body>
    </html>
  );
}
