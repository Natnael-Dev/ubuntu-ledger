// Project Receipt DTOs, Derivations, and Presentation Helpers
// Authoritative sources:
// - docs/specs/05-api-contracts.md §0, §4
// - docs/specs/08-ui-ux-design.md §5
// - docs/specs/04-state-machine.md §6
// - docs/specs/11-tasks.md T-19

import { getServiceContainer, type ServiceContainer } from '@/infra/db/container';
import { systemClock } from '@/infra/clock';
import type { ProjectRecord, InspectionTaskRecord } from '@/infra/db/types';
import {
  ALL_DEMO_PROJECTS,
  ALL_DEMO_SOURCE_DOCUMENTS,
  DEMO_INSPECTION_TASKS,
  DEMO_REPAIR_TICKETS,
} from '@/fixtures/demo-scenario';
import { formatMessage, type Locale } from '@/domain/content';
import { getWardCurrency } from '@/domain/jurisdiction-config';
import type { SourceConfidence } from '@/domain/types';

export interface ProjectReceiptSource {
  title: string;
  issuer: string;
  page: number | null;
  sha256: string;
  archivedAt: string;
}

export interface ProjectReceiptNarrative {
  state: string;
  messageKey: string;
  slots?: Record<string, string>;
}

export interface ProjectReceiptWitness {
  count: number;
  target: number;
}

export interface ProjectReceiptDto {
  projectCode: string;
  title: string;
  amountMinor: number;
  currency: string;
  contractor: string;
  promisedCompletion: string;
  confidence: SourceConfidence;
  source: ProjectReceiptSource | null;
  narrative: ProjectReceiptNarrative;
  witness: ProjectReceiptWitness;
  wardId?: string;
}

export interface WardMetadataDto {
  code: string;
  name: string;
  locales: Locale[];
}

export interface SingleProjectReceiptResponseDto extends ProjectReceiptDto {
  ward: WardMetadataDto;
  generatedAt: string;
}

export function formatCurrency(amountMinor: number, currency: string = 'ETB'): string {
  const major = Math.floor(amountMinor / 100);
  return `${currency} ${major.toLocaleString('en-US')}`;
}

export function formatPromisedDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = d.getUTCDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getUTCMonth()];
  return `due ${day} ${month}`;
}

export function formatArchivedDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = d.getUTCDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

