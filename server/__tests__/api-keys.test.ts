/**
 * Integration tests: API key management + public REST API (/v1/scan).
 * All DB calls and the scan orchestrator are mocked — no DB or LLM required.
 * Tests cover: CRUD for /api/api-keys, auth middleware on /v1/scan, /api/docs.
 */
import { createHash, randomBytes } from 'crypto';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';

// ── Hoist shared fixtures so they are available inside vi.mock() factories ───
// vi.mock() is hoisted to the top of the file by Vitest; variables defined in
// the module body are NOT yet initialized at that point. vi.hoisted() runs
// its callback at the same hoisted time, making the result available everywhere.

const { mockApiKeyRecord } = vi.hoisted(() => ({
  mockApiKeyRecord: {
    id:          'aaaa0000-0000-0000-0000-000000000001',
    userId:      'bbbb0000-0000-0000-0000-000000000001',
    keyPrefix:   'ska_1a2b3c4d',
    name:        'Test key',
    isActive:    true,
    lastUsedAt:  null,
    createdAt:   new Date().toISOString(),
  },
}));

vi.mock('../db/queries', () => ({
  // Scan pipeline queries (needed when /v1/scan hits scanHandler)
  createScan:       vi.fn().mockResolvedValue('cccc0000-0000-0000-0000-000000000001'),
  updateScanStatus: vi.fn().mockResolvedValue(undefined),
  completeScan:     vi.fn().mockResolvedValue(undefined),
  failScan:         vi.fn().mockResolvedValue(undefined),
  insertFindings:   vi.fn().mockResolvedValue(undefined),
  assignScanToUser: vi.fn().mockResolvedValue(undefined),
  getScanById:      vi.fn().mockResolvedValue(null),

  // API key queries
  createApiKey:         vi.fn().mockResolvedValue(mockApiKeyRecord),
  getApiKeyByHash:      vi.fn(),
  getApiKeysByUser:     vi.fn().mockResolvedValue([mockApiKeyRecord]),
  deactivateApiKey:     vi.fn().mockResolvedValue(true),
  touchApiKeyLastUsed:  vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../agents/orchestrator', () => ({
  runScan: vi.fn().mockResolvedValue({
    scanId:     'cccc0000-0000-0000-0000-000000000001',
    target:     'https://github.com/test/repo',
    riskScore:  0,
    riskLabel:  'safe',
    findings:   [],
    summary:    'No issues found.',
    scannedAt:  new Date().toISOString(),
    durationMs: 100,
  }),
}));

import { app } from '../api/index';
import { getApiKeyByHash, deactivateApiKey } from '../db/queries';

// ── Test API key pair (generated once, hash matched in mocks) ─────────────────

const TEST_KEY = `ska_${randomBytes(32).toString('hex')}`;
const TEST_KEY_HASH = createHash('sha256').update(TEST_KEY).digest('hex');
const TEST_USER_ID = 'bbbb0000-0000-0000-0000-000000000001';

beforeAll(() => {
  // By default, return a valid active key for our test key hash
  vi.mocked(getApiKeyByHash).mockImplementation(async (hash: string) => {
    if (hash === TEST_KEY_HASH) {
      return { id: mockApiKeyRecord.id, userId: TEST_USER_ID, isActive: true };
    }
    return null;
  });
});

// ── POST /api/api-keys ────────────────────────────────────────────────────────

describe('POST /api/api-keys', () => {
  it('returns 401 when X-User-Id is missing', async () => {
    const res = await request(app).post('/api/api-keys').send({});
    expect(res.status).toBe(401);
    expect(res.body.error).toContain('Authentication required');
  });

  it('creates a key and returns plaintext once', async () => {
    const res = await request(app)
      .post('/api/api-keys')
      .set('X-User-Id', TEST_USER_ID)
      .send({ name: 'Test key' });

    expect(res.status).toBe(201);
    // Plaintext key is in the response body
    expect(typeof res.body.key).toBe('string');
    expect(res.body.key).toMatch(/^ska_/);
    // Record is returned alongside (no plaintext)
    expect(res.body.record.id).toBe(mockApiKeyRecord.id);
    expect(res.body.record).not.toHaveProperty('keyHash');
  });

  it('returns 400 for invalid name (too long)', async () => {
    const res = await request(app)
      .post('/api/api-keys')
      .set('X-User-Id', TEST_USER_ID)
      .send({ name: 'x'.repeat(101) }); // max is 100
    expect(res.status).toBe(400);
  });
});

