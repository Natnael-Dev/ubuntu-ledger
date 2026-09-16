// Unified Service and Repository Container Provider
// Authoritative sources: docs/specs/02-architecture.md §2, §4, §5, docs/specs/11-tasks.md T-13, T-15, T-16

import { InMemoryTransactionRunner, type TransactionRunner } from './transaction';
import { InMemoryProjectRepository, type ProjectRepository } from './repositories/project.repository';
import { InMemoryTaskRepository, type TaskRepository } from './repositories/task.repository';
import { InMemoryRespondentRepository, type RespondentRepository } from './repositories/respondent.repository';
import { InMemoryAuditLogService, type AuditLogService } from './services/audit-log.service';
import { InMemoryIdempotencyStore, type IdempotencyStore } from './services/idempotency.store';
import { ObservationService } from '@/app-services/observation.service';
import { systemClock } from '@/infra/clock';

import {
  DEMO_PROJECTS,
  DEMO_INSPECTION_TASKS,
  DEMO_OBSERVATIONS,
  DEMO_RESPONDENTS,
  DEMO_IDS,
} from '@/fixtures/demo-scenario';

import type {
  ProjectRecord,
  InspectionTaskRecord,
  ObservationRecord,
  RespondentRecord,
} from './types';

export interface ServiceContainer {
  txRunner: TransactionRunner;
  projectRepo: ProjectRepository;
  taskRepo: TaskRepository;
  respondentRepo: RespondentRepository;
  auditLogService: AuditLogService;
  idempotencyStore: IdempotencyStore;
  observationService: ObservationService;
}

/**
 * Creates and primes an in-memory container using canonical demo fixtures.
 */
export function createInMemoryContainer(): ServiceContainer {
  const projectRepo = new InMemoryProjectRepository();
  const taskRepo = new InMemoryTaskRepository();
  const respondentRepo = new InMemoryRespondentRepository();
  const auditLogService = new InMemoryAuditLogService();
  const idempotencyStore = new InMemoryIdempotencyStore();

  // 1. Seed Projects
  for (const p of DEMO_PROJECTS) {
    const record: ProjectRecord = {
      id: p.id,
      wardId: p.wardId,
      projectCode: p.projectCode,
      fiscal: p.fiscal,
      audit: p.audit,
      confidence: p.confidence,
      confirmedAt: null,
    };
    projectRepo.seed(record);
  }

  // 2. Seed Inspection Tasks
  for (const t of DEMO_INSPECTION_TASKS) {
    const record: InspectionTaskRecord = {
      id: t.id,
      projectId: t.projectId,
      assetId: t.assetId,
      dispatchedAt: new Date(t.dispatchedAt),
      expiresAt: new Date(t.expiresAt),
      witnessTarget: t.witnessTarget,
      witnessCount: t.witnessCount,
      closedAt: t.closedAt ? new Date(t.closedAt) : null,
    };
    taskRepo.seedTask(record);
    if (t.id === DEMO_IDS.TASK_4412) {
      taskRepo.seedTask({ ...record, id: 'task-4412' });
    }
  }

  // 3. Seed Pre-recorded Observations
  for (const obs of DEMO_OBSERVATIONS) {
    const record: ObservationRecord = {
      id: obs.id,
      taskId: obs.taskId,
      respondentId: obs.respondentId,
      channel: obs.channel,
      answers: obs.answers,
      clusterKey: obs.clusterKey,
      weight: obs.weight,
      geoCell: obs.geoCell ?? null,
      idempotencyKey: obs.idempotencyKey,
      submittedAt: new Date(obs.submittedAt),
      receivedAt: new Date(obs.receivedAt),
    };
    // Directly insert into the underlying map
    const obsMap = (taskRepo as unknown as { observations: Map<string, ObservationRecord> }).observations;
    if (obsMap) {
      obsMap.set(record.id, record);
    }
  }

  // 4. Seed Respondents
  for (const r of DEMO_RESPONDENTS) {
    const record: RespondentRecord & { geoCell?: string } = {
      id: r.id,
      wardId: DEMO_IDS.WARD_W09,
      phoneHash: r.phoneHash,
      phoneEnc: null,
      msisdnPrefix: r.msisdnPrefix,
      registeredAt: new Date(r.registeredAt),
      locale: r.locale,
      geoCell: r.geoCell,
    };
    respondentRepo.seed(record as unknown as RespondentRecord);
  }

  const txRunner = new InMemoryTransactionRunner({
    projectRepo,
    taskRepo,
    auditLogService,
    idempotencyStore,
  });

  const observationService = new ObservationService(
    txRunner,
    idempotencyStore,
    systemClock
  );

  return {
    txRunner,
    projectRepo,
    taskRepo,
    respondentRepo,
    auditLogService,
    idempotencyStore,
    observationService,
  };
}

let activeContainer: ServiceContainer | null = null;

/**
 * Returns the active shared ServiceContainer.
 * In environments without PostgreSQL configured, returns the in-memory demo container.
 */
export function getServiceContainer(options?: { forceInMemory?: boolean }): ServiceContainer {
  if (options?.forceInMemory) {
    return createInMemoryContainer();
  }

  if (!activeContainer) {
    activeContainer = createInMemoryContainer();
  }

  return activeContainer;
}

/**
 * Resets the active container singleton (for test isolation).
 */
export function resetServiceContainer(): void {
  activeContainer = null;
}
