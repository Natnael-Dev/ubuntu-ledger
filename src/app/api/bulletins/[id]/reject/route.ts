// POST /api/bulletins/[id]/reject — Moderator bulletin rejection
// Authoritative sources:
// - docs/specs/05-api-contracts.md §9
// - docs/specs/11-tasks.md T-28

import { NextResponse } from 'next/server';
import { getBulletinService } from '@/app-services/bulletin.service';
import { ServiceError } from '@/app-services/errors';
import { authorizeActor } from '@/infra/security/actor-auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, props: RouteContext): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { code: 'E_INVALID_JSON', detail: 'Request body must be valid JSON' },
      { status: 400 }
    );
  }

  const auth = authorizeActor(request, ['MODERATOR', 'ADMIN'], body);
  if (!auth.authorized) {
    return auth.response;
  }

  const { id } = await props.params;

  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

  if (!reason) {
    return NextResponse.json(
      { code: 'E_INVALID_INPUT', detail: '"reason" is required for rejection' },
      { status: 400 }
    );
  }

  try {
    const service = getBulletinService();
    const bulletin = await service.rejectBulletin(id, { reason });

    return NextResponse.json(bulletin);
  } catch (err: unknown) {
    if (err instanceof ServiceError) {
      return NextResponse.json(
        {
          type: `https://wardproofline.dev/errors/${err.code.toLowerCase().replace(/^e_/, '')}`,
          code: err.code,
          status: err.statusCode,
          detail: err.message,
        },
        { status: err.statusCode }
      );
    }
    return NextResponse.json(
      { code: 'E_INTERNAL', detail: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
