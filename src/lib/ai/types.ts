// TypeScript Contracts & Zod Schemas for Ubuntu Ledger AI Layer (T-AI-010 / T-AI-011)
// Authoritative sources: docs/specs/06-voice-and-ussd.md §7, docs/specs/07-trust-and-security.md §3, §5
// Rule: Strictly assistive and isolated. The core deterministic ledger (INV-01, k-anonymity)
// MUST NOT depend on these schemas for canonical state transitions.

import { z } from 'zod';

export type AiProvider = 'gemini' | 'openai';

export interface AiCallOptions {
  timeoutMs?: number;
  temperature?: number;
  provider?: AiProvider;
  systemInstruction?: string;
}

// ==============================================================================
// 1. Voice-to-Evidence Contract
// ==============================================================================
// Transforms spoken civic audio or unstructured transcripts into structured observation
// responses compatible with inspection tasks without bypassing human review or k-anonymity.

export const VoiceToEvidenceResultSchema = z.object({
  taskId: z.string().describe('Target inspection task UUID'),
  transcription: z.string().describe('Assisted transcript of the citizen voice recording'),
  detectedLanguage: z.enum(['en', 'am', 'om']).or(z.string()).describe('ISO language code (en, am, om)'),
  confidence: z.number().min(0).max(1).describe('Model confidence score for the extraction (0.0 to 1.0)'),
  answers: z.record(z.string(), z.boolean()).describe('Extracted boolean answers for proof tasks, e.g. {"q1": true}'),
  summary: z.string().describe('Plain-text factual synopsis of the citizen report'),
  urgency: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).describe('Calculated civic urgency priority'),
  extractedDetails: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export type VoiceToEvidenceResult = z.infer<typeof VoiceToEvidenceResultSchema>;

// ==============================================================================
// 2. NLP Sybil / Collusion Detection Contract
// ==============================================================================
// Cross-compares observation submission narratives, timing, and linguistic patterns to
// flag artificial co-ordinated reporting rings without exposing citizen PII.

export const SybilCollusionResultSchema = z.object({
  flaggedObservationIds: z.array(z.string()).describe('Array of observation IDs flagged for collusion / Sybil activity'),
  similarityScore: z.number().min(0).max(1).describe('Semantic / temporal similarity index between submissions (0.0 to 1.0)'),
  collusionRisk: z.enum(['LOW', 'MEDIUM', 'HIGH']).describe('Assessed collusion risk level'),
  reasons: z.array(z.string()).describe('Specific indicators of coordinated manipulation'),
  narrative: z.string().describe('Synthesized explanation of detected collusion or anomalous pattern'),
  clusterKey: z.string().optional().describe('Associated 16-hex Sybil cluster key if mapped to an existing cohort'),
  flaggedCohorts: z.array(z.string()).optional().describe('Registration cohorts or device patterns implicated'),
});

export type SybilCollusionResult = z.infer<typeof SybilCollusionResultSchema>;

// ==============================================================================
// 3. Cross-Ward Contractor Patterns Contract
// ==============================================================================
// Analyzes contractor concentration, concurrent project allocations, and failure rates
// across multiple wards to alert community oversight committees to systemic anomalies.

export const FlaggedPatternSchema = z.object({
  type: z.string().describe('Anomaly classification code, e.g. CONCURRENT_OVERALLOCATION, HIGH_FAILURE_RATE'),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH']).describe('Severity rating of the identified pattern'),
  description: z.string().describe('Detailed finding on contractor allocation or delivery delays'),
  wardIds: z.array(z.string()).optional().describe('Wards where this pattern is observed'),
});

export const CrossWardPatternResultSchema = z.object({
  contractorName: z.string().describe('Commercial name of the contractor audited'),
  concentrationScore: z.number().min(0).max(1).describe('Concentration index of active contracts (0.0 to 1.0)'),
  wardsInvolved: z.array(z.string()).describe('List of ward identifiers or names where contractor holds active awards'),
  activeProjectsCount: z.number().int().nonnegative().describe('Number of open or unfinished projects assigned'),
  totalCommittedBudgetMinor: z.number().int().nonnegative().describe('Sum of committed funds across all projects in minor units'),
  anomalyDetected: z.boolean().describe('Whether concentration or delivery risk exceeds safety thresholds'),
  flaggedPatterns: z.array(FlaggedPatternSchema).describe('Specific patterns and risk signals detected'),
  recommendation: z.string().describe('Actionable oversight advisory for ward civic committees'),
});

export type FlaggedPattern = z.infer<typeof FlaggedPatternSchema>;
export type CrossWardPatternResult = z.infer<typeof CrossWardPatternResultSchema>;

// ==============================================================================
// 4. ELI5 Plain-Language Summary & Audio Contract
// ==============================================================================
// Generates accessible 5th-grade civic explanations and synthesized audio references
// so non-literate or non-technical citizens can understand complex public finance data.

export const Eli5SummaryResultSchema = z.object({
  plainLanguageText: z.string().describe('Simplified, jargon-free explanation tailored for civic community members'),
  audioUrl: z.string().nullable().describe('URL to pre-rendered or synthesized TTS audio clip, or null if text-only'),
  audioDurationSeconds: z.number().nonnegative().nullable().optional().describe('Duration of audio file in seconds'),
  keyTakeaways: z.array(z.string()).min(1).describe('Bullet-point takeaways of the civic project or bulletin'),
  locale: z.enum(['en', 'am', 'om']).or(z.string()).describe('Target language locale'),
  readingLevel: z.string().describe('Complexity classification, e.g., Grade 5 / Plain Civic'),
  context: z.object({
    entityType: z.enum(['project', 'ward', 'service', 'bulletin']),
    entityId: z.string(),
  }).describe('Reference entity grounding the ELI5 summary'),
});

export type Eli5SummaryResult = z.infer<typeof Eli5SummaryResultSchema>;
