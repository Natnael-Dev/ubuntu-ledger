// POST /api/bulletins/[id]/approve — Moderator approval with approval-time k-recheck
// Authoritative sources:
// - docs/specs/05-api-contracts.md §9
// - docs/specs/07-trust-and-security.md §6.4
// - docs/specs/11-tasks.md T-28
// INV-06: Re-validates every fact's k-status at approval time

import { NextResponse } from 'next/server';
import { getBulletinService } from '@/app-services/bulletin.service';
import { ServiceError } from '@/app-services/errors';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, props: RouteContext): Promise<Response> {
  const { id } = await props.params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { code: 'E_INVALID_JSON', detail: 'Request body must be valid JSON' },
      { status: 400 }
    );
  }

  const moderatorInitials = typeof body.moderatorInitials === 'string' ? body.moderatorInitials : '';
  const editedScript = typeof body.editedScript === 'string' ? body.editedScript : undefined;

  if (!moderatorInitials) {
    return NextResponse.json(
      { code: 'E_INVALID_INPUT', detail: '"moderatorInitials" is required' },
      { status: 400 }
    );
  }

  try {
    const service = getBulletinService();
    // Use approveWithLiveKCheck for proper k-recheck at approval time
    const bulletin = await service.approveWithLiveKCheck(id, {
      moderatorInitials,
      editedScript,
    });

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
