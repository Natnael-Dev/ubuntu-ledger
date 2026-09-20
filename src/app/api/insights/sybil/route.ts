// API Route: NLP Sybil & Collusion Ring Detection (T-AI-010 / T-AI-011)
// Contract: Assistive pattern analysis across observation submissions.
// Enforces zero-PII boundary, 2000ms timeout, and strict deterministic fallback.

import { callAiWithFallback } from '@/lib/ai/client';
import { redactPiiPayload } from '@/lib/ai/redact';
import {
  SybilCollusionResultSchema,
  type SybilCollusionResult,
} from '@/lib/ai/types';
import fallbackFixture from '@/content/fixtures/ai/sybil-collusion.json';

export async function POST(request: Request): Promise<Response> {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  // Strip phone numbers, exact GPS, and actor identities
  const safePayload = redactPiiPayload(body);

  const prompt = `You are an assistive integrity auditor detecting coordinated Sybil submissions.
Analyze submission timing, answering anomalies, and linguistic repetition.
Input: ${JSON.stringify(safePayload)}`;

  const typedFallback = fallbackFixture as SybilCollusionResult;

  const result = await callAiWithFallback(
    prompt,
    SybilCollusionResultSchema,
    typedFallback
  );

  return Response.json(result, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'X-AI-Assistive-Only': 'true',
    },
  });
}
