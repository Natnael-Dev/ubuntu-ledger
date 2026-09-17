// Unit tests for Bulletin HTTP Route Handlers (T-28, SEC-01, SEC-02, SEC-03)
// Authoritative sources:
// - docs/specs/05-api-contracts.md §9, §11
// - docs/specs/07-trust-and-security.md §6.4, §9
// - docs/specs/11-tasks.md T-28

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GET as getBulletin } from '@/app/api/bulletins/[id]/route';
import { POST as approveBulletin } from '@/app/api/bulletins/[id]/approve/route';
import { POST as rejectBulletin } from '@/app/api/bulletins/[id]/reject/route';
import { POST as compileCron } from '@/app/api/cron/bulletins/compile/route';
import { getBulletinService } from '@/app-services/bulletin.service';

describe('T-28: Bulletin Authorization & Cron Security (SEC-01, SEC-02, SEC-03)', () => {
  const CRON_SECRET = 'test-bulletin-cron-secret-xyz';
  const ORIGINAL_ENV = process.env.CRON_SECRET;
  let bulletinId = 'test-bulletin-001';

  beforeEach(async () => {
    process.env.CRON_SECRET = CRON_SECRET;
    const service = getBulletinService();
    const created = await service.compileBulletins({
      wardId: '00000000-0000-0000-0000-000000000010',
      wardCode: 'ET-AA-W09',
      periodStart: '2026-08-17',
      periodEnd: '2026-09-17',
      facts: [
        {
          serviceCode: 'ET-ID-REPLACE',
          officeCode: 'ET-AA-W09-OFFICE',
          windowDays: 30,
          reportCount: 14,
          distinctClusters: 6,
          pctAdditionalFee: 78.6,
          medianExtraMinor: 20000,
          currency: 'ETB',
          kSatisfied: true,
        },
      ],
      locale: 'en',
    });
    if (created) {
      bulletinId = created.id;
    }
  });

  afterEach(() => {
    process.env.CRON_SECRET = ORIGINAL_ENV;
  });

  function makeRequest(
    url: string,
    options: {
      method?: string;
      headers?: Record<string, string>;
      body?: unknown;
    } = {}
  ): Request {
    return new Request(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  }

  // ==========================================================================
  // 1. SEC-03: GET /api/bulletins/[id] (Role-Gated Moderator Inspection)
  // ==========================================================================
  describe('1. SEC-03: GET /api/bulletins/[id]', () => {
    it('rejects anonymous inspection with 401 E_UNAUTHORIZED', async () => {
      const req = makeRequest(`https://wardproofline.dev/api/bulletins/${bulletinId}`);
      const res = await getBulletin(req, { params: Promise.resolve({ id: bulletinId }) });

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.code).toBe('E_UNAUTHORIZED');
    });

    it('rejects citizen actor role with 403 E_FORBIDDEN_ROLE', async () => {
      const req = makeRequest(`https://wardproofline.dev/api/bulletins/${bulletinId}`, {
        headers: { 'x-actor-role': 'CITIZEN' },
      });
      const res = await getBulletin(req, { params: Promise.resolve({ id: bulletinId }) });

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.code).toBe('E_FORBIDDEN_ROLE');
    });

    it('allows MODERATOR role to inspect bulletin details', async () => {
      const req = makeRequest(`https://wardproofline.dev/api/bulletins/${bulletinId}`, {
        headers: { 'x-actor-role': 'MODERATOR' },
      });
      const res = await getBulletin(req, { params: Promise.resolve({ id: bulletinId }) });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.id).toBe(bulletinId);
    });

    it('allows ADMIN role to inspect bulletin details', async () => {
      const req = makeRequest(`https://wardproofline.dev/api/bulletins/${bulletinId}`, {
        headers: { 'x-actor-role': 'ADMIN' },
      });
      const res = await getBulletin(req, { params: Promise.resolve({ id: bulletinId }) });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.id).toBe(bulletinId);
    });
  });

  // ==========================================================================
  // 2. SEC-01: POST /api/bulletins/[id]/approve & reject
  // ==========================================================================
  describe('2. SEC-01: POST /api/bulletins/[id]/approve and reject', () => {
    it('rejects anonymous approve with 401 E_UNAUTHORIZED', async () => {
      const req = makeRequest(`https://wardproofline.dev/api/bulletins/${bulletinId}/approve`, {
        method: 'POST',
        body: { moderatorInitials: 'TZ' },
      });
      const res = await approveBulletin(req, { params: Promise.resolve({ id: bulletinId }) });

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.code).toBe('E_UNAUTHORIZED');
    });

    it('rejects non-moderator approve with 403 E_FORBIDDEN_ROLE', async () => {
      const req = makeRequest(`https://wardproofline.dev/api/bulletins/${bulletinId}/approve`, {
        method: 'POST',
        headers: { 'x-actor-role': 'CITIZEN' },
        body: { moderatorInitials: 'TZ' },
      });
      const res = await approveBulletin(req, { params: Promise.resolve({ id: bulletinId }) });

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.code).toBe('E_FORBIDDEN_ROLE');
    });

    it('rejects anonymous reject with 401 E_UNAUTHORIZED', async () => {
      const req = makeRequest(`https://wardproofline.dev/api/bulletins/${bulletinId}/reject`, {
        method: 'POST',
        body: { reason: 'Data verification pending' },
      });
      const res = await rejectBulletin(req, { params: Promise.resolve({ id: bulletinId }) });

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.code).toBe('E_UNAUTHORIZED');
    });

    it('rejects non-moderator reject with 403 E_FORBIDDEN_ROLE', async () => {
      const req = makeRequest(`https://wardproofline.dev/api/bulletins/${bulletinId}/reject`, {
        method: 'POST',
        headers: { 'x-actor-role': 'MONITOR' },
        body: { reason: 'Data verification pending' },
      });
      const res = await rejectBulletin(req, { params: Promise.resolve({ id: bulletinId }) });

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.code).toBe('E_FORBIDDEN_ROLE');
    });
  });

  // ==========================================================================
  // 3. SEC-02: POST /api/cron/bulletins/compile Fail-Closed Security
  // ==========================================================================
  describe('3. SEC-02: Compile Cron Fail-Closed & Timing-Safe Verification', () => {
    it('fails closed when CRON_SECRET environment variable is missing/unset', async () => {
      delete process.env.CRON_SECRET;

      const req = makeRequest('https://wardproofline.dev/api/cron/bulletins/compile', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer dev-cron-secret-2026',
        },
      });
      const res = await compileCron(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.code).toBe('E_UNAUTHORIZED');
    });

    it('rejects invalid credentials with 401 E_UNAUTHORIZED', async () => {
      const req = makeRequest('https://wardproofline.dev/api/cron/bulletins/compile', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer attacker-guessed-secret',
        },
      });
      const res = await compileCron(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.code).toBe('E_UNAUTHORIZED');
    });

    it('accepts valid Authorization: Bearer <CRON_SECRET>', async () => {
      const req = makeRequest('https://wardproofline.dev/api/cron/bulletins/compile', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${CRON_SECRET}`,
        },
      });
      const res = await compileCron(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
    });

    it('accepts valid x-cron-secret header', async () => {
      const req = makeRequest('https://wardproofline.dev/api/cron/bulletins/compile', {
        method: 'POST',
        headers: {
          'x-cron-secret': CRON_SECRET,
        },
      });
      const res = await compileCron(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
    });
  });
});
