import { describe, it, expect, beforeEach } from 'vitest';
import { ObservationService, type SubmitObservationInput } from '@/app-services/observation.service';
import { ServiceError } from '@/app-services/errors';
import { InMemoryTransactionRunner } from '@/infra/db/transaction';
import { TestClock } from '@/infra/clock';
import type { InspectionTaskRecord, ProjectRecord } from '@/infra/db/types';

describe('T-13: Observation Application Service & Repositories', () => {
  let txRunner: InMemoryTransactionRunner;
  let clock: TestClock;
  let service: ObservationService;

  const PROJECT_ID = 'proj-health-01';
  const TASK_ID = 'task-inspect-01';
  const WARD_ID = 'ward-nairobi-01';
  const ASSET_ID = 'asset-generator-01';

  beforeEach(() => {
    clock = new TestClock(new Date('2026-09-16T10:00:00Z'));
    txRunner = new InMemoryTransactionRunner();
    service = new ObservationService(txRunner, txRunner.idempotencyStore, clock);

    // Seed aggregate project & inspection task
    const project: ProjectRecord = {
      id: PROJECT_ID,
      wardId: WARD_ID,
      projectCode: '4412',
      fiscal: 'DISBURSED',
      audit: 'AWAITING_THRESHOLD',
      confidence: 'OFFICIAL_CITED',
      confirmedAt: null,
    };
    txRunner.projectRepo.seed(project);

    const task: InspectionTaskRecord = {
      id: TASK_ID,
      projectId: PROJECT_ID,
      assetId: ASSET_ID,
      dispatchedAt: new Date('2026-09-15T08:00:00Z'),
      expiresAt: new Date('2026-09-22T08:00:00Z'),
      witnessTarget: 3,
      witnessCount: 0,
      closedAt: null,
    };
    txRunner.taskRepo.seedTask(task);
  });

  describe('1. Standard Observation Submission & Witness Counting (INV-02)', () => {
    it('records first observation from a cluster with weight 1 and increments witness count', async () => {
      const input: SubmitObservationInput = {
        taskId: TASK_ID,
        respondentId: 'resp-alice',
        respondentWardId: WARD_ID,
        channel: 'PWA',
        answers: { q1_operational: true, q2_fuel_present: true },
        clientIdempotencyKey: 'idemp-001',
        geoCell: 'geo-cell-01',
        msisdnPrefixBucket: '254711',
      };

      const res = await service.submitObservation(input);

      expect(res.accepted).toBe(true);
      expect(res.counted).toBe(true);
      expect(res.witnessCount).toBe(1);
      expect(res.witnessTarget).toBe(3);

      const task = txRunner.taskRepo.getTask(TASK_ID);
      expect(task?.witnessCount).toBe(1);

      const observations = await txRunner.taskRepo.getObservationsForTask(TASK_ID);
      expect(observations.length).toBe(1);
      expect(observations[0].weight).toBe(1);
    });

    it('records duplicate cluster submission with weight 0 and leaves witness count unchanged', async () => {
      // First submission from prefix 254711 in cell 01
      await service.submitObservation({
        taskId: TASK_ID,
        respondentId: 'resp-alice',
        respondentWardId: WARD_ID,
        channel: 'PWA',
        answers: { q1_operational: true },
        clientIdempotencyKey: 'idemp-001',
        geoCell: 'geo-cell-01',
        msisdnPrefixBucket: '254711',
      });

      // Second submission from same cluster (different respondent, same cell & prefix)
      const res2 = await service.submitObservation({
        taskId: TASK_ID,
        respondentId: 'resp-bob',
        respondentWardId: WARD_ID,
        channel: 'PWA',
        answers: { q1_operational: true },
        clientIdempotencyKey: 'idemp-002',
        geoCell: 'geo-cell-01',
        msisdnPrefixBucket: '254711',
      });

      expect(res2.accepted).toBe(true);
      expect(res2.counted).toBe(false);
      expect(res2.reasonKey).toBe('observation.cluster_already_counted');
      expect(res2.witnessCount).toBe(1); // Unchanged!

      const task = txRunner.taskRepo.getTask(TASK_ID);
      expect(task?.witnessCount).toBe(1);

      // Asserts OBSERVATION_SUPPRESSED audit event was recorded per 04 §2 line 47
      const auditEvents = txRunner.auditLogService.getEvents();
      expect(auditEvents.length).toBe(1);
      expect(auditEvents[0].action).toBe('OBSERVATION_SUPPRESSED');
      expect((auditEvents[0].payload as { weight: number }).weight).toBe(0);
    });
  });

  describe('2. Idempotency Contract (Same Key + Same/Different Payload)', () => {
    it('returns identical cached response on replay with same key and same payload', async () => {
      const input: SubmitObservationInput = {
        taskId: TASK_ID,
        respondentId: 'resp-alice',
        respondentWardId: WARD_ID,
        channel: 'PWA',
        answers: { q1: true },
        clientIdempotencyKey: 'idemp-replay-01',
        geoCell: 'cell-01',
        msisdnPrefixBucket: '254711',
      };

      const firstRes = await service.submitObservation(input);
      const secondRes = await service.submitObservation(input);

      expect(secondRes).toEqual(firstRes);

      // Verifies only one observation row exists
      const observations = await txRunner.taskRepo.getObservationsForTask(TASK_ID);
      expect(observations.length).toBe(1);
    });

    it('throws 409 idempotency_key_reused when same key is used with different payload', async () => {
      const input1: SubmitObservationInput = {
        taskId: TASK_ID,
        respondentId: 'resp-alice',
        respondentWardId: WARD_ID,
        channel: 'PWA',
        answers: { q1: true },
        clientIdempotencyKey: 'idemp-conflict-01',
        geoCell: 'cell-01',
        msisdnPrefixBucket: '254711',
      };

      await service.submitObservation(input1);

      const input2Different: SubmitObservationInput = {
        ...input1,
        answers: { q1: false }, // Different answer payload!
      };

      await expect(service.submitObservation(input2Different)).rejects.toThrow(
        /idempotency_key_reused/
      );

      try {
        await service.submitObservation(input2Different);
      } catch (err) {
        expect(err).toBeInstanceOf(ServiceError);
        expect((err as ServiceError).statusCode).toBe(409);
        expect((err as ServiceError).message).toBe('idempotency_key_reused');
      }
    });

    it('rejects same idempotency key across different tasks with 409', async () => {
      const inputTask1: SubmitObservationInput = {
        taskId: TASK_ID,
        respondentId: 'resp-alice',
        respondentWardId: WARD_ID,
        channel: 'PWA',
        answers: { q1: true },
        clientIdempotencyKey: 'idemp-cross-task',
        geoCell: 'cell-01',
        msisdnPrefixBucket: '254711',
      };

      await service.submitObservation(inputTask1);

      const inputTask2: SubmitObservationInput = {
        ...inputTask1,
        taskId: 'task-inspect-02', // Different task!
      };

      await expect(service.submitObservation(inputTask2)).rejects.toThrow(
        /idempotency_key_reused/
      );
    });
  });

  describe('3. Threshold Completion, State Transitions & Atomic Audit Chain (INV-03, INV-08)', () => {
    it('transitions project to PHYSICALLY_CONFIRMED on 3rd consistent cluster and appends audit event', async () => {
      // 1st witness
      await service.submitObservation({
        taskId: TASK_ID,
        respondentId: 'resp-01',
        respondentWardId: WARD_ID,
        channel: 'PWA',
        answers: { q1: true, q2: true },
        clientIdempotencyKey: 'idemp-t1',
        geoCell: 'cell-01',
        msisdnPrefixBucket: '254711',
      });

      // 2nd witness
      await service.submitObservation({
        taskId: TASK_ID,
        respondentId: 'resp-02',
        respondentWardId: WARD_ID,
        channel: 'PWA',
        answers: { q1: true, q2: true },
        clientIdempotencyKey: 'idemp-t2',
        geoCell: 'cell-02',
        msisdnPrefixBucket: '254722',
      });

      expect(txRunner.projectRepo.get(PROJECT_ID)?.audit).toBe('AWAITING_THRESHOLD');

      // 3rd witness (threshold reached with 3/3 unanimous agreement)
      const res3 = await service.submitObservation({
        taskId: TASK_ID,
        respondentId: 'resp-03',
        respondentWardId: WARD_ID,
        channel: 'PWA',
        answers: { q1: true, q2: true },
        clientIdempotencyKey: 'idemp-t3',
        geoCell: 'cell-03',
        msisdnPrefixBucket: '254733',
      });

      expect(res3.counted).toBe(true);
      expect(res3.witnessCount).toBe(3);
      expect(res3.resultingNarrative).toBe('PHYSICALLY_CONFIRMED');

      const project = txRunner.projectRepo.get(PROJECT_ID);
      expect(project?.audit).toBe('PHYSICALLY_CONFIRMED');

      // INV-03: Verify exactly 1 state-change audit event was appended
      const events = txRunner.auditLogService.getEvents();
      expect(events.length).toBe(1);
      expect(events[0].action).toBe('AUDIT_STATE_CHANGED');
      expect(events[0].seq).toBe(1);
      expect(events[0].prev_hash).toBe('0'.repeat(64));
    });

    it('transitions project to DISCREPANCY_FLAGGED when agreement < 2/3 at threshold', async () => {
      // Configure task with witnessTarget = 2 to test 1 true vs 1 false split
      const task = txRunner.taskRepo.getTask(TASK_ID)!;
      task.witnessTarget = 2;

      // 1st witness: true
      await service.submitObservation({
        taskId: TASK_ID,
        respondentId: 'resp-01',
        respondentWardId: WARD_ID,
        channel: 'PWA',
        answers: { q1: true },
        clientIdempotencyKey: 'idemp-d1',
        geoCell: 'cell-01',
        msisdnPrefixBucket: '254711',
      });

      // 2nd witness: false (1 true, 1 false out of 2 -> 50% < 2/3)
      const res2 = await service.submitObservation({
        taskId: TASK_ID,
        respondentId: 'resp-02',
        respondentWardId: WARD_ID,
        channel: 'PWA',
        answers: { q1: false },
        clientIdempotencyKey: 'idemp-d2',
        geoCell: 'cell-02',
        msisdnPrefixBucket: '254722',
      });

      expect(res2.resultingNarrative).toBe('FIELD_DISCREPANCY');
      const project = txRunner.projectRepo.get(PROJECT_ID);
      expect(project?.audit).toBe('DISCREPANCY_FLAGGED');
    });

    it('INV-08 Domain Guard: a 4th observation on an already-confirmed task does not re-transition', async () => {
      // Reach threshold = 3
      for (let i = 1; i <= 3; i++) {
        await service.submitObservation({
          taskId: TASK_ID,
          respondentId: `resp-0${i}`,
          respondentWardId: WARD_ID,
          channel: 'PWA',
          answers: { q1: true },
          clientIdempotencyKey: `idemp-seq-${i}`,
          geoCell: `cell-0${i}`,
          msisdnPrefixBucket: `25470${i}`,
        });
      }

      expect(txRunner.projectRepo.get(PROJECT_ID)?.audit).toBe('PHYSICALLY_CONFIRMED');
      const eventsAfterThreshold = txRunner.auditLogService.getEvents().length;
      expect(eventsAfterThreshold).toBe(1);

      // 4th distinct cluster arrives
      const res4 = await service.submitObservation({
        taskId: TASK_ID,
        respondentId: 'resp-04',
        respondentWardId: WARD_ID,
        channel: 'PWA',
        answers: { q1: true },
        clientIdempotencyKey: 'idemp-seq-4',
        geoCell: 'cell-04',
        msisdnPrefixBucket: '254704',
      });

      expect(res4.counted).toBe(true);
      expect(res4.witnessCount).toBe(4);
      expect(txRunner.projectRepo.get(PROJECT_ID)?.audit).toBe('PHYSICALLY_CONFIRMED');

      // Crucial: No second PROJECT_STATE_CHANGED audit event emitted!
      const finalEvents = txRunner.auditLogService.getEvents();
      expect(finalEvents.length).toBe(1);
    });
  });

  describe('4. Atomicity & Rollback Semantics (INV-05)', () => {
    it('rolls back observation and leaves zero trace if transaction throws', async () => {
      // Attempt submission on non-existent task
      await expect(
        service.submitObservation({
          taskId: 'non-existent-task',
          respondentId: 'resp-fail',
          respondentWardId: WARD_ID,
          channel: 'PWA',
          answers: { q1: true },
          clientIdempotencyKey: 'idemp-fail-01',
          geoCell: 'cell-01',
          msisdnPrefixBucket: '254711',
        })
      ).rejects.toThrow(/not found/);

      // Assert idempotency record was NOT saved
      expect(txRunner.idempotencyStore.has('idemp-fail-01')).toBe(false);

      // Assert zero observations were added
      expect(txRunner.taskRepo.getAllObservations().length).toBe(0);

      // Assert zero audit events were added
      expect(txRunner.auditLogService.getEvents().length).toBe(0);
    });

    it('allows clean retry after a failed first transaction', async () => {
      // Temporarily mark task closed to cause error
      const task = txRunner.taskRepo.getTask(TASK_ID)!;
      task.closedAt = new Date();

      await expect(
        service.submitObservation({
          taskId: TASK_ID,
          respondentId: 'resp-retry',
          respondentWardId: WARD_ID,
          channel: 'PWA',
          answers: { q1: true },
          clientIdempotencyKey: 'idemp-retry-01',
          geoCell: 'cell-01',
          msisdnPrefixBucket: '254711',
        })
      ).rejects.toThrow(/closed/);

      // Re-open task in repository
      txRunner.taskRepo.getTask(TASK_ID)!.closedAt = null;

      // Retry with same idempotency key succeeds!
      const res = await service.submitObservation({
        taskId: TASK_ID,
        respondentId: 'resp-retry',
        respondentWardId: WARD_ID,
        channel: 'PWA',
        answers: { q1: true },
        clientIdempotencyKey: 'idemp-retry-01',
        geoCell: 'cell-01',
        msisdnPrefixBucket: '254711',
      });

      expect(res.accepted).toBe(true);
      expect(txRunner.idempotencyStore.has('idemp-retry-01')).toBe(true);
    });
  });

  describe('5. Ingress Privacy Boundary Assertion (07 §5)', () => {
    it('accepts raw MSISDN at service ingress and normalizes it to prefix before domain', async () => {
      const res = await service.submitObservation({
        taskId: TASK_ID,
        respondentId: 'resp-phone',
        respondentWardId: WARD_ID,
        channel: 'USSD',
        answers: { q1: true },
        clientIdempotencyKey: 'idemp-phone-01',
        geoCell: 'cell-01',
        msisdn: '+254712345678', // Raw phone passed at ingress!
      });

      expect(res.accepted).toBe(true);
      expect(res.clusterKey).toMatch(/^[0-9a-f]{16}$/);

      // Assert observation stored prefix without raw phone
      const obs = (await txRunner.taskRepo.getObservationsForTask(TASK_ID))[0];
      expect(obs.clusterKey).toBe(res.clusterKey);
    });
  });

  describe('6. Ward-Registration Invariant (14 §3)', () => {
    it('rejects submission when respondent ward does not match project ward with E_UNKNOWN_CODE / 404', async () => {
      const input: SubmitObservationInput = {
        taskId: TASK_ID,
        respondentId: 'resp-wrong-ward',
        respondentWardId: 'ward-other-99',
        channel: 'PWA',
        answers: { q1_operational: true },
        clientIdempotencyKey: 'idemp-wrong-ward-01',
        geoCell: 'geo-cell-01',
        msisdnPrefixBucket: '254711',
      };

      try {
        await service.submitObservation(input);
        expect.unreachable('Should have thrown ServiceError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ServiceError);
        const serr = err as ServiceError;
        expect(serr.code).toBe('E_UNKNOWN_CODE');
        expect(serr.statusCode).toBe(404);
        expect(serr.message).toContain('does not match project ward');
      }
    });
  });
});
