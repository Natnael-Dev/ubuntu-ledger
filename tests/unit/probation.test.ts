import { describe, it, expect } from 'vitest';
import {
  transition,
  type ProbationSnapshot,
  type ProbationEvent,
} from '@/domain/probation';
import type { ActorRole } from '@/domain/types';

describe('T-09: Probation Lifecycle State Machine (04-state-machine.md §3)', () => {
  const BASE_TIME = new Date('2026-09-15T09:00:00.000Z');

  function makeEmptySnapshot(overrides?: Partial<ProbationSnapshot>): ProbationSnapshot {
    return {
      ticketId: 'ticket-uuid-001',
      assetId: 'asset-uuid-generator',
      state: null,
      reportedBrokenAt: null,
      originalReporterClusters: [],
      repairClaimedAt: null,
      claimedBy: null,
      probationStartedAt: null,
      probationEndsAt: null,
      probationDays: 7,
      extensionCount: 0,
      maxExtensions: 2,
      isPaused: false,
      pausedAt: null,
      accumulatedPauseMs: 0,
      confirmations: [],
      failures: [],
      failureCount: 0,
      resolvedAt: null,
      failureReasonKey: null,
      ...overrides,
    };
  }

  describe('1. Breakage reported: — -> REPORTED_BROKEN', () => {
    it('initializes a new repair ticket with original reporter cluster set', () => {
      const current = makeEmptySnapshot();
      const event: ProbationEvent = {
        type: 'BREAKAGE_REPORTED',
        ticketId: 'ticket-uuid-001',
        assetId: 'asset-uuid-generator',
        reporterClusterKey: 'cluster-kibera-01',
        at: BASE_TIME,
      };

      const res = transition(current, event);

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.next).toBe('REPORTED_BROKEN');
        expect(res.snapshot.state).toBe('REPORTED_BROKEN');
        expect(res.snapshot.reportedBrokenAt).toEqual(BASE_TIME);
        expect(res.snapshot.originalReporterClusters).toEqual(['cluster-kibera-01']);
        expect(res.effects).toContainEqual({
          kind: 'AUDIT',
          action: 'AUDIT_STATE_CHANGED',
          payload: {
            from: null,
            to: 'REPORTED_BROKEN',
            ticketId: 'ticket-uuid-001',
            assetId: 'asset-uuid-generator',
            reporterCluster: 'cluster-kibera-01',
            at: BASE_TIME.toISOString(),
          },
        });
      }
    });

    it('rejects breakage report if active ticket already exists', () => {
      const activeStates: ProbationSnapshot['state'][] = [
        'REPORTED_BROKEN',
        'REPAIR_CLAIMED',
        'PROBATION_DAY_0',
        'PROBATION_ACTIVE',
      ];

      for (const st of activeStates) {
        const current = makeEmptySnapshot({
          state: st,
          originalReporterClusters: ['c1'],
        });
        const res = transition(current, {
          type: 'BREAKAGE_REPORTED',
          ticketId: 'ticket-uuid-002',
          assetId: 'asset-uuid-generator',
          reporterClusterKey: 'c2',
          at: BASE_TIME,
        });

        expect(res.ok).toBe(false);
        if (!res.ok) {
          expect(res.code).toBe('E_ALREADY_INITIALIZED');
          expect(res.effects).toEqual([]);
        }
      }
    });

    it('rejects breakage report if reporter cluster key is empty', () => {
      const current = makeEmptySnapshot();
      const res = transition(current, {
        type: 'BREAKAGE_REPORTED',
        ticketId: 't-1',
        assetId: 'a-1',
        reporterClusterKey: '',
        at: BASE_TIME,
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe('E_GUARD_FAILED');
        expect(res.effects).toEqual([]);
      }
    });
  });

  describe('2. Repair claimed: REPORTED_BROKEN -> REPAIR_CLAIMED', () => {
    it('transitions to REPAIR_CLAIMED when organisation claim is recorded', () => {
      const current = makeEmptySnapshot({
        state: 'REPORTED_BROKEN',
        originalReporterClusters: ['c1'],
      });

      const event: ProbationEvent = {
        type: 'REPAIR_CLAIMED',
        claimedBy: 'Nairobi Water & Sewerage Co.',
        at: BASE_TIME,
      };

      const res = transition(current, event);

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.next).toBe('REPAIR_CLAIMED');
        expect(res.snapshot.claimedBy).toBe('Nairobi Water & Sewerage Co.');
        expect(res.snapshot.repairClaimedAt).toEqual(BASE_TIME);
        expect(res.effects).toContainEqual({
          kind: 'AUDIT',
          action: 'AUDIT_STATE_CHANGED',
          payload: {
            from: 'REPORTED_BROKEN',
            to: 'REPAIR_CLAIMED',
            ticketId: current.ticketId,
            claimedBy: 'Nairobi Water & Sewerage Co.',
            at: BASE_TIME.toISOString(),
          },
        });
      }
    });

    it('rejects consecutive claims in a row (already in REPAIR_CLAIMED)', () => {
      const current = makeEmptySnapshot({
        state: 'REPAIR_CLAIMED',
        claimedBy: 'First Contractor Ltd',
        originalReporterClusters: ['c1'],
      });

      const res = transition(current, {
        type: 'REPAIR_CLAIMED',
        claimedBy: 'Second Contractor Ltd',
        at: BASE_TIME,
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe('E_ILLEGAL_TRANSITION');
        expect(res.effects).toEqual([]);
      }
    });

    it('rejects claim without valid organisation name', () => {
      const current = makeEmptySnapshot({
        state: 'REPORTED_BROKEN',
        originalReporterClusters: ['c1'],
      });

      const res = transition(current, {
        type: 'REPAIR_CLAIMED',
        claimedBy: '   ',
        at: BASE_TIME,
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe('E_GUARD_FAILED');
        expect(res.effects).toEqual([]);
      }
    });
  });

  describe('3. Initial function confirmation: REPAIR_CLAIMED -> PROBATION_DAY_0', () => {
    it('schedules Day 3 and Day 7 pings and computes probation window', () => {
      const current = makeEmptySnapshot({
        state: 'REPAIR_CLAIMED',
        claimedBy: 'Solar Solutions EA',
        originalReporterClusters: ['cluster-orig-1'],
        probationDays: 7,
      });

      const event: ProbationEvent = {
        type: 'INITIAL_FUNCTION_CONFIRMED',
        clusterKey: 'cluster-verifier-1',
        at: BASE_TIME,
      };

      const res = transition(current, event);

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.next).toBe('PROBATION_DAY_0');
        expect(res.snapshot.probationStartedAt).toEqual(BASE_TIME);

        // 7 days * 24 * 60 * 60 * 1000 = 604,800,000 ms
        const expectedEndsAt = new Date(BASE_TIME.getTime() + 7 * 24 * 60 * 60 * 1000);
        expect(res.snapshot.probationEndsAt).toEqual(expectedEndsAt);

        // Verify scheduled pings to original reporter cluster
        expect(res.effects).toContainEqual({
          kind: 'SCHEDULE_PING',
          pingDay: 3,
          ticketId: current.ticketId,
          clusterKey: 'cluster-orig-1',
        });
        expect(res.effects).toContainEqual({
          kind: 'SCHEDULE_PING',
          pingDay: 7,
          ticketId: current.ticketId,
          clusterKey: 'cluster-orig-1',
        });
      }
    });
  });

  describe('4. Clock advanced: PROBATION_DAY_0 -> PROBATION_ACTIVE', () => {
    it('advances to PROBATION_ACTIVE once now > probation_started_at', () => {
      const current = makeEmptySnapshot({
        state: 'PROBATION_DAY_0',
        probationStartedAt: BASE_TIME,
        probationEndsAt: new Date(BASE_TIME.getTime() + 7 * 24 * 60 * 60 * 1000),
        originalReporterClusters: ['c1'],
      });

      // 1 minute after start
      const advancedTime = new Date(BASE_TIME.getTime() + 60 * 1000);
      const res = transition(current, {
        type: 'CLOCK_ADVANCED',
        at: advancedTime,
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.next).toBe('PROBATION_ACTIVE');
        expect(res.snapshot.state).toBe('PROBATION_ACTIVE');
      }
    });

    it('rejects clock advancement if now <= probation_started_at', () => {
      const current = makeEmptySnapshot({
        state: 'PROBATION_DAY_0',
        probationStartedAt: BASE_TIME,
        originalReporterClusters: ['c1'],
      });

      const res = transition(current, {
        type: 'CLOCK_ADVANCED',
        at: BASE_TIME,
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe('E_GUARD_FAILED');
        expect(res.effects).toEqual([]);
      }
    });
  });

  describe('5. Failure reported: PROBATION_ACTIVE -> PROBATION_FAILED', () => {
    it('immediately moves to PROBATION_FAILED and increments failure count', () => {
      const current = makeEmptySnapshot({
        state: 'PROBATION_ACTIVE',
        claimedBy: 'Apex Generators',
        failureCount: 0,
        originalReporterClusters: ['c1'],
      });

      const failTime = new Date(BASE_TIME.getTime() + 2 * 24 * 60 * 60 * 1000); // Day 2
      const event: ProbationEvent = {
        type: 'FAILURE_REPORTED',
        clusterKey: 'c1',
        reasonKey: 'water_leak_detected',
        at: failTime,
      };

      const res = transition(current, event);

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.next).toBe('PROBATION_FAILED');
        expect(res.snapshot.failureCount).toBe(1);
        expect(res.snapshot.failureReasonKey).toBe('water_leak_detected');
        expect(res.effects).toContainEqual({
          kind: 'INCREMENT_FAILURE_COUNT',
          claimingOrg: 'Apex Generators',
        });
        expect(res.effects).toContainEqual({
          kind: 'QUEUE_BULLETIN_FACT',
          reason: 'water_leak_detected',
          ticketId: current.ticketId,
          assetId: current.assetId,
        });
      }
    });
  });

  describe('6. Sustained verification: PROBATION_ACTIVE -> VERIFIED_SUSTAINED', () => {
    it('verifies sustained repair when now >= probation_ends_at with >=2 distinct original cluster confirmations', () => {
      const endsAt = new Date(BASE_TIME.getTime() + 7 * 24 * 60 * 60 * 1000);
      const current = makeEmptySnapshot({
        state: 'PROBATION_ACTIVE',
        originalReporterClusters: ['orig-c1', 'orig-c2'],
        probationStartedAt: BASE_TIME,
        probationEndsAt: endsAt,
        isPaused: false,
        failures: [],
      });

      // Confirmations dated exactly at / after endsAt
      const event: ProbationEvent = {
        type: 'PROBATION_WINDOW_CLOSED',
        confirmations: [
          { clusterKey: 'orig-c1', confirmedAt: endsAt },
          { clusterKey: 'orig-c2', confirmedAt: new Date(endsAt.getTime() + 1000) },
        ],
        at: endsAt,
      };

      const res = transition(current, event);

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.next).toBe('VERIFIED_SUSTAINED');
        expect(res.snapshot.resolvedAt).toEqual(endsAt);
        expect(res.effects).toContainEqual({ kind: 'MARK_BULLETIN_ELIGIBLE' });
        expect(res.effects).toContainEqual(
          expect.objectContaining({
            kind: 'AUDIT',
            action: 'AUDIT_STATE_CHANGED',
          })
        );
      }
    });

    it('rejects VERIFIED_SUSTAINED if confirmations are from non-original clusters', () => {
      const endsAt = new Date(BASE_TIME.getTime() + 7 * 24 * 60 * 60 * 1000);
      const current = makeEmptySnapshot({
        state: 'PROBATION_ACTIVE',
        originalReporterClusters: ['orig-c1', 'orig-c2'],
        probationEndsAt: endsAt,
        isPaused: false,
      });

      // Confirmations from foreign clusters (Sybil attempt)
      const event: ProbationEvent = {
        type: 'PROBATION_WINDOW_CLOSED',
        confirmations: [
          { clusterKey: 'foreign-c1', confirmedAt: endsAt },
          { clusterKey: 'foreign-c2', confirmedAt: endsAt },
        ],
        at: endsAt,
      };

      const res = transition(current, event);

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe('E_GUARD_FAILED');
        expect(res.effects).toEqual([]);
      }
    });

    it('rejects VERIFIED_SUSTAINED if unresolved failures exist', () => {
      const endsAt = new Date(BASE_TIME.getTime() + 7 * 24 * 60 * 60 * 1000);
      const current = makeEmptySnapshot({
        state: 'PROBATION_ACTIVE',
        originalReporterClusters: ['orig-c1', 'orig-c2'],
        probationEndsAt: endsAt,
        isPaused: false,
        failures: [
          {
            clusterKey: 'orig-c1',
            reasonKey: 'noisy_engine',
            reportedAt: new Date(BASE_TIME.getTime() + 2000),
            resolved: false,
          },
        ],
      });

      const event: ProbationEvent = {
        type: 'PROBATION_WINDOW_CLOSED',
        confirmations: [
          { clusterKey: 'orig-c1', confirmedAt: endsAt },
          { clusterKey: 'orig-c2', confirmedAt: endsAt },
        ],
        at: endsAt,
      };

      const res = transition(current, event);

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe('E_GUARD_FAILED');
        expect(res.effects).toEqual([]);
      }
    });
  });

  describe('7. INV-01: No VERIFIED_SUSTAINED before probation_ends_at under ANY actor role', () => {
    const roles: ActorRole[] = [
      'CITIZEN',
      'MONITOR',
      'MODERATOR',
      'INGEST_REVIEWER',
      'ADMIN',
      'SYSTEM',
    ];

    it.each(roles)('rejects early closure for role %s', (actor) => {
      const endsAt = new Date(BASE_TIME.getTime() + 7 * 24 * 60 * 60 * 1000);
      // Day 3 (early)
      const earlyTime = new Date(BASE_TIME.getTime() + 3 * 24 * 60 * 60 * 1000);

      const current = makeEmptySnapshot({
        state: 'PROBATION_ACTIVE',
        originalReporterClusters: ['orig-c1', 'orig-c2'],
        probationEndsAt: endsAt,
        isPaused: false,
      });

      const event: ProbationEvent = {
        type: 'PROBATION_WINDOW_CLOSED',
        actor,
        confirmations: [
          { clusterKey: 'orig-c1', confirmedAt: earlyTime },
          { clusterKey: 'orig-c2', confirmedAt: earlyTime },
        ],
        at: earlyTime,
      };

      const res = transition(current, event);

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe('E_PROBATION_LOCKED');
        expect(res.effects).toEqual([]);
      }
    });
  });

  describe('8. Manual close attempt: MANUAL_CLOSE_ATTEMPT is ALWAYS rejected', () => {
    const roles: ActorRole[] = [
      'CITIZEN',
      'MONITOR',
      'MODERATOR',
      'INGEST_REVIEWER',
      'ADMIN',
      'SYSTEM',
    ];

    it.each(roles)('returns E_PROBATION_LOCKED for actor %s across any state', (actor) => {
      const current = makeEmptySnapshot({
        state: 'PROBATION_ACTIVE',
        probationEndsAt: new Date(BASE_TIME.getTime() + 7 * 24 * 60 * 60 * 1000),
      });

      const res = transition(current, {
        type: 'MANUAL_CLOSE_ATTEMPT',
        actor,
        at: BASE_TIME,
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe('E_PROBATION_LOCKED');
        expect(res.effects).toEqual([]);
      }
    });
  });

  describe('9. No-response window extensions and limit: WINDOW_CLOSED_NO_RESPONSE', () => {
    it('extends probation_ends_at by 3 days when extensions remain', () => {
      const endsAt = new Date(BASE_TIME.getTime() + 7 * 24 * 60 * 60 * 1000);
      const current = makeEmptySnapshot({
        state: 'PROBATION_ACTIVE',
        probationEndsAt: endsAt,
        extensionCount: 0,
        maxExtensions: 2,
        isPaused: false,
      });

      const res = transition(current, {
        type: 'WINDOW_CLOSED_NO_RESPONSE',
        at: endsAt,
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.next).toBe('PROBATION_ACTIVE');
        expect(res.snapshot.extensionCount).toBe(1);
        const expectedNewEndsAt = new Date(endsAt.getTime() + 3 * 24 * 60 * 60 * 1000);
        expect(res.snapshot.probationEndsAt).toEqual(expectedNewEndsAt);
        expect(res.effects).toContainEqual({
          kind: 'AUDIT',
          action: 'PROBATION_WINDOW_EXTENDED',
          payload: {
            ticketId: current.ticketId,
            extensionCount: 1,
            maxExtensions: 2,
            newProbationEndsAt: expectedNewEndsAt.toISOString(),
            at: endsAt.toISOString(),
          },
        });
      }
    });

    it('transitions to PROBATION_FAILED with reason "no_verification" once max extensions (2) are exhausted', () => {
      const endsAt = new Date(BASE_TIME.getTime() + 13 * 24 * 60 * 60 * 1000);
      const current = makeEmptySnapshot({
        state: 'PROBATION_ACTIVE',
        probationEndsAt: endsAt,
        extensionCount: 2, // 2 extensions already used
        maxExtensions: 2,
        claimedBy: 'Build Corp Ltd',
        failureCount: 0,
        isPaused: false,
      });

      const res = transition(current, {
        type: 'WINDOW_CLOSED_NO_RESPONSE',
        at: endsAt,
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.next).toBe('PROBATION_FAILED');
        expect(res.snapshot.failureReasonKey).toBe('no_verification');
        expect(res.snapshot.failureCount).toBe(1);
        expect(res.effects).toContainEqual({
          kind: 'INCREMENT_FAILURE_COUNT',
          claimingOrg: 'Build Corp Ltd',
        });
        expect(res.effects).toContainEqual({
          kind: 'QUEUE_BULLETIN_FACT',
          reason: 'no_verification',
          ticketId: current.ticketId,
          assetId: current.assetId,
        });
      }
    });
  });

  describe('10. Reclaim after failure: REPAIR_RECLAIMED', () => {
    it('resets probation window to full length while preserving failure history', () => {
      const current = makeEmptySnapshot({
        state: 'PROBATION_FAILED',
        claimedBy: 'Old Contractor',
        failureCount: 2,
        failures: [
          { clusterKey: 'c1', reasonKey: 'broken_belt', reportedAt: BASE_TIME },
          { clusterKey: 'c2', reasonKey: 'no_verification', reportedAt: BASE_TIME },
        ],
        failureReasonKey: 'no_verification',
      });

      const reclaimTime = new Date(BASE_TIME.getTime() + 10 * 24 * 60 * 60 * 1000);
      const res = transition(current, {
        type: 'REPAIR_RECLAIMED',
        claimedBy: 'New Contractor Ltd',
        at: reclaimTime,
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.next).toBe('REPAIR_CLAIMED');
        expect(res.snapshot.claimedBy).toBe('New Contractor Ltd');
        expect(res.snapshot.repairClaimedAt).toEqual(reclaimTime);
        // Failure count preserved!
        expect(res.snapshot.failureCount).toBe(2);
        expect(res.snapshot.failures.length).toBe(2);
        expect(res.snapshot.extensionCount).toBe(0);
        expect(res.snapshot.probationStartedAt).toBeNull();
        expect(res.snapshot.probationEndsAt).toBeNull();
      }
    });
  });

  describe('11. INV-10: Discrepancy pause/resume preserves exact remaining duration', () => {
    it('pauses probation clock and resumes shifting ends_at by exact pause duration', () => {
      const startedAt = BASE_TIME;
      const originalEndsAt = new Date(startedAt.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const current = makeEmptySnapshot({
        state: 'PROBATION_ACTIVE',
        probationStartedAt: startedAt,
        probationEndsAt: originalEndsAt,
        isPaused: false,
      });

      // Pause at Day 3 (exact 3 days elapsed, 4 days remaining = 345,600,000 ms)
      const pauseTime = new Date(startedAt.getTime() + 3 * 24 * 60 * 60 * 1000);
      const pauseRes = transition(current, {
        type: 'LINKED_DISCREPANCY_FLAGGED',
        at: pauseTime,
      });

      expect(pauseRes.ok).toBe(true);
      if (!pauseRes.ok) return;

      expect(pauseRes.snapshot.isPaused).toBe(true);
      expect(pauseRes.snapshot.pausedAt).toEqual(pauseTime);

      // Attempt to close window while paused is rejected
      const earlyAttempt = transition(pauseRes.snapshot, {
        type: 'PROBATION_WINDOW_CLOSED',
        at: originalEndsAt,
      });
      expect(earlyAttempt.ok).toBe(false);
      if (!earlyAttempt.ok) {
        expect(earlyAttempt.code).toBe('E_GUARD_FAILED');
      }

      // Resume 5 days later (paused duration = 5 days = 432,000,000 ms)
      const resumeTime = new Date(pauseTime.getTime() + 5 * 24 * 60 * 60 * 1000);
      const resumeRes = transition(pauseRes.snapshot, {
        type: 'LINKED_DISCREPANCY_RESOLVED',
        at: resumeTime,
      });

      expect(resumeRes.ok).toBe(true);
      if (resumeRes.ok) {
        expect(resumeRes.snapshot.isPaused).toBe(false);
        expect(resumeRes.snapshot.pausedAt).toBeNull();

        // New ends_at must be originalEndsAt + 5 days
        const expectedNewEndsAt = new Date(originalEndsAt.getTime() + 5 * 24 * 60 * 60 * 1000);
        expect(resumeRes.snapshot.probationEndsAt).toEqual(expectedNewEndsAt);

        // Remaining duration from resumeTime to new ends_at must equal exactly 4 days
        const remainingMs = resumeRes.snapshot.probationEndsAt!.getTime() - resumeTime.getTime();
        const expectedRemainingMs = 4 * 24 * 60 * 60 * 1000;
        expect(remainingMs).toBe(expectedRemainingMs);
      }
    });
  });

  describe('12. DST-boundary test: absolute epoch arithmetic', () => {
    it('preserves exact elapsed millisecond duration across Daylight Saving Time transitions', () => {
      // European DST shift: Spring forward on last Sunday of March (e.g. March 29, 2026)
      const dstStartDate = new Date('2026-03-25T10:00:00.000Z');
      const current = makeEmptySnapshot({
        state: 'REPAIR_CLAIMED',
        claimedBy: 'Clean Power Africa',
        probationDays: 7,
      });

      const res = transition(current, {
        type: 'INITIAL_FUNCTION_CONFIRMED',
        clusterKey: 'c-dst',
        at: dstStartDate,
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        const expectedMs = dstStartDate.getTime() + 7 * 24 * 60 * 60 * 1000;
        expect(res.snapshot.probationEndsAt!.getTime()).toBe(expectedMs);
        expect(res.snapshot.probationEndsAt!.toISOString()).toBe('2026-04-01T10:00:00.000Z');
      }
    });
  });

  describe('13. Invariants: INV-03 & INV-05', () => {
    it('INV-03: Every successful transition emits exactly one AUDIT state-change descriptor', () => {
      const current = makeEmptySnapshot({
        state: 'REPORTED_BROKEN',
        originalReporterClusters: ['c1'],
      });

      const res = transition(current, {
        type: 'REPAIR_CLAIMED',
        claimedBy: 'Kisumu Engineering Works',
        at: BASE_TIME,
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        const auditEffects = res.effects.filter(
          (e) => e.kind === 'AUDIT' && e.action === 'AUDIT_STATE_CHANGED'
        );
        expect(auditEffects.length).toBe(1);
      }
    });

    it('INV-05: Illegal transitions return typed error with empty effects array', () => {
      const current = makeEmptySnapshot({
        state: 'REPORTED_BROKEN',
      });

      // Illegal skip: REPORTED_BROKEN -> PROBATION_WINDOW_CLOSED
      const res = transition(current, {
        type: 'PROBATION_WINDOW_CLOSED',
        at: BASE_TIME,
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe('E_ILLEGAL_TRANSITION');
        expect(res.effects).toEqual([]);
      }
    });
  });
});
