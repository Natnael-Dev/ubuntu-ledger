// API Route: ELI5 Plain-Language Summary & Audio Generation (T-AI-010 / T-AI-011)
// Contract: Assistive plain-language civic explainer.
// Enforces zero-PII boundary, 2000ms timeout, and deterministic fallback.

import { callAiWithFallback } from '@/lib/ai/client';
import { redactPiiPayload } from '@/lib/ai/redact';
import {
  Eli5SummaryResultSchema,
  type Eli5SummaryResult,
} from '@/lib/ai/types';
import fallbackFixture from '@/content/fixtures/ai/eli5-summary.json';

export async function POST(request: Request): Promise<Response> {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  // Strip phone numbers, exact GPS, and actor identities
  const safePayload = redactPiiPayload(body);

  const prompt = `You are an accessible civic communicator explaining local public finance and project checks to community members.
Provide a clear 5th-grade reading level explanation with key takeaways.
Input: ${JSON.stringify(safePayload)}`;

  const typedFallback = fallbackFixture as Eli5SummaryResult;

  const result = await callAiWithFallback(
    prompt,
    Eli5SummaryResultSchema,
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
