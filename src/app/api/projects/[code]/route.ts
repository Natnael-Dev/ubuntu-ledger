// GET /api/projects/[code] — Public Project Receipt API
// Authoritative sources:
// - docs/specs/05-api-contracts.md §0, §4
// - docs/specs/08-ui-ux-design.md §5
// - docs/specs/04-state-machine.md §6
// - docs/specs/11-tasks.md T-19

import { systemClock } from '@/infra/clock';
import { DEMO_WARDS } from '@/fixtures/demo-scenario';
import {
  getProjectReceipt,
  problemResponse,
  type ProjectReceiptDto,
  type WardMetadataDto,
  type SingleProjectReceiptResponseDto,
} from '@/lib/project-receipt';

export type {
  ProjectReceiptDto,
  WardMetadataDto,
  SingleProjectReceiptResponseDto,
};

/**
 * GET /api/projects/[code]
 * Returns 200 with the single project receipt matching that project code (e.g. 4412),
 * or 404 E_NOT_FOUND if not found.
 */
export async function GET(
  req: Request,
  props: { params: Promise<{ code: string }> }
): Promise<Response> {
  const resolvedParams = await props.params;
  const code = resolvedParams.code;

  if (!code || !code.trim()) {
    return problemResponse(404, 'E_NOT_FOUND', 'Not Found', 'Project code is required');
  }

  const receipt = getProjectReceipt(code.trim());
  if (!receipt) {
    return problemResponse(
      404,
      'E_NOT_FOUND',
      'Not Found',
      `Project '${code}' not found`
    );
  }

  // Resolve Ward metadata
  const ward =
    DEMO_WARDS.find((w) => w.id === receipt.wardId || w.code === receipt.wardId) ||
    DEMO_WARDS[0];

  const responseBody: SingleProjectReceiptResponseDto = {
    projectCode: receipt.projectCode,
    title: receipt.title,
    amountMinor: receipt.amountMinor,
    currency: receipt.currency,
    contractor: receipt.contractor,
    promisedCompletion: receipt.promisedCompletion,
    confidence: receipt.confidence,
    source: receipt.source,
    narrative: receipt.narrative,
    witness: receipt.witness,
    ward: {
      code: ward.code,
      name: ward.name,
      locales: ward.locales,
    },
    generatedAt: systemClock.nowIso(),
  };

  return new Response(JSON.stringify(responseBody), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export async function POST(): Promise<Response> {
  return new Response('Method Not Allowed', {
    status: 405,
    headers: {
      Allow: 'GET',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}

export async function PUT(): Promise<Response> {
  return POST();
}

export async function DELETE(): Promise<Response> {
  return POST();
}

export async function PATCH(): Promise<Response> {
  return POST();
}
