/**
 * Scan route handler — POST /api/scan.
 * Validates input, persists scan state to DB, runs the pipeline synchronously,
 * and returns the complete ScanResult. Runs synchronously for MVP simplicity.
 */
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { logger } from '../lib/logger';
import { runScan } from '../agents/orchestrator';
import { createScan, updateScanStatus, completeScan, failScan, insertFindings } from '../db/queries';

const ScanRequestSchema = z.object({
  target:     z.string().min(1).max(500),
  targetType: z.enum(['github', 'address']),
  chain:      z.enum(['ethereum', 'polygon', 'arbitrum', 'optimism', 'base', 'bsc']).optional(),
});

/**
 * Handles POST /api/scan.
 * Orchestrates: validate → create DB record → run pipeline → persist results → respond.
 * Scans run synchronously; the request blocks until the scan completes (up to ~60s).
 * @param req  - Body must satisfy ScanRequestSchema
 * @param res  - Returns 200 ScanResult on success, 400 on bad input, 500 on pipeline failure
 * @param next - Forwards unexpected errors to the global error handler
 */
export async function scanHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const parseResult = ScanRequestSchema.safeParse(req.body);

  if (!parseResult.success) {
    res.status(400).json({ error: 'Invalid request', details: parseResult.error.flatten() });
    return;
  }

  const { target, targetType, chain } = parseResult.data;

  // Create DB record before pipeline starts so we can track failures
  const scanId = await createScan(target, targetType, chain);
  await updateScanStatus(scanId, 'running');

  logger.info({ scanId, target, targetType, chain }, 'scan started');

  try {
    const result = await runScan({ target, targetType, chain }, scanId);

    // Persist results to DB
    await completeScan(scanId, result.riskScore, result.riskLabel, result.summary, result.durationMs);
    await insertFindings(scanId, result.findings);

    logger.info({ scanId, riskScore: result.riskScore, durationMs: result.durationMs }, 'scan completed');

    res.status(200).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown pipeline error';
    await failScan(scanId, message).catch(() => {
      // Best-effort: if DB update fails, still continue to error response
      logger.error({ scanId }, 'failed to update scan status to failed');
    });

    logger.error({ err, scanId }, 'scan pipeline failed');
    next(err);
  }
}
