/**
 * Express application factory — wires up middleware, routes, and error handlers.
 * Exported as `app` so it can be imported by tests (Supertest) and server/index.ts.
 * Mount order matters: middleware → routes → 404 → global error handler.
 */
import path from 'path';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { healthHandler } from './health';
import { scanHandler } from './scan';
import { scanResultHandler } from './scanResult';
import { scanHistoryHandler } from './scanHistory';
import { apiKeyAuth, createApiKeyHandler, listApiKeysHandler, deactivateApiKeyHandler } from './apiKeys';
import { logger } from '../lib/logger';

export const app = express();

// Required for correct req.ip behind Nginx reverse proxy (prod) and for express-rate-limit IPv6 handling.
// Hop count of 1 matches the single Nginx proxy in our docker-compose topology.
app.set('trust proxy', 1);

// Parse JSON bodies up to 10MB (large contract repos can produce big payloads)
app.use(express.json({ limit: '10mb' }));

// CORS — in production, restrict to the Next.js origin via env var
app.use(cors({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  methods: ['GET', 'POST'],
}));

// Rate limiter for POST /api/scan: 1 request per 30s.
// Keyed by authenticated userId (X-User-Id header) when present, otherwise by IP.
// X-User-Id is injected by the Next.js proxy after session validation — trusted on internal network only.
// Skipped in test environment so validation unit tests are not affected by the limiter.
const scanLimiter = rateLimit({
  windowMs: 30_000,
  limit: 1,
  skip: () => process.env.NODE_ENV === 'test',
  keyGenerator: (req: Request) => {
    const userId = req.headers['x-user-id'];
    return typeof userId === 'string' ? `user:${userId}` : `ip:${req.ip ?? 'unknown'}`;
  },
  handler: (req: Request, res: Response) => {
    const userId = req.headers['x-user-id'];
    logger.warn(
      { ip: req.ip, userId: typeof userId === 'string' ? userId : undefined },
      'rate limit hit on POST /api/scan',
    );
    res.status(429).json({ error: 'Rate limit exceeded. Try again in 30 seconds.' });
  },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // Suppress eager validation warnings: trust proxy is set above; keyGenerator handles IPv6 explicitly.
  validate: false,
});

// Routes
app.get('/api/health', healthHandler);

// Serve OpenAPI spec — path is relative to the project root regardless of cwd
app.get('/api/docs', (_req: Request, res: Response) => {
  res.sendFile(path.resolve(__dirname, '../../docs/api/openapi.yaml'));
});
app.post('/api/scan', scanLimiter, scanHandler);
app.get('/api/scan/:scanId', scanResultHandler);
app.get('/api/scan-history/:userId', scanHistoryHandler);

// API key management — X-User-Id injected by the Next.js session proxy
app.post('/api/api-keys', createApiKeyHandler);
app.get('/api/api-keys', listApiKeysHandler);
app.delete('/api/api-keys/:keyId', deactivateApiKeyHandler);

// Public REST API — authenticated by X-Api-Key header (no session required)
// apiKeyAuth validates the key and injects X-User-Id; scanLimiter then keys by userId.
app.post('/v1/scan', apiKeyAuth, scanLimiter, scanHandler);

// 404 handler — catches any unmatched routes
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler — catches errors forwarded via next(err)
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, 'unhandled error in request pipeline');
  res.status(500).json({ error: 'Internal server error' });
});
