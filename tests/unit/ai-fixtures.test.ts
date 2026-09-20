// AI Layer Contract & Fallback Verification (T-AI-010 / T-AI-011)
// Verifies:
// 1. All 4 AI JSON fixtures conform strictly to their respective Zod schemas
// 2. PII redaction engine scrubs MSISDNs, exact GPS coordinates, and actor identities
// 3. Fallback mechanism deterministically returns fixtures when external API is unreachable or times out

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  VoiceToEvidenceResultSchema,
  SybilCollusionResultSchema,
  CrossWardPatternResultSchema,
  Eli5SummaryResultSchema,
  type VoiceToEvidenceResult,
  type SybilCollusionResult,
  type CrossWardPatternResult,
  type Eli5SummaryResult,
} from '@/lib/ai/types';
import { redactPiiPayload, redactPiiString } from '@/lib/ai/redact';
import { callAiWithFallback, callGeminiOrFallback } from '@/lib/ai/client';

import voiceFixture from '@/content/fixtures/ai/voice-to-evidence.json';
import sybilFixture from '@/content/fixtures/ai/sybil-collusion.json';
import crossWardFixture from '@/content/fixtures/ai/cross-ward-patterns.json';
import eli5Fixture from '@/content/fixtures/ai/eli5-summary.json';

describe('AI Contracts: Fixture Compliance', () => {
  it('validates voice-to-evidence.json against VoiceToEvidenceResultSchema', () => {
    const parsed = VoiceToEvidenceResultSchema.safeParse(voiceFixture);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.taskId).toBeDefined();
      expect(typeof parsed.data.answers).toBe('object');
      expect(parsed.data.confidence).toBeGreaterThanOrEqual(0);
      expect(parsed.data.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('validates sybil-collusion.json against SybilCollusionResultSchema', () => {
    const parsed = SybilCollusionResultSchema.safeParse(sybilFixture);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(Array.isArray(parsed.data.flaggedObservationIds)).toBe(true);
      expect(parsed.data.flaggedObservationIds.length).toBeGreaterThan(0);
      expect(['LOW', 'MEDIUM', 'HIGH']).toContain(parsed.data.collusionRisk);
      expect(parsed.data.similarityScore).toBeGreaterThanOrEqual(0);
    }
  });

  it('validates cross-ward-patterns.json against CrossWardPatternResultSchema', () => {
    const parsed = CrossWardPatternResultSchema.safeParse(crossWardFixture);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.contractorName).toBeDefined();
      expect(Array.isArray(parsed.data.wardsInvolved)).toBe(true);
      expect(Array.isArray(parsed.data.flaggedPatterns)).toBe(true);
      expect(parsed.data.activeProjectsCount).toBeGreaterThanOrEqual(0);
    }
  });

  it('validates eli5-summary.json against Eli5SummaryResultSchema', () => {
    const parsed = Eli5SummaryResultSchema.safeParse(eli5Fixture);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.plainLanguageText).toBeDefined();
      expect(Array.isArray(parsed.data.keyTakeaways)).toBe(true);
      expect(parsed.data.context.entityType).toBeDefined();
    }
  });
});

