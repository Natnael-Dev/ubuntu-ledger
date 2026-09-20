// Isolated AI Client & Deterministic Fallback Engine (T-AI-010 / T-AI-011)
// Authoritative sources:
// - docs/specs/06-voice-and-ussd.md §7
// - docs/specs/07-trust-and-security.md §5
// Rule: Every AI call MUST enforce a 2000ms AbortSignal.timeout and fallback to deterministic fixtures.
// Under NO circumstance may an AI timeout or provider error bubble up as an unhandled failure.

import type { z } from 'zod';
import { logger } from '@/lib/logger';
import { redactPiiPayload } from './redact';
import type { AiCallOptions, AiProvider } from './types';

const DEFAULT_TIMEOUT_MS = 2000;
const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * Executes a call to Google Gemini 1.5 Flash with strict timeout and fallback semantics.
 */
export async function callGeminiOrFallback<T>(
  prompt: string,
  schema: z.ZodType<T>,
  fallbackFixture: T,
  options?: AiCallOptions
): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    logger.warn('AI: GEMINI_API_KEY is not configured; using deterministic fallback fixture');
    return fallbackFixture;
  }

  // Ensure prompt undergoes mandatory PII redaction
  const safePrompt = redactPiiPayload(prompt);

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: safePrompt,
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: options?.temperature ?? 0.1,
    },
    ...(options?.systemInstruction
      ? {
          systemInstruction: {
            parts: [{ text: options.systemInstruction }],
          },
        }
      : {}),
  };

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown HTTP error');
      logger.warn('AI: Gemini API returned non-200 response; returning fallback fixture', {
        status: response.status,
        error: errorText,
      });
      return fallbackFixture;
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText || typeof rawText !== 'string') {
      logger.warn('AI: Gemini response missing text payload; returning fallback fixture');
      return fallbackFixture;
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawText);
    } catch {
      logger.warn('AI: Failed to parse Gemini response as JSON; returning fallback fixture');
      return fallbackFixture;
    }

    const validation = schema.safeParse(parsedJson);
    if (!validation.success) {
      logger.warn('AI: Gemini response failed schema validation; returning fallback fixture', {
        errors: validation.error.flatten(),
      });
      return fallbackFixture;
    }

    return validation.data;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      logger.warn(`AI: Gemini request timed out after ${timeoutMs}ms; returning fallback fixture`);
    } else if (err instanceof Error && err.name === 'AbortError') {
      logger.warn(`AI: Gemini request aborted after ${timeoutMs}ms; returning fallback fixture`);
    } else {
      logger.warn('AI: Unexpected error calling Gemini; returning fallback fixture', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return fallbackFixture;
  }
}

/**
 * Drop-in alternative provider: OpenAI gpt-4o-mini
 */
async function callOpenAiOrFallback<T>(
  prompt: string,
  schema: z.ZodType<T>,
  fallbackFixture: T,
  options?: AiCallOptions
): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    logger.warn('AI: OPENAI_API_KEY is not configured; using deterministic fallback fixture');
    return fallbackFixture;
  }

  const safePrompt = redactPiiPayload(prompt);

  const requestBody = {
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          options?.systemInstruction ??
          'You are an assistive civic intelligence assistant. Output valid JSON adhering to schema.',
      },
      { role: 'user', content: safePrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: options?.temperature ?? 0.1,
  };

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      logger.warn('AI: OpenAI returned non-200 response; returning fallback fixture', {
        status: response.status,
      });
      return fallbackFixture;
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      return fallbackFixture;
    }

    const parsed = JSON.parse(content);
    const validation = schema.safeParse(parsed);
    return validation.success ? validation.data : fallbackFixture;
  } catch (err: unknown) {
    logger.warn('AI: OpenAI call failed or timed out; returning fallback fixture', {
      error: err instanceof Error ? err.message : String(err),
    });
    return fallbackFixture;
  }
}

/**
 * Unified AI invocation wrapper with deterministic fallback.
 * Provider resolution:
 * 1. options.provider
 * 2. process.env.AI_PROVIDER ('gemini' | 'openai')
 * 3. Default: 'gemini'
 */
export async function callAiWithFallback<T>(
  prompt: string,
  schema: z.ZodType<T>,
  fallbackFixture: T,
  options?: AiCallOptions
): Promise<T> {
  const selectedProvider: AiProvider =
    options?.provider ||
    (process.env.AI_PROVIDER?.toLowerCase() === 'openai' ? 'openai' : 'gemini');

  if (selectedProvider === 'openai') {
    return callOpenAiOrFallback(prompt, schema, fallbackFixture, options);
  }

  return callGeminiOrFallback(prompt, schema, fallbackFixture, options);
}
