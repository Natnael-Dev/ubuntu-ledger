// Unit tests for Receipt API and Public Receipt contracts
// Authoritative sources:
// - docs/specs/05-api-contracts.md §0, §4
// - docs/specs/08-ui-ux-design.md §5
// - docs/specs/04-state-machine.md §6
// - docs/specs/11-tasks.md T-19

import { describe, it, expect, beforeEach } from 'vitest';
import {
  GET as getWardReceipts,
  POST as postWardReceipts,
  PUT as putWardReceipts,
  DELETE as deleteWardReceipts,
  PATCH as patchWardReceipts,
} from '@/app/api/wards/[wardCode]/receipts/route';
import {
  GET as getProjectReceiptEndpoint,
  POST as postProjectReceipt,
  PUT as putProjectReceipt,
  DELETE as deleteProjectReceipt,
  PATCH as patchProjectReceipt,
  getProjectReceipt,
  formatCurrency,
  formatPromisedDate,
  formatArchivedDate,
  truncateHash,
  resolveNarrativeText,
} from '@/app/api/projects/[code]/route';
import {
  getServiceContainer,
  resetServiceContainer,
} from '@/infra/db/container';
import { DEMO_IDS } from '@/fixtures/demo-scenario';

describe('Receipt API & Contracts (T-19)', () => {
  beforeEach(() => {
    resetServiceContainer();
  });

  describe('1. GET /api/wards/[wardCode]/receipts (05 §4)', () => {
    it('returns 200 with ward metadata and array of project receipts for ET-AA-W09', async () => {
      const req = new Request('https://wardproofline.local/api/wards/ET-AA-W09/receipts');
      const res = await getWardReceipts(req, {
        params: Promise.resolve({ wardCode: 'ET-AA-W09' }),
      });

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('application/json');

      const json = await res.json();

      // Ward metadata contract
      expect(json.ward).toBeDefined();
      expect(json.ward.code).toBe('ET-AA-W09');
      expect(json.ward.name).toBe('Woreda 9');
      expect(json.ward.locales).toEqual(['am', 'om', 'en']);
      expect(typeof json.generatedAt).toBe('string');
      expect(Array.isArray(json.receipts)).toBe(true);
      expect(json.receipts.length).toBeGreaterThanOrEqual(5);

      // Verify cited project 4412
      const project4412 = json.receipts.find(
        (r: { projectCode: string }) => r.projectCode === '4412'
      );
      expect(project4412).toBeDefined();
      expect(project4412.title).toBe('Health post generator overhaul');
      expect(project4412.amountMinor).toBe(32000000);
      expect(project4412.currency).toBe('ETB');
      expect(project4412.contractor).toBe('AfroTech Infra');
      expect(project4412.promisedCompletion).toBe('2026-08-30');
      expect(project4412.confidence).toBe('OFFICIAL_CITED');

      // Source block for cited project
      expect(project4412.source).not.toBeNull();
      expect(project4412.source.title).toBe('Woreda 9 Capital Budget FY2026');
      expect(project4412.source.issuer).toBe('Woreda 9 Finance Office');
      expect(project4412.source.page).toBe(41);
      expect(project4412.source.sha256).toBe(
        '3b1f9c87d4a2e5890123456789abcdef0123456789abcdef0123456789abcdef'
      );
      expect(typeof project4412.source.archivedAt).toBe('string');

      // Narrative state
      expect(project4412.narrative).toBeDefined();
      expect(project4412.narrative.state).toBe('PROBATION_ACTIVE');
      expect(project4412.narrative.messageKey).toBe(
        'narrative.under_probation_n_days'
      );
      expect(project4412.narrative.slots).toBeDefined();
      expect(project4412.narrative.slots.days).toBe('5');

      // Witness counter
      expect(project4412.witness).toBeDefined();
      expect(project4412.witness.count).toBe(2);
      expect(project4412.witness.target).toBe(3);

      // Verify unofficial estimate project 4414
      const project4414 = json.receipts.find(
        (r: { projectCode: string }) => r.projectCode === '4414'
      );
      expect(project4414).toBeDefined();
      expect(project4414.title).toBe('Primary school latrine block roof');
      expect(project4414.amountMinor).toBe(15000000);
      expect(project4414.currency).toBe('ETB');
      expect(project4414.confidence).toBe('UNOFFICIAL_ESTIMATE');

      // Crucial rule from 05 §4 line 153:
      // "Lines with confidence: 'UNOFFICIAL_ESTIMATE' must include 'source': null"
      expect(project4414.source).toBeNull();
      expect(project4414.narrative.state).toBe('UNOFFICIAL_ESTIMATE');
      expect(project4414.narrative.messageKey).toBe(
        'narrative.no_source_document'
      );
    });

    it('handles case-insensitive ward code lookup (e.g. et-aa-w09)', async () => {
      const req = new Request('https://wardproofline.local/api/wards/et-aa-w09/receipts');
      const res = await getWardReceipts(req, {
        params: Promise.resolve({ wardCode: 'et-aa-w09' }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ward.code).toBe('ET-AA-W09');
    });

    it('returns 404 Problem JSON + E_NOT_FOUND when ward code does not exist', async () => {
      const req = new Request('https://wardproofline.local/api/wards/NON-EXISTENT-WARD/receipts');
      const res = await getWardReceipts(req, {
        params: Promise.resolve({ wardCode: 'NON-EXISTENT-WARD' }),
      });

      expect(res.status).toBe(404);
      expect(res.headers.get('Content-Type')).toContain('application/problem+json');

      const json = await res.json();
      expect(json.code).toBe('E_NOT_FOUND');
      expect(json.status).toBe(404);
      expect(json.title).toBe('Not Found');
      expect(json.detail).toContain('NON-EXISTENT-WARD');
    });

    it('rejects unsupported HTTP methods with 405 Method Not Allowed', async () => {
      const methods = [postWardReceipts, putWardReceipts, deleteWardReceipts, patchWardReceipts];
      for (const handler of methods) {
        const res = await handler();
        expect(res.status).toBe(405);
        expect(res.headers.get('Allow')).toBe('GET');
      }
    });
  });

  describe('2. GET /api/projects/[code] (05 §4, T-19)', () => {
    it('returns 200 with the single project receipt for cited project 4412', async () => {
      const req = new Request('https://wardproofline.local/api/projects/4412');
      const res = await getProjectReceiptEndpoint(req, {
        params: Promise.resolve({ code: '4412' }),
      });

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('application/json');

      const json = await res.json();
      expect(json.projectCode).toBe('4412');
      expect(json.title).toBe('Health post generator overhaul');
      expect(json.amountMinor).toBe(32000000);
      expect(json.currency).toBe('ETB');
      expect(json.contractor).toBe('AfroTech Infra');
      expect(json.promisedCompletion).toBe('2026-08-30');
      expect(json.confidence).toBe('OFFICIAL_CITED');

      expect(json.source).toBeDefined();
      expect(json.source.title).toBe('Woreda 9 Capital Budget FY2026');
      expect(json.source.page).toBe(41);
      expect(json.source.sha256).toBe(
        '3b1f9c87d4a2e5890123456789abcdef0123456789abcdef0123456789abcdef'
      );

      expect(json.narrative.state).toBe('PROBATION_ACTIVE');
      expect(json.narrative.messageKey).toBe('narrative.under_probation_n_days');
      expect(json.narrative.slots.days).toBe('5');

      expect(json.witness.count).toBe(2);
      expect(json.witness.target).toBe(3);

      expect(json.ward).toBeDefined();
      expect(json.ward.code).toBe('ET-AA-W09');
    });

    it('returns 200 with source: null for unofficial estimate 4414', async () => {
      const req = new Request('https://wardproofline.local/api/projects/4414');
      const res = await getProjectReceiptEndpoint(req, {
        params: Promise.resolve({ code: '4414' }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.projectCode).toBe('4414');
      expect(json.confidence).toBe('UNOFFICIAL_ESTIMATE');
      expect(json.source).toBeNull();
      expect(json.narrative.state).toBe('UNOFFICIAL_ESTIMATE');
      expect(json.narrative.messageKey).toBe('narrative.no_source_document');
    });

    it('returns 404 Problem JSON + E_NOT_FOUND when project code is unknown', async () => {
      const req = new Request('https://wardproofline.local/api/projects/9999');
      const res = await getProjectReceiptEndpoint(req, {
        params: Promise.resolve({ code: '9999' }),
      });

      expect(res.status).toBe(404);
      expect(res.headers.get('Content-Type')).toContain('application/problem+json');

      const json = await res.json();
      expect(json.code).toBe('E_NOT_FOUND');
      expect(json.status).toBe(404);
      expect(json.detail).toContain('9999');
    });

    it('rejects unsupported HTTP methods with 405 Method Not Allowed', async () => {
      const methods = [postProjectReceipt, putProjectReceipt, deleteProjectReceipt, patchProjectReceipt];
      for (const handler of methods) {
        const res = await handler();
        expect(res.status).toBe(405);
        expect(res.headers.get('Allow')).toBe('GET');
      }
    });
  });

  describe('3. Live Container State Integration & Derivations', () => {
    it('reflects updated witness count when task in container is updated', async () => {
      const container = getServiceContainer();
      await container.taskRepo.updateWitnessCount(DEMO_IDS.TASK_4412, 3);

      const receipt = getProjectReceipt('4412', container);
      expect(receipt).not.toBeNull();
      expect(receipt!.witness.count).toBe(3);
      expect(receipt!.witness.target).toBe(3);
    });

    it('reflects updated audit state when project in container is updated to PHYSICALLY_CONFIRMED', async () => {
      const container = getServiceContainer();
      // Project 4416 has no repair ticket, so audit state determines narrative
      await container.projectRepo.updateAuditState(
        DEMO_IDS.PROJECT_4416,
        'PHYSICALLY_CONFIRMED'
      );

      const receipt = getProjectReceipt('4416', container);
      expect(receipt).not.toBeNull();
      expect(receipt!.narrative.state).toBe('PHYSICALLY_CONFIRMED');
      expect(receipt!.narrative.messageKey).toBe('narrative.asset_present');
    });

    it('reflects FIELD_DISCREPANCY when audit state is DISCREPANCY_FLAGGED', async () => {
      const container = getServiceContainer();
      // Project 4415 is seeded as DISCREPANCY_FLAGGED
      const receipt = getProjectReceipt('4415', container);
      expect(receipt).not.toBeNull();
      expect(receipt!.narrative.state).toBe('FIELD_DISCREPANCY');
      expect(receipt!.narrative.messageKey).toBe('narrative.reports_disagree');
    });
  });

  describe('4. Formatting & Presentation Helpers (08 §5)', () => {
    it('formats currency in ETB without decimal places', () => {
      expect(formatCurrency(32000000, 'ETB')).toBe('ETB 320,000');
      expect(formatCurrency(15000000, 'ETB')).toBe('ETB 150,000');
      expect(formatCurrency(0, 'ETB')).toBe('ETB 0');
    });

    it('formats promised dates per 08 §5 (e.g. due 30 Aug)', () => {
      expect(formatPromisedDate('2026-08-30')).toBe('due 30 Aug');
      expect(formatPromisedDate('2026-10-15')).toBe('due 15 Oct');
    });

    it('formats archived dates (e.g. 12 Sep 2026)', () => {
      expect(formatArchivedDate('2026-09-12T08:00:00.000Z')).toBe('12 Sep 2026');
    });

    it('truncates sha256 to 6…4 pattern per 08 §5', () => {
      const sha = '3b1f9c87d4a2e5890123456789abcdef0123456789abcdef0123456789abcdef';
      expect(truncateHash(sha)).toBe('3b1f9c…cdef');
    });

    it('resolves narrative text with slot substitution', () => {
      const text = resolveNarrativeText('narrative.under_probation_n_days', { days: '5' });
      expect(text).toBe(
        'Repair claimed. Under 7-day check. 5 days left before it can be closed.'
      );
    });
  });
});
