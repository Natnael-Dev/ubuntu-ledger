// Unit Tests: Sybil & Collusion AI Service & Route (T-AI-022)
// Authoritative sources:
// - docs/specs/06-voice-and-ussd.md §7
// - docs/specs/07-trust-and-security.md §3, §5

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  detectSybilCollusion,
  type SybilObservationItem,
} from '@/app-services/ai/sybil-detect.service';
import { POST as handleSybilRoute } from '@/app/api/insights/sybil/route';
import {
  SybilCollusionResultSchema,
  type SybilCollusionResult,
} from '@/lib/ai/types';
import fallbackFixture from '@/content/fixtures/ai/sybil-collusion.json';

describe('Sybil & Collusion Service: detectSybilCollusion (T-AI-022)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('returns valid SybilCollusionResult adhering to schema with fallback when no API key is present', async () => {
    const observations: SybilObservationItem[] = [
      {
        id: 'obs-1',
        text: 'Borehole dry and valve broken',
        timestamp: '2026-09-20T05:00:00Z',
        msisdnPrefix: '254712',
        answers: { pump_broken: true },
      },
      {
        id: 'obs-2',
        text: 'Borehole dry and valve broken',
        timestamp: '2026-09-20T05:00:02Z',
        msisdnPrefix: '254712',
        answers: { pump_broken: true },
      },
    ];

    const result = await detectSybilCollusion(observations);

    const validation = SybilCollusionResultSchema.safeParse(result);
    expect(validation.success).toBe(true);

    if (validation.success) {
      expect(result.collusionRisk).toBe(fallbackFixture.collusionRisk);
      expect(result.similarityScore).toBe(fallbackFixture.similarityScore);
      expect(result.flaggedObservationIds).toEqual(fallbackFixture.flaggedObservationIds);
      expect(result.reasons).toEqual(fallbackFixture.reasons);
      expect(result.narrative).toBe(fallbackFixture.narrative);
    }
  });

  it('handles empty observation list gracefully with a safe low-risk default', async () => {
    const result = await detectSybilCollusion([]);

    const validation = SybilCollusionResultSchema.safeParse(result);
    expect(validation.success).toBe(true);
    expect(result.collusionRisk).toBe('LOW');
    expect(result.similarityScore).toBe(0);
    expect(result.flaggedObservationIds).toEqual([]);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('sanitizes msisdnPrefix to 6 characters and avoids PII exposure', async () => {
    process.env.GEMINI_API_KEY = 'mock-key';

    let capturedPrompt = '';
    const mockApiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  flaggedObservationIds: ['obs-pii-1'],
                  similarityScore: 0.95,
                  collusionRisk: 'HIGH',
                  reasons: ['Coordinated burst with identical content'],
                  narrative: 'Identical submissions within 1 second.',
                  clusterKey: '12345678abcdef01',
                  flaggedCohorts: ['2026-W38:254712'],
                }),
              },
            ],
          },
        },
      ],
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      const body = JSON.parse(init?.body as string);
      capturedPrompt = body.contents[0].parts[0].text;
      return new Response(JSON.stringify(mockApiResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const observations: SybilObservationItem[] = [
      {
        id: 'obs-pii-1',
        text: 'Reporter Alice phone +254712345678 says broken tap',
        msisdnPrefix: '254712999', // 9 digits, should be sliced to 6
      },
    ];

    const result = await detectSybilCollusion(observations);

    expect(result.collusionRisk).toBe('HIGH');
    expect(result.similarityScore).toBe(0.95);
    expect(capturedPrompt).toContain('254712');
    expect(capturedPrompt).not.toContain('254712999');
    // Ensure full phone numbers are redacted by redactPiiPayload
    expect(capturedPrompt).not.toContain('+254712345678');
  });

  it('falls back gracefully when Gemini API returns 500 error', async () => {
    process.env.GEMINI_API_KEY = 'mock-key';

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Internal Server Error', { status: 500 })
    );

    const observations: SybilObservationItem[] = [
      {
        id: 'obs-err-1',
        text: 'Checking pump',
      },
    ];

    const result = await detectSybilCollusion(observations);

    const validation = SybilCollusionResultSchema.safeParse(result);
    expect(validation.success).toBe(true);
    expect(result.collusionRisk).toBe(fallbackFixture.collusionRisk);
  });
});

describe('Sybil & Collusion API Route: POST /api/insights/sybil (T-AI-022)', () => {
  beforeEach(() => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 200 with X-AI-Assistive-Only header and typed JSON result', async () => {
    const req = new Request('https://ubuntu-ledger.local/api/insights/sybil', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        observations: [
          {
            id: 'obs-route-1',
            text: 'Ground truth report 1',
            timestamp: '2026-09-20T05:00:00Z',
          },
          {
            id: 'obs-route-2',
            text: 'Ground truth report 2',
            timestamp: '2026-09-20T05:00:01Z',
          },
        ],
      }),
    });

    const res = await handleSybilRoute(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('application/json');
    expect(res.headers.get('X-AI-Assistive-Only')).toBe('true');

    const json = (await res.json()) as SybilCollusionResult;
    const validation = SybilCollusionResultSchema.safeParse(json);
    expect(validation.success).toBe(true);
  });

  it('handles empty body gracefully returning fallback fixture', async () => {
    const req = new Request('https://ubuntu-ledger.local/api/insights/sybil', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '',
    });

    const res = await handleSybilRoute(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('X-AI-Assistive-Only')).toBe('true');

    const json = (await res.json()) as SybilCollusionResult;
    const validation = SybilCollusionResultSchema.safeParse(json);
    expect(validation.success).toBe(true);
  });

  it('handles malformed JSON body gracefully', async () => {
    const req = new Request('https://ubuntu-ledger.local/api/insights/sybil', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ not valid json syntax',
    });

    const res = await handleSybilRoute(req);
    expect(res.status).toBe(200);

    const json = (await res.json()) as SybilCollusionResult;
    const validation = SybilCollusionResultSchema.safeParse(json);
    expect(validation.success).toBe(true);
  });
});
