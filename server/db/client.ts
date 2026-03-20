/**
 * PostgreSQL connection pool using the `pg` driver.
 * Exports a typed `query` wrapper — use this everywhere instead of Pool directly.
 * Reads connection config from DATABASE_URL environment variable.
 */
import { Pool, QueryResult, QueryResultRow } from 'pg';
import { logger } from '../lib/logger';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required but not set.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Keep pool small — scans are long-running, not high-concurrency
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected PostgreSQL pool error');
});

/**
 * Executes a parameterized SQL query against the connection pool.
 * @param text   - SQL query string with $1, $2, ... placeholders
 * @param params - Ordered array of parameter values
 * @returns QueryResult with typed rows
 * @throws Error if the query fails (caller is responsible for handling)
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  const result = await pool.query<T>(text, params);
  const durationMs = Date.now() - start;
  logger.debug({ query: text, durationMs, rows: result.rowCount }, 'db query executed');
  return result;
}

export { pool };
