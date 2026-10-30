import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // forbidden() and app/forbidden.tsx: a FORBIDDEN service failure on a page renders a 403 page (PROD-CRASH)
  experimental: { authInterrupts: true },
};

export default nextConfig;
