/**
 * Integration test: GET /api/health
 * Does not require a database connection.
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../api/index';

describe('GET /api/health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.timestamp).toBe('string');
    // Verify timestamp is a valid ISO date
    expect(() => new Date(res.body.timestamp)).not.toThrow();
  });
});

describe('GET /api/unknown-route', () => {
  it('returns 404 for unrecognised routes', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
  });
});
