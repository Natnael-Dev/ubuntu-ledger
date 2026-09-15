// Project Aggregate Repository
// Authoritative source: docs/specs/03-data-model.md §3, docs/specs/02-architecture.md §2, §4

import type { AuditState } from '@/domain/types';
import type { ProjectRecord } from '../types';

export interface ProjectRepository {
  /**
   * Retrieves a project aggregate by ID with row-level locking (SELECT ... FOR UPDATE).
   */
  getProjectForUpdate(id: string): Promise<ProjectRecord | null>;

  /**
   * Updates the audit lifecycle state of the project.
   */
  updateAuditState(id: string, state: AuditState, confirmedAt?: Date | null): Promise<void>;
}

/**
 * In-memory mock implementation for unit and service-level testing.
 */
export class InMemoryProjectRepository implements ProjectRepository {
  constructor(private projects: Map<string, ProjectRecord> = new Map()) {}

  async getProjectForUpdate(id: string): Promise<ProjectRecord | null> {
    const p = this.projects.get(id);
    return p ? { ...p } : null;
  }

  async updateAuditState(id: string, state: AuditState, confirmedAt?: Date | null): Promise<void> {
    const p = this.projects.get(id);
    if (!p) {
      throw new Error(`Project '${id}' not found`);
    }
    this.projects.set(id, {
      ...p,
      audit: state,
      confirmedAt: confirmedAt !== undefined ? confirmedAt : p.confirmedAt,
    });
  }

  // Test helper
  seed(project: ProjectRecord): void {
    this.projects.set(project.id, { ...project });
  }

  get(id: string): ProjectRecord | undefined {
    return this.projects.get(id);
  }
}
