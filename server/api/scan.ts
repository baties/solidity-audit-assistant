/**
 * Scan route handler — POST /api/scan.
 * Validates the request body with Zod, then delegates to the orchestrator.
 * Phase 0: returns 501 Not Implemented. Phase 1 wires in the full pipeline.
 */
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { logger } from '../lib/logger';

/** Zod schema for scan request body — mirrors the ScanRequest type. */
const ScanRequestSchema = z.object({
  target: z.string().min(1).max(500),
  targetType: z.enum(['github', 'address']),
  chain: z.enum(['ethereum', 'polygon', 'arbitrum', 'optimism', 'base', 'bsc']).optional(),
});

/**
 * Handles POST /api/scan.
 * Validates input with Zod, assigns a scanId, and invokes the scan pipeline.
 * @param req  - Express request; body must match ScanRequestSchema
 * @param res  - Express response
 * @param next - Express next (forwards unhandled errors to global handler)
 * @returns 202 with scanId on success, 400 on validation failure, 501 in Phase 0
 */
export async function scanHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const parseResult = ScanRequestSchema.safeParse(req.body);

  if (!parseResult.success) {
    res.status(400).json({
      error: 'Invalid request',
      details: parseResult.error.flatten(),
    });
    return;
  }

  const scanId = randomUUID();
  const { target, targetType, chain } = parseResult.data;

  logger.info({ scanId, target, targetType, chain }, 'scan request received');

  // Phase 1: invoke orchestrator, persist to DB, return 202 + scanId
  res.status(501).json({
    message: 'Scan endpoint not yet implemented — Phase 1',
    scanId,
  });
}
