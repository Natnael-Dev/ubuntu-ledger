// Unit tests for POST /api/observations HTTP Route & Idempotency Header
// Authoritative sources:
// - docs/specs/05-api-contracts.md §0, §5, §13
// - docs/specs/02-architecture.md §2, §4, §5 (Path B)
// - docs/specs/07-trust-and-security.md §3, §4, §8
// - docs/specs/14-testing-and-edge-cases.md §3
// - docs/specs/11-tasks.md T-16

import { describe, it, expect, beforeEach } from 'vitest';
import {
  POST,
  GET,
  PUT,
  DELETE,
  PATCH,
} from '@/app/api/observations/route';
import { ObservationService } from '@/app-services/observation.service';
import { InMemoryRespondentRepository } from '@/infra/db/repositories/respondent.repository';
import { InMemoryTransactionRunner } from '@/infra/db/transaction';
import { TestClock } from '@/infra/clock';
import type {
  InspectionTaskRecord,
  ProjectRecord,
  RespondentRecord,
} from '@/infra/db/types';

describe('POST /api/observations — HTTP Route & Idempotency Boundary', () => {
  let txRunner: InMemoryTransactionRunner;
  let respondentRepo: InMemoryRespondentRepository;
  let observationService: ObservationService;
  let clock: TestClock;

  const PROJECT_ID = 'proj-health-01';
  const TASK_ID = 'task-inspect-01';
  const WARD_ID = 'ward-nairobi-01';
  const ASSET_ID = 'asset-generator-01';

  const VALID_PHONE_HASH =
    '9ad4c89283748291028475829104857291048572910485729104857291048572';
  const VALID_RESPONDENT_ID = 'e3b0c442-98fc-4c14-9afe-037e564d2d53';

  const WRONG_WARD_PHONE_HASH =
    '1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff';
  const WRONG_WARD_RESPONDENT_ID = 'f4c1d553-09ad-4d25-a0fe-148f675e3e64';

  const VALID_IDEMPOTENCY_KEY = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

  beforeEach(() => {
    clock = new TestClock(new Date('2026-09-16T10:00:00Z'));
    txRunner = new InMemoryTransactionRunner();
    respondentRepo = new InMemoryRespondentRepository();
    observationService = new ObservationService(
      txRunner,
      txRunner.idempotencyStore,
      clock
    );

    // Seed aggregate project & inspection task
    const project: ProjectRecord = {
      id: PROJECT_ID,
      wardId: WARD_ID,
      projectCode: '4412',
      fiscal: 'DISBURSED',
      audit: 'AWAITING_THRESHOLD',
      confidence: 'OFFICIAL_CITED',
      confirmedAt: null,
    };
    txRunner.projectRepo.seed(project);

    const task: InspectionTaskRecord = {
      id: TASK_ID,
      projectId: PROJECT_ID,
      assetId: ASSET_ID,
      dispatchedAt: new Date('2026-09-15T08:00:00Z'),
      expiresAt: new Date('2026-09-22T08:00:00Z'),
      witnessTarget: 3,
      witnessCount: 0,
      closedAt: null,
    };
    txRunner.taskRepo.seedTask(task);

    // Seed registered respondent in matching ward
    const respondent: RespondentRecord = {
      id: VALID_RESPONDENT_ID,
      wardId: WARD_ID,
      phoneHash: VALID_PHONE_HASH,
      registeredAt: new Date('2026-09-01T00:00:00Z'),
      locale: 'sw',
    };
    respondentRepo.seed(respondent);

    // Seed registered respondent in a different ward
    const wrongWardRespondent: RespondentRecord = {
      id: WRONG_WARD_RESPONDENT_ID,
      wardId: 'ward-mombasa-99',
      phoneHash: WRONG_WARD_PHONE_HASH,
      registeredAt: new Date('2026-09-01T00:00:00Z'),
      locale: 'sw',
    };
    respondentRepo.seed(wrongWardRespondent);
  });

  function callPost(req: Request) {
    (req as Request & { deps?: unknown }).deps = {
      respondentRepo,
      observationService,
    };
    return POST(req);
  }

  function createRequest(
    body: unknown,
    customHeaders: Record<string, string> = {}
  ): Request {
    const headers = new Headers({
      'Content-Type': 'application/json',
      'Idempotency-Key': VALID_IDEMPOTENCY_KEY,
    });
    for (const [k, v] of Object.entries(customHeaders)) {
      headers.set(k, v);
    }
    return new Request('https://wardproofline.local/api/observations', {
      method: 'POST',
      headers,
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  }

  function validPayload() {
    return {
      taskId: TASK_ID,
      phoneHash: VALID_PHONE_HASH,
      channel: 'PWA',
      answers: { q1_operational: true, q2_fuel_present: true },
      geoCell: 'et-aa-0917',
      submittedAt: '2026-09-16T09:30:00Z',
      clientIdempotencyKey: 'client-key-1001',
    };
  }

  describe('1. Idempotency-Key Header Validation (05 §0)', () => {
    it('rejects request with missing Idempotency-Key header with 400 + E_MISSING_IDEMPOTENCY_KEY', async () => {
      const req = new Request('https://wardproofline.local/api/observations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validPayload()),
      });

      const res = await callPost(req);
      expect(res.status).toBe(400);
      expect(res.headers.get('Content-Type')).toContain('application/problem+json');

      const json = await res.json();
      expect(json.code).toBe('E_MISSING_IDEMPOTENCY_KEY');
      expect(json.status).toBe(400);
      expect(json.detail).toContain('Idempotency-Key: <uuid>');
    });

    it('rejects request with empty/whitespace Idempotency-Key header with 400', async () => {
      const req = createRequest(validPayload(), { 'Idempotency-Key': '   ' });

      const res = await callPost(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.code).toBe('E_MISSING_IDEMPOTENCY_KEY');
    });

    it('rejects request with non-UUID Idempotency-Key header with 422 + E_VALIDATION', async () => {
      const req = createRequest(validPayload(), {
        'Idempotency-Key': 'not-a-valid-uuid',
      });

      const res = await callPost(req);
      expect(res.status).toBe(422);
      expect(res.headers.get('Content-Type')).toContain('application/problem+json');

      const json = await res.json();
      expect(json.code).toBe('E_VALIDATION');
      expect(json.status).toBe(422);
      expect(json.errors).toContain('headers.idempotency-key');
    });

    it('accepts valid UUID header regardless of casing', async () => {
      const req = createRequest(validPayload(), {
        'idempotency-key': 'A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11',
      });

      const res = await callPost(req);
      expect(res.status).toBe(200);
    });

    it('treats Idempotency-Key header and body clientIdempotencyKey as independent values', async () => {
      const payload = {
        ...validPayload(),
        clientIdempotencyKey: 'independent-client-uuid-or-string-99',
      };
      const req = createRequest(payload, {
        'Idempotency-Key': '12345678-1234-1234-1234-123456789abc',
      });

      const res = await callPost(req);
      expect(res.status).toBe(200);
    });
  });

  describe('2. Request Body Schema Validation (05 §5)', () => {
    it('returns 422 + E_VALIDATION when request body is not valid JSON', async () => {
      const req = createRequest('invalid json body {', {
        'Content-Type': 'application/json',
      });

      const res = await callPost(req);
      expect(res.status).toBe(422);
      const json = await res.json();
      expect(json.code).toBe('E_VALIDATION');
    });

    it('returns 422 + E_VALIDATION when required fields are missing', async () => {
      const req = createRequest({
        taskId: '',
        phoneHash: '',
        answers: 'not-an-object',
      });

      const res = await callPost(req);
      expect(res.status).toBe(422);
      const json = await res.json();
      expect(json.code).toBe('E_VALIDATION');
      expect(json.errors.length).toBeGreaterThan(0);
    });

    it('returns 422 + E_VALIDATION when answers contain non-boolean values', async () => {
      const req = createRequest({
        ...validPayload(),
        answers: { q1: 'yes', q2: 1 },
      });

      const res = await callPost(req);
      expect(res.status).toBe(422);
      const json = await res.json();
      expect(json.code).toBe('E_VALIDATION');
      expect(json.errors).toContain('answers.q1 must be a boolean');
      expect(json.errors).toContain('answers.q2 must be a boolean');
    });
  });

  describe('3. Server-Side Identity Resolution & Privacy Boundary', () => {
    it('returns 404 + E_UNKNOWN_CODE when phoneHash is unknown / unregistered', async () => {
      const req = createRequest({
        ...validPayload(),
        phoneHash: '0000000000000000000000000000000000000000000000000000000000000000',
      });

      const res = await callPost(req);
      expect(res.status).toBe(404);
      expect(res.headers.get('Content-Type')).toContain('application/problem+json');

      const json = await res.json();
      expect(json.code).toBe('E_UNKNOWN_CODE');
      expect(json.status).toBe(404);
      expect(json.detail).toContain('Respondent not found');
    });

    it('never exposes respondent.id or raw MSISDN in HTTP success response', async () => {
      const req = createRequest(validPayload());

      const res = await callPost(req);
      expect(res.status).toBe(200);

      const rawText = await res.text();
      expect(rawText).not.toContain(VALID_RESPONDENT_ID);
      expect(rawText).not.toContain('+254');
      expect(rawText).not.toContain('+251');

      const json = JSON.parse(rawText);
      expect(json).not.toHaveProperty('respondentId');
      expect(json).not.toHaveProperty('respondent_id');
      expect(json).not.toHaveProperty('msisdn');
    });

    it('never exposes respondent.id or raw MSISDN in HTTP error response', async () => {
      const req = createRequest({
        ...validPayload(),
        phoneHash: WRONG_WARD_PHONE_HASH,
      });

      const res = await callPost(req);
      expect(res.status).toBe(404);

      const rawText = await res.text();
      expect(rawText).not.toContain(WRONG_WARD_RESPONDENT_ID);
      expect(rawText).not.toContain('+254');
      expect(rawText).not.toContain('+251');
    });
  });

  describe('4. Ward-Registration Invariant Enforcement', () => {
    it('returns 404 + E_UNKNOWN_CODE when respondent is registered in a different ward', async () => {
      const req = createRequest({
        ...validPayload(),
        phoneHash: WRONG_WARD_PHONE_HASH,
      });

      const res = await callPost(req);
      expect(res.status).toBe(404);
      expect(res.headers.get('Content-Type')).toContain('application/problem+json');

      const json = await res.json();
      expect(json.code).toBe('E_UNKNOWN_CODE');
      expect(json.status).toBe(404);
      expect(json.detail).toContain('does not match project ward');
    });
  });

  describe('5. End-to-End Observation Ingress & Duplicate Cluster Handling (05 §5)', () => {
    it('successfully processes valid observation and returns 200 response shape', async () => {
      const req = createRequest(validPayload());

      const res = await callPost(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('application/json');

      const json = await res.json();
      expect(json.accepted).toBe(true);
      expect(json.counted).toBe(true);
      expect(json.witnessCount).toBe(1);
      expect(json.witnessTarget).toBe(3);
      expect(typeof json.clusterKey).toBe('string');
    });

    it('replaying the same clientIdempotencyKey returns cached response without creating second observation', async () => {
      const payload = validPayload();
      const req1 = createRequest(payload);
      const res1 = await callPost(req1);
      expect(res1.status).toBe(200);
      const json1 = await res1.json();

      // Replay with new HTTP Idempotency-Key but same clientIdempotencyKey
      const req2 = createRequest(payload, {
        'Idempotency-Key': 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
      });
      const res2 = await callPost(req2);
      expect(res2.status).toBe(200);
      const json2 = await res2.json();

      expect(json2).toEqual(json1);

      const observations = await txRunner.taskRepo.getObservationsForTask(TASK_ID);
      expect(observations.length).toBe(1);
    });

    it('returns counted: false with reasonKey for duplicate cluster submission', async () => {
      // First submission from respondent in cell et-aa-0917
      const req1 = createRequest(validPayload());
      const res1 = await callPost(req1);
      expect(res1.status).toBe(200);

      // Seed second respondent in same ward
      const SECOND_PHONE_HASH =
        '2222333344445555666677778888999900001111222233334444555566667777';
      const SECOND_RESPONDENT_ID = 'c1b0c442-98fc-4c14-9afe-037e564d2d99';
      respondentRepo.seed({
        id: SECOND_RESPONDENT_ID,
        wardId: WARD_ID,
        phoneHash: SECOND_PHONE_HASH,
        registeredAt: new Date('2026-09-01T00:00:00Z'),
        locale: 'sw',
      });

      // Second submission from same geoCell with different respondent and client key
      const req2 = createRequest(
        {
          ...validPayload(),
          phoneHash: SECOND_PHONE_HASH,
          clientIdempotencyKey: 'client-key-1002',
        },
        {
          'Idempotency-Key': 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
        }
      );

      const res2 = await callPost(req2);
      expect(res2.status).toBe(200);
      const json2 = await res2.json();

      expect(json2.accepted).toBe(true);
      expect(json2.counted).toBe(false);
      expect(json2.reasonKey).toBe('observation.cluster_already_counted');
      expect(json2.witnessCount).toBe(1);
    });
  });

  describe('6. HTTP Method Guards', () => {
    it('rejects GET with 405 Method Not Allowed', async () => {
      const res = await GET();
      expect(res.status).toBe(405);
      expect(res.headers.get('Allow')).toBe('POST');
    });

    it('rejects PUT with 405 Method Not Allowed', async () => {
      const res = await PUT();
      expect(res.status).toBe(405);
      expect(res.headers.get('Allow')).toBe('POST');
    });

    it('rejects DELETE with 405 Method Not Allowed', async () => {
      const res = await DELETE();
      expect(res.status).toBe(405);
      expect(res.headers.get('Allow')).toBe('POST');
    });

    it('rejects PATCH with 405 Method Not Allowed', async () => {
      const res = await PATCH();
      expect(res.status).toBe(405);
      expect(res.headers.get('Allow')).toBe('POST');
    });
  });
});
