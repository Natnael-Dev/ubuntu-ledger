// Repair Claim HTTP Route
// Authoritative sources:
// - docs/specs/04-state-machine.md §3 (INV-01, INV-03)
// - docs/specs/05-api-contracts.md §8
// - docs/specs/11-tasks.md T-20

import {
  ProbationService,
  getProbationService,
} from '@/app-services/probation.service';
import { ServiceError } from '@/app-services/errors';
import type { RepairTicketRepository } from '@/infra/db/repositories/repair-ticket.repository';
import type { AuditLogService } from '@/infra/db/services/audit-log.service';
import type { Clock } from '@/infra/clock';

export interface ClaimRouteDeps {
  probationService?: ProbationService;
  repairTicketRepo?: RepairTicketRepository;
  auditLogService?: AuditLogService;
  clock?: Clock;
}

function problemResponse(
  status: number,
  code: string,
  title: string,
  detail: string,
  errors?: string[],
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

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const rawParams = await Promise.resolve(context?.params);
    let id = rawParams?.id;
    if (!id) {
      const url = new URL(req.url);
      const segments = url.pathname.split('/');
      const repairsIdx = segments.indexOf('repairs');
      if (repairsIdx !== -1 && segments[repairsIdx + 1]) {
        id = segments[repairsIdx + 1];
      }
    }

    if (!id) {
      return problemResponse(
        400,
        'E_INVALID_ARGUMENT',
        'Invalid Argument',
        'Missing repair ticket ID in route parameters'
      );
    }

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

    if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
      return problemResponse(
        422,
        'E_VALIDATION',
        'Validation Error',
        'Request body must be a JSON object',
        ['body']
      );
    }

    const body = rawBody as Record<string, unknown>;
    const claimedBy =
      typeof body.claimedBy === 'string' ? body.claimedBy.trim() : '';

    if (!claimedBy) {
      return problemResponse(
        422,
        'E_VALIDATION',
        'Validation Error',
        'claimedBy is required and must be a non-empty organisation name',
        ['claimedBy']
      );
    }

    const claimedAt =
      typeof body.claimedAt === 'string' ? body.claimedAt : undefined;
    const evidenceNote =
      typeof body.evidenceNote === 'string' ? body.evidenceNote : undefined;

    const deps = (req as Request & { deps?: ClaimRouteDeps }).deps;
    const probationService =
      deps?.probationService || getProbationService(deps);

    const result = await probationService.claimRepair(
      id,
      claimedBy,
      claimedAt,
      evidenceNote
    );

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    if (error instanceof ServiceError) {
      const title =
        error.code === 'E_NOT_FOUND' ? 'Ticket Not Found' : 'Claim Failed';
      return problemResponse(error.statusCode, error.code, title, error.message);
    }

    return problemResponse(
      500,
      'E_INTERNAL_ERROR',
      'Internal Server Error',
      error instanceof Error ? error.message : 'Unknown internal error'
    );
  }
}
