/**
 * Next.js configuration.
 * In development, rewrites most /api/* paths to the Express server on :3001.
 * Paths handled by Next.js Route Handlers (/api/auth/*, /api/scan, /api/history)
 * are excluded from the rewrite — Next.js Route Handlers take priority, but being
 * explicit avoids confusion and ensures correct prod parity.
 * In production, Nginx handles routing — rewrites are not applied.
 * Uses .mjs (not .ts) — Next.js 14 does not support TypeScript config files.
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    // Only proxy to local Express in development.
    // In production, Nginx routes /api/* → Express directly (except auth paths handled by Nginx below).
    if (process.env.NODE_ENV !== 'development') return [];
    return [
      {
        // Proxy low-level scan lookup and health check to Express.
        // /api/scan (POST) and /api/auth/* and /api/history are handled by Route Handlers above.
        source: '/api/:path*',
        destination: `http://localhost:${process.env.PORT ?? 3001}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
