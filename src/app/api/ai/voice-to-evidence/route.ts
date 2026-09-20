// API Route: Voice-to-Evidence AI Assistive Processing (T-AI-010 / T-AI-011)
// Contract: All AI endpoints must live under /api/ai/* or /api/insights/*,
// enforce PII redaction, 2000ms timeout, and return typed results with deterministic fallbacks.

import { callAiWithFallback } from '@/lib/ai/client';
import { redactPiiPayload } from '@/lib/ai/redact';
import {
  VoiceToEvidenceResultSchema,
  type VoiceToEvidenceResult,
} from '@/lib/ai/types';
import fallbackFixture from '@/content/fixtures/ai/voice-to-evidence.json';

export async function POST(request: Request): Promise<Response> {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    // Body is optional for initial fallback probing
    body = {};
  }

  // Enforce zero-PII boundary before model invocation
  const safePayload = redactPiiPayload(body);

  const prompt = `You are an assistive civic observer analyzing a citizen voice report.
Extract structured observation answers (q1, q2, q3 as booleans), urgency, and summary.
Input: ${JSON.stringify(safePayload)}`;

  const typedFallback = fallbackFixture as VoiceToEvidenceResult;

  const result = await callAiWithFallback(
    prompt,
    VoiceToEvidenceResultSchema,
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
