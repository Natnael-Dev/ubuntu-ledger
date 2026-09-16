// Observation Ingress HTTP Route
// Authoritative sources:
// - docs/specs/05-api-contracts.md §0, §5, §13
// - docs/specs/02-architecture.md §2, §4, §5 (Path B)
// - docs/specs/07-trust-and-security.md §3, §4, §8
// - docs/specs/14-testing-and-edge-cases.md §3
// - docs/specs/11-tasks.md T-16

import { ObservationService } from '@/app-services/observation.service';
import { ServiceError } from '@/app-services/errors';
import type { RespondentRepository } from '@/infra/db/repositories/respondent.repository';
import type { Channel } from '@/domain/types';
import { getServiceContainer } from '@/infra/db/container';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ObservationRouteDeps {
  respondentRepo?: RespondentRepository;
  observationService?: ObservationService;
}

function getDefaultDeps(): {
  respondentRepo: RespondentRepository;
  observationService: ObservationService;
} {
  const container = getServiceContainer();
  return {
    respondentRepo: container.respondentRepo,
    observationService: container.observationService,
  };
}

function problemResponse(
  status: number,
  code: string,
  title: string,
  detail: string,
  errors?: string[]
): Response {
  const typeSuffix = code.toLowerCase().replace(/^e_/, '');
  const payload: Record<string, unknown> = {
    type: `https://wardproofline.dev/errors/${typeSuffix}`,
    title,
    status,
    code,
    detail,
  };
  if (errors && errors.length > 0) {
    payload.errors = errors;
  }
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/problem+json',
    },
  });
}

interface ObservationRequestBody {
  taskId: string;
  phoneHash: string;
  clientIdempotencyKey: string;
  answers: Record<string, boolean>;
  channel?: string;
  geoCell?: string | null;
  submittedAt?: string;
}

/**
 * Validates request body fields according to 05 §5.
 */
function validateRequestBody(body: unknown): {
  data?: ObservationRequestBody;
  errors?: string[];
} {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { errors: ['body must be a JSON object'] };
  }

  const b = body as Record<string, unknown>;
  const errors: string[] = [];

  if (typeof b.taskId !== 'string' || !b.taskId.trim()) {
    errors.push('taskId is required and must be a non-empty string');
  }

  if (typeof b.phoneHash !== 'string' || !b.phoneHash.trim()) {
    errors.push('phoneHash is required and must be a non-empty string');
  }

  if (typeof b.clientIdempotencyKey !== 'string' || !b.clientIdempotencyKey.trim()) {
    errors.push('clientIdempotencyKey is required and must be a non-empty string');
  }

  if (!b.answers || typeof b.answers !== 'object' || Array.isArray(b.answers)) {
    errors.push('answers must be an object of key-boolean pairs');
  } else {
    for (const [k, v] of Object.entries(b.answers)) {
      if (typeof v !== 'boolean') {
        errors.push(`answers.${k} must be a boolean`);
      }
    }
  }

  if (errors.length > 0) {
    return { errors };
  }

  return {
    data: {
      taskId: (b.taskId as string).trim(),
      phoneHash: (b.phoneHash as string).trim(),
      clientIdempotencyKey: (b.clientIdempotencyKey as string).trim(),
      answers: b.answers as Record<string, boolean>,
      channel: typeof b.channel === 'string' ? b.channel : undefined,
      geoCell: typeof b.geoCell === 'string' ? b.geoCell : null,
      submittedAt: typeof b.submittedAt === 'string' ? b.submittedAt : undefined,
    },
  };
}

/**
 * POST /api/observations
 * Ingress endpoint for Monitor PWA observation submissions.
 */
export async function POST(req: Request): Promise<Response> {
  // 1. Validate Idempotency-Key HTTP header per 05 §0
  const idempotencyHeader =
    req.headers.get('idempotency-key') || req.headers.get('Idempotency-Key');

  if (!idempotencyHeader || !idempotencyHeader.trim()) {
    return problemResponse(
      400,
      'E_MISSING_IDEMPOTENCY_KEY',
      'Missing Idempotency-Key header',
      'Every mutating endpoint requires Idempotency-Key: <uuid>'
    );
  }

  const trimmedHeaderKey = idempotencyHeader.trim();
  if (!UUID_REGEX.test(trimmedHeaderKey)) {
    return problemResponse(
      422,
      'E_VALIDATION',
      'Validation Error',
      'Idempotency-Key header must be a valid UUID',
      ['headers.idempotency-key']
    );
  }

  // 2. Parse and validate JSON request body
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return problemResponse(
      422,
      'E_VALIDATION',
      'Validation Error',
      'Malformed or invalid JSON body',
      ['body']
    );
  }

  const { data: body, errors } = validateRequestBody(rawBody);
  if (errors || !body) {
    return problemResponse(
      422,
      'E_VALIDATION',
      'Validation Error',
      'Request body validation failed',
      errors
    );
  }

  // 3. Resolve dependencies
  const deps = (req as Request & { deps?: ObservationRouteDeps }).deps;
  const respondentRepo = deps?.respondentRepo || getDefaultDeps().respondentRepo;
  const observationService = deps?.observationService || getDefaultDeps().observationService;

  // 4. Server-side identity resolution & submission
  try {
    const respondent = await respondentRepo.findByPhoneHash(body.phoneHash);
    if (!respondent) {
      return problemResponse(
        404,
        'E_UNKNOWN_CODE',
        'Unknown Respondent',
        'Respondent not found for provided phoneHash'
      );
    }

    // 5. Delegate to Observation Application Service
    const effectiveKey = body.clientIdempotencyKey || trimmedHeaderKey;
    const result = await observationService.submitObservation({
      taskId: body.taskId,
      respondentId: respondent.id,
      respondentWardId: respondent.wardId,
      channel: (body.channel as Channel) || 'PWA',
      answers: body.answers,
      clientIdempotencyKey: effectiveKey,
      geoCell: body.geoCell ?? null,
      submittedAt: body.submittedAt,
    });

    // 6. Shape clean response (never exposes respondent UUID or raw MSISDN)
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
        err.code === 'E_UNKNOWN_CODE' ? 'Unknown Code' : err.message,
        err.message
      );
    }

    // Generic safe 500 error without exposing stack traces or database errors
    return problemResponse(
      500,
      'E_INTERNAL',
      'Internal Server Error',
      'An error occurred while processing the observation submission'
    );
  }
}

/**
 * Rejection for unsupported HTTP methods per API contract.
 */
export async function GET(): Promise<Response> {
  return new Response('Method Not Allowed', {
    status: 405,
    headers: {
      Allow: 'POST',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}

export async function PUT(): Promise<Response> {
  return GET();
}

export async function DELETE(): Promise<Response> {
  return GET();
}

export async function PATCH(): Promise<Response> {
  return GET();
}
