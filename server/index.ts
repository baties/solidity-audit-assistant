/**
 * Express server entry point.
 * Loads environment variables, starts the HTTP server on PORT (default 3001).
 * In production this runs alongside the Next.js process (managed by docker-compose).
 */
import 'dotenv/config';
import { app } from './api/index';
import { logger } from './lib/logger';

const PORT = parseInt(process.env.PORT ?? '3001', 10);

app.listen(PORT, () => {
  logger.info({ port: PORT, env: process.env.NODE_ENV ?? 'development' }, 'Express server started');
});
