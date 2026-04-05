/**
 * Express application factory — wires up middleware, routes, and error handlers.
 * Exported as `app` so it can be imported by tests (Supertest) and server/index.ts.
 * Mount order matters: middleware → routes → 404 → global error handler.
 */
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { healthHandler } from './health';
import { scanHandler } from './scan';
import { scanResultHandler } from './scanResult';
import { scanHistoryHandler } from './scanHistory';
import { logger } from '../lib/logger';

export const app = express();

// Parse JSON bodies up to 10MB (large contract repos can produce big payloads)
app.use(express.json({ limit: '10mb' }));

// CORS — in production, restrict to the Next.js origin via env var
app.use(cors({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  methods: ['GET', 'POST'],
}));

// Routes
app.get('/api/health', healthHandler);
app.post('/api/scan', scanHandler);
app.get('/api/scan/:scanId', scanResultHandler);
app.get('/api/scan-history/:userId', scanHistoryHandler);

// 404 handler — catches any unmatched routes
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler — catches errors forwarded via next(err)
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, 'unhandled error in request pipeline');
  res.status(500).json({ error: 'Internal server error' });
});
