// API Route: Voice-to-Evidence AI Assistive Processing (T-AI-010 / T-AI-021)
// Contract: All AI endpoints must live under /api/ai/* or /api/insights/*,
// enforce PII redaction, 2000ms timeout, and return typed results with deterministic fallbacks.
// Rule: Strictly assistive. The core deterministic ledger (INV-01) does not rely on this endpoint for state transitions.

import { processVoiceEvidence } from '@/app-services/ai/voice-evidence.service';
import fallbackFixture from '@/content/fixtures/ai/voice-to-evidence.json';
import type { VoiceToEvidenceResult } from '@/lib/ai/types';
import { logger } from '@/lib/logger';

interface VoiceToEvidenceRequestBody {
  audioBase64?: string;
  textTranscript?: string;
  taskId?: string;
}

export async function POST(request: Request): Promise<Response> {
  let body: VoiceToEvidenceRequestBody = {};
  try {
    const raw = await request.json();
    if (raw && typeof raw === 'object') {
      body = raw as VoiceToEvidenceRequestBody;
    }
  } catch {
    // Body is optional for initial fallback probing or malformed JSON
    body = {};
  }

  const requestedTaskId = typeof body.taskId === 'string' ? body.taskId.trim() : undefined;

  try {
    const result = await processVoiceEvidence({
      audioBase64: typeof body.audioBase64 === 'string' ? body.audioBase64 : undefined,
      textTranscript: typeof body.textTranscript === 'string' ? body.textTranscript : undefined,
      taskId: requestedTaskId,
    });

    return Response.json(result, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-AI-Assistive-Only': 'true',
      },
    });
  } catch (error) {
    logger.warn('AI: Error processing voice evidence route; returning fallback fixture', {
      error: error instanceof Error ? error.message : String(error),
    });

    const fallback: VoiceToEvidenceResult = {
      ...(fallbackFixture as VoiceToEvidenceResult),
      ...(requestedTaskId ? { taskId: requestedTaskId } : {}),
    };

    return Response.json(fallback, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-AI-Assistive-Only': 'true',
      },
    });
  }
}