export function truncateHash(hash: string): string {
  if (!hash || hash.length < 12) return hash || '';
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

export function resolveNarrativeText(messageKey: string, slots?: Record<string, string>): string {
  const rendered = formatMessage(messageKey, 'en', slots);
  if (rendered !== messageKey) {
    return rendered;
  }
  if (messageKey === 'narrative.working_seven_days') {
    return 'Repair verified and sustained for 7 days.';
  }
  if (messageKey === 'narrative.asset_present') {
    return 'Asset physically confirmed by community witnesses.';
  }
  if (messageKey === 'narrative.funded_not_yet_checked') {
    return 'Funded and committed. Inspection not yet dispatched.';
  }
  return messageKey;
}

export function problemResponse(
  status: number,
  code: string,
  title: string,
  detail: string
): Response {
  const typeSuffix = code.toLowerCase().replace(/^e_/, '');
  return new Response(
    JSON.stringify({
      type: `https://wardproofline.dev/errors/${typeSuffix}`,
      title,
      status,
      code,
      detail,
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/problem+json',
      },
    }
  );
}

/**
 * Derives the canonical ProjectReceiptDto for a given project code.
 * Integrates container project state, inspection tasks, and demo fixtures.
 */
export function getProjectReceipt(
  code: string,
  container?: ServiceContainer
): ProjectReceiptDto | null {
  const activeContainer = container || getServiceContainer();

  // 1. Look up live project aggregate in projectRepo
  const inMemoryRepo = activeContainer.projectRepo as unknown as {
    projects?: Map<string, ProjectRecord>;
  };
  const liveProject = inMemoryRepo?.projects
    ? Array.from(inMemoryRepo.projects.values()).find(
        (p) => p.projectCode === code || p.id === code
      )
    : undefined;

  // 2. Look up declarative project metadata in ALL_DEMO_PROJECTS
  const fixture = ALL_DEMO_PROJECTS.find(
    (p) => p.projectCode === code || p.id === code
  );

  if (!liveProject && !fixture) {
    return null;
  }

  const projectId = liveProject?.id ?? fixture?.id ?? code;
  const projectCode = liveProject?.projectCode ?? fixture?.projectCode ?? code;
  const wardId = liveProject?.wardId ?? fixture?.wardId ?? '';
  const title = fixture?.title ?? `Project ${projectCode}`;
  const amountMinor = fixture?.amountMinor ?? 0;
  const currency = fixture?.currency ?? getWardCurrency(wardId);
  const contractor = fixture?.contractorName ?? 'Unknown Contractor';
  const promisedCompletion = fixture?.promisedCompletion ?? '2026-12-31';
  const confidence: SourceConfidence =
    liveProject?.confidence ?? fixture?.confidence ?? 'OFFICIAL_UNCITED';
  const fiscal = liveProject?.fiscal ?? fixture?.fiscal ?? 'PROMISED';
  const audit = liveProject?.audit ?? fixture?.audit ?? 'NOT_DISPATCHED';

  // 3. Resolve Source Document Block (05 §4: UNOFFICIAL_ESTIMATE must have source: null)
  let source: ProjectReceiptSource | null = null;
  if (confidence !== 'UNOFFICIAL_ESTIMATE' && fixture?.sourceDocumentId) {
    const doc = ALL_DEMO_SOURCE_DOCUMENTS.find((d) => d.id === fixture.sourceDocumentId);
    if (doc) {
      source = {
        title: doc.title,
        issuer: doc.issuer,
        page: fixture.sourcePage ?? null,
        sha256: doc.sha256,
        archivedAt: doc.archivedAt,
      };
    }
  }

  // 4. Resolve Inspection Task & Witness count
  const inMemoryTaskRepo = activeContainer.taskRepo as unknown as {
    tasks?: Map<string, InspectionTaskRecord>;
  };
  const liveTask = inMemoryTaskRepo?.tasks
    ? Array.from(inMemoryTaskRepo.tasks.values()).find(
        (t) => t.projectId === projectId || t.id === `task-${projectCode}` || t.id === projectId
      )
    : undefined;
  const fixtureTask = DEMO_INSPECTION_TASKS.find((t) => t.projectId === projectId);
  const witnessCount = liveTask?.witnessCount ?? fixtureTask?.witnessCount ?? 0;
  const witnessTarget = liveTask?.witnessTarget ?? fixtureTask?.witnessTarget ?? 3;

  // 5. Resolve Repair Ticket
  const ticket = DEMO_REPAIR_TICKETS.find((t) => t.projectId === projectId);

  // 6. Derive Narrative State (04 §6 display priority order)
  let narrativeState = 'NOT_DISPATCHED';
  let messageKey = 'narrative.funded_not_yet_checked';
  let slots: Record<string, string> = {};

  if (ticket && ticket.state === 'PROBATION_FAILED') {
    narrativeState = 'PROBATION_FAILED';
    messageKey = 'narrative.repair_failed_durability';
    slots = { code: projectCode };
  } else if (audit === 'DISCREPANCY_FLAGGED') {
    narrativeState = 'FIELD_DISCREPANCY';
    messageKey = 'narrative.reports_disagree';
  } else if (
    ticket &&
    (ticket.state === 'PROBATION_ACTIVE' ||
      ticket.state === 'PROBATION_DAY_0' ||
      ticket.state === 'REPAIR_CLAIMED')
  ) {
    narrativeState = 'PROBATION_ACTIVE';
    messageKey = 'narrative.under_probation_n_days';
    let daysLeft = 5;
    if (ticket.probationEndsAt) {
      const endMs = new Date(ticket.probationEndsAt).getTime();
      const nowMs = systemClock.nowMs();
      const diff = Math.ceil((endMs - nowMs) / (24 * 60 * 60 * 1000));
      daysLeft = diff > 0 ? diff : 5;
    }
    slots = { days: String(daysLeft) };
  } else if (audit === 'PHYSICALLY_CONFIRMED') {
    narrativeState = 'PHYSICALLY_CONFIRMED';
    messageKey = 'narrative.asset_present';
  } else if (ticket && ticket.state === 'VERIFIED_SUSTAINED') {
    narrativeState = 'VERIFIED_SUSTAINED';
    messageKey = 'narrative.working_seven_days';
  } else if (audit === 'AWAITING_THRESHOLD') {
    narrativeState = 'AWAITING_THRESHOLD';
    messageKey = 'narrative.awaiting_reports_n_of_3';
    slots = { count: String(witnessCount), target: String(witnessTarget) };
  } else if (confidence === 'UNOFFICIAL_ESTIMATE') {
    narrativeState = 'UNOFFICIAL_ESTIMATE';
    messageKey = 'narrative.no_source_document';
  } else if (fiscal === 'COMMITTED' || fiscal === 'DISBURSED' || fiscal === 'PROMISED') {
    narrativeState = 'TASK_DISPATCHED';
    messageKey = 'narrative.funded_not_yet_checked';
  }

  return {
    projectCode,
    title,
    amountMinor,
    currency,
    contractor,
    promisedCompletion,
    confidence,
    source,
    narrative: {
      state: narrativeState,
      messageKey,
      slots: Object.keys(slots).length > 0 ? slots : undefined,
    },
    witness: {
      count: witnessCount,
      target: witnessTarget,
    },
    wardId,
  };
}
