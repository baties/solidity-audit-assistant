/**
 * PostgreSQL connection pool using the `pg` driver.
 * Exports a typed `query` wrapper — use this everywhere instead of Pool directly.
 * Reads connection config from DATABASE_URL environment variable.
 * Pool is created lazily so that importing this module in tests without a DB does not throw.
 */
import { Pool, QueryResult, QueryResultRow } from 'pg';
import { logger } from '../lib/logger';

let pool: Pool | null = null;

/**
 * Returns the shared Pool, creating it on first call.
 * Lazy initialisation means tests can mock this module before any query is made.
 * @throws Error if DATABASE_URL is not set
 */
function getPool(): Pool {
  if (pool) return pool;

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required but not set.');
  }

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  pool.on('error', (err) => {
    logger.error({ err }, 'Unexpected PostgreSQL pool error');
  });

  return pool;
}

/**
 * Executes a parameterized SQL query against the connection pool.
 * @param text   - SQL query string with $1, $2, ... placeholders
 * @param params - Ordered array of parameter values
 * @returns QueryResult with typed rows
 * @throws Error if DATABASE_URL is unset or the query fails
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  const result = await getPool().query<T>(text, params);
  const durationMs = Date.now() - start;
  logger.debug({ query: text, durationMs, rows: result.rowCount }, 'db query executed');
  return result;
}

/** Exported for tests that need to seed/reset state via direct pool access. */
export { getPool };
