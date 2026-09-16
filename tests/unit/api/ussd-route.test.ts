// Focused unit tests for POST /api/ussd HTTP transport adapter
// Authoritative sources:
// - docs/specs/06-voice-and-ussd.md §1, §2, §10
// - docs/specs/05-api-contracts.md §1
// - docs/specs/07-trust-and-security.md §5
// - docs/specs/11-tasks.md T-15

import { describe, it, expect, vi } from 'vitest';
import { POST, GET, PUT, DELETE, PATCH } from '@/app/api/ussd/route';
import * as ussdSessionModule from '@/domain/ussd/session';
import { getServiceContainer } from '@/infra/db/container';
import { computePhoneHash } from '@/lib/msisdn';
import { DEMO_PEPPER } from '@/fixtures/demo-scenario';

describe('POST /api/ussd — HTTP Transport Adapter', () => {
  const defaultSessionId = 'ATUid_9f1a2b3c4d5e';
  const defaultPhone = '+251911223344';
  const defaultServiceCode = '*890#';

  function createFormRequest(params: Record<string, string>): Request {
    const searchParams = new URLSearchParams(params);
    return new Request('https://wardproofline.local/api/ussd', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: searchParams.toString(),
    });
  }

  function createJsonRequest(body: Record<string, unknown>): Request {
    return new Request('https://wardproofline.local/api/ussd', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  }

  describe('1. Ingress Payload Parsing & Compatibility', () => {
    it('successfully processes form-encoded Africa\'s Talking payload', async () => {
      const req = createFormRequest({
        sessionId: defaultSessionId,
        serviceCode: defaultServiceCode,
        phoneNumber: defaultPhone,
        text: '',
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('text/plain');

      const body = await res.text();
      expect(body.startsWith('CON ')).toBe(true);
      expect(body).toContain('1 Check a project');
    });

    it('successfully processes JSON payload (simulator/testing interoperability)', async () => {
      const req = createJsonRequest({
        sessionId: defaultSessionId,
        serviceCode: defaultServiceCode,
        phoneNumber: defaultPhone,
        text: '',
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('text/plain');

      const body = await res.text();
      expect(body.startsWith('CON ')).toBe(true);
      expect(body).toContain('1 Check a project');
    });

    it('handles omitted serviceCode and omitted text (defaults text to "")', async () => {
      const req = createFormRequest({
        sessionId: defaultSessionId,
        phoneNumber: defaultPhone,
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body.startsWith('CON ')).toBe(true);
    });

    it('returns 400 if sessionId is missing', async () => {
      const req = createFormRequest({
        phoneNumber: defaultPhone,
        text: '1',
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.text();
      expect(body).toBe('Invalid USSD request payload');
    });

    it('returns 400 if phoneNumber is missing', async () => {
      const req = createFormRequest({
        sessionId: defaultSessionId,
        text: '1',
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.text();
      expect(body).toBe('Invalid USSD request payload');
    });

    it('returns 400 on malformed JSON body', async () => {
      const req = new Request('https://wardproofline.local/api/ussd', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: '{not-json}',
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.text();
      expect(body).toBe('Invalid USSD request payload');
    });
  });

  describe('2. Navigation and Exact CON/END Framing', () => {
    it('returns exact CON framing for non-terminal root request', async () => {
      const req = createFormRequest({
        sessionId: defaultSessionId,
        phoneNumber: defaultPhone,
        text: '',
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body.startsWith('CON ')).toBe(true);
      expect(body.startsWith('CON CON ')).toBe(false);
    });

    it('returns exact CON framing for intermediate navigation (1*4412)', async () => {
      const req = createFormRequest({
        sessionId: defaultSessionId,
        phoneNumber: defaultPhone,
        text: '1*4412',
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body.startsWith('CON ')).toBe(true);
      expect(body).toContain('Health post generator overhaul');
    });

    it('returns exact END framing for terminal request (1*4412*1*1*2*1)', async () => {
      const req = createFormRequest({
        sessionId: defaultSessionId,
        phoneNumber: defaultPhone,
        text: '1*4412*1*1*2*1',
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body.startsWith('END ')).toBe(true);
      expect(body.startsWith('END END ')).toBe(false);
      expect(body).toContain('Thank you.');
    });

    it('runs scripted session end-to-end through the HTTP endpoint', async () => {
      const steps = [
        { text: '', expectPrefix: 'CON ', expectBody: '1 Check a project' },
        { text: '1', expectPrefix: 'CON ', expectBody: 'Enter the 4-digit project code' },
        { text: '1*4412', expectPrefix: 'CON ', expectBody: 'Health post generator' },
        { text: '1*4412*1', expectPrefix: 'CON ', expectBody: 'When mains power stops' },
        { text: '1*4412*1*1', expectPrefix: 'CON ', expectBody: 'Does the vaccine fridge' },
        { text: '1*4412*1*1*2', expectPrefix: 'CON ', expectBody: 'Is a project board' },
        { text: '1*4412*1*1*2*1', expectPrefix: 'END ', expectBody: 'Thank you.' },
      ];

      for (const step of steps) {
        const req = createFormRequest({
          sessionId: defaultSessionId,
          phoneNumber: defaultPhone,
          text: step.text,
        });
        const res = await POST(req);
        expect(res.status).toBe(200);
        const body = await res.text();
        expect(body.startsWith(step.expectPrefix)).toBe(true);
        expect(body).toContain(step.expectBody);
      }
    });

    it('does not crash on malformed or unusual USSD text (repeated asterisks, letters, etc.)', async () => {
      const req = createFormRequest({
        sessionId: defaultSessionId,
        phoneNumber: defaultPhone,
        text: '**1***999999**#abc**',
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body.startsWith('CON ') || body.startsWith('END ')).toBe(true);
    });

    it('is purely deterministic: identical request produces identical response', async () => {
      const req1 = createFormRequest({
        sessionId: defaultSessionId,
        phoneNumber: defaultPhone,
        text: '1*4412*3',
      });
      const req2 = createFormRequest({
        sessionId: defaultSessionId,
        phoneNumber: defaultPhone,
        text: '1*4412*3',
      });

      const res1 = await POST(req1);
      const res2 = await POST(req2);

      const body1 = await res1.text();
      const body2 = await res2.text();

      expect(body1).toBe(body2);
      expect(body1.startsWith('END ')).toBe(true);
    });
  });

  describe('3. MSISDN Trust Boundary & PII Protection', () => {
    it('returns 400 if phone number is too short or invalid format', async () => {
      const req = createFormRequest({
        sessionId: defaultSessionId,
        phoneNumber: '123', // Less than 6 digits
        text: '',
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.text();
      expect(body).toBe('Invalid phone number format');
      expect(body).not.toContain('123');
    });

    it('never leaks raw MSISDN into response body or headers', async () => {
      const sensitivePhone = '+251999887766';
      const req = createFormRequest({
        sessionId: defaultSessionId,
        phoneNumber: sensitivePhone,
        text: '1*4412*1',
      });

      const res = await POST(req);
      const body = await res.text();

      expect(body).not.toContain(sensitivePhone);
      expect(body).not.toContain('999887766');

      for (const [key, value] of res.headers.entries()) {
        expect(key).not.toContain('999887766');
        expect(value).not.toContain('999887766');
      }
    });

    it('never passes raw MSISDN into reduceUssdSession domain function', async () => {
      const spy = vi.spyOn(ussdSessionModule, 'reduceUssdSession');
      const sensitivePhone = '+251912345678';

      const req = createFormRequest({
        sessionId: defaultSessionId,
        phoneNumber: sensitivePhone,
        text: '1*4412',
      });

      await POST(req);

      expect(spy).toHaveBeenCalled();
      const [invokedText, invokedContext] = spy.mock.calls[0];

      expect(invokedText).toBe('1*4412');
      expect(invokedText).not.toContain(sensitivePhone);

      // Verify context does not contain the raw phone number
      const serializedContext = JSON.stringify(invokedContext || {});
      expect(serializedContext).not.toContain(sensitivePhone);

      spy.mockRestore();
    });
  });

  describe('4. Error Handling & Method Guarding', () => {
    it('returns 405 Method Not Allowed with Allow: POST header for unsupported verbs', async () => {
      const verbs = [GET, PUT, DELETE, PATCH];

      for (const verb of verbs) {
        const res = await verb();
        expect(res.status).toBe(405);
        expect(res.headers.get('Allow')).toBe('POST');
        const body = await res.text();
        expect(body).toBe('Method Not Allowed');
      }
    });

    it('returns safe generic 500 without leaking stack trace on internal error', async () => {
      const spy = vi
        .spyOn(ussdSessionModule, 'reduceUssdSession')
        .mockImplementationOnce(() => {
          throw new Error('SecretDatabaseConnectionFailed: postgres://admin:secretPass@internal:5432/db');
        });

      const req = createFormRequest({
        sessionId: defaultSessionId,
        phoneNumber: defaultPhone,
        text: '',
      });

      const res = await POST(req);
      expect(res.status).toBe(500);

      const body = await res.text();
      expect(body).toBe('Internal error processing USSD session');
      expect(body).not.toContain('SecretDatabaseConnectionFailed');
      expect(body).not.toContain('secretPass');
      expect(body).not.toContain('postgres://');

      spy.mockRestore();
    });
  });

  describe('5. CH-02 Length Invariant via HTTP Responses (<=182 characters)', () => {
    it('all standard navigated responses returned via HTTP do not exceed 182 characters', async () => {
      const pathsToTest = [
        '',
        '1',
        '1*4412',
        '1*4412*1',
        '1*4412*1*1',
        '1*4412*1*1*2',
        '1*4412*1*1*2*1',
        '1*4412*3',
        '2',
        '2*1',
        '2*1*1',
        '2*1*2',
        '2*1*3',
        '2*1*3*1',
        '3',
        '3*4412',
        '3*4412*1',
        '4',
        '4*1',
        '4*2',
        '4*3',
      ];

      for (const text of pathsToTest) {
        const req = createFormRequest({
          sessionId: defaultSessionId,
          phoneNumber: defaultPhone,
          text,
        });

        const res = await POST(req);
        expect(res.status).toBe(200);
        const body = await res.text();
        expect(
          body.length,
          `HTTP response for text "${text}" exceeded 182 chars (${body.length}): "${body}"`
        ).toBeLessThanOrEqual(182);
      }
    });
  });

  describe('6. Respondent UUID Generation and Persistence (Checkpoint 3 Fix)', () => {
    it('creates and persists new respondents with valid RFC 4122 UUID instead of resp-auto-* synthetic IDs', async () => {
      const container = getServiceContainer();
      const newPhone = '+251977665544';
      const pepper = process.env.PHONE_HASH_PEPPER || process.env.PEPPER || DEMO_PEPPER;
      const phoneHash = computePhoneHash(newPhone, pepper);

      // Verify respondent does not exist before observation submission
      const existing = await container.respondentRepo.findByPhoneHash(phoneHash);
      expect(existing).toBeNull();

      // Submit terminal observation sequence
      const req = createFormRequest({
        sessionId: 'ATUid_new_session_999',
        phoneNumber: newPhone,
        text: '1*4412*1*1*2*1',
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text.startsWith('END ')).toBe(true);

      // Verify respondent was persisted and can be looked up by phoneHash
      const created = await container.respondentRepo.findByPhoneHash(phoneHash);
      expect(created).not.toBeNull();

      // Assert UUID validity (RFC 4122) and absence of synthetic non-UUID prefix
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(created!.id).toMatch(uuidRegex);
      expect(created!.id.startsWith('resp-auto-')).toBe(false);

      // Verify respondent can also be retrieved by its primary key UUID
      const byId = await container.respondentRepo.findById(created!.id);
      expect(byId).not.toBeNull();
      expect(byId!.id).toBe(created!.id);
    });
  });
});
