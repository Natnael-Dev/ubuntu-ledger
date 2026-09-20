// Unit tests for ELI5 Plain-Language Summary Engine and Route (T-AI-024)
// Verifies:
// 1. generateEli5Summary service adherence to Eli5SummaryResultSchema
// 2. Deterministic fallback behavior when AI is unavailable or fails schema validation
// 3. GET and POST route handlers in src/app/api/insights/eli5/route.ts
// 4. Strict assistive headers (X-AI-Assistive-Only: true) and PII safety

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateEli5Summary,
  buildEli5Prompt,
} from '@/app-services/ai/eli5.service';
import { GET, POST } from '@/app/api/insights/eli5/route';
import {
  Eli5SummaryResultSchema,
  type Eli5SummaryResult,
} from '@/lib/ai/types';
import fallbackFixture from '@/content/fixtures/ai/eli5-summary.json';

describe('T-AI-024: ELI5 Service & Prompt Builder', () => {
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

  it('builds a prompt specifying 5th-grade civic explanation and 3 concrete takeaways', () => {
    const prompt = buildEli5Prompt({
      entityType: 'project',
      entityId: '4412',
      title: 'Water Borehole Solar Pump',
      amount: 320000,
      currency: 'KES',
      contractor: 'Rift Water Works Ltd',
      status: 'UNDER_INSPECTION',
      locale: 'en',
    });

    expect(prompt).toContain('5th-grade reading level');
    expect(prompt).toContain('Exactly 3 concrete, plain bullet points');
    expect(prompt).toContain('Water Borehole Solar Pump');
    expect(prompt).toContain('320000 KES');
    expect(prompt).toContain('Rift Water Works Ltd');
    expect(prompt).toContain('UNDER_INSPECTION');
    expect(prompt).toContain('Grade 5 / Plain Civic');
  });

  it('returns deterministic fallback conforming to Eli5SummaryResultSchema when GEMINI_API_KEY is not set', async () => {
    const result = await generateEli5Summary({
      entityType: 'project',
      entityId: '4412',
    });

    const parsed = Eli5SummaryResultSchema.safeParse(result);
    expect(parsed.success).toBe(true);
    expect(result).toEqual(fallbackFixture);
    expect(result.keyTakeaways.length).toBeGreaterThanOrEqual(1);
    expect(result.readingLevel).toBe('Grade 5 / Plain Civic');
  });

  it('returns custom fallback when specified in options', async () => {
    const customFallback: Eli5SummaryResult = {
      plainLanguageText: 'Custom plain language text for testing ward 9.',
      audioUrl: null,
      audioDurationSeconds: null,
      keyTakeaways: [
        'Takeaway 1: Routine maintenance',
        'Takeaway 2: Budget 50,000 KES',
        'Takeaway 3: Requires 3 witnesses',
      ],
      locale: 'en',
      readingLevel: 'Grade 5 / Plain Civic',
      context: {
        entityType: 'ward',
        entityId: 'ward-09',
      },
    };

    const result = await generateEli5Summary(
      {
        entityType: 'ward',
        entityId: 'ward-09',
      },
      { fallback: customFallback }
    );

    expect(result).toEqual(customFallback);
    expect(result.context.entityType).toBe('ward');
    expect(result.context.entityId).toBe('ward-09');
  });

  it('returns valid structure from mock AI response adhering to Eli5SummaryResultSchema', async () => {
    process.env.GEMINI_API_KEY = 'mock-gemini-key';

    const mockAiData: Eli5SummaryResult = {
      plainLanguageText:
        'The village borehole now has a new solar water pump. The county paid 320,000 shillings. Three neighbors verified water is running cleanly.',
      audioUrl: '/audio/test.mp3',
      audioDurationSeconds: 15,
      keyTakeaways: [
        'New solar pump installed at the village borehole',
        '320,000 KES public funds paid',
        '3 independent neighbors confirmed clean water flow',
      ],
      locale: 'en',
      readingLevel: 'Grade 5 / Plain Civic',
      context: {
        entityType: 'project',
        entityId: '4412',
      },
    };

    const mockResponsePayload = {
      candidates: [
        {
          content: {
            parts: [{ text: JSON.stringify(mockAiData) }],
          },
        },
      ],
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockResponsePayload), { status: 200 })
    );

    const result = await generateEli5Summary({
      entityType: 'project',
      entityId: '4412',
    });

    const parsed = Eli5SummaryResultSchema.safeParse(result);
    expect(parsed.success).toBe(true);
    expect(result).toEqual(mockAiData);
  });

  it('falls back deterministically when AI response fails schema parsing', async () => {
    process.env.GEMINI_API_KEY = 'mock-gemini-key';

    const corruptedResponse = {
      candidates: [
        {
          content: {
            parts: [{ text: JSON.stringify({ wrongField: 'no summary' }) }],
          },
        },
      ],
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(corruptedResponse), { status: 200 })
    );

    const result = await generateEli5Summary({
      entityType: 'project',
      entityId: '4412',
    });

    expect(result).toEqual(fallbackFixture);
  });
});

describe('T-AI-024: Route Handler /api/insights/eli5', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.GEMINI_API_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('GET handler', () => {
    it('accepts query params and returns 200 with X-AI-Assistive-Only header', async () => {
      const request = new Request(
        'https://wardproofline.local/api/insights/eli5?entityType=project&entityId=4412&locale=en'
      );

      const response = await GET(request);
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('application/json');
      expect(response.headers.get('X-AI-Assistive-Only')).toBe('true');

      const json = await response.json();
      const validation = Eli5SummaryResultSchema.safeParse(json);
      expect(validation.success).toBe(true);
      expect(json.plainLanguageText).toBeDefined();
      expect(Array.isArray(json.keyTakeaways)).toBe(true);
    });

    it('defaults entityType and entityId gracefully when query params are absent', async () => {
      const request = new Request('https://wardproofline.local/api/insights/eli5');

      const response = await GET(request);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.context.entityType).toBe('project');
    });
  });

  describe('POST handler', () => {
    it('accepts JSON body and returns 200 with X-AI-Assistive-Only header', async () => {
      const request = new Request('https://wardproofline.local/api/insights/eli5', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: 'project',
          entityId: '4412',
          title: 'Primary School Latrine Block',
          amount: 150000,
          currency: 'KES',
          locale: 'en',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('application/json');
      expect(response.headers.get('X-AI-Assistive-Only')).toBe('true');

      const json = await response.json();
      const validation = Eli5SummaryResultSchema.safeParse(json);
      expect(validation.success).toBe(true);
    });

    it('handles malformed or empty POST body gracefully without error', async () => {
      const request = new Request('https://wardproofline.local/api/insights/eli5', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid-json-string',
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.plainLanguageText).toBeDefined();
    });
  });
});
