/**
 * Structured JSON logger using pino.
 * Import this in every server module — never use console.log in production paths.
 * LOG_LEVEL env var controls verbosity: 'debug' (dev) | 'info' (prod).
 */
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
});
