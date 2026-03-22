/**
 * Next.js configuration.
 * In development, rewrites /api/* to the Express server on :3001.
 * In production, Nginx handles routing — rewrites are not applied.
 * Uses .mjs (not .ts) — Next.js 14 does not support TypeScript config files.
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    // Only proxy to local Express in development.
    // In production, Nginx routes /api/* → Express directly.
    if (process.env.NODE_ENV !== 'development') return [];
    return [
      {
        source: '/api/:path*',
        destination: `http://localhost:${process.env.PORT ?? 3001}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
