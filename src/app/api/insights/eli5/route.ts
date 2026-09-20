// API Route: ELI5 Plain-Language Summary & Audio Generation (T-AI-010 / T-AI-011 / T-AI-024)
// Contract: Assistive plain-language civic explainer.
// Enforces zero-PII boundary, 2000ms timeout, and deterministic fallback.

import { generateEli5Summary } from '@/app-services/ai/eli5.service';

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const rawType = searchParams.get('entityType') ?? 'project';
  const entityType = (['project', 'ward', 'service', 'bulletin'].includes(rawType)
    ? rawType
    : 'project') as 'project' | 'ward' | 'service' | 'bulletin';
  const entityId = searchParams.get('entityId') || '4412';
  const locale = searchParams.get('locale') || undefined;
  const title = searchParams.get('title') || undefined;
  const contractor = searchParams.get('contractor') || undefined;
  const status = searchParams.get('status') || undefined;
  const rawAmount = searchParams.get('amount');
  const amount = rawAmount ? Number(rawAmount) : undefined;
  const currency = searchParams.get('currency') || undefined;

  const result = await generateEli5Summary({
    entityType,
    entityId,
    locale,
    title,
    contractor,
    status,
    amount: Number.isFinite(amount) ? amount : undefined,
    currency,
  });

  return Response.json(result, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'X-AI-Assistive-Only': 'true',
    },
  });
}

export async function POST(request: Request): Promise<Response> {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const rawType = typeof body.entityType === 'string' ? body.entityType : 'project';
  const entityType = (['project', 'ward', 'service', 'bulletin'].includes(rawType)
    ? rawType
    : 'project') as 'project' | 'ward' | 'service' | 'bulletin';
  const entityId =
    typeof body.entityId === 'string' && body.entityId.trim()
      ? body.entityId
      : '4412';
  const title = typeof body.title === 'string' ? body.title : undefined;
  const contractor = typeof body.contractor === 'string' ? body.contractor : undefined;
  const status = typeof body.status === 'string' ? body.status : undefined;
  const locale = typeof body.locale === 'string' ? body.locale : undefined;
  const currency = typeof body.currency === 'string' ? body.currency : undefined;
  const amount =
    typeof body.amount === 'number' && Number.isFinite(body.amount)
      ? body.amount
      : undefined;

  const result = await generateEli5Summary({
    entityType,
    entityId,
    title,
    contractor,
    status,
    locale,
    currency,
    amount,
  });

  return Response.json(result, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'X-AI-Assistive-Only': 'true',
    },
  });
}