// ── GET /api/api-keys ─────────────────────────────────────────────────────────

describe('GET /api/api-keys', () => {
  it('returns 401 when X-User-Id is missing', async () => {
    const res = await request(app).get('/api/api-keys');
    expect(res.status).toBe(401);
  });

  it('returns the list of keys for the authenticated user', async () => {
    const res = await request(app)
      .get('/api/api-keys')
      .set('X-User-Id', TEST_USER_ID);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.keys)).toBe(true);
    expect(res.body.keys[0].id).toBe(mockApiKeyRecord.id);
    // Hash must never appear in the response
    expect(JSON.stringify(res.body)).not.toContain('keyHash');
    expect(JSON.stringify(res.body)).not.toContain('key_hash');
  });
});

// ── DELETE /api/api-keys/:keyId ───────────────────────────────────────────────

describe('DELETE /api/api-keys/:keyId', () => {
  it('returns 401 when X-User-Id is missing', async () => {
    const res = await request(app).delete(`/api/api-keys/${mockApiKeyRecord.id}`);
    expect(res.status).toBe(401);
  });

  it('deactivates a key owned by the user', async () => {
    const res = await request(app)
      .delete(`/api/api-keys/${mockApiKeyRecord.id}`)
      .set('X-User-Id', TEST_USER_ID);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('deactivated');
  });

  it('returns 404 when key is not found or not owned by user', async () => {
    vi.mocked(deactivateApiKey).mockResolvedValueOnce(false);

    const res = await request(app)
      .delete('/api/api-keys/dddd0000-0000-0000-0000-000000000099')
      .set('X-User-Id', TEST_USER_ID);

    expect(res.status).toBe(404);
  });
});

// ── POST /v1/scan — API key authentication ────────────────────────────────────

describe('POST /v1/scan', () => {
  it('returns 401 when X-Api-Key header is missing', async () => {
    const res = await request(app)
      .post('/v1/scan')
      .send({ target: 'https://github.com/test/repo', targetType: 'github' });

    expect(res.status).toBe(401);
    expect(res.body.error).toContain('API key required');
  });

  it('returns 401 for an unknown API key', async () => {
    const res = await request(app)
      .post('/v1/scan')
      .set('X-Api-Key', 'ska_' + 'f'.repeat(64)) // unknown key
      .send({ target: 'https://github.com/test/repo', targetType: 'github' });

    expect(res.status).toBe(401);
    expect(res.body.error).toContain('Invalid or inactive');
  });

  it('runs a scan successfully with a valid API key', async () => {
    const res = await request(app)
      .post('/v1/scan')
      .set('X-Api-Key', TEST_KEY)
      .send({ target: 'https://github.com/test/repo', targetType: 'github' });

    expect(res.status).toBe(200);
    expect(res.body.scanId).toBeTruthy();
    expect(res.body.riskScore).toBeDefined();
  });

  it('returns 400 for invalid body even with a valid API key', async () => {
    const res = await request(app)
      .post('/v1/scan')
      .set('X-Api-Key', TEST_KEY)
      .send({ target: '', targetType: 'github' }); // empty target

    expect(res.status).toBe(400);
  });
});

// ── GET /api/docs ──────────────────────────────────────────────────────────────

describe('GET /api/docs', () => {
  it('returns the OpenAPI YAML spec', async () => {
    const res = await request(app).get('/api/docs');

    expect(res.status).toBe(200);
    // Should be YAML content
    expect(res.text).toContain('openapi: 3.0.3');
    expect(res.text).toContain('/v1/scan');
  });
});
