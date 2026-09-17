// Adversarial Tests for Production Authentication Boundary
// Authoritative sources: docs/specs/07-trust-and-security.md §9, docs/specs/05-api-contracts.md §7

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { POST as approveBulletin } from '@/app/api/bulletins/[id]/approve/route';
import { POST as claimRepair } from '@/app/api/repairs/[id]/claim/route';
import { signJwtToken } from '@/infra/security/jwt';

describe('Security: Production Authentication & Header Spoofing Defense', () => {
  const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
  const ORIGINAL_JWT_SECRET = process.env.SUPABASE_JWT_SECRET;
  const TEST_SECRET = 'super-secret-jwt-token-with-at-least-32-characters-long';

  beforeEach(() => {
    process.env.SUPABASE_JWT_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = ORIGINAL_NODE_ENV;
    process.env.SUPABASE_JWT_SECRET = ORIGINAL_JWT_SECRET;
  });

  function makeRequest(
    url: string,
    options: {
      headers?: Record<string, string>;
      body?: unknown;
    } = {}
  ): Request {
    return new Request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: JSON.stringify(options.body || {}),
    });
  }

  describe('Production Environment (NODE_ENV === "production")', () => {
    beforeEach(() => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      delete process.env.ALLOW_DEV_ACTOR_HEADERS;
    });

    it('rejects forged x-actor-role header with 401 Unauthorized in production', async () => {
      const req = makeRequest('https://wardproofline.dev/api/bulletins/b-1/approve', {
        headers: {
          'x-actor-role': 'ADMIN',
          'x-actor-ref': 'attacker',
        },
        body: { moderatorInitials: 'ATK' },
      });

      const res = await approveBulletin(req, {
        params: Promise.resolve({ id: 'b-1' }),
      });

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.code).toBe('E_UNAUTHORIZED');
      expect(json.detail).toContain('bearer session token missing');
    });

    it('rejects forged body.actorRole parameter with 401 Unauthorized in production', async () => {
      const req = makeRequest('https://wardproofline.dev/api/repairs/ticket-1/claim', {
        body: {
          actorRole: 'ADMIN',
          actorRef: 'attacker',
          claimedBy: 'Malicious Contractor',
        },
      });

      const res = await claimRepair(req, {
        params: Promise.resolve({ id: 'ticket-1' }),
      });

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.code).toBe('E_UNAUTHORIZED');
      expect(json.detail).toContain('bearer session token missing');
    });

    it('rejects tampered or forged JWT tokens with 401 Unauthorized in production', async () => {
      // Token signed with wrong secret
      const forgedToken = signJwtToken(
        { role: 'ADMIN', sub: 'attacker@evil.com', exp: Math.floor(Date.now() / 1000) + 3600 },
        'wrong-attacker-secret'
      );

      const req = makeRequest('https://wardproofline.dev/api/bulletins/b-1/approve', {
        headers: {
          Authorization: `Bearer ${forgedToken}`,
        },
        body: { moderatorInitials: 'MOD' },
      });

      const res = await approveBulletin(req, {
        params: Promise.resolve({ id: 'b-1' }),
      });

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.code).toBe('E_UNAUTHORIZED');
      expect(json.detail).toContain('Invalid JWT signature');
    });

    it('rejects expired JWT tokens with 401 Unauthorized in production', async () => {
      const expiredToken = signJwtToken(
        { role: 'ADMIN', sub: 'admin@gov.et', exp: Math.floor(Date.now() / 1000) - 3600 },
        TEST_SECRET
      );

      const req = makeRequest('https://wardproofline.dev/api/bulletins/b-1/approve', {
        headers: {
          Authorization: `Bearer ${expiredToken}`,
        },
        body: { moderatorInitials: 'MOD' },
      });

      const res = await approveBulletin(req, {
        params: Promise.resolve({ id: 'b-1' }),
      });

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.code).toBe('E_UNAUTHORIZED');
      expect(json.detail).toContain('JWT token expired');
    });

    it('rejects valid JWT with unauthorized role with 403 Forbidden in production', async () => {
      // CITIZEN role is not authorized to approve bulletins
      const validCitizenToken = signJwtToken(
        { role: 'CITIZEN', sub: 'citizen@ward.org', exp: Math.floor(Date.now() / 1000) + 3600 },
        TEST_SECRET
      );

      const req = makeRequest('https://wardproofline.dev/api/bulletins/b-1/approve', {
        headers: {
          Authorization: `Bearer ${validCitizenToken}`,
        },
        body: { moderatorInitials: 'MOD' },
      });

      const res = await approveBulletin(req, {
        params: Promise.resolve({ id: 'b-1' }),
      });

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.code).toBe('E_FORBIDDEN_ROLE');
    });

    it('accepts validly signed JWT with MODERATOR role in production', async () => {
      const validModToken = signJwtToken(
        { role: 'MODERATOR', sub: 'mod-1@gov.et', exp: Math.floor(Date.now() / 1000) + 3600 },
        TEST_SECRET
      );

      const req = makeRequest('https://wardproofline.dev/api/bulletins/b-nonexistent/approve', {
        headers: {
          Authorization: `Bearer ${validModToken}`,
        },
        body: { moderatorInitials: 'MD1' },
      });

      const res = await approveBulletin(req, {
        params: Promise.resolve({ id: 'b-nonexistent' }),
      });

      // Gating passed! Reaches service layer, which returns 404 for non-existent bulletin
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.code).toBe('E_NOT_FOUND');
    });
  });

  describe('Test Environment (NODE_ENV === "test")', () => {
    it('preserves test ergonomics by allowing x-actor-role in test environment', async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'test';

      const req = makeRequest('https://wardproofline.dev/api/bulletins/b-nonexistent/approve', {
        headers: {
          'x-actor-role': 'MODERATOR',
          'x-actor-ref': 'test-mod',
        },
        body: { moderatorInitials: 'MD1' },
      });

      const res = await approveBulletin(req, {
        params: Promise.resolve({ id: 'b-nonexistent' }),
      });

      expect(res.status).toBe(404); // Passed role check, hit service 404
      const json = await res.json();
      expect(json.code).toBe('E_NOT_FOUND');
    });
  });
});