describe('AI Security Boundary: PII Redaction', () => {
  it('redacts telephone numbers (MSISDNs) from strings and keys', () => {
    const rawString = 'Citizen called from +254712345678 and alternative 0798765432 regarding borehole';
    const redactedStr = redactPiiString(rawString);
    expect(redactedStr).not.toContain('+254712345678');
    expect(redactedStr).not.toContain('0798765432');
    expect(redactedStr).toContain('[REDACTED_PHONE]');

    const payload = {
      phone: '+254700000000',
      msisdn: '251911223344',
      message: 'Contact me at +254722111222',
    };
    const redacted = redactPiiPayload(payload);
    expect(redacted.phone).toBe('[REDACTED_SENSITIVE]');
    expect(redacted.msisdn).toBe('[REDACTED_SENSITIVE]');
    expect(redacted.message).not.toContain('+254722111222');
  });

  it('redacts exact GPS coordinates while preserving coarse structures', () => {
    const payload = {
      latitude: -1.286389,
      longitude: 36.817223,
      coords: [-1.286389, 36.817223],
      notes: 'GPS point at -1.286389, 36.817223 near the tree',
      coarse_cell: 'ward:nandi-hills-01',
    };
    const redacted = redactPiiPayload(payload);
    expect(redacted.latitude).toBe('[REDACTED_GPS]');
    expect(redacted.longitude).toBe('[REDACTED_GPS]');
    expect(redacted.coords).toBe('[REDACTED_GPS]');
    expect(redacted.notes).not.toContain('-1.286389, 36.817223');
    expect(redacted.notes).toContain('[REDACTED_GPS]');
    expect(redacted.coarse_cell).toBe('ward:nandi-hills-01');
  });

  it('redacts actor and citizen identifying keys and strings', () => {
    const payload = {
      full_name: 'Amina Wanjiku',
      reporter_name: 'John Doe',
      details: 'Spoke with citizen-99128 about pump failure',
      task_id: 'task-1234',
    };
    const redacted = redactPiiPayload(payload);
    expect(redacted.full_name).toBe('[REDACTED_ACTOR]');
    expect(redacted.reporter_name).toBe('[REDACTED_ACTOR]');
    expect(redacted.details).not.toContain('citizen-99128');
    expect(redacted.details).toContain('[REDACTED_ACTOR]');
    expect(redacted.task_id).toBe('task-1234');
  });

  it('handles circular references gracefully without stack overflow', () => {
    const circularObj: Record<string, unknown> = {
      name: 'Circular Test',
      value: 42,
    };
    circularObj.self = circularObj;

    expect(() => redactPiiPayload(circularObj)).not.toThrow();
    const result = redactPiiPayload(circularObj) as Record<string, unknown>;
    expect(result.name).toBe('[REDACTED_ACTOR]');
    expect(result.value).toBe(42);
    expect(result.self).toBe('[CIRCULAR]');
  });
});

describe('AI Resilience: Deterministic Fallback Execution', () => {
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

  it('returns deterministic fixture when GEMINI_API_KEY is not set', async () => {
    const result = await callGeminiOrFallback(
      'Test prompt',
      VoiceToEvidenceResultSchema,
      voiceFixture as VoiceToEvidenceResult
    );

    expect(result).toEqual(voiceFixture);
  });

  it('returns deterministic fixture when network fetch throws or rejects', async () => {
    process.env.GEMINI_API_KEY = 'mock-key-for-test';
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network unreachable'));

    const result = await callAiWithFallback(
      'Analyze sybil rings',
      SybilCollusionResultSchema,
      sybilFixture as SybilCollusionResult
    );

    expect(result).toEqual(sybilFixture);
  });

  it('returns deterministic fixture when API returns invalid non-JSON body', async () => {
    process.env.GEMINI_API_KEY = 'mock-key-for-test';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Internal Server Error HTML', { status: 500 })
    );

    const result = await callAiWithFallback(
      'Analyze cross-ward patterns',
      CrossWardPatternResultSchema,
      crossWardFixture as CrossWardPatternResult
    );

    expect(result).toEqual(crossWardFixture);
  });

  it('returns deterministic fixture when API response fails schema validation', async () => {
    process.env.GEMINI_API_KEY = 'mock-key-for-test';
    const invalidPayload = {
      candidates: [
        {
          content: {
            parts: [{ text: JSON.stringify({ invalidField: true }) }],
          },
        },
      ],
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(invalidPayload), { status: 200 })
    );

    const result = await callAiWithFallback(
      'Generate ELI5 summary',
      Eli5SummaryResultSchema,
      eli5Fixture as Eli5SummaryResult
    );

    expect(result).toEqual(eli5Fixture);
  });
});
