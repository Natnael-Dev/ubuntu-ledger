// API Route: Cross-Ward Contractor Pattern Detection (T-AI-010 / T-AI-011)
// Contract: Assistive intelligence detecting contractor over-concentration or multi-ward failure trends.
// Enforces zero-PII boundary, 2000ms timeout, and deterministic fallback.

import { callAiWithFallback } from '@/lib/ai/client';
import { redactPiiPayload } from '@/lib/ai/redact';
import {
  CrossWardPatternResultSchema,
  type CrossWardPatternResult,
} from '@/lib/ai/types';
import fallbackFixture from '@/content/fixtures/ai/cross-ward-patterns.json';

export async function POST(request: Request): Promise<Response> {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  // Strip phone numbers, exact GPS, and actor identities
  const safePayload = redactPiiPayload(body);

  const prompt = `You are a public procurement transparency analyst.
Analyze contractor allocation across ward boundaries, detecting project over-concentration and probation risks.
Input: ${JSON.stringify(safePayload)}`;

  const typedFallback = fallbackFixture as CrossWardPatternResult;

  const result = await callAiWithFallback(
    prompt,
    CrossWardPatternResultSchema,
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
