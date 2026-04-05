/**
 * Scan history route handler — GET /api/scan-history/:userId.
 * Returns a paginated list of scan summaries for the given user.
 * Called by the Next.js history API route which has already verified the session;
 * the userId in the path must match the authenticated user's internal DB UUID.
 */
import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';
import { getScansByUser } from '../db/queries';

/**
 * Handles GET /api/scan-history/:userId.
 * Returns up to 20 scan summaries for the user, newest first.
 * Accepts optional `?limit=N&offset=N` query params for pagination.
 * @param req - Params: userId (UUID). Query: limit, offset.
 * @param res - JSON array of ScanSummary objects
 * @param next - Forwards unexpected errors to the global error handler
 */
export async function scanHistoryHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { userId } = req.params;

  const limit  = Math.min(parseInt(req.query['limit']  as string ?? '20', 10) || 20, 100);
  const offset = Math.max(parseInt(req.query['offset'] as string ?? '0',  10) || 0,  0);

  try {
    const scans = await getScansByUser(userId, limit, offset);
    logger.debug({ userId, count: scans.length }, 'scan history fetched');
    res.status(200).json({ scans });
  } catch (err) {
    logger.error({ err, userId }, 'failed to fetch scan history');
    next(err);
  }
}
