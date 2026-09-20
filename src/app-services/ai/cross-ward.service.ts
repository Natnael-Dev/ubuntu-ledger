// Cross-Ward Contractor Pattern Analysis Service (T-AI-023)
// Evaluates contractor concentration across multiple wards, concurrent allocation risk,
// and historical durability probation failure rates.
// Adheres strictly to AI isolation boundary (INV-01): Assistive only, non-canonical, 2000ms fallback.

import { callGeminiOrFallback } from '@/lib/ai/client';
import {
  CrossWardPatternResultSchema,
  type CrossWardPatternResult,
  type AiCallOptions,
} from '@/lib/ai/types';
import fallbackFixture from '@/content/fixtures/ai/cross-ward-patterns.json';

export interface CrossWardProjectInput {
  id: string;
  wardId: string;
  amount: number;
  status: string;
  type: string;
}

export interface AnalyzeCrossWardPatternsParams {
  contractorName: string;
  wardIds?: string[];
  projects?: CrossWardProjectInput[];
}

/**
 * Analyzes cross-ward contractor concentration and delivery patterns.
 * Identifies over-allocation across county wards, concurrent active projects exceeding capacity,
 * and durability probation failure tendencies.
 */
export async function analyzeCrossWardPatterns(
  params: AnalyzeCrossWardPatternsParams,
  options?: AiCallOptions
): Promise<CrossWardPatternResult> {
  const wardsContext =
    params.wardIds && params.wardIds.length > 0
      ? `Target Wards: ${params.wardIds.join(', ')}`
      : 'Target Wards: Unspecified across county wards';

  const projectsContext =
    params.projects && params.projects.length > 0
      ? `Itemized Projects:\n${JSON.stringify(params.projects, null, 2)}`
      : 'Itemized Projects: No explicit project breakdown provided; evaluate known cross-ward contractor registry footprint.';

  const prompt = `You are a public procurement oversight and civic integrity analyst for the county ledger.
Evaluate contractor concentration across multiple wards, concurrent allocation risk, and historical probation failure rates for the contractor below.

Contractor Name: ${params.contractorName}
${wardsContext}
${projectsContext}

Evaluation Criteria:
1. Multi-Ward Concentration: Whether the contractor holds a disproportionate concentration of active civic public works across multiple wards.
2. Concurrent Allocation Risk: Operational capacity strain from managing parallel project allocations simultaneously.
3. Durability & Probation Risk: Historical or adjacent failure tendencies where completed works failed 7-day durability probation.
4. Civic Recommendation: Actionable advisory for community monitoring committees and county oversight officers.

Respond strictly with valid JSON conforming to this schema:
{
  "contractorName": "${params.contractorName}",
  "concentrationScore": <number between 0.0 and 1.0>,
  "wardsInvolved": [<string array of ward identifiers>],
  "activeProjectsCount": <integer non-negative>,
  "totalCommittedBudgetMinor": <integer non-negative in minor currency units>,
  "anomalyDetected": <boolean true if concentration score > 0.65 or active projects exceed safe concurrent capacity>,
  "flaggedPatterns": [
    {
      "type": "<string classification code e.g. CONCURRENT_OVERALLOCATION, HIGH_PROBATION_FAILURE_RATE, CROSS_WARD_SPIKE>",
      "severity": "<'LOW' | 'MEDIUM' | 'HIGH'>",
      "description": "<detailed finding on contractor allocation, capacity strain, or durability failure>",
      "wardIds": [<string array of ward IDs where pattern occurs>]
    }
  ],
  "recommendation": "<actionable oversight recommendation for ward civic monitoring committees>"
}`;

  return callGeminiOrFallback(
    prompt,
    CrossWardPatternResultSchema,
    fallbackFixture as CrossWardPatternResult,
    options
  );
}
