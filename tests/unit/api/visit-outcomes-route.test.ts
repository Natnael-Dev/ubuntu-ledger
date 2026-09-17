// Unit tests for POST /api/visits/outcomes route handler (T-26)
// Authoritative sources:
// - docs/specs/05-api-contracts.md §7, §12
// - docs/specs/07-trust-and-security.md §7
// - docs/specs/11-tasks.md T-26

import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/visits/outcomes/route';

describe('POST /api/visits/outcomes Route Handler', () => {
  function makeRequest(body: unknown, headers: Record<string, string> = {}): Request {
    return new Request('https://wardproofline.dev/api/visits/outcomes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  }

  it('successfully accepts valid outcome and returns silent response', async () => {
    const req = makeRequest({
      serviceCode: 'ET-ID-REPLACE',
      outcomeCode: 2,
      extraFeeMinor: 20000,
      visits: 3,
      phoneHash: 'phone_hash_valid_01',
      channel: 'USSD',
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({
      accepted: true,
      thankYouKey: 'outcome.recorded',
    });

    // Verify no aggregate leakage in body
    expect(json.reportCount).toBeUndefined();
    expect(json.distinctClusters).toBeUndefined();
    expect(json.kSatisfied).toBeUndefined();
  });

  it('rejects unknown serviceCode with 404 E_UNKNOWN_CODE', async () => {
    const req = makeRequest({
      serviceCode: 'ET-NON-EXISTENT',
      outcomeCode: 1,
      phoneHash: 'phone_hash_02',
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.code).toBe('E_UNKNOWN_CODE');
  });

  it('rejects invalid outcomeCode with 400 E_INVALID_OUTCOME_CODE', async () => {
    const req = makeRequest({
      serviceCode: 'ET-ID-REPLACE',
      outcomeCode: 9, // Must be 1..5
      phoneHash: 'phone_hash_03',
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe('E_INVALID_OUTCOME_CODE');
  });

  it('is idempotent: duplicate request with same Idempotency-Key returns 200 without duplication', async () => {
    const idempotencyKey = `idemp_route_test_${Date.now()}_${Math.random()}`;
    const payload = {
      serviceCode: 'ET-ID-REPLACE',
      outcomeCode: 1,
      phoneHash: 'phone_hash_idemp',
      channel: 'USSD',
    };

    const req1 = makeRequest(payload, { 'Idempotency-Key': idempotencyKey });
    const res1 = await POST(req1);
    expect(res1.status).toBe(200);

    const req2 = makeRequest(payload, { 'Idempotency-Key': idempotencyKey });
    const res2 = await POST(req2);
    expect(res2.status).toBe(200);
    const json2 = await res2.json();
    expect(json2).toEqual({
      accepted: true,
      thankYouKey: 'outcome.recorded',
    });
  });

  it('enforces rate limit: 4th submission by same phone for same service in one day returns 429', async () => {
    const reporterHash = `rate_limited_phone_${Date.now()}`;
    const payload = (i: number) => ({
      serviceCode: 'ET-ID-REPLACE',
      outcomeCode: 1,
      phoneHash: reporterHash,
      channel: 'USSD',
      idempotencyKey: `idemp_rl_${reporterHash}_${i}`,
    });

    // 1st request
    const r1 = await POST(makeRequest(payload(1)));
    expect(r1.status).toBe(200);

    // 2nd request
    const r2 = await POST(makeRequest(payload(2)));
    expect(r2.status).toBe(200);

    // 3rd request
    const r3 = await POST(makeRequest(payload(3)));
    expect(r3.status).toBe(200);

    // 4th request exceeds rate limit (max 3 / phone / service / day)
    const r4 = await POST(makeRequest(payload(4)));
    expect(r4.status).toBe(429);
    const json4 = await r4.json();
    expect(json4.code).toBe('E_RATE_LIMITED');
  });

  it('SEC-04: ignores client-supplied clusterKey and processes outcome cleanly', async () => {
    const maliciousPayload = {
      serviceCode: 'ET-ID-REPLACE',
      outcomeCode: 1,
      phoneHash: 'malicious_client_probe_01',
      channel: 'USSD',
      clusterKey: 'attacker-forged-cluster-key',
      idempotencyKey: 'idemp_sec04_01',
    };

    const res = await POST(makeRequest(maliciousPayload));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.accepted).toBe(true);
    expect(json.thankYouKey).toBe('outcome.recorded');
  });
});
