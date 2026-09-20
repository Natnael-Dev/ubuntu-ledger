// Unit Tests: Voice-to-Evidence AI Service & Route (T-AI-021)
// Authoritative sources:
// - docs/specs/06-voice-and-ussd.md §7
// - docs/specs/07-trust-and-security.md §3, §5

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { processVoiceEvidence } from '@/app-services/ai/voice-evidence.service';
import { POST as handleVoiceToEvidenceRoute } from '@/app/api/ai/voice-to-evidence/route';
import {
  VoiceToEvidenceResultSchema,
  type VoiceToEvidenceResult,
} from '@/lib/ai/types';
import fallbackFixture from '@/content/fixtures/ai/voice-to-evidence.json';

describe('Voice Evidence Service: processVoiceEvidence (T-AI-021)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('returns valid VoiceToEvidenceResult adhering to schema with fallback when no API key is present', async () => {
    const result = await processVoiceEvidence({
      textTranscript: 'Borehole handle fixed but no water pumping out',
    });

    const validation = VoiceToEvidenceResultSchema.safeParse(result);
    expect(validation.success).toBe(true);

    if (validation.success) {
      expect(result.taskId).toBe(fallbackFixture.taskId);
      expect(result.summary).toBeDefined();
      expect(typeof result.answers).toBe('object');
      expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(result.urgency);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('accepts string input directly as text transcript', async () => {
    const result = await processVoiceEvidence('Culvert bridge repaired with concrete slabs');
    const validation = VoiceToEvidenceResultSchema.safeParse(result);
    expect(validation.success).toBe(true);
    expect(result.summary).toBeDefined();
  });

  it('preserves custom taskId when specified in input', async () => {
    const customTaskId = 'task-custom-uuid-999';
    const result = await processVoiceEvidence({
      taskId: customTaskId,
      textTranscript: 'Handpump installed yesterday',
    });

    expect(result.taskId).toBe(customTaskId);
  });

  it('handles audioBuffer (Buffer) input and converts to base64 properly', async () => {
    const dummyAudioBuffer = Buffer.from('RIFF....WAVEfmt....data....');
    const result = await processVoiceEvidence({
      audioBuffer: dummyAudioBuffer,
      taskId: 'task-buffer-test',
    });

    const validation = VoiceToEvidenceResultSchema.safeParse(result);
    expect(validation.success).toBe(true);
    expect(result.taskId).toBe('task-buffer-test');
  });

  it('handles audioBuffer as Uint8Array', async () => {
    const uint8Array = new Uint8Array([0x52, 0x49, 0x46, 0x46]);
    const result = await processVoiceEvidence({
      audioBuffer: uint8Array,
      taskId: 'task-uint8-test',
    });

    const validation = VoiceToEvidenceResultSchema.safeParse(result);
    expect(validation.success).toBe(true);
    expect(result.taskId).toBe('task-uint8-test');
  });

  it('handles raw audioBase64 string', async () => {
    const base64Audio = Buffer.from('fake-audio-bytes').toString('base64');
    const result = await processVoiceEvidence({
      audioBase64: base64Audio,
      taskId: 'task-base64-test',
    });

    const validation = VoiceToEvidenceResultSchema.safeParse(result);
    expect(validation.success).toBe(true);
    expect(result.taskId).toBe('task-base64-test');
  });

  it('returns model extraction when Gemini API responds successfully', async () => {
    process.env.GEMINI_API_KEY = 'mock-test-gemini-key';

    const mockAiOutput: VoiceToEvidenceResult = {
      taskId: 'task-live-ai-123',
      transcription: 'Solar inverter replaced but wiring not insulated',
      detectedLanguage: 'en',
      confidence: 0.98,
      answers: {
        q1: true,
        q2: false,
        q3: true,
      },
      summary: 'Inverter hardware is mounted but electrical insulation is unfinished.',
      urgency: 'HIGH',
      extractedDetails: {
        safetyHazard: true,
      },
    };

    const mockApiResponse = {
      candidates: [
        {
          content: {
            parts: [{ text: JSON.stringify(mockAiOutput) }],
          },
        },
      ],
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockApiResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await processVoiceEvidence({
      textTranscript: 'Solar inverter replaced but wiring not insulated',
      taskId: 'task-live-ai-123',
    });

    expect(result.taskId).toBe('task-live-ai-123');
    expect(result.summary).toBe('Inverter hardware is mounted but electrical insulation is unfinished.');
    expect(result.urgency).toBe('HIGH');
    expect(result.answers.q1).toBe(true);
    expect(result.answers.q2).toBe(false);
  });

  it('falls back gracefully when Gemini API returns 500 error', async () => {
    process.env.GEMINI_API_KEY = 'mock-test-gemini-key';

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Internal Server Error', { status: 500 })
    );

    const customTaskId = 'task-fallback-on-error';
    const result = await processVoiceEvidence({
      textTranscript: 'Check water pump',
      taskId: customTaskId,
    });

    expect(result.taskId).toBe(customTaskId);
    expect(result.answers).toBeDefined();
    expect(result.urgency).toBe(fallbackFixture.urgency);
  });
});

describe('Voice-to-Evidence API Route: POST /api/ai/voice-to-evidence', () => {
  beforeEach(() => {
    delete process.env.GEMINI_API_KEY;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 200 with X-AI-Assistive-Only header and typed JSON result', async () => {
    const req = new Request('https://wardproofline.local/api/ai/voice-to-evidence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        textTranscript: 'Water well is completed and producing clean water',
        taskId: 'task-api-test-001',
      }),
    });

    const res = await handleVoiceToEvidenceRoute(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('application/json');
    expect(res.headers.get('X-AI-Assistive-Only')).toBe('true');

    const json = (await res.json()) as VoiceToEvidenceResult;
    const validation = VoiceToEvidenceResultSchema.safeParse(json);
    expect(validation.success).toBe(true);
    expect(json.taskId).toBe('task-api-test-001');
  });

  it('handles empty request body gracefully by returning 200 and fallback', async () => {
    const req = new Request('https://wardproofline.local/api/ai/voice-to-evidence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '',
    });

    const res = await handleVoiceToEvidenceRoute(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('X-AI-Assistive-Only')).toBe('true');

    const json = await res.json();
    const validation = VoiceToEvidenceResultSchema.safeParse(json);
    expect(validation.success).toBe(true);
  });

  it('handles malformed JSON body gracefully', async () => {
    const req = new Request('https://wardproofline.local/api/ai/voice-to-evidence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ not valid json',
    });

    const res = await handleVoiceToEvidenceRoute(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    const validation = VoiceToEvidenceResultSchema.safeParse(json);
    expect(validation.success).toBe(true);
  });

  it('handles base64 audio payload in request body', async () => {
    const req = new Request('https://wardproofline.local/api/ai/voice-to-evidence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audioBase64: 'ZHVtbXktYXVkaW8tYnl0ZXM=',
        taskId: 'task-audio-api-789',
      }),
    });

    const res = await handleVoiceToEvidenceRoute(req);
    expect(res.status).toBe(200);

    const json = (await res.json()) as VoiceToEvidenceResult;
    expect(json.taskId).toBe('task-audio-api-789');
  });
});
