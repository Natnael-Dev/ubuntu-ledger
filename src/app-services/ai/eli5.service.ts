// Service: Assistive ELI5 Civic Summary Engine (T-AI-024)
// Generates accessible 5th-grade reading level civic explanations with 3 concrete takeaways.
// Enforces zero-PII boundary, strict schema adherence, and deterministic fallback.

import { callGeminiOrFallback } from '@/lib/ai/client';
import {
  Eli5SummaryResultSchema,
  type Eli5SummaryResult,
  type AiCallOptions,
} from '@/lib/ai/types';
import fallbackFixture from '@/content/fixtures/ai/eli5-summary.json';

export interface GenerateEli5SummaryParams {
  entityType: 'project' | 'ward' | 'service' | 'bulletin';
  entityId: string;
  title?: string;
  amount?: number;
  currency?: string;
  contractor?: string;
  status?: string;
  locale?: string;
}

export interface GenerateEli5SummaryOptions extends AiCallOptions {
  fallback?: Eli5SummaryResult;
}

/**
 * Builds an assistive prompt instructing the model to produce a 5th-grade reading level
 * civic explanation with 3 clear bullet takeaways.
 */
export function buildEli5Prompt(params: GenerateEli5SummaryParams): string {
  const details = [
    `Entity Type: ${params.entityType}`,
    `Entity ID: ${params.entityId}`,
    params.title ? `Title: ${params.title}` : null,
    params.amount !== undefined
      ? `Budget / Amount: ${params.amount} ${params.currency ?? 'KES'}`
      : null,
    params.contractor ? `Contractor: ${params.contractor}` : null,
    params.status ? `Status: ${params.status}` : null,
    `Target Locale: ${params.locale ?? 'en'}`,
  ]
    .filter(Boolean)
    .join('\n');

  return `You are an accessible, trustworthy civic communicator explaining local public finance and project checks to everyday community members.
Generate a simple, jargon-free 5th-grade reading level civic explanation so community members without technical or accounting backgrounds can easily understand what is happening with their community resources.

Requirements:
1. "plainLanguageText": A concise, engaging 2-4 sentence narrative written at a 5th-grade reading level explaining what this project/bulletin is doing, what public money is involved, and how community verification works. Avoid jargon, procurement acronyms, or complex legal terms.
2. "keyTakeaways": Exactly 3 concrete, plain bullet points:
   - Bullet 1: What the project or community item is.
   - Bullet 2: The public funding or budget involved.
   - Bullet 3: The witness confirmation, inspection proof, or community sign-off needed.
3. "readingLevel": "Grade 5 / Plain Civic".
4. "locale": "${params.locale ?? 'en'}".
5. "context": { "entityType": "${params.entityType}", "entityId": "${params.entityId}" }.
6. "audioUrl": null.
7. "audioDurationSeconds": null.

Input details:
${details}

Return ONLY a valid JSON object matching the Eli5SummaryResult schema.`;
}

/**
 * Generates an ELI5 civic summary or returns the deterministic fallback fixture.
 */
export async function generateEli5Summary(
  params: GenerateEli5SummaryParams,
  options?: GenerateEli5SummaryOptions
): Promise<Eli5SummaryResult> {
  const prompt = buildEli5Prompt(params);
  const fallback = options?.fallback ?? (fallbackFixture as Eli5SummaryResult);

  return callGeminiOrFallback(
    prompt,
    Eli5SummaryResultSchema,
    fallback,
    options
  );
}
