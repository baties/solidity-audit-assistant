/**
 * Health check route handler — GET /api/health.
 * Used by Docker healthchecks, load balancers, and uptime monitors.
 * Returns 200 with a timestamp so callers can verify liveness.
 */
import { Request, Response } from 'express';

/**
 * Handles GET /api/health.
 * @param _req - Express request (unused)
 * @param res  - Express response
 * @returns 200 JSON with status and current timestamp
 */
export function healthHandler(_req: Request, res: Response): void {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
}
