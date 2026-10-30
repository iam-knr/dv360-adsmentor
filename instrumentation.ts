// Server error log for production (Vercel runtime logs). Next hides the message of a Server Components error from the
// browser and shows only a digest; this hook writes route, params (names and ids only), the digest and the error to
// console.error so a tester's "Error reference" can be found. No headers, cookies or bodies are logged.
import type { Instrumentation } from 'next';

export const onRequestError: Instrumentation.onRequestError = (err, request, context) => {
  const error = err as { digest?: string; message?: string; stack?: string; name?: string };
  console.error(
    '[request-error]',
    JSON.stringify({
      digest: error.digest,
      method: request.method,
      path: request.path.split('?')[0],
      routePath: context.routePath,
      routeType: context.routeType,
      renderSource: context.renderSource,
      error: error.name,
      message: error.message,
    }),
    error.stack ?? '',
  );
};
