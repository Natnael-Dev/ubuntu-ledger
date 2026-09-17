// POST /api/cron/bulletins/compile — Bulletin Draft Compiler Cron
// Authoritative sources:
// - docs/specs/05-api-contracts.md §9, §11
// - docs/specs/07-trust-and-security.md §6.4
// - docs/specs/11-tasks.md T-28

import { NextResponse } from 'next/server';
import { getBulletinService } from '@/app-services/bulletin.service';
import { getStatutoryService } from '@/app-services/statutory.service';
import { DEMO_SERVICES, DEMO_WARDS } from '@/fixtures/demo-scenario';
import { systemClock } from '@/infra/clock';
import { isCronAuthorized } from '@/infra/security/cron-auth';

export async function POST(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'E_UNAUTHORIZED' },
      { status: 401 }
    );
  }

  try {
    const bulletinService = getBulletinService();
    const statutoryService = getStatutoryService();
    const now = systemClock.nowIso();

    const results: Array<{ wardId: string; bulletinId?: string; skipped?: boolean }> = [];

    // Calculate period boundaries: previous 30 days
    const periodEnd = now.slice(0, 10);
    const endDate = new Date(periodEnd);
    endDate.setDate(endDate.getDate() - 1);
    const startDate = new Date(periodEnd);
    startDate.setDate(startDate.getDate() - 30);
    const periodStart = startDate.toISOString().slice(0, 10);

    for (const ward of DEMO_WARDS) {
      // Gather k-satisfied facts for this ward's services
      const wardServices = DEMO_SERVICES.filter((s) => s.wardId === ward.id);
      const facts = [];

      for (const svc of wardServices) {
        try {
          const card = await statutoryService.getStatutoryCard(svc.code);
          const observed = card.observed;
          if (observed.kSatisfied) {
            facts.push({
              serviceCode: svc.code,
              officeCode: svc.officeCode,
              windowDays: observed.windowDays,
              reportCount: observed.reportCount,
              distinctClusters: observed.distinctClusters,
              pctAdditionalFee: observed.pctAdditionalFee,
              medianExtraMinor: observed.medianExtraMinor,
              currency: card.statutory.currency,
              kSatisfied: true,
            });
          }
        } catch {
          // Skip services that error
        }
      }

      const bulletin = await bulletinService.compileBulletins({
        wardId: ward.id,
        wardCode: ward.code,
        periodStart,
        periodEnd,
        facts,
        locale: ward.locales?.[0] ?? 'en',
      });

      if (bulletin) {
        results.push({ wardId: ward.id, bulletinId: bulletin.id });
      } else {
        results.push({ wardId: ward.id, skipped: true });
      }
    }

    return NextResponse.json({
      ok: true,
      periodStart,
      periodEnd,
      results,
      compiledAt: now,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
