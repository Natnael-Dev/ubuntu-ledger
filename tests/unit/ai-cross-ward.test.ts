// Unit tests for Cross-Ward Contractor Pattern Detection (T-AI-023)
// Tests:
// 1. Service execution and schema adherence (CrossWardPatternResultSchema)
// 2. Deterministic fallback behavior when GEMINI_API_KEY is not set or network fails
// 3. Mocked Gemini API success pathway
// 4. API route POST and GET handlers with assistive headers and defaults

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  analyzeCrossWardPatterns,
  type AnalyzeCrossWardPatternsParams,
} from '@/app-services/ai/cross-ward.service';
import {
  CrossWardPatternResultSchema,
  type CrossWardPatternResult,
} from '@/lib/ai/types';
import fallbackFixture from '@/content/fixtures/ai/cross-ward-patterns.json';
import { POST, GET } from '@/app/api/insights/cross-ward/route';

describe('Cross-Ward Pattern Service: analyzeCrossWardPatterns (T-AI-023)', () => {
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

  it('returns valid structure adhering to CrossWardPatternResultSchema with fallback when key unset', async () => {
    const params: AnalyzeCrossWardPatternsParams = {
      contractorName: 'Apex Rift Engineering Ltd',
      wardIds: ['ward-nandi-hills-01', 'ward-chepkunyuk-02'],
      projects: [
        {
          id: 'proj-001',
          wardId: 'ward-nandi-hills-01',
          amount: 15000000,
          status: 'IN_PROGRESS',
          type: 'WATER_RETICULATION',
        },
      ],
    };

    const result = await analyzeCrossWardPatterns(params);

    const validation = CrossWardPatternResultSchema.safeParse(result);
    expect(validation.success).toBe(true);

    expect(result).toEqual(fallbackFixture);
    expect(result.contractorName).toBe('Apex Rift Engineering Ltd');
    expect(result.concentrationScore).toBeGreaterThanOrEqual(0);
    expect(result.concentrationScore).toBeLessThanOrEqual(1);
    expect(Array.isArray(result.wardsInvolved)).toBe(true);
    expect(Array.isArray(result.flaggedPatterns)).toBe(true);
    expect(typeof result.anomalyDetected).toBe('boolean');
    expect(typeof result.recommendation).toBe('string');
  });

  it('falls back deterministically when external API rejects or times out', async () => {
    process.env.GEMINI_API_KEY = 'mock-test-key';
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Connection timeout'));

    const result = await analyzeCrossWardPatterns({
      contractorName: 'Apex Rift Engineering Ltd',
    });

    expect(result).toEqual(fallbackFixture);
    expect(CrossWardPatternResultSchema.safeParse(result).success).toBe(true);
  });

  it('falls back deterministically when API response violates schema', async () => {
    process.env.GEMINI_API_KEY = 'mock-test-key';
    const malformedResponse = {
      candidates: [
        {
          content: {
            parts: [{ text: JSON.stringify({ invalid: 'schema-violation' }) }],
          },
        },
      ],
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(malformedResponse), { status: 200 })
    );

    const result = await analyzeCrossWardPatterns({
      contractorName: 'Apex Rift Engineering Ltd',
    });

    expect(result).toEqual(fallbackFixture);
  });

  it('successfully returns model-generated payload when API returns valid schema JSON', async () => {
    process.env.GEMINI_API_KEY = 'mock-test-key';
    const mockModelOutput: CrossWardPatternResult = {
      contractorName: 'AfroTech Infra',
      concentrationScore: 0.85,
      wardsInvolved: ['ward-kapsabet-01', 'ward-sangalo-02'],
      activeProjectsCount: 4,
      totalCommittedBudgetMinor: 32000000,
      anomalyDetected: true,
      flaggedPatterns: [
        {
          type: 'CONCURRENT_OVERALLOCATION',
          severity: 'HIGH',
          description: 'Excess concurrent awards exceeding ward engineering supervisory capacity',
          wardIds: ['ward-kapsabet-01'],
        },
      ],
      recommendation: 'Pause further disbursements until independent verification of site status.',
    };

    const apiResponse = {
      candidates: [
        {
          content: {
            parts: [{ text: JSON.stringify(mockModelOutput) }],
          },
        },
      ],
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(apiResponse), { status: 200 })
    );

    const result = await analyzeCrossWardPatterns({
      contractorName: 'AfroTech Infra',
      wardIds: ['ward-kapsabet-01', 'ward-sangalo-02'],
    });

    expect(result).toEqual(mockModelOutput);
    expect(result.contractorName).toBe('AfroTech Infra');
    expect(result.concentrationScore).toBe(0.85);
  });
});

describe('Cross-Ward Pattern API Route: /api/insights/cross-ward (T-AI-023)', () => {
  beforeEach(() => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  it('handles POST request with full payload and returns 200 with X-AI-Assistive-Only header', async () => {
    const req = new Request('http://localhost:3000/api/insights/cross-ward', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contractorName: 'Apex Rift Engineering Ltd',
        wardIds: ['ward-nandi-hills-01', 'ward-chepkunyuk-02'],
        projects: [
          {
            id: 'proj-1',
            wardId: 'ward-nandi-hills-01',
            amount: 10000000,
            status: 'ACTIVE',
            type: 'ROAD_CULVERT',
          },
        ],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('application/json');
    expect(res.headers.get('X-AI-Assistive-Only')).toBe('true');

    const json = await res.json();
    const parsed = CrossWardPatternResultSchema.safeParse(json);
    expect(parsed.success).toBe(true);
    expect(json.contractorName).toBe('Apex Rift Engineering Ltd');
  });

  it('handles POST request with empty body defaulting contractor gracefully', async () => {
    const req = new Request('http://localhost:3000/api/insights/cross-ward', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('X-AI-Assistive-Only')).toBe('true');

    const json = await res.json();
    expect(json.contractorName).toBe('Apex Rift Engineering Ltd');
  });

  it('handles GET request with query params and returns valid response', async () => {
    const req = new Request(
      'http://localhost:3000/api/insights/cross-ward?contractorName=Apex%20Rift%20Engineering%20Ltd&wardIds=ward-1,ward-2',
      {
        method: 'GET',
      }
    );

    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('X-AI-Assistive-Only')).toBe('true');

    const json = await res.json();
    const parsed = CrossWardPatternResultSchema.safeParse(json);
    expect(parsed.success).toBe(true);
  });

  it('handles GET request without query params and defaults to Apex Rift Engineering Ltd', async () => {
    const req = new Request('http://localhost:3000/api/insights/cross-ward', {
      method: 'GET',
    });

    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.contractorName).toBe('Apex Rift Engineering Ltd');
  });
});
