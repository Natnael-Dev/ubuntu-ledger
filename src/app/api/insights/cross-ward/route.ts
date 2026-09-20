// API Route: Cross-Ward Contractor Pattern Detection (T-AI-023)
// Assistive intelligence endpoint detecting contractor over-concentration or multi-ward failure trends.
// Enforces zero-PII boundary, 2000ms timeout, and deterministic fallback via cross-ward service.

import {
  analyzeCrossWardPatterns,
  type CrossWardProjectInput,
} from '@/app-services/ai/cross-ward.service';

const DEFAULT_CONTRACTOR = 'Apex Rift Engineering Ltd';

export async function POST(request: Request): Promise<Response> {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const contractorName =
    typeof body.contractorName === 'string' && body.contractorName.trim().length > 0
      ? body.contractorName.trim()
      : DEFAULT_CONTRACTOR;

  const wardIds = Array.isArray(body.wardIds)
    ? (body.wardIds.filter((id) => typeof id === 'string') as string[])
    : undefined;

  const projects = Array.isArray(body.projects)
    ? (body.projects as CrossWardProjectInput[])
    : undefined;

  const result = await analyzeCrossWardPatterns({
    contractorName,
    wardIds,
    projects,
  });

  return Response.json(result, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'X-AI-Assistive-Only': 'true',
    },
  });
}

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const contractorParam = searchParams.get('contractorName');
  const contractorName =
    contractorParam && contractorParam.trim().length > 0
      ? contractorParam.trim()
      : DEFAULT_CONTRACTOR;

  const wardParam = searchParams.get('wardIds');
  const wardIds = wardParam
    ? wardParam
        .split(',')
        .map((w) => w.trim())
        .filter(Boolean)
    : undefined;

  const result = await analyzeCrossWardPatterns({
    contractorName,
    wardIds,
  });

  return Response.json(result, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'X-AI-Assistive-Only': 'true',
    },
  });
}
