// T-31 IVR Ingress API Route Unit & Security Tests
// Authoritative sources: docs/specs/05-api-contracts.md §3, docs/specs/07-trust-and-security.md §5

import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/ivr/route';

describe('POST /api/ivr Ingress Gateway Route', () => {
  it('returns 400 Problem Details on malformed JSON payload', async () => {
    const req = new Request('http://localhost/api/ivr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid-json{',
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(res.headers.get('Content-Type')).toContain('application/problem+json');
    const json = await res.json();
    expect(json.code).toBe('E_INVALID_JSON');
  });

  it('returns 400 Problem Details if sessionId is missing', async () => {
    const req = new Request('http://localhost/api/ivr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber: '+251911223344',
        digits: '1',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe('E_MISSING_SESSION_ID');
  });

  it('returns 400 Problem Details if phoneNumber is invalid / too short', async () => {
    const req = new Request('http://localhost/api/ivr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'ivr_test_01',
        phoneNumber: '123',
        digits: '',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe('E_INVALID_PHONE_NUMBER');
  });

  it('returns 200 with valid IvrResponse wire contract on legitimate request', async () => {
    const req = new Request('http://localhost/api/ivr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'ivr_01J8ABCDEF',
        phoneNumber: '+251911223344',
        digits: '1*4412*1',
        locale: 'am',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('application/json');

    const json = await res.json();
    expect(json.action).toBe('PROMPT');
    expect(Array.isArray(json.audioKeys)).toBe(true);
    expect(json.audioKeys).toContain('q.generator.runs_on_outage');
    expect(json.timeoutMs).toBe(8000);
    expect(json.repeatKey).toBe('prompt.repeat_hint');

    // Zero-PII verification: phone number must NOT be in response
    expect(JSON.stringify(json)).not.toContain('251911223344');
  });

  it('processes observation completion gracefully at terminal stage', async () => {
    const req = new Request('http://localhost/api/ivr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'ivr_01J8FINAL',
        phoneNumber: '+251911998877',
        digits: '1*4412*1*1*2*1',
        locale: 'en',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.action).toBe('END');
    expect(json.audioKeys).toContain('observation.counted');
  });
});
