// POST /api/visits/outcomes — Public Ingress for Citizen Visit Outcomes
// Authoritative sources:
// - docs/specs/03-data-model.md §5
// - docs/specs/05-api-contracts.md §7, §12
// - docs/specs/07-trust-and-security.md §7
// - docs/specs/11-tasks.md T-26

import { getStatutoryService } from '@/app-services/statutory.service';
import { ServiceError } from '@/app-services/errors';

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

export async function POST(req: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return problemResponse(
      400,
      'E_INVALID_JSON',
      'Bad Request',
      'Request body must be valid JSON',
      '/api/visits/outcomes'
    );
  }

  if (!body || typeof body !== 'object') {
    return problemResponse(
      400,
      'E_INVALID_INPUT',
      'Bad Request',
      'Request body must be an object',
      '/api/visits/outcomes'
    );
  }

  const serviceCode = typeof body.serviceCode === 'string' ? body.serviceCode.trim() : '';
  if (!serviceCode) {
    return problemResponse(
      400,
      'E_INVALID_INPUT',
      'Bad Request',
      'Field "serviceCode" is required',
      '/api/visits/outcomes'
    );
  }

  const outcomeCode = body.outcomeCode;
  if (typeof outcomeCode !== 'number' || !Number.isInteger(outcomeCode)) {
    return problemResponse(
      400,
      'E_INVALID_OUTCOME_CODE',
      'Bad Request',
      'Field "outcomeCode" must be an integer between 1 and 5',
      '/api/visits/outcomes'
    );
  }

  const phoneHash = typeof body.phoneHash === 'string' ? body.phoneHash.trim() : '';
  if (!phoneHash) {
    return problemResponse(
      400,
      'E_INVALID_INPUT',
      'Bad Request',
      'Field "phoneHash" is required',
      '/api/visits/outcomes'
    );
  }

  const headerIdempotencyKey = req.headers.get('Idempotency-Key') || req.headers.get('idempotency-key');
  const idempotencyKey =
    headerIdempotencyKey?.trim() ||
    (typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : undefined);

  const extraFeeMinor =
    typeof body.extraFeeMinor === 'number' && Number.isInteger(body.extraFeeMinor)
      ? body.extraFeeMinor
      : undefined;

  const visits =
    typeof body.visits === 'number' && Number.isInteger(body.visits)
      ? body.visits
      : undefined;

  const channel = typeof body.channel === 'string' ? body.channel : 'USSD';
  const clusterKey = typeof body.clusterKey === 'string' ? body.clusterKey.trim() : undefined;

  try {
    const service = getStatutoryService();
    const result = await service.recordVisitOutcome({
      serviceCode,
      outcomeCode,
      extraFeeMinor,
      visits,
      phoneHash,
      channel,
      idempotencyKey,
      clusterKey,
    });

    return new Response(JSON.stringify(result), {
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
        err.code === 'E_RATE_LIMITED' ? 'Too Many Requests' : 'Error',
        err.message,
        '/api/visits/outcomes'
      );
    }

    return problemResponse(
      500,
      'E_INTERNAL',
      'Internal Server Error',
      'An unexpected error occurred while processing outcome',
      '/api/visits/outcomes'
    );
  }
}
