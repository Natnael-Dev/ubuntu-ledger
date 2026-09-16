// Unit Tests for Statutory API Route Handler
// Authoritative sources:
// - docs/specs/05-api-contracts.md §0, §6 (GET /api/services/:serviceCode/card & /statutory)
// - docs/specs/03-data-model.md §5
// - docs/specs/07-trust-and-security.md §7
// - docs/specs/11-tasks.md T-25

import { describe, it, expect } from 'vitest';
import {
  GET as getStatutoryRoute,
  POST as postStatutoryRoute,
  PUT as putStatutoryRoute,
  DELETE as deleteStatutoryRoute,
  PATCH as patchStatutoryRoute,
} from '@/app/api/services/[code]/statutory/route';
import { GET as getCardRoute } from '@/app/api/services/[code]/card/route';

describe('T-25: Statutory API Routes (05 §6)', () => {
  // ==========================================================================
  // 1. GET /api/services/[code]/statutory — SUCCESS CASES
  // ==========================================================================
  describe('1. GET /api/services/[code]/statutory — Success Cases', () => {
    it('returns 200 with statutory rule card and public divergence aggregate when k >= 5', async () => {
      const req = new Request('https://wardproofline.dev/api/services/ET-ID-REPLACE/statutory');
      const res = await getStatutoryRoute(req, {
        params: Promise.resolve({ code: 'ET-ID-REPLACE' }),
      });

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('application/json');

      const json = await res.json();

      // Service identity
      expect(json.serviceCode).toBe('ET-ID-REPLACE');
      expect(json.officeCode).toBe('W09-CIVIL-01');

      // Statutory card details
      expect(json.statutory).toBeDefined();
      expect(json.statutory.feeCeilingMinor).toBe(5000); // 50.00 ETB
      expect(json.statutory.currency).toBe('ETB');
      expect(Array.isArray(json.statutory.requiredDocuments)).toBe(true);
      expect(json.statutory.requiredDocuments).toContain('doc.birth_certificate_copy');
      expect(json.statutory.requiredDocuments).toContain('doc.two_witnesses_id');
      expect(json.statutory.expectedVisits).toBe(1);
      expect(json.statutory.refusalScriptKey).toBe('script.request_official_receipt');
      expect(json.statutory.appealRouteKey).toBe('appeal.woreda_ombudsman');

      // Source document citation
      expect(json.statutory.source).not.toBeNull();
      expect(json.statutory.source.title).toContain('Circular 14/2026');
      expect(json.statutory.source.page).toBe(3);
      expect(json.statutory.source.reviewer).toBe('H.T.');

      // Observed divergence (k >= 5)
      expect(json.observed).toBeDefined();
      expect(json.observed.kSatisfied).toBe(true);
      expect(json.observed.windowDays).toBe(30);
      expect(json.observed.reportCount).toBe(14);
      expect(json.observed.distinctClusters).toBe(6);
      expect(json.observed.pctAdditionalFee).toBe(78.6);
      expect(json.observed.medianExtraMinor).toBe(20000);
      expect(typeof json.observed.avgVisits).toBe('number');
    });

    it('returns 200 with statutory rule card and suppressed aggregate when k < 5', async () => {
      const req = new Request('https://wardproofline.dev/api/services/ET-CLINIC-INTAKE/statutory');
      const res = await getStatutoryRoute(req, {
        params: Promise.resolve({ code: 'ET-CLINIC-INTAKE' }),
      });

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('application/json');

      const json = await res.json();

      expect(json.serviceCode).toBe('ET-CLINIC-INTAKE');
      expect(json.officeCode).toBe('W09-HLTH-01');
      expect(json.statutory.feeCeilingMinor).toBe(0); // Free clinic intake
      expect(json.statutory.currency).toBe('ETB');
      expect(json.statutory.requiredDocuments).toContain('doc.kebele_resident_id');

      // Observed divergence MUST be suppressed
      expect(json.observed).toBeDefined();
      expect(json.observed.kSatisfied).toBe(false);
      expect(json.observed.windowDays).toBe(30);
      expect(json.observed.noticeKey).toBe('divergence.not_enough_reports');
      expect(json.observed.minimumRequired).toBe(5);

      // SECURITY CRITICAL: suppressed aggregates MUST NOT leak counts, percentages, or medians
      expect(json.observed.reportCount).toBeUndefined();
      expect(json.observed.distinctClusters).toBeUndefined();
      expect(json.observed.pctAdditionalFee).toBeUndefined();
      expect(json.observed.medianExtraMinor).toBeUndefined();
      expect(json.observed.avgVisits).toBeUndefined();
    });

    it('canonical alias route GET /api/services/[code]/card returns identical contract (05 §6)', async () => {
      const req = new Request('https://wardproofline.dev/api/services/ET-ID-REPLACE/card');
      const res = await getCardRoute(req, {
        params: Promise.resolve({ code: 'ET-ID-REPLACE' }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.serviceCode).toBe('ET-ID-REPLACE');
      expect(json.observed.kSatisfied).toBe(true);
    });

    it('handles case-insensitive service codes', async () => {
      const req = new Request('https://wardproofline.dev/api/services/et-id-replace/statutory');
      const res = await getStatutoryRoute(req, {
        params: Promise.resolve({ code: 'et-id-replace' }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.serviceCode).toBe('ET-ID-REPLACE');
    });
  });

  // ==========================================================================
  // 2. ERROR HANDLING & HTTP PROTOCOL INVARIANTS
  // ==========================================================================
  describe('2. Error Handling & Protocol Invariants', () => {
    it('returns 404 RFC 9457 problem response for unknown service code', async () => {
      const req = new Request('https://wardproofline.dev/api/services/NON-EXISTENT/statutory');
      const res = await getStatutoryRoute(req, {
        params: Promise.resolve({ code: 'NON-EXISTENT' }),
      });

      expect(res.status).toBe(404);
      expect(res.headers.get('Content-Type')).toContain('application/problem+json');

      const json = await res.json();
      expect(json.code).toBe('E_UNKNOWN_CODE');
      expect(json.status).toBe(404);
      expect(json.type).toBe('https://wardproofline.dev/errors/unknown_code');
      expect(json.detail).toContain('NON-EXISTENT');
    });

    it('returns 404 RFC 9457 problem response for empty code', async () => {
      const req = new Request('https://wardproofline.dev/api/services//statutory');
      const res = await getStatutoryRoute(req, {
        params: Promise.resolve({ code: '   ' }),
      });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.code).toBe('E_UNKNOWN_CODE');
    });

    it('rejects POST, PUT, DELETE, PATCH with 405 Method Not Allowed and Allow: GET', async () => {
      const postRes = await postStatutoryRoute();
      expect(postRes.status).toBe(405);
      expect(postRes.headers.get('Allow')).toBe('GET');

      const putRes = await putStatutoryRoute();
      expect(putRes.status).toBe(405);
      expect(putRes.headers.get('Allow')).toBe('GET');

      const deleteRes = await deleteStatutoryRoute();
      expect(deleteRes.status).toBe(405);
      expect(deleteRes.headers.get('Allow')).toBe('GET');

      const patchRes = await patchStatutoryRoute();
      expect(patchRes.status).toBe(405);
      expect(patchRes.headers.get('Allow')).toBe('GET');
    });
  });
});
