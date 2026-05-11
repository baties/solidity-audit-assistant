/**
 * API key management route handlers + apiKeyAuth middleware.
 * Handlers require X-User-Id (injected by the Next.js session proxy).
 * apiKeyAuth is used as middleware on POST /v1/scan — validates X-Api-Key and
 * injects the owning user's UUID as X-User-Id so the scan handler works unchanged.
 */
import { createHash, randomBytes } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { logger } from '../lib/logger';
import {
  createApiKey,
  getApiKeyByHash,
  getApiKeysByUser,
  deactivateApiKey,
  touchApiKeyLastUsed,
} from '../db/queries';

const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

/**
 * Generates a cryptographically secure API key triplet.
 * @returns plaintext key (returned to caller once), SHA-256 hash (stored), display prefix
 */
function generateApiKeyPair(): { key: string; hash: string; prefix: string } {
  const key = `ska_${randomBytes(32).toString('hex')}`;
  const hash = createHash('sha256').update(key).digest('hex');
  const prefix = key.slice(0, 12); // "ska_" + first 8 hex chars — safe to show in UI
  return { key, hash, prefix };
}

/**
 * Express middleware: validates the X-Api-Key header, resolves the owning user,
 * and injects X-User-Id into req.headers so downstream handlers work unchanged.
 * Returns 401 if the key is missing, unknown, or inactive.
 */
export async function apiKeyAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const rawKey = req.headers['x-api-key'];

  if (typeof rawKey !== 'string' || !rawKey) {
    res.status(401).json({ error: 'API key required. Set the X-Api-Key header.' });
    return;
  }

  const hash = createHash('sha256').update(rawKey).digest('hex');
  let keyRecord: { id: string; userId: string; isActive: boolean } | null;

  try {
    keyRecord = await getApiKeyByHash(hash);
  } catch (err) {
    logger.error({ err }, 'apiKeyAuth: DB error looking up API key');
    res.status(500).json({ error: 'Internal server error' });
    return;
  }

  if (!keyRecord || !keyRecord.isActive) {
    logger.warn({ prefix: rawKey.slice(0, 12) }, 'apiKeyAuth: invalid or inactive key');
    res.status(401).json({ error: 'Invalid or inactive API key.' });
    return;
  }

  // Inject userId so the scan handler associates the result with the correct user
  req.headers['x-user-id'] = keyRecord.userId;

  // Fire-and-forget — update last_used_at without blocking the scan
  touchApiKeyLastUsed(keyRecord.id).catch((err) => {
    logger.error({ err, keyId: keyRecord!.id }, 'failed to touch api key last_used_at');
  });

  next();
}

/**
 * Handles POST /api/api-keys.
 * Creates a new API key for the authenticated user. The plaintext key is returned
 * exactly once — it cannot be retrieved again.
 * @param req - Headers must include X-User-Id; body: { name?: string }
 * @param res - Returns { key, record } where key is the plaintext (show once)
 */
export async function createApiKeyHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = req.headers['x-user-id'];
  if (typeof userId !== 'string') {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const parsed = CreateApiKeySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    return;
  }

  const { name = null } = parsed.data;
  const { key, hash, prefix } = generateApiKeyPair();

  try {
    const record = await createApiKey(userId, hash, prefix, name);
    logger.info({ userId, keyId: record.id }, 'api key created');
    // Return plaintext key only here — never stored, cannot be recovered
    res.status(201).json({ key, record });
  } catch (err) {
    logger.error({ err, userId }, 'failed to create api key');
    next(err);
  }
}

/**
 * Handles GET /api/api-keys.
 * Lists all API keys for the authenticated user (no plaintext keys — prefixes only).
 * @param req - Headers must include X-User-Id
 * @param res - Returns { keys: ApiKeyRecord[] }
 */
export async function listApiKeysHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = req.headers['x-user-id'];
  if (typeof userId !== 'string') {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  try {
    const keys = await getApiKeysByUser(userId);
    res.status(200).json({ keys });
  } catch (err) {
    logger.error({ err, userId }, 'failed to list api keys');
    next(err);
  }
}

/**
 * Handles DELETE /api/api-keys/:keyId.
 * Deactivates an API key. The key's user_id must match the requesting user.
 * @param req - Params: keyId (UUID). Headers must include X-User-Id.
 * @param res - Returns 200 on success, 404 if key not found or not owned by user
 */
export async function deactivateApiKeyHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = req.headers['x-user-id'];
  if (typeof userId !== 'string') {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const { keyId } = req.params;

  try {
    const deactivated = await deactivateApiKey(keyId, userId);
    if (!deactivated) {
      res.status(404).json({ error: 'API key not found.' });
      return;
    }
    logger.info({ userId, keyId }, 'api key deactivated');
    res.status(200).json({ message: 'API key deactivated.' });
  } catch (err) {
    logger.error({ err, userId, keyId }, 'failed to deactivate api key');
    next(err);
  }
}
