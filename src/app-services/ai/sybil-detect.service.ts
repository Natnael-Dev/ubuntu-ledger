// Sybil & Collusion Detection Application Service (T-AI-022)
// Authoritative sources: docs/specs/06-voice-and-ussd.md §7, docs/specs/07-trust-and-security.md §3, §5
// Rule: Strictly assistive and isolated. Never exposes citizen PII across network boundaries.

import { callGeminiOrFallback } from '@/lib/ai/client';
import {
  SybilCollusionResultSchema,
  type SybilCollusionResult,
  type AiCallOptions,
} from '@/lib/ai/types';
import fallbackFixture from '@/content/fixtures/ai/sybil-collusion.json';

export interface SybilObservationItem {
  id: string;
  text: string;
  timestamp?: string;
  msisdnPrefix?: string;
  answers?: Record<string, boolean>;
}

export interface DetectSybilCollusionOptions extends AiCallOptions {
  wardId?: string;
  taskId?: string;
}

/**
 * Evaluates an array of observations for coordinated Sybil rings or collusion.
 * Analyzes submission timing bursts, identical or contradictory answering patterns,
 * and semantic repetition across submissions without exposing citizen PII.
 */
export async function detectSybilCollusion(
  observations: SybilObservationItem[],
  options?: DetectSybilCollusionOptions
): Promise<SybilCollusionResult> {
  const typedFallback = fallbackFixture as SybilCollusionResult;

  // Gracefully handle empty observation sets with a safe low-risk default
  if (!observations || observations.length === 0) {
    return {
      flaggedObservationIds: [],
      similarityScore: 0,
      collusionRisk: 'LOW',
      reasons: ['No observations provided for collusion analysis'],
      narrative: 'No observation records were submitted for analysis.',
    };
  }

  // Sanitize observation items to ensure zero-PII exposure
  const sanitizedObservations = observations.map((obs) => ({
    id: obs.id,
    text: obs.text,
    timestamp: obs.timestamp,
    msisdnPrefix: obs.msisdnPrefix ? obs.msisdnPrefix.slice(0, 6) : undefined,
    answers: obs.answers,
  }));

  const prompt = `You are an assistive integrity auditor for civic community monitoring.
Analyze the following observation submissions for indicators of coordinated Sybil rings or collusion:
1. Submission timing bursts (e.g. multiple submissions within seconds or minutes).
2. Identical or contradictory answering patterns (e.g. identical answers or suspicious coordinated contradictions).
3. Semantic and linguistic repetition across submission narratives.
4. Shared telecom cohort patterns (e.g. matching 6-digit MSISDN prefix buckets) without exposing citizen PII.

Input observations:
${JSON.stringify(sanitizedObservations, null, 2)}

Respond with a JSON object strictly matching this schema:
{
  "flaggedObservationIds": string[],
  "similarityScore": number (0.0 to 1.0),
  "collusionRisk": "LOW" | "MEDIUM" | "HIGH",
  "reasons": string[],
  "narrative": string,
  "clusterKey"?: string,
  "flaggedCohorts"?: string[]
}`;

  return callGeminiOrFallback(
    prompt,
    SybilCollusionResultSchema,
    typedFallback,
    {
      systemInstruction:
        'You are an assistive civic integrity auditor evaluating submission timing bursts, identical or contradictory answering patterns, and semantic repetition across submissions without exposing citizen PII. Output valid JSON matching the schema.',
      ...options,
    }
  );
}
