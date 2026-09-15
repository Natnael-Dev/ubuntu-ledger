// Append-Only Audit Event Service
// Authoritative source: docs/specs/03-data-model.md §10, docs/specs/07-trust-and-security.md §8

import type { AuditEventRecord } from '@/domain/audit-chain';

export interface AuditLogService {
  /**
   * Retrieves the latest audit event record to determine seq and prev_hash.
   * In PostgreSQL, this is executed under the advisory lock `pg_advisory_xact_lock(hashtext('audit_event_chain'))`.
   */
  getLastEventForUpdate(): Promise<AuditEventRecord | null>;

  /**
   * Appends an audit event to the append-only log.
   */
  append(record: AuditEventRecord): Promise<void>;
}

/**
 * In-memory implementation for unit and service-level testing.
 */
export class InMemoryAuditLogService implements AuditLogService {
  private events: AuditEventRecord[] = [];

  async getLastEventForUpdate(): Promise<AuditEventRecord | null> {
    if (this.events.length === 0) {
      return null;
    }
    return { ...this.events[this.events.length - 1] };
  }

  async append(record: AuditEventRecord): Promise<void> {
    // Assert strictly increasing seq
    const last = this.events[this.events.length - 1];
    if (last && Number(record.seq) <= Number(last.seq)) {
      throw new Error(
        `Audit sequence violation: incoming seq ${record.seq} is <= last seq ${last.seq}`
      );
    }
    this.events.push({ ...record });
  }

  // Test helpers
  getEvents(): AuditEventRecord[] {
    return this.events.map((e) => ({ ...e }));
  }

  clear(): void {
    this.events = [];
  }
}
