// Repair Close (Probation Refusal) HTTP Route
// Authoritative sources:
// - docs/specs/04-state-machine.md §3, §7 (INV-01, INV-03)
// - docs/specs/05-api-contracts.md §0, §8
// - docs/specs/11-tasks.md T-20
// - docs/specs/14-testing-and-edge-cases.md ADV-08

import {
  ProbationService,
  getProbationService,
} from '@/app-services/probation.service';
import { ServiceError } from '@/app-services/errors';
import type { ActorRole } from '@/domain/types';
import type { RepairTicketRepository } from '@/infra/db/repositories/repair-ticket.repository';
import type { AuditLogService } from '@/infra/db/services/audit-log.service';
import type { Clock } from '@/infra/clock';

export interface CloseRouteDeps {
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

    // Extract actorRole from body or header, defaulting to ADMIN
    let actorRole: ActorRole = 'ADMIN';
    try {
      const rawBody = await req.json();
      if (rawBody && typeof rawBody === 'object') {
        const bodyObj = rawBody as Record<string, unknown>;
        const candidate = bodyObj.actorRole || bodyObj.actor;
        if (typeof candidate === 'string' && candidate.trim()) {
          actorRole = candidate.trim() as ActorRole;
        }
      }
    } catch {
      // Body is optional
    }

    const headerRole = req.headers.get('x-actor-role') as ActorRole | null;
    if (headerRole && headerRole.trim()) {
      actorRole = headerRole.trim() as ActorRole;
    }

    const deps = (req as Request & { deps?: CloseRouteDeps }).deps;
    const probationService =
      deps?.probationService || getProbationService(deps);

    // Hard Rule INV-01: attemptClose ALWAYS rejects early closure and writes to audit log (INV-03)
    await probationService.attemptClose(id, actorRole);

    return problemResponse(
      409,
      'E_PROBATION_LOCKED',
      'Probation window is still open',
      'Early manual closure is forbidden by state machine invariant INV-01',
      undefined,
      `/api/repairs/${id}/close`
    );
  } catch (error) {
    if (error instanceof ServiceError) {
      const title =
        error.code === 'E_PROBATION_LOCKED'
          ? 'Probation window is still open'
          : error.code === 'E_NOT_FOUND'
          ? 'Ticket Not Found'
          : 'Close Failed';

      const rawParams = await Promise.resolve(context?.params);
      const instancePath = rawParams?.id
        ? `/api/repairs/${rawParams.id}/close`
        : undefined;

      return problemResponse(
        error.statusCode,
        error.code,
        title,
        error.message,
        undefined,
        instancePath
      );
    }

    return problemResponse(
      500,
      'E_INTERNAL_ERROR',
      'Internal Server Error',
      error instanceof Error ? error.message : 'Unknown internal error'
    );
  }
}
