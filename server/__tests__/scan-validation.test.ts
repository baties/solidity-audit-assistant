/**
 * Unit tests: POST /api/scan input validation (Zod layer).
 * The DB queries module is mocked so no Postgres connection is required.
 * These tests only verify that the Zod schema accepts/rejects inputs correctly.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Mock DB queries before importing the app so the pool is never created
vi.mock('../db/queries', () => ({
  createScan:        vi.fn().mockResolvedValue('00000000-0000-0000-0000-000000000001'),
  updateScanStatus:  vi.fn().mockResolvedValue(undefined),
  completeScan:      vi.fn().mockResolvedValue(undefined),
  failScan:          vi.fn().mockResolvedValue(undefined),
  insertFindings:    vi.fn().mockResolvedValue(undefined),
  getScanById:       vi.fn().mockResolvedValue(null),
}));

// Mock the orchestrator so the pipeline never runs in validation tests
vi.mock('../agents/orchestrator', () => ({
  runScan: vi.fn().mockResolvedValue({
    scanId: '00000000-0000-0000-0000-000000000001',
    target: 'https://github.com/test/repo',
    riskScore: 0,
    riskLabel: 'safe',
    findings: [],
    summary: 'No issues found.',
    scannedAt: new Date().toISOString(),
    durationMs: 100,
  }),
}));

import { app } from '../api/index';

describe('POST /api/scan — Zod validation', () => {
  it('returns 400 when body is empty', async () => {
    const res = await request(app).post('/api/scan').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request');
  });

  it('returns 400 when target is empty string', async () => {
    const res = await request(app)
      .post('/api/scan')
      .send({ target: '', targetType: 'github' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when targetType is invalid', async () => {
    const res = await request(app)
      .post('/api/scan')
      .send({ target: 'https://github.com/a/b', targetType: 'invalid' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when chain is invalid for address scan', async () => {
    const res = await request(app).post('/api/scan').send({
      target: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      targetType: 'address',
      chain: 'solana', // not a supported EVM chain
    });
    expect(res.status).toBe(400);
  });

  it('returns 200 for a valid GitHub scan request', async () => {
    const res = await request(app)
      .post('/api/scan')
      .send({ target: 'https://github.com/OpenZeppelin/openzeppelin-contracts', targetType: 'github' });
    expect(res.status).toBe(200);
    expect(res.body.scanId).toBeTruthy();
  });

  it('returns 200 for a valid address scan request with chain', async () => {
    const res = await request(app).post('/api/scan').send({
      target: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      targetType: 'address',
      chain: 'ethereum',
    });
    expect(res.status).toBe(200);
  });

  it('accepts address scan without chain (defaults to ethereum)', async () => {
    const res = await request(app).post('/api/scan').send({
      target: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      targetType: 'address',
    });
    expect(res.status).toBe(200);
  });
});

describe('GET /api/scan/:scanId', () => {
  it('returns 404 for unknown scan ID', async () => {
    const res = await request(app)
      .get('/api/scan/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });
});
