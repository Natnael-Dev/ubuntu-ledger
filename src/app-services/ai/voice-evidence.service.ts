// Voice-to-Evidence AI Assistive Processing Service (T-AI-021)
// Authoritative sources:
// - docs/specs/06-voice-and-ussd.md §7
// - docs/specs/07-trust-and-security.md §3, §5
// Rule: Strictly assistive and isolated. The core deterministic ledger (INV-01, k-anonymity)
// MUST NOT depend on this layer for canonical state transitions.

import { callGeminiOrFallback } from '@/lib/ai/client';
import {
  VoiceToEvidenceResultSchema,
  type VoiceToEvidenceResult,
  type AiCallOptions,
} from '@/lib/ai/types';
import fallbackFixture from '@/content/fixtures/ai/voice-to-evidence.json';

export interface VoiceEvidenceInput {
  /**
   * Raw audio buffer or byte array (e.g. from WebRTC/MediaRecorder or file upload)
   */
  audioBuffer?: Buffer | Uint8Array | ArrayBuffer;

  /**
   * Base64-encoded audio payload (e.g. audio/webm, audio/wav, audio/ogg)
   */
  audioBase64?: string;

  /**
   * Text transcript fallback (e.g. from IVR STT or citizen manual input)
   */
  textTranscript?: string;

  /**
   * Target inspection task identifier (optional)
   */
  taskId?: string;
}

/**
 * Normalizes input parameters into structured VoiceEvidenceInput.
 */
function normalizeInput(input: VoiceEvidenceInput | string): VoiceEvidenceInput {
  if (typeof input === 'string') {
    return { textTranscript: input };
  }
  return input;
}

/**
 * Converts various buffer formats to a base64 string.
 */
function bufferToBase64(buf: Buffer | Uint8Array | ArrayBuffer): string {
  if (Buffer.isBuffer(buf)) {
    return buf.toString('base64');
  }
  if (buf instanceof Uint8Array) {
    return Buffer.from(buf).toString('base64');
  }
  if (buf instanceof ArrayBuffer) {
    return Buffer.from(new Uint8Array(buf)).toString('base64');
  }
  return '';
}

/**
 * Processes citizen voice evidence (audio payload or spoken text transcript)
 * and extracts structured civic observation findings:
 * - Proof task answers (q1, q2, q3 boolean checks)
 * - Plain factual summary
 * - Calculated civic urgency (LOW, MEDIUM, HIGH, CRITICAL)
 * - Language detection and confidence score
 */
export async function processVoiceEvidence(
  input: VoiceEvidenceInput | string,
  options?: AiCallOptions
): Promise<VoiceToEvidenceResult> {
  const normalized = normalizeInput(input);

  // Derive target task ID, preserving fallback fixture task ID if unspecified
  const defaultFallback = fallbackFixture as VoiceToEvidenceResult;
  const targetTaskId = normalized.taskId?.trim() || defaultFallback.taskId;

  // Resolve audio base64 if audioBuffer is supplied
  let audioBase64 = normalized.audioBase64;
  if (!audioBase64 && normalized.audioBuffer) {
    audioBase64 = bufferToBase64(normalized.audioBuffer);
  }

  // Build specialized fallback fixture pinned to the target task ID
  const pinnedFallback: VoiceToEvidenceResult = {
    ...defaultFallback,
    taskId: targetTaskId,
  };

  // Construct structured civic extraction prompt
  const promptLines: string[] = [
    'You are an assistive civic observer analyzing a citizen voice report for public infrastructure verification.',
    'Extract structured verification evidence adhering strictly to the JSON schema.',
    '',
    `Target Task ID: ${targetTaskId}`,
  ];

  if (normalized.textTranscript && normalized.textTranscript.trim().length > 0) {
    promptLines.push(`Citizen Voice Transcript: "${normalized.textTranscript.trim()}"`);
  } else if (audioBase64 && audioBase64.length > 0) {
    promptLines.push(
      `Audio Recording Payload: Base64 data encoded (${audioBase64.slice(0, 120)}... length: ${audioBase64.length} chars)`
    );
  } else {
    promptLines.push('Citizen Voice Transcript: [No explicit audio or transcript provided; analyze task verification context]');
  }

  promptLines.push(
    '',
    'Extraction Guidelines:',
    '1. answers: Extract key verification questions as boolean flags (e.g. {"q1": true, "q2": false, "q3": true}).',
    '   - q1: Is the asset, structure, or equipment physically present and installed? (true/false)',
    '   - q2: Is the asset currently functional, operational, and delivering service? (true/false)',
    '   - q3: Is official signage, project board, or identification visible? (true/false)',
    '2. summary: Provide a concise, factual, objective synopsis in plain English without speculation.',
    '3. urgency: Rate civic urgency based on safety and service impact: "LOW", "MEDIUM", "HIGH", or "CRITICAL".',
    '   (Use CRITICAL/HIGH for active flooding, total drinking water loss, or acute structural collapse).',
    '4. detectedLanguage: Detect ISO language code (e.g., "en", "am", "om").',
    '5. confidence: Numerical confidence score between 0.0 and 1.0 reflecting clarity of evidence.',
    '6. transcription: The verbatim transcript of what the citizen reported.',
    '7. taskId: Must match the target task ID.'
  );

  const prompt = promptLines.join('\n');

  const systemInstruction =
    options?.systemInstruction ??
    'You are an assistive civic intelligence observer for the Ubuntu Ledger. Extract structured evidence from spoken citizen reports. Always output valid JSON conforming to the schema.';

  const result = await callGeminiOrFallback(
    prompt,
    VoiceToEvidenceResultSchema,
    pinnedFallback,
    {
      ...options,
      systemInstruction,
    }
  );

  // Guarantee that the returned taskId matches targetTaskId
  return {
    ...result,
    taskId: targetTaskId,
  };
}
