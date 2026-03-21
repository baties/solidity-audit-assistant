/**
 * Scan result route handler — GET /api/scan/:scanId.
 * Returns a completed scan record with all findings. Used by the report page.
 */
import { Request, Response } from 'express';
import { logger } from '../lib/logger';
import { getScanById } from '../db/queries';

/**
 * Handles GET /api/scan/:scanId.
 * @param req - URL param scanId must be a valid UUID
 * @param res - Returns 200 with scan + findings, 404 if not found
 */
export async function scanResultHandler(req: Request, res: Response): Promise<void> {
  const { scanId } = req.params;

  logger.debug({ scanId }, 'scan result requested');

  const record = await getScanById(scanId);

  if (!record) {
    res.status(404).json({ error: 'Scan not found' });
    return;
  }

  res.status(200).json(record);
}
