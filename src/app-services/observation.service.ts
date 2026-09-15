// Observation Application Service
// Authoritative sources: docs/specs/02-architecture.md §2, §4, §5 (Path B),
// docs/specs/03-data-model.md §4, §10, §11, docs/specs/04-state-machine.md §2, §7 (INV-02, INV-03, INV-08),
// docs/specs/05-api-contracts.md §5, docs/specs/07-trust-and-security.md §3, §4, §8, docs/specs/11-tasks.md T-13

import { createHash } from 'node:crypto';
import type { Clock } from '@/infra/clock';
import { systemClock } from '@/infra/clock';
import type { Channel } from '@/domain/types';
import { deriveClusterKey } from '@/domain/sybil';
import {
  assignObservationWeight,
  countWitnesses,
  evaluateTriangulation,
  type ClusterAnswer,
} from '@/domain/triangulation';
import {
  transition,
  type AuditSnapshot,
  type AuditEvent,
} from '@/domain/audit-lifecycle';
import {
  createAuditEventRecord,
  canonicalJson,
} from '@/domain/audit-chain';
import { extractMsisdnPrefix } from '@/lib/msisdn';
import type { TransactionRunner } from '@/infra/db/transaction';
import type { IdempotencyStore } from '@/infra/db/services/idempotency.store';
import { ServiceError } from './errors';

export interface SubmitObservationInput {
  taskId: string;
  respondentId: string;
  channel: Channel;
  answers: Record<string, boolean>;
  clientIdempotencyKey: string;
  geoCell?: string | null;
  msisdnPrefixBucket?: string;
  msisdn?: string; // If raw MSISDN passed at ingress, normalized before domain
  registeredAt?: Date | string;
  submittedAt?: Date | string;
}

export interface ObservationResponseDto {
  accepted: boolean;
  counted: boolean;
  clusterKey: string;
  witnessCount: number;
  witnessTarget: number;
  reasonKey?: string;
  resultingNarrative?: string;
  messageKey?: string;
}

export class ObservationService {
  constructor(
    private readonly txRunner: TransactionRunner,
    private readonly idempotencyStore: IdempotencyStore,
    private readonly clock: Clock = systemClock
  ) {}

  /**
   * Computes the SHA-256 request hash for idempotency deduplication per 03 §11.
   */
  private computeRequestHash(input: SubmitObservationInput): string {
    const canonical = canonicalJson({
      taskId: input.taskId,
      respondentId: input.respondentId,
      channel: input.channel,
      answers: input.answers,
      geoCell: input.geoCell || null,
      msisdnPrefixBucket: input.msisdnPrefixBucket || null,
    });
    return createHash('sha256').update(canonical, 'utf8').digest('hex');
  }

