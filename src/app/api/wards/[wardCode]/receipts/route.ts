// GET /api/wards/[wardCode]/receipts — Public Ward Spending Receipts API
// Authoritative sources:
// - docs/specs/05-api-contracts.md §0, §4
// - docs/specs/08-ui-ux-design.md §5
// - docs/specs/11-tasks.md T-19

import { systemClock } from '@/infra/clock';
import { getServiceContainer } from '@/infra/db/container';
import type { ProjectRecord } from '@/infra/db/types';
import { DEMO_PROJECTS, DEMO_WARDS } from '@/fixtures/demo-scenario';
import {
  getProjectReceipt,
  problemResponse,
  type ProjectReceiptDto,
  type WardMetadataDto,
} from '@/app/api/projects/[code]/route';

export interface WardReceiptsResponseDto {
  ward: WardMetadataDto;
  receipts: ProjectReceiptDto[];
  generatedAt: string;
}

/**
 * GET /api/wards/[wardCode]/receipts
 * Returns 200 with ward metadata and array of project receipts.
 */
export async function GET(
  req: Request,
  props: { params: Promise<{ wardCode: string }> }
): Promise<Response> {
  const resolvedParams = await props.params;
  const wardCode = resolvedParams.wardCode;

  if (!wardCode || !wardCode.trim()) {
    return problemResponse(404, 'E_NOT_FOUND', 'Not Found', 'Ward code is required');
  }

  // Find ward in canonical fixtures (case-insensitive)
  const normalizedWardCode = wardCode.trim().toLowerCase();
  const ward = DEMO_WARDS.find(
    (w) => w.code.toLowerCase() === normalizedWardCode || w.id.toLowerCase() === normalizedWardCode
  );

  if (!ward) {
    return problemResponse(
      404,
      'E_NOT_FOUND',
      'Not Found',
      `Ward '${wardCode}' not found`
    );
  }

  const container = getServiceContainer();

  // Find projects for this ward in both live container and demo fixtures
  const inMemoryRepo = container.projectRepo as unknown as {
    projects?: Map<string, ProjectRecord>;
  };
  const liveProjects = inMemoryRepo?.projects
    ? Array.from(inMemoryRepo.projects.values()).filter((p) => p.wardId === ward.id)
    : [];

  const fixtureProjects = DEMO_PROJECTS.filter((p) => p.wardId === ward.id);

  // Deduplicate project codes
  const projectCodes = new Set<string>();
  for (const p of fixtureProjects) {
    projectCodes.add(p.projectCode);
  }
  for (const p of liveProjects) {
    projectCodes.add(p.projectCode);
  }

  const receipts: ProjectReceiptDto[] = [];
  for (const code of projectCodes) {
    const r = getProjectReceipt(code, container);
    if (r) {
      // Strip internal wardId property for API contract clean shape
      const cleanReceipt = { ...r };
      delete cleanReceipt.wardId;
      receipts.push(cleanReceipt);
    }
  }

  // Format ward name per 05 §4
  const displayName = ward.code === 'ET-AA-W09' ? 'Woreda 9' : ward.name;

  const responseBody: WardReceiptsResponseDto = {
    ward: {
      code: ward.code,
      name: displayName,
      locales: ward.locales,
    },
    receipts,
    generatedAt: systemClock.nowIso(),
  };

  return new Response(JSON.stringify(responseBody), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
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
