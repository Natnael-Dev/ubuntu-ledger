// API Route: NLP Sybil & Collusion Ring Detection (T-AI-010 / T-AI-011 / T-AI-022)
// Contract: Assistive pattern analysis across observation submissions.
// Enforces zero-PII boundary, 2000ms timeout, and strict deterministic fallback.

import {
  detectSybilCollusion,
  type SybilObservationItem,
} from '@/app-services/ai/sybil-detect.service';
import fallbackFixture from '@/content/fixtures/ai/sybil-collusion.json';
import type { SybilCollusionResult } from '@/lib/ai/types';

export async function POST(request: Request): Promise<Response> {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  // Gracefully handle empty or malformed inputs
  let observations: SybilObservationItem[] = [];
  if (Array.isArray(body?.observations)) {
    observations = body.observations.filter(
      (item): item is SybilObservationItem =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as Record<string, unknown>).id === 'string' &&
        typeof (item as Record<string, unknown>).text === 'string'
    );
  }

  try {
    // If no valid observations were provided, fallback to fallbackFixture or safe response
    let result: SybilCollusionResult;
    if (observations.length === 0) {
      result = fallbackFixture as SybilCollusionResult;
    } else {
      result = await detectSybilCollusion(observations);
    }

    return Response.json(result, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-AI-Assistive-Only': 'true',
      },
    });
  } catch {
    return Response.json(fallbackFixture as SybilCollusionResult, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-AI-Assistive-Only': 'true',
      },
    });
  }
}
