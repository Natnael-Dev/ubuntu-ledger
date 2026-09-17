// GET /api/services/[code]/statutory — Public Statutory Rule Card API
// Authoritative sources:
// - docs/specs/05-api-contracts.md §0, §6
// - docs/specs/03-data-model.md §5
// - docs/specs/07-trust-and-security.md §7
// - docs/specs/11-tasks.md T-25

import { getStatutoryService } from '@/app-services/statutory.service';
import { ServiceError } from '@/app-services/errors';

export interface RouteContext {
  params: Promise<{ code: string }>;
}

function problemResponse(
  status: number,
  code: string,
  title: string,
  detail: string,
  instance?: string
): Response {
  const typeSuffix = code.toLowerCase().replace(/^e_/, '');
  const payload: Record<string, unknown> = {
    type: `https://wardproofline.dev/errors/${typeSuffix}`,
    title,
    status,
    code,
    detail,
  };
  if (instance) {
    payload.instance = instance;
  }
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/problem+json',
    },
  });
}

/**
 * GET /api/services/[code]/statutory
 * Returns 200 with statutory rule card, fee ceiling, required documents,
 * and k-anonymously gated divergence aggregate.
 */
export async function GET(
  req: Request,
  props: RouteContext
): Promise<Response> {
  const resolvedParams = await props.params;
  const rawCode = resolvedParams?.code;

  if (!rawCode || !rawCode.trim()) {
    return problemResponse(
      404,
      'E_UNKNOWN_CODE',
      'Not Found',
      'Service code is required',
      '/api/services/unknown/statutory'
    );
  }

  const code = rawCode.trim();
  const service = getStatutoryService();

  try {
    const card = await service.getStatutoryCard(code);
    return new Response(JSON.stringify(card), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (err: unknown) {
    if (err instanceof ServiceError) {
      return problemResponse(
        err.statusCode,
        err.code,
        err.statusCode === 404 ? 'Not Found' : 'Error',
        err.message,
        `/api/services/${code}/statutory`
      );
    }
    return problemResponse(
      500,
      'E_INTERNAL',
      'Internal Server Error',
      'An unexpected error occurred processing the statutory card request',
      `/api/services/${code}/statutory`
    );
  }
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
