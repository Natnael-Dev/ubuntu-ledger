import { describe, it, expect } from 'vitest';
import {
  transition,
  calculateAgreement,
  type AuditSnapshot,
  type AuditEvent,
  type ClusterAnswer,
} from '@/domain/audit-lifecycle';

describe('T-08: Audit Lifecycle State Machine (04-state-machine.md §2)', () => {
  const TEST_DATE = new Date('2026-09-15T12:00:00.000Z');

  describe('1. Task creation: NOT_DISPATCHED -> TASK_DISPATCHED (TASK_CREATED)', () => {
    it('successfully creates task when project has asset and asset_type has template', () => {
      const snapshot: AuditSnapshot = {
        audit: 'NOT_DISPATCHED',
        hasAsset: true,
        hasTaskTemplate: true,
        witnessTarget: 3,
        witnessCount: 0,
        distinctClusterKeys: [],
      };

      const event: AuditEvent = {
        type: 'TASK_CREATED',
        taskId: 'task-uuid-1',
        assetId: 'asset-uuid-1',
        expiresAt: new Date('2026-09-22T12:00:00.000Z'),
        at: TEST_DATE,
      };

      const result = transition(snapshot, event);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.next).toBe('TASK_DISPATCHED');
        expect(result.effects).toContainEqual({
          kind: 'CREATE_TASK',
          taskId: 'task-uuid-1',
          assetId: 'asset-uuid-1',
          expiresAt: new Date('2026-09-22T12:00:00.000Z').toISOString(),
        });
        expect(result.effects).toContainEqual({
          kind: 'ENQUEUE_OUTBOX',
          templateKey: 'TASK_DISPATCHED_NOTIFICATION',
          recipientId: 'WARD_MONITORS',
        });
        expect(result.effects).toContainEqual({
          kind: 'AUDIT',
          action: 'AUDIT_STATE_CHANGED',
          payload: {
            from: 'NOT_DISPATCHED',
            to: 'TASK_DISPATCHED',
            taskId: 'task-uuid-1',
            assetId: 'asset-uuid-1',
            at: TEST_DATE.toISOString(),
          },
        });
      }
    });

    it('rejects task creation when project has no assets', () => {
      const snapshot: AuditSnapshot = {
        audit: 'NOT_DISPATCHED',
        hasAsset: false,
        hasTaskTemplate: true,
        witnessTarget: 3,
        witnessCount: 0,
        distinctClusterKeys: [],
      };

      const event: AuditEvent = {
        type: 'TASK_CREATED',
        taskId: 'task-uuid-1',
        assetId: 'asset-uuid-1',
        expiresAt: new Date('2026-09-22T12:00:00.000Z'),
        at: TEST_DATE,
      };

      const result = transition(snapshot, event);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('E_GUARD_FAILED');
        expect(result.effects).toEqual([]);
      }
    });

    it('rejects task creation when asset_type has no task template', () => {
      const snapshot: AuditSnapshot = {
        audit: 'NOT_DISPATCHED',
        hasAsset: true,
        hasTaskTemplate: false,
        witnessTarget: 3,
        witnessCount: 0,
        distinctClusterKeys: [],
      };

      const event: AuditEvent = {
        type: 'TASK_CREATED',
        taskId: 'task-uuid-1',
        assetId: 'asset-uuid-1',
        expiresAt: new Date('2026-09-22T12:00:00.000Z'),
        at: TEST_DATE,
      };

      const result = transition(snapshot, event);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('E_GUARD_FAILED');
        expect(result.effects).toEqual([]);
      }
    });
  });

  describe('2. First observation: TASK_DISPATCHED -> AWAITING_THRESHOLD (FIRST_OBSERVATION)', () => {
    it('transitions to AWAITING_THRESHOLD on first observation with weight = 1', () => {
      const snapshot: AuditSnapshot = {
        audit: 'TASK_DISPATCHED',
        hasAsset: true,
        hasTaskTemplate: true,
        witnessTarget: 3,
        witnessCount: 0,
        distinctClusterKeys: [],
      };

      const event: AuditEvent = {
        type: 'FIRST_OBSERVATION',
        clusterKey: 'cluster-alpha',
        weight: 1,
        at: TEST_DATE,
      };

      const result = transition(snapshot, event);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.next).toBe('AWAITING_THRESHOLD');
        expect(result.effects).toContainEqual({
          kind: 'RECOMPUTE_WITNESS_COUNT',
          witnessCount: 1,
          clusterKey: 'cluster-alpha',
        });
        expect(result.effects).toContainEqual({
          kind: 'AUDIT',
          action: 'AUDIT_STATE_CHANGED',
          payload: {
            from: 'TASK_DISPATCHED',
            to: 'AWAITING_THRESHOLD',
            clusterKey: 'cluster-alpha',
            witnessCount: 1,
            at: TEST_DATE.toISOString(),
          },
        });
      }
    });

    it('rejects FIRST_OBSERVATION if weight is not 1 (e.g. weight = 0)', () => {
      const snapshot: AuditSnapshot = {
        audit: 'TASK_DISPATCHED',
        hasAsset: true,
        hasTaskTemplate: true,
        witnessTarget: 3,
        witnessCount: 0,
        distinctClusterKeys: [],
      };

      const event: AuditEvent = {
        type: 'FIRST_OBSERVATION',
        clusterKey: 'cluster-alpha',
        weight: 0,
        at: TEST_DATE,
      };

      const result = transition(snapshot, event);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('E_GUARD_FAILED');
        expect(result.effects).toEqual([]);
      }
    });
  });

  describe('3. Consistent threshold: AWAITING_THRESHOLD -> PHYSICALLY_CONFIRMED (THRESHOLD_MET_CONSISTENT)', () => {
    it('transitions to PHYSICALLY_CONFIRMED when distinct clusters >= target and agreement >= 2/3 on all questions', () => {
      const snapshot: AuditSnapshot = {
        audit: 'AWAITING_THRESHOLD',
        hasAsset: true,
        hasTaskTemplate: true,
        witnessTarget: 3,
        witnessCount: 2,
        distinctClusterKeys: ['c1', 'c2'],
      };

      // 3 distinct clusters, all answering yes to q1 and no to q2 (100% agreement on both)
      const clusterAnswers: ClusterAnswer[] = [
        { clusterKey: 'c1', answers: { q1: true, q2: false } },
        { clusterKey: 'c2', answers: { q1: true, q2: false } },
        { clusterKey: 'c3', answers: { q1: true, q2: false } },
      ];

      const event: AuditEvent = {
        type: 'THRESHOLD_MET_CONSISTENT',
        clusterAnswers,
        at: TEST_DATE,
      };

      const result = transition(snapshot, event);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.next).toBe('PHYSICALLY_CONFIRMED');
        expect(result.effects).toContainEqual({
          kind: 'NOTIFY_MODERATOR',
          action: 'PHYSICAL_CONFIRMATION_ACHIEVED',
        });
        expect(result.effects).toContainEqual({
          kind: 'MARK_BULLETIN_ELIGIBLE',
        });
        expect(result.effects).toContainEqual(
          expect.objectContaining({
            kind: 'AUDIT',
            action: 'AUDIT_STATE_CHANGED',
          })
        );
      }
    });

    it('rejects THRESHOLD_MET_CONSISTENT if distinct cluster target is unmet', () => {
      const snapshot: AuditSnapshot = {
        audit: 'AWAITING_THRESHOLD',
        hasAsset: true,
        hasTaskTemplate: true,
        witnessTarget: 3,
        witnessCount: 1,
        distinctClusterKeys: ['c1'],
      };

      // Only 2 distinct clusters
      const clusterAnswers: ClusterAnswer[] = [
        { clusterKey: 'c1', answers: { q1: true } },
        { clusterKey: 'c2', answers: { q1: true } },
      ];

      const event: AuditEvent = {
        type: 'THRESHOLD_MET_CONSISTENT',
        clusterAnswers,
        at: TEST_DATE,
      };

      const result = transition(snapshot, event);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('E_GUARD_FAILED');
        expect(result.effects).toEqual([]);
      }
    });

    it('rejects THRESHOLD_MET_CONSISTENT if answer agreement is below 2/3 on any question', () => {
      const snapshot: AuditSnapshot = {
        audit: 'AWAITING_THRESHOLD',
        hasAsset: true,
        hasTaskTemplate: true,
        witnessTarget: 3,
        witnessCount: 2,
        distinctClusterKeys: ['c1', 'c2'],
      };

      // 4 clusters answering q1 with 2 yes / 2 no (agreement = 50% < 66.7%)
      const clusterAnswers: ClusterAnswer[] = [
        { clusterKey: 'c1', answers: { q1: true } },
        { clusterKey: 'c2', answers: { q1: true } },
        { clusterKey: 'c3', answers: { q1: false } },
        { clusterKey: 'c4', answers: { q1: false } },
      ];

      const event: AuditEvent = {
        type: 'THRESHOLD_MET_CONSISTENT',
        clusterAnswers,
        at: TEST_DATE,
      };

      const result = transition(snapshot, event);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('E_GUARD_FAILED');
        expect(result.effects).toEqual([]);
      }
    });
  });

  describe('4. Conflicting threshold: AWAITING_THRESHOLD -> DISCREPANCY_FLAGGED (THRESHOLD_MET_CONFLICTING)', () => {
    it('transitions to DISCREPANCY_FLAGGED when witness target met but agreement < 2/3 on a question', () => {
      const snapshot: AuditSnapshot = {
        audit: 'AWAITING_THRESHOLD',
        hasAsset: true,
        hasTaskTemplate: true,
        witnessTarget: 4,
        witnessCount: 3,
        distinctClusterKeys: ['c1', 'c2', 'c3'],
      };

      // 4 distinct clusters: 2 yes, 2 no on q1 (agreement = 50% < 2/3)
      const clusterAnswers: ClusterAnswer[] = [
        { clusterKey: 'c1', answers: { q1: true } },
        { clusterKey: 'c2', answers: { q1: true } },
        { clusterKey: 'c3', answers: { q1: false } },
        { clusterKey: 'c4', answers: { q1: false } },
      ];

      const event: AuditEvent = {
        type: 'THRESHOLD_MET_CONFLICTING',
        clusterAnswers,
        at: TEST_DATE,
      };

      const result = transition(snapshot, event);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.next).toBe('DISCREPANCY_FLAGGED');
        expect(result.effects).toContainEqual({
          kind: 'ENQUEUE_MODERATOR',
          queue: 'DISCREPANCY_REVIEW',
        });
        // INV-10: Pause probation clock
        expect(result.effects).toContainEqual({
          kind: 'PAUSE_PROBATION_CLOCK',
        });
        expect(result.effects).toContainEqual(
          expect.objectContaining({
            kind: 'AUDIT',
            action: 'AUDIT_STATE_CHANGED',
          })
        );
      }
    });

    it('rejects THRESHOLD_MET_CONFLICTING if answers are actually consistent', () => {
      const snapshot: AuditSnapshot = {
        audit: 'AWAITING_THRESHOLD',
        hasAsset: true,
        hasTaskTemplate: true,
        witnessTarget: 3,
        witnessCount: 2,
        distinctClusterKeys: ['c1', 'c2'],
      };

      // 3 distinct clusters: all yes (agreement = 100% >= 2/3)
      const clusterAnswers: ClusterAnswer[] = [
        { clusterKey: 'c1', answers: { q1: true } },
        { clusterKey: 'c2', answers: { q1: true } },
        { clusterKey: 'c3', answers: { q1: true } },
      ];

      const event: AuditEvent = {
        type: 'THRESHOLD_MET_CONFLICTING',
        clusterAnswers,
        at: TEST_DATE,
      };

      const result = transition(snapshot, event);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('E_GUARD_FAILED');
        expect(result.effects).toEqual([]);
      }
    });
  });

  describe('5. Contradiction of official claim: AWAITING_THRESHOLD -> DISCREPANCY_FLAGGED', () => {
    it('transitions to DISCREPANCY_FLAGGED when >= 2 distinct clusters contradict official claim', () => {
      const snapshot: AuditSnapshot = {
        audit: 'AWAITING_THRESHOLD',
        hasAsset: true,
        hasTaskTemplate: true,
        witnessTarget: 3,
        witnessCount: 2,
        distinctClusterKeys: ['c1', 'c2'],
      };

      const event: AuditEvent = {
        type: 'CONTRADICTS_OFFICIAL_CLAIM',
        contradictingClustersCount: 2,
        at: TEST_DATE,
      };

      const result = transition(snapshot, event);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.next).toBe('DISCREPANCY_FLAGGED');
        expect(result.effects).toContainEqual({
          kind: 'OPEN_RESPONSE_WINDOW',
          durationHours: 72,
        });
        expect(result.effects).toContainEqual({
          kind: 'PAUSE_PROBATION_CLOCK',
        });
      }
    });

    it('rejects CONTRADICTS_OFFICIAL_CLAIM if fewer than 2 distinct clusters contradict', () => {
      const snapshot: AuditSnapshot = {
        audit: 'AWAITING_THRESHOLD',
        hasAsset: true,
        hasTaskTemplate: true,
        witnessTarget: 3,
        witnessCount: 1,
        distinctClusterKeys: ['c1'],
      };

      const event: AuditEvent = {
        type: 'CONTRADICTS_OFFICIAL_CLAIM',
        contradictingClustersCount: 1,
        at: TEST_DATE,
      };

      const result = transition(snapshot, event);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('E_GUARD_FAILED');
        expect(result.effects).toEqual([]);
      }
    });
  });

  describe('6. Late contradiction: PHYSICALLY_CONFIRMED -> DISCREPANCY_FLAGGED', () => {
    it('transitions to DISCREPANCY_FLAGGED when >= 2 clusters contradict within 30 days', () => {
      const confirmedAt = new Date('2026-09-01T10:00:00.000Z');
      const snapshot: AuditSnapshot = {
        audit: 'PHYSICALLY_CONFIRMED',
        hasAsset: true,
        hasTaskTemplate: true,
        witnessTarget: 3,
        witnessCount: 3,
        distinctClusterKeys: ['c1', 'c2', 'c3'],
        confirmedAt,
      };

      // 14 days later (within 30 days)
      const eventDate = new Date('2026-09-15T10:00:00.000Z');
      const event: AuditEvent = {
        type: 'LATE_CONTRADICTION',
        contradictingClustersCount: 2,
        at: eventDate,
      };

      const result = transition(snapshot, event);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.next).toBe('DISCREPANCY_FLAGGED');
        expect(result.effects).toContainEqual({
          kind: 'QUEUE_BULLETIN_CORRECTION',
        });
        expect(result.effects).toContainEqual({
          kind: 'PAUSE_PROBATION_CLOCK',
        });
      }
    });

    it('rejects LATE_CONTRADICTION when outside 30 days (e.g. 31 days)', () => {
      const confirmedAt = new Date('2026-08-01T10:00:00.000Z');
      const snapshot: AuditSnapshot = {
        audit: 'PHYSICALLY_CONFIRMED',
        hasAsset: true,
        hasTaskTemplate: true,
        witnessTarget: 3,
        witnessCount: 3,
        distinctClusterKeys: ['c1', 'c2', 'c3'],
        confirmedAt,
      };

      // 45 days later (outside 30 days)
      const eventDate = new Date('2026-09-15T10:00:00.000Z');
      const event: AuditEvent = {
        type: 'LATE_CONTRADICTION',
        contradictingClustersCount: 2,
        at: eventDate,
      };

      const result = transition(snapshot, event);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('E_GUARD_FAILED');
        expect(result.effects).toEqual([]);
      }
    });
  });

  describe('7. Task expiration: AWAITING_THRESHOLD -> AWAITING_THRESHOLD (TASK_EXPIRED)', () => {
    it('keeps state unchanged in AWAITING_THRESHOLD when task expires without meeting threshold', () => {
      const expiresAt = new Date('2026-09-14T10:00:00.000Z');
      const snapshot: AuditSnapshot = {
        audit: 'AWAITING_THRESHOLD',
        hasAsset: true,
        hasTaskTemplate: true,
        witnessTarget: 3,
        witnessCount: 1,
        distinctClusterKeys: ['c1'],
        expiresAt,
      };

      const event: AuditEvent = {
        type: 'TASK_EXPIRED',
        at: TEST_DATE, // 2026-09-15 > 2026-09-14
      };

      const result = transition(snapshot, event);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // STATE REMAINS EXACTLY AWAITING_THRESHOLD
        expect(result.next).toBe('AWAITING_THRESHOLD');
        expect(result.effects).toContainEqual({
          kind: 'CLOSE_TASK',
        });
        expect(result.effects).toContainEqual({
          kind: 'AUDIT',
          action: 'TASK_EXPIRED',
          payload: {
            state: 'AWAITING_THRESHOLD',
            witnessCount: 1,
            witnessTarget: 3,
            at: TEST_DATE.toISOString(),
          },
        });
      }
    });

    it('rejects TASK_EXPIRED if task expiration date has not elapsed', () => {
      const expiresAt = new Date('2026-09-20T10:00:00.000Z');
      const snapshot: AuditSnapshot = {
        audit: 'AWAITING_THRESHOLD',
        hasAsset: true,
        hasTaskTemplate: true,
        witnessTarget: 3,
        witnessCount: 1,
        distinctClusterKeys: ['c1'],
        expiresAt,
      };

      const event: AuditEvent = {
        type: 'TASK_EXPIRED',
        at: TEST_DATE, // 2026-09-15 < 2026-09-20
      };

      const result = transition(snapshot, event);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('E_GUARD_FAILED');
        expect(result.effects).toEqual([]);
      }
    });
  });

  describe('8. Duplicate observation: ANY STATE -> SAME STATE (DUPLICATE_OBSERVATION)', () => {
    it('leaves state unchanged on duplicate observation and emits OBSERVATION_SUPPRESSED with weight = 0', () => {
      const states: AuditSnapshot['audit'][] = [
        'TASK_DISPATCHED',
        'AWAITING_THRESHOLD',
        'PHYSICALLY_CONFIRMED',
        'DISCREPANCY_FLAGGED',
      ];

      for (const audit of states) {
        const snapshot: AuditSnapshot = {
          audit,
          hasAsset: true,
          hasTaskTemplate: true,
          witnessTarget: 3,
          witnessCount: 1,
          distinctClusterKeys: ['cluster-repeat'],
        };

        const event: AuditEvent = {
          type: 'DUPLICATE_OBSERVATION',
          clusterKey: 'cluster-repeat',
          at: TEST_DATE,
        };

        const result = transition(snapshot, event);

        expect(result.ok).toBe(true);
        if (result.ok) {
          // State is strictly unchanged
          expect(result.next).toBe(audit);
          expect(result.effects).toEqual([
            {
              kind: 'AUDIT',
              action: 'OBSERVATION_SUPPRESSED',
              payload: {
                clusterKey: 'cluster-repeat',
                weight: 0,
                currentState: audit,
                at: TEST_DATE.toISOString(),
              },
            },
          ]);
        }
      }
    });

    it('rejects DUPLICATE_OBSERVATION if the clusterKey is not actually a duplicate', () => {
      const snapshot: AuditSnapshot = {
        audit: 'AWAITING_THRESHOLD',
        hasAsset: true,
        hasTaskTemplate: true,
        witnessTarget: 3,
        witnessCount: 1,
        distinctClusterKeys: ['existing-cluster'],
      };

      const event: AuditEvent = {
        type: 'DUPLICATE_OBSERVATION',
        clusterKey: 'new-cluster',
        at: TEST_DATE,
      };

      const result = transition(snapshot, event);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('E_GUARD_FAILED');
        expect(result.effects).toEqual([]);
      }
    });
  });

  describe('9. Invariant Assertions: INV-02, INV-03, INV-05, INV-10', () => {
    it('INV-02: Sybil suppression - duplicate cluster submissions do not increment witness count', () => {
      // 10 submissions from the exact same cluster
      const repeatedClusterAnswers: ClusterAnswer[] = Array.from({ length: 10 }, () => ({
        clusterKey: 'same-cluster',
        answers: { q1: true },
      }));

      const agreement = calculateAgreement(repeatedClusterAnswers);
      // Distinct clusters must be exactly 1!
      expect(agreement.distinctClusterCount).toBe(1);
    });

    it('INV-03: Every successful state change emits exactly one AUDIT state-change descriptor', () => {
      const snapshot: AuditSnapshot = {
        audit: 'NOT_DISPATCHED',
        hasAsset: true,
        hasTaskTemplate: true,
        witnessTarget: 3,
        witnessCount: 0,
        distinctClusterKeys: [],
      };

      const result = transition(snapshot, {
        type: 'TASK_CREATED',
        taskId: 'task-1',
        assetId: 'asset-1',
        expiresAt: new Date('2026-09-30T00:00:00Z'),
        at: TEST_DATE,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const auditEffects = result.effects.filter(
          (e) => e.kind === 'AUDIT' && e.action === 'AUDIT_STATE_CHANGED'
        );
        expect(auditEffects.length).toBe(1);
      }
    });

    it('INV-05: Illegal transitions produce typed errors and empty effects array', () => {
      // Illegal jump: NOT_DISPATCHED -> THRESHOLD_MET_CONSISTENT
      const snapshot: AuditSnapshot = {
        audit: 'NOT_DISPATCHED',
        hasAsset: true,
        hasTaskTemplate: true,
        witnessTarget: 3,
        witnessCount: 0,
        distinctClusterKeys: [],
      };

      const result = transition(snapshot, {
        type: 'THRESHOLD_MET_CONSISTENT',
        clusterAnswers: [{ clusterKey: 'c1', answers: { q1: true } }],
        at: TEST_DATE,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('E_ILLEGAL_TRANSITION');
        expect(result.effects).toEqual([]);
      }
    });

    it('INV-10: All transitions to DISCREPANCY_FLAGGED emit PAUSE_PROBATION_CLOCK', () => {
      // 1. Conflicting threshold
      const s1: AuditSnapshot = {
        audit: 'AWAITING_THRESHOLD',
        hasAsset: true,
        hasTaskTemplate: true,
        witnessTarget: 3,
        witnessCount: 3,
        distinctClusterKeys: ['c1', 'c2', 'c3'],
      };
      const r1 = transition(s1, {
        type: 'THRESHOLD_MET_CONFLICTING',
        clusterAnswers: [
          { clusterKey: 'c1', answers: { q1: true } },
          { clusterKey: 'c2', answers: { q1: false } },
          { clusterKey: 'c3', answers: { q1: false } },
          { clusterKey: 'c4', answers: { q1: true } },
        ],
        at: TEST_DATE,
      });
      expect(r1.ok).toBe(true);
      if (r1.ok) {
        expect(r1.effects).toContainEqual({ kind: 'PAUSE_PROBATION_CLOCK' });
      }

      // 2. Contradicts official claim
      const s2: AuditSnapshot = {
        audit: 'AWAITING_THRESHOLD',
        hasAsset: true,
        hasTaskTemplate: true,
        witnessTarget: 3,
        witnessCount: 2,
        distinctClusterKeys: ['c1', 'c2'],
      };
      const r2 = transition(s2, {
        type: 'CONTRADICTS_OFFICIAL_CLAIM',
        contradictingClustersCount: 2,
        at: TEST_DATE,
      });
      expect(r2.ok).toBe(true);
      if (r2.ok) {
        expect(r2.effects).toContainEqual({ kind: 'PAUSE_PROBATION_CLOCK' });
      }

      // 3. Late contradiction
      const s3: AuditSnapshot = {
        audit: 'PHYSICALLY_CONFIRMED',
        hasAsset: true,
        hasTaskTemplate: true,
        witnessTarget: 3,
        witnessCount: 3,
        distinctClusterKeys: ['c1', 'c2', 'c3'],
        confirmedAt: new Date('2026-09-01T00:00:00Z'),
      };
      const r3 = transition(s3, {
        type: 'LATE_CONTRADICTION',
        contradictingClustersCount: 2,
        at: new Date('2026-09-10T00:00:00Z'),
      });
      expect(r3.ok).toBe(true);
      if (r3.ok) {
        expect(r3.effects).toContainEqual({ kind: 'PAUSE_PROBATION_CLOCK' });
      }
    });
  });

  describe('10. Agreement calculation pure function: calculateAgreement', () => {
    it('calculates 100% agreement when all clusters agree', () => {
      const answers: ClusterAnswer[] = [
        { clusterKey: 'c1', answers: { q1: true, q2: false } },
        { clusterKey: 'c2', answers: { q1: true, q2: false } },
        { clusterKey: 'c3', answers: { q1: true, q2: false } },
      ];

      const res = calculateAgreement(answers);
      expect(res.isConsistent).toBe(true);
      expect(res.minAgreement).toBe(1.0);
      expect(res.distinctClusterCount).toBe(3);
    });

    it('calculates 66.7% agreement (2/3) as meeting consistency threshold', () => {
      const answers: ClusterAnswer[] = [
        { clusterKey: 'c1', answers: { q1: true } },
        { clusterKey: 'c2', answers: { q1: true } },
        { clusterKey: 'c3', answers: { q1: false } },
      ];

      const res = calculateAgreement(answers);
      // 2/3 agreement meets the >= 2/3 requirement
      expect(res.isConsistent).toBe(true);
      expect(res.minAgreement).toBeCloseTo(2 / 3, 4);
    });

    it('calculates 50% agreement (below 2/3) as inconsistent', () => {
      const answers: ClusterAnswer[] = [
        { clusterKey: 'c1', answers: { q1: true } },
        { clusterKey: 'c2', answers: { q1: true } },
        { clusterKey: 'c3', answers: { q1: false } },
        { clusterKey: 'c4', answers: { q1: false } },
      ];

      const res = calculateAgreement(answers);
      expect(res.isConsistent).toBe(false);
      expect(res.minAgreement).toBe(0.5);
    });
  });
});
