// Database Transaction and Concurrency Runner
// Authoritative source: docs/specs/02-architecture.md §2, §4, docs/specs/11-tasks.md T-13

import type { ProjectRepository } from './repositories/project.repository';
import type { TaskRepository } from './repositories/task.repository';
import type { AuditLogService } from './services/audit-log.service';
import type { IdempotencyStore } from './services/idempotency.store';
import { InMemoryProjectRepository } from './repositories/project.repository';
import { InMemoryTaskRepository } from './repositories/task.repository';
import { InMemoryAuditLogService } from './services/audit-log.service';
import { InMemoryIdempotencyStore } from './services/idempotency.store';
import type { InspectionTaskRecord, ObservationRecord, ProjectRecord } from './types';
import type { AuditEventRecord } from '@/domain/audit-chain';

export interface TransactionContext {
  taskRepo: TaskRepository;
  projectRepo: ProjectRepository;
  auditLogService: AuditLogService;
  idempotencyStore: IdempotencyStore;

  /**
   * Acquires a PostgreSQL transaction-scoped advisory lock.
   * In Postgres: executes `SELECT pg_advisory_xact_lock(hashtext($1))`
   */
  acquireAdvisoryLock(lockKey: string): Promise<void>;
}

export interface TransactionRunner {
  runTransaction<T>(work: (ctx: TransactionContext) => Promise<T>): Promise<T>;
}

/**
 * In-memory transactional runner for deterministic unit and service testing.
 * Automatically restores state if the transaction throws (simulating PostgreSQL ROLLBACK).
 */
export class InMemoryTransactionRunner implements TransactionRunner {
  public projectRepo: InMemoryProjectRepository;
  public taskRepo: InMemoryTaskRepository;
  public auditLogService: InMemoryAuditLogService;
  public idempotencyStore: InMemoryIdempotencyStore;

  // Track acquired locks for assertions
  public acquiredLocks: string[] = [];

  constructor(options?: {
    projectRepo?: InMemoryProjectRepository;
    taskRepo?: InMemoryTaskRepository;
    auditLogService?: InMemoryAuditLogService;
    idempotencyStore?: InMemoryIdempotencyStore;
  }) {
    this.projectRepo = options?.projectRepo || new InMemoryProjectRepository();
    this.taskRepo = options?.taskRepo || new InMemoryTaskRepository();
    this.auditLogService = options?.auditLogService || new InMemoryAuditLogService();
    this.idempotencyStore = options?.idempotencyStore || new InMemoryIdempotencyStore();
  }

  async runTransaction<T>(work: (ctx: TransactionContext) => Promise<T>): Promise<T> {
    // Snapshot state before work to enable rollback simulation
    const projectSnapshot = this.snapshotProjects();
    const taskSnapshot = this.snapshotTasks();
    const obsSnapshot = this.snapshotObservations();
    const auditSnapshot = this.snapshotAuditEvents();
    const idempSnapshot = this.snapshotIdempotency();

    const currentTxLocks: string[] = [];

    const ctx: TransactionContext = {
      taskRepo: this.taskRepo,
      projectRepo: this.projectRepo,
      auditLogService: this.auditLogService,
      idempotencyStore: this.idempotencyStore,
      acquireAdvisoryLock: async (lockKey: string) => {
        currentTxLocks.push(lockKey);
        this.acquiredLocks.push(lockKey);
      },
    };

    try {
      const result = await work(ctx);
      // Success = COMMIT
      return result;
    } catch (err) {
      // Failure = ROLLBACK
      this.restoreProjects(projectSnapshot);
      this.restoreTasks(taskSnapshot);
      this.restoreObservations(obsSnapshot);
      this.restoreAuditEvents(auditSnapshot);
      this.restoreIdempotency(idempSnapshot);
      throw err;
    }
  }

  private snapshotProjects(): Map<string, ProjectRecord> {
    const raw = (this.projectRepo as unknown as { projects: Map<string, ProjectRecord> }).projects;
    const copy = new Map<string, ProjectRecord>();
    for (const [k, v] of raw.entries()) {
      copy.set(k, { ...v });
    }
    return copy;
  }

  private restoreProjects(snapshot: Map<string, ProjectRecord>): void {
    const raw = (this.projectRepo as unknown as { projects: Map<string, ProjectRecord> }).projects;
    raw.clear();
    for (const [k, v] of snapshot.entries()) {
      raw.set(k, v);
    }
  }

  private snapshotTasks(): Map<string, InspectionTaskRecord> {
    const raw = (this.taskRepo as unknown as { tasks: Map<string, InspectionTaskRecord> }).tasks;
    const copy = new Map<string, InspectionTaskRecord>();
    for (const [k, v] of raw.entries()) {
      copy.set(k, { ...v });
    }
    return copy;
  }

  private restoreTasks(snapshot: Map<string, InspectionTaskRecord>): void {
    const raw = (this.taskRepo as unknown as { tasks: Map<string, InspectionTaskRecord> }).tasks;
    raw.clear();
    for (const [k, v] of snapshot.entries()) {
      raw.set(k, v);
    }
  }

  private snapshotObservations(): Map<string, ObservationRecord> {
    const raw = (this.taskRepo as unknown as { observations: Map<string, ObservationRecord> }).observations;
    const copy = new Map<string, ObservationRecord>();
    for (const [k, v] of raw.entries()) {
      copy.set(k, { ...v });
    }
    return copy;
  }

  private restoreObservations(snapshot: Map<string, ObservationRecord>): void {
    const raw = (this.taskRepo as unknown as { observations: Map<string, ObservationRecord> }).observations;
    raw.clear();
    for (const [k, v] of snapshot.entries()) {
      raw.set(k, v);
    }
  }

  private snapshotAuditEvents(): AuditEventRecord[] {
    return this.auditLogService.getEvents();
  }

  private restoreAuditEvents(snapshot: AuditEventRecord[]): void {
    this.auditLogService.clear();
    for (const e of snapshot) {
      this.auditLogService.append(e);
    }
  }

  private snapshotIdempotency(): Map<string, unknown> {
    const raw = (this.idempotencyStore as unknown as { records: Map<string, unknown> }).records;
    const copy = new Map<string, unknown>();
    for (const [k, v] of raw.entries()) {
      copy.set(k, typeof v === 'object' && v !== null ? { ...v } : v);
    }
    return copy;
  }

  private restoreIdempotency(snapshot: Map<string, unknown>): void {
    const raw = (this.idempotencyStore as unknown as { records: Map<string, unknown> }).records;
    raw.clear();
    for (const [k, v] of snapshot.entries()) {
      raw.set(k, v as never);
    }
  }
}
