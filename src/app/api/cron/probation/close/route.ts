// GET /api/cron/probation/close
// Authoritative sources: docs/specs/04-state-machine.md §3, docs/specs/05-api-contracts.md §7, §11, docs/specs/11-tasks.md T-21
// Protected by Authorization: Bearer <CRON_SECRET>

import { NextResponse } from 'next/server';
import {
  getProbationCronService,
  type ProbationCronService,
} from '@/app-services/probation-cron.service';

function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET || 'dev-cron-secret-2026';
  const authHeader =
    request.headers.get('authorization') ||
    request.headers.get('Authorization');

  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      return parts[1] === cronSecret;
    }
  }

  const xCronSecret = request.headers.get('x-cron-secret');
  if (xCronSecret && xCronSecret === cronSecret) {
    return true;
  }

  return false;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
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

    const result = await service.evaluateClosedProbations();

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error.message || 'Failed to evaluate closed probations',
        code: error.code || 'E_INTERNAL',
      },
      { status: error.status || 500 }
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