  /**
   * Submits an observation adhering to the 16-step canonical transaction contract.
   */
  async submitObservation(input: SubmitObservationInput): Promise<ObservationResponseDto> {
    if (!input.clientIdempotencyKey) {
      throw new ServiceError(
        'E_INVALID_ARGUMENT',
        400,
        'clientIdempotencyKey is required'
      );
    }
    if (!input.taskId) {
      throw new ServiceError('E_INVALID_ARGUMENT', 400, 'taskId is required');
    }
    if (!input.respondentId) {
      throw new ServiceError(
        'E_INVALID_ARGUMENT',
        400,
        'respondentId is required'
      );
    }

    const requestHash = this.computeRequestHash(input);

    // 0. Fast-path pre-check outside transaction (optimization per 03 §11)
    const preCheck = await this.idempotencyStore.findByKey(
      input.clientIdempotencyKey
    );
    if (preCheck) {
      if (preCheck.requestHash !== requestHash) {
        throw new ServiceError(
          'E_IDEMPOTENCY_CONFLICT',
          409,
          'idempotency_key_reused'
        );
      }
      return preCheck.response as unknown as ObservationResponseDto;
    }

    // Ingress boundary prefix normalization: raw MSISDN never enters domain
    const prefixBucket = input.msisdnPrefixBucket
      ? input.msisdnPrefixBucket
      : input.msisdn
      ? extractMsisdnPrefix(input.msisdn)
      : '000000';

    const registeredAt = input.registeredAt || this.clock.now();
    const submittedAt = input.submittedAt
      ? new Date(input.submittedAt)
      : this.clock.now();
    const receivedAt = this.clock.now();

    // Execute atomic 16-step PostgreSQL transaction
    return await this.txRunner.runTransaction(async (tx) => {
      // 1 & 2. Acquire idempotency advisory lock: serialize concurrent requests with same key
      await tx.acquireAdvisoryLock(`idempotency:${input.clientIdempotencyKey}`);

      // 3 & 4. Re-check idempotency_record INSIDE transaction
      const inTxIdemp = await tx.idempotencyStore.findByKey(
        input.clientIdempotencyKey
      );
      if (inTxIdemp) {
        if (inTxIdemp.requestHash !== requestHash) {
          throw new ServiceError(
            'E_IDEMPOTENCY_CONFLICT',
            409,
            'idempotency_key_reused'
          );
        }
        return inTxIdemp.response as unknown as ObservationResponseDto;
      }

      // 5. Lock inspection_task with SELECT ... FOR UPDATE
      const task = await tx.taskRepo.getTaskForUpdate(input.taskId);
      if (!task) {
        throw new ServiceError(
          'E_NOT_FOUND',
          404,
          `InspectionTask '${input.taskId}' not found`
        );
      }
      if (task.closedAt) {
        throw new ServiceError(
          'E_TASK_CLOSED',
          400,
          `InspectionTask '${input.taskId}' is closed`
        );
      }
      if (task.expiresAt && this.clock.now() > task.expiresAt) {
        throw new ServiceError(
          'E_TASK_EXPIRED',
          400,
          `InspectionTask '${input.taskId}' is expired`
        );
      }

      // 6. Lock project aggregate with SELECT ... FOR UPDATE
      const project = await tx.projectRepo.getProjectForUpdate(task.projectId);
      if (!project) {
        throw new ServiceError(
          'E_NOT_FOUND',
          404,
          `Project '${task.projectId}' not found`
        );
      }

      // 7. Derive opaque cluster_key (T-11 pure domain primitive)
      const clusterKey = deriveClusterKey({
        taskId: task.id,
        geoCell: input.geoCell,
        wardId: project.wardId,
        msisdnPrefixBucket: prefixBucket,
        registeredAt,
      });

      // 8. Assign observation weight (T-12 pure domain primitive)
      const existingClusterKeys = await tx.taskRepo.getClusterKeysForTask(
        task.id
      );
      const weightResult = assignObservationWeight(
        existingClusterKeys,
        clusterKey
      );

      // 9. Persist observation
      await tx.taskRepo.insertObservation({
        taskId: task.id,
        respondentId: input.respondentId,
        channel: input.channel,
        answers: input.answers,
        clusterKey,
        weight: weightResult.weight,
        geoCell: input.geoCell,
        idempotencyKey: input.clientIdempotencyKey,
        submittedAt,
        receivedAt,
      });

      // 10. Recalculate witness count strictly from persisted observations (INV-02)
      const persistedObservations = await tx.taskRepo.getObservationsForTask(
        task.id
      );
      const updatedWitnessCount = countWitnesses(persistedObservations);
      await tx.taskRepo.updateWitnessCount(task.id, updatedWitnessCount);

      // 11. Evaluate triangulation & determine event
      let auditEventToApply: AuditEvent | undefined;

      if (weightResult.weight === 0) {
        // Duplicate cluster: does not increment witness count, emits DUPLICATE_OBSERVATION
        auditEventToApply = {
          type: 'DUPLICATE_OBSERVATION',
          clusterKey,
          at: receivedAt,
        };
      } else {
        const clusterAnswers: ClusterAnswer[] = persistedObservations.map(
          (obs) => ({
            clusterKey: obs.clusterKey,
            answers: obs.answers,
          })
        );

        const triage = evaluateTriangulation({
          witnessTarget: task.witnessTarget,
          witnessCount: updatedWitnessCount,
          clusterAnswers,
          at: receivedAt,
        });

        if (triage.recommendedEvent) {
          auditEventToApply = triage.recommendedEvent;
        }
      }

      // 12. Apply domain lifecycle transition (T-08 pure machine)
      const effectsToExecute: Array<{ kind: 'AUDIT'; action: string; payload: Record<string, unknown> }> = [];

      if (auditEventToApply) {
        const distinctValidClusters = Array.from(
          new Set(
            persistedObservations
              .filter((o) => o.weight === 1)
              .map((o) => o.clusterKey)
          )
        );

        const snapshot: AuditSnapshot = {
          audit: project.audit,
          hasAsset: true,
          hasTaskTemplate: true,
          witnessTarget: task.witnessTarget,
          witnessCount: updatedWitnessCount,
          distinctClusterKeys: distinctValidClusters,
          confirmedAt: project.confirmedAt,
          expiresAt: task.expiresAt,
        };

        const transitionResult = transition(snapshot, auditEventToApply);

        if (transitionResult.ok) {
          // 13. Persist task/project state if changed
          if (transitionResult.next !== project.audit) {
            const confirmedAt =
              transitionResult.next === 'PHYSICALLY_CONFIRMED'
                ? receivedAt
                : project.confirmedAt;
            await tx.projectRepo.updateAuditState(
              project.id,
              transitionResult.next,
              confirmedAt
            );
            project.audit = transitionResult.next;
          }

          // Collect AUDIT effects
          for (const eff of transitionResult.effects) {
            if (eff.kind === 'AUDIT') {
              effectsToExecute.push(eff);
            }
          }
        }
      }

      // 14. Append audit event (INV-03, T-10 cryptographic hash chain)
      for (const eff of effectsToExecute) {
        await tx.acquireAdvisoryLock('audit_event_chain');
        const lastEvent = await tx.auditLogService.getLastEventForUpdate();
        const nextSeq = lastEvent ? Number(lastEvent.seq) + 1 : 1;

        const auditRecord = createAuditEventRecord({
          seq: nextSeq,
          prevEvent: lastEvent,
          action: eff.action,
          entityType: 'project',
          entityId: project.id,
          payload: eff.payload,
          actorRole: 'SYSTEM',
          occurredAt: receivedAt,
          wardId: project.wardId,
        });

        await tx.auditLogService.append(auditRecord);
      }

      // 15. Format response DTO per 05 §5
      let resultingNarrative: string | undefined;
      let messageKey: string | undefined;

      if (project.audit === 'PHYSICALLY_CONFIRMED') {
        resultingNarrative = 'PHYSICALLY_CONFIRMED';
        messageKey = 'narrative.asset_present';
      } else if (project.audit === 'DISCREPANCY_FLAGGED') {
        resultingNarrative = 'FIELD_DISCREPANCY';
        messageKey = 'narrative.reports_disagree';
      }

      const responseDto: ObservationResponseDto =
        weightResult.weight === 1
          ? {
              accepted: true,
              counted: true,
              clusterKey,
              witnessCount: updatedWitnessCount,
              witnessTarget: task.witnessTarget,
              resultingNarrative,
              messageKey,
            }
          : {
              accepted: true,
              counted: false,
              reasonKey: weightResult.reasonKey || 'observation.cluster_already_counted',
              clusterKey,
              witnessCount: updatedWitnessCount,
              witnessTarget: task.witnessTarget,
            };

      // Persist idempotency response inside same transaction
      await tx.idempotencyStore.save({
        key: input.clientIdempotencyKey,
        endpoint: '/api/observations',
        requestHash,
        response: responseDto as unknown as Record<string, unknown>,
        createdAt: receivedAt,
      });

      // 16. COMMIT
      return responseDto;
    });
  }
}
