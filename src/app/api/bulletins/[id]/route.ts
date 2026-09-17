// GET /api/bulletins/[id] — Moderator bulletin inspection endpoint
// Authoritative sources:
// - docs/specs/05-api-contracts.md §9
// - docs/specs/11-tasks.md T-28

import { NextResponse } from 'next/server';
import { getBulletinService } from '@/app-services/bulletin.service';
import { ServiceError } from '@/app-services/errors';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, props: RouteContext): Promise<Response> {
  const { id } = await props.params;

  try {
    const service = getBulletinService();
    const bulletin = await service.getBulletinById(id);

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
