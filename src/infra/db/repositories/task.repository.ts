import { systemClock } from '@/infra/clock';
import type { InspectionTaskRecord, NewObservationRecord, ObservationRecord } from '../types';

export interface TaskRepository {
  /**
   * Retrieves an inspection task by ID with row-level locking (SELECT ... FOR UPDATE).
   */
  getTaskForUpdate(id: string): Promise<InspectionTaskRecord | null>;

  /**
   * Updates the witness_count on an inspection task.
   */
  updateWitnessCount(id: string, witnessCount: number): Promise<void>;

  /**
   * Appends an observation row to the task.
   */
  insertObservation(observation: NewObservationRecord): Promise<ObservationRecord>;

  /**
   * Fetches all recorded observations for a task.
   */
  getObservationsForTask(taskId: string): Promise<ObservationRecord[]>;

  /**
   * Fetches distinct cluster keys already observed for a task.
   */
  getClusterKeysForTask(taskId: string): Promise<string[]>;
}

/**
 * In-memory implementation for unit and service-level testing.
 */
export class InMemoryTaskRepository implements TaskRepository {
  constructor(
    private tasks: Map<string, InspectionTaskRecord> = new Map(),
    private observations: Map<string, ObservationRecord> = new Map()
  ) {}

  async getTaskForUpdate(id: string): Promise<InspectionTaskRecord | null> {
    const task = this.tasks.get(id);
    return task ? { ...task } : null;
  }

  async updateWitnessCount(id: string, witnessCount: number): Promise<void> {
    const task = this.tasks.get(id);
    if (!task) {
      throw new Error(`InspectionTask '${id}' not found`);
    }
    this.tasks.set(id, { ...task, witnessCount });
  }

  async insertObservation(newObs: NewObservationRecord): Promise<ObservationRecord> {
    // Check unique (task_id, respondent_id) per 03 §4 line 186
    for (const obs of this.observations.values()) {
      if (obs.taskId === newObs.taskId && obs.respondentId === newObs.respondentId) {
        throw new Error(
          `Unique constraint violation: respondent '${newObs.respondentId}' already submitted for task '${newObs.taskId}'`
        );
      }
      if (obs.idempotencyKey === newObs.idempotencyKey) {
        throw new Error(
          `Unique constraint violation: idempotencyKey '${newObs.idempotencyKey}' already exists`
        );
      }
    }

    const id = newObs.id || `obs-${systemClock.nowMs()}-${Math.random().toString(36).slice(2, 9)}`;
    const record: ObservationRecord = {
      ...newObs,
      id,
    };
    this.observations.set(id, record);
    return { ...record };
  }

  async getObservationsForTask(taskId: string): Promise<ObservationRecord[]> {
    return Array.from(this.observations.values())
      .filter((obs) => obs.taskId === taskId)
      .map((obs) => ({ ...obs }));
  }

  async getClusterKeysForTask(taskId: string): Promise<string[]> {
    const clusters = new Set<string>();
    for (const obs of this.observations.values()) {
      if (obs.taskId === taskId) {
        clusters.add(obs.clusterKey);
      }
    }
    return Array.from(clusters);
  }

  // Test helpers
  seedTask(task: InspectionTaskRecord): void {
    this.tasks.set(task.id, { ...task });
  }

  getTask(id: string): InspectionTaskRecord | undefined {
    return this.tasks.get(id);
  }

  getAllObservations(): ObservationRecord[] {
    return Array.from(this.observations.values());
  }
}
