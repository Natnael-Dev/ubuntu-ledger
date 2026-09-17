// GET /api/cron/probation/pings
// Authoritative sources: docs/specs/05-api-contracts.md §7, §11, docs/specs/11-tasks.md T-21
// Protected by Authorization: Bearer <CRON_SECRET>

import { NextResponse } from 'next/server';
import {
  getProbationCronService,
  type ProbationCronService,
} from '@/app-services/probation-cron.service';
import { isCronAuthorized } from '@/infra/security/cron-auth';

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'E_UNAUTHORIZED' },
      { status: 401 }
    );
  }

  try {
    const deps = (
      request as unknown as {
        deps?: { probationCronService?: ProbationCronService };
      }
    )?.deps;
    const service = deps?.probationCronService ?? getProbationCronService();

    const result = await service.processPings();

    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    const err = error as { message?: string; code?: string; status?: number };
    return NextResponse.json(
      {
        error: err?.message || 'Failed to process probation pings',
        code: err?.code || 'E_INTERNAL',
      },
      { status: err?.status || 500 }
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
