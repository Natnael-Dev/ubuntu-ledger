// Repair Probation Lifecycle State Machine
// Authoritative source: docs/specs/04-state-machine.md §3, §7 (INV-01, INV-03, INV-05, INV-10), §8, 03-data-model.md §6
// Rule: Pure function. No I/O, no DB imports, no clock imports, no Date.now() / arg-less new Date().

import type {
  ActorRole,
  DomainErrorCode,
  Effect,
  ProbationState,
} from './types';

export interface ConfirmationRecord {
  clusterKey: string;
  confirmedAt: Date;
}

export interface FailureRecord {
  clusterKey: string;
  reasonKey: string;
  reportedAt: Date;
  resolved?: boolean;
}

export interface ProbationSnapshot {
  ticketId: string;
  assetId: string;
  state: ProbationState | null;
  reportedBrokenAt?: Date | null;
  originalReporterClusters: string[];
  repairClaimedAt?: Date | null;
  claimedBy?: string | null;
  probationStartedAt?: Date | null;
  probationEndsAt?: Date | null;
  probationDays: number;
  extensionCount: number;
  maxExtensions: number;
  isPaused: boolean;
  pausedAt?: Date | null;
  accumulatedPauseMs: number;
  confirmations: ConfirmationRecord[];
  failures: FailureRecord[];
  failureCount: number;
  resolvedAt?: Date | null;
  failureReasonKey?: string | null;
}

export type ProbationEvent =
  | {
      type: 'BREAKAGE_REPORTED';
      ticketId: string;
      assetId: string;
      reporterClusterKey: string;
      at: Date;
    }
  | {
      type: 'REPAIR_CLAIMED';
      claimedBy: string;
      at: Date;
    }
  | {
      type: 'INITIAL_FUNCTION_CONFIRMED';
      clusterKey: string;
      at: Date;
    }
  | {
      type: 'CLOCK_ADVANCED';
      at: Date;
    }
  | {
      type: 'FAILURE_REPORTED';
      clusterKey: string;
      reasonKey: string;
      at: Date;
    }
  | {
      type: 'PROBATION_WINDOW_CLOSED';
      actor?: ActorRole;
      confirmations?: ConfirmationRecord[];
      at: Date;
    }
  | {
      type: 'WINDOW_CLOSED_NO_RESPONSE';
      at: Date;
    }
  | {
      type: 'REPAIR_RECLAIMED';
      claimedBy: string;
      at: Date;
    }
  | {
      type: 'MANUAL_CLOSE_ATTEMPT';
      actor: ActorRole;
      at: Date;
    }
  | {
      type: 'LINKED_DISCREPANCY_FLAGGED';
      at: Date;
    }
  | {
      type: 'LINKED_DISCREPANCY_RESOLVED';
      at: Date;
    };

export type ProbationResult =
  | {
      ok: true;
      next: ProbationState;
      snapshot: ProbationSnapshot;
      effects: Effect[];
    }
  | {
      ok: false;
      code: DomainErrorCode;
      message: string;
      effects: never[];
    };

/**
 * Pure transition function for the Repair Probation Lifecycle.
 *
 * Implements 04-state-machine.md §3:
 * 1. — -> BREAKAGE_REPORTED -> REPORTED_BROKEN
 * 2. REPORTED_BROKEN -> REPAIR_CLAIMED -> REPAIR_CLAIMED
 * 3. REPAIR_CLAIMED -> INITIAL_FUNCTION_CONFIRMED -> PROBATION_DAY_0
 * 4. PROBATION_DAY_0 -> CLOCK_ADVANCED -> PROBATION_ACTIVE
 * 5. PROBATION_ACTIVE -> FAILURE_REPORTED -> PROBATION_FAILED
 * 6. PROBATION_ACTIVE -> PROBATION_WINDOW_CLOSED -> VERIFIED_SUSTAINED
 * 7. PROBATION_ACTIVE -> WINDOW_CLOSED_NO_RESPONSE -> PROBATION_ACTIVE / PROBATION_FAILED
 * 8. PROBATION_FAILED -> REPAIR_RECLAIMED -> REPAIR_CLAIMED
 * 9. ANY -> MANUAL_CLOSE_ATTEMPT -> (rejected, E_PROBATION_LOCKED)
 * 10. PROBATION_ACTIVE/DAY_0 -> LINKED_DISCREPANCY_FLAGGED -> clock paused
 * 11. PROBATION_ACTIVE/DAY_0 -> LINKED_DISCREPANCY_RESOLVED -> clock resumed, duration preserved
 */
export function transition(
  current: ProbationSnapshot,
  event: ProbationEvent
): ProbationResult {
  switch (event.type) {
    case 'BREAKAGE_REPORTED': {
      // Guard: Cannot initialize if already in an active/non-terminal probation ticket
      if (
        current.state === 'REPORTED_BROKEN' ||
        current.state === 'REPAIR_CLAIMED' ||
        current.state === 'PROBATION_DAY_0' ||
        current.state === 'PROBATION_ACTIVE'
      ) {
        return {
          ok: false,
          code: 'E_ALREADY_INITIALIZED',
          message: `Cannot report breakage: active repair ticket already exists in state '${current.state}'`,
          effects: [],
        };
      }

      if (!event.reporterClusterKey || event.reporterClusterKey.trim() === '') {
        return {
          ok: false,
          code: 'E_GUARD_FAILED',
          message: 'Breakage report requires a valid reporter cluster key',
          effects: [],
        };
      }

      const nextSnapshot: ProbationSnapshot = {
        ...current,
        ticketId: event.ticketId,
        assetId: event.assetId,
        state: 'REPORTED_BROKEN',
        reportedBrokenAt: event.at,
        originalReporterClusters: [event.reporterClusterKey.trim()],
        repairClaimedAt: null,
        claimedBy: null,
        probationStartedAt: null,
        probationEndsAt: null,
        extensionCount: 0,
        isPaused: false,
        pausedAt: null,
        accumulatedPauseMs: 0,
        confirmations: [],
        failures: [],
        resolvedAt: null,
        failureReasonKey: null,
      };

      const effects: Effect[] = [
        {
          kind: 'AUDIT',
          action: 'AUDIT_STATE_CHANGED',
          payload: {
            from: current.state,
            to: 'REPORTED_BROKEN',
            ticketId: event.ticketId,
            assetId: event.assetId,
            reporterCluster: event.reporterClusterKey,
            at: event.at.toISOString(),
          },
        },
      ];

      return {
        ok: true,
        next: 'REPORTED_BROKEN',
        snapshot: nextSnapshot,
        effects,
      };
    }

    case 'REPAIR_CLAIMED': {
      // Guard: must be in REPORTED_BROKEN
      if (current.state !== 'REPORTED_BROKEN') {
        return {
          ok: false,
          code: 'E_ILLEGAL_TRANSITION',
          message: `Cannot claim repair when state is '${current.state}'; expected 'REPORTED_BROKEN'`,
          effects: [],
        };
      }

      // Guard: claimed_by must be an organisation name, never empty/individual
      const trimmedClaimedBy = event.claimedBy ? event.claimedBy.trim() : '';
      if (!trimmedClaimedBy) {
        return {
          ok: false,
          code: 'E_GUARD_FAILED',
          message: 'Repair claim requires a valid claiming organisation name',
          effects: [],
        };
      }

      const nextSnapshot: ProbationSnapshot = {
        ...current,
        state: 'REPAIR_CLAIMED',
        repairClaimedAt: event.at,
        claimedBy: trimmedClaimedBy,
      };

      const effects: Effect[] = [
        {
          kind: 'AUDIT',
          action: 'AUDIT_STATE_CHANGED',
          payload: {
            from: 'REPORTED_BROKEN',
            to: 'REPAIR_CLAIMED',
            ticketId: current.ticketId,
            claimedBy: trimmedClaimedBy,
            at: event.at.toISOString(),
          },
        },
      ];

      return {
        ok: true,
        next: 'REPAIR_CLAIMED',
        snapshot: nextSnapshot,
        effects,
      };
    }

    case 'INITIAL_FUNCTION_CONFIRMED': {
      // Guard: must be in REPAIR_CLAIMED
      if (current.state !== 'REPAIR_CLAIMED') {
        return {
          ok: false,
          code: 'E_ILLEGAL_TRANSITION',
          message: `Cannot record initial confirmation from state '${current.state}'; expected 'REPAIR_CLAIMED'`,
          effects: [],
        };
      }

      const clusterKey = event.clusterKey ? event.clusterKey.trim() : '';
      if (!clusterKey) {
        return {
          ok: false,
          code: 'E_GUARD_FAILED',
          message: 'Initial function confirmation requires a valid distinct cluster key',
          effects: [],
        };
      }

      const probationDays =
        current.probationDays >= 7 && current.probationDays <= 14
          ? current.probationDays
          : 7;

      const startedAtMs = event.at.getTime();
      const endsAtMs = startedAtMs + probationDays * 24 * 60 * 60 * 1000;
      const probationStartedAt = new Date(startedAtMs);
      const probationEndsAt = new Date(endsAtMs);

      const nextSnapshot: ProbationSnapshot = {
        ...current,
        state: 'PROBATION_DAY_0',
        probationStartedAt,
        probationEndsAt,
        probationDays,
        extensionCount: 0,
        isPaused: false,
        pausedAt: null,
        confirmations: [{ clusterKey, confirmedAt: event.at }],
      };

      const pingTargetCluster =
        current.originalReporterClusters.length > 0
          ? current.originalReporterClusters[0]
          : clusterKey;

      const effects: Effect[] = [
        {
          kind: 'SCHEDULE_PING',
          pingDay: 3,
          ticketId: current.ticketId,
          clusterKey: pingTargetCluster,
        },
        {
          kind: 'SCHEDULE_PING',
          pingDay: 7,
          ticketId: current.ticketId,
          clusterKey: pingTargetCluster,
        },
        {
          kind: 'AUDIT',
          action: 'AUDIT_STATE_CHANGED',
          payload: {
            from: 'REPAIR_CLAIMED',
            to: 'PROBATION_DAY_0',
            ticketId: current.ticketId,
            probationStartedAt: probationStartedAt.toISOString(),
            probationEndsAt: probationEndsAt.toISOString(),
            probationDays,
            at: event.at.toISOString(),
          },
        },
      ];

      return {
        ok: true,
        next: 'PROBATION_DAY_0',
        snapshot: nextSnapshot,
        effects,
      };
    }

    case 'CLOCK_ADVANCED': {
      // Guard: must be in PROBATION_DAY_0
      if (current.state !== 'PROBATION_DAY_0') {
        return {
          ok: false,
          code: 'E_ILLEGAL_TRANSITION',
          message: `Cannot advance clock to PROBATION_ACTIVE from state '${current.state}'; expected 'PROBATION_DAY_0'`,
          effects: [],
        };
      }

      // Guard: now > probation_started_at
      if (
        !current.probationStartedAt ||
        event.at.getTime() <= current.probationStartedAt.getTime()
      ) {
        return {
          ok: false,
          code: 'E_GUARD_FAILED',
          message: 'Cannot advance to PROBATION_ACTIVE: current time has not passed probation_started_at',
          effects: [],
        };
      }

      const nextSnapshot: ProbationSnapshot = {
        ...current,
        state: 'PROBATION_ACTIVE',
      };

      const effects: Effect[] = [
        {
          kind: 'AUDIT',
          action: 'AUDIT_STATE_CHANGED',
          payload: {
            from: 'PROBATION_DAY_0',
            to: 'PROBATION_ACTIVE',
            ticketId: current.ticketId,
            at: event.at.toISOString(),
          },
        },
      ];

      return {
        ok: true,
        next: 'PROBATION_ACTIVE',
        snapshot: nextSnapshot,
        effects,
      };
    }

    case 'FAILURE_REPORTED': {
      // Guard: must be in PROBATION_ACTIVE or PROBATION_DAY_0
      if (
        current.state !== 'PROBATION_ACTIVE' &&
        current.state !== 'PROBATION_DAY_0'
      ) {
        return {
          ok: false,
          code: 'E_ILLEGAL_TRANSITION',
          message: `Cannot report probation failure from state '${current.state}'; expected active probation`,
          effects: [],
        };
      }

      const clusterKey = event.clusterKey ? event.clusterKey.trim() : '';
      if (!clusterKey) {
        return {
          ok: false,
          code: 'E_GUARD_FAILED',
          message: 'Failure report requires a valid reporting cluster key',
          effects: [],
        };
      }

      const newFailures: FailureRecord[] = [
        ...current.failures,
        {
          clusterKey,
          reasonKey: event.reasonKey,
          reportedAt: event.at,
          resolved: false,
        },
      ];

      const newFailureCount = current.failureCount + 1;

      const nextSnapshot: ProbationSnapshot = {
        ...current,
        state: 'PROBATION_FAILED',
        failureReasonKey: event.reasonKey,
        failureCount: newFailureCount,
        failures: newFailures,
        isPaused: false,
        pausedAt: null,
      };

      const effects: Effect[] = [
        {
          kind: 'INCREMENT_FAILURE_COUNT',
          claimingOrg: current.claimedBy || 'UNKNOWN_ORG',
        },
        {
          kind: 'QUEUE_BULLETIN_FACT',
          reason: event.reasonKey,
          ticketId: current.ticketId,
          assetId: current.assetId,
        },
        {
          kind: 'AUDIT',
          action: 'AUDIT_STATE_CHANGED',
          payload: {
            from: current.state,
            to: 'PROBATION_FAILED',
            ticketId: current.ticketId,
            failureReasonKey: event.reasonKey,
            reportingCluster: clusterKey,
            failureCount: newFailureCount,
            at: event.at.toISOString(),
          },
        },
      ];

      return {
        ok: true,
        next: 'PROBATION_FAILED',
        snapshot: nextSnapshot,
        effects,
      };
    }

    case 'PROBATION_WINDOW_CLOSED': {
      // Guard: must be in PROBATION_ACTIVE
      if (current.state !== 'PROBATION_ACTIVE') {
        return {
          ok: false,
          code: 'E_ILLEGAL_TRANSITION',
          message: `Cannot evaluate probation window closure from state '${current.state}'; expected 'PROBATION_ACTIVE'`,
          effects: [],
        };
      }

      // Guard: Clock must not be paused
      if (current.isPaused) {
        return {
          ok: false,
          code: 'E_GUARD_FAILED',
          message: 'Cannot close probation window while probation clock is paused due to discrepancy',
          effects: [],
        };
      }

      // Guard: INV-01 — No VERIFIED_SUSTAINED earlier than probation_ends_at under ANY actor role
      if (
        !current.probationEndsAt ||
        event.at.getTime() < current.probationEndsAt.getTime()
      ) {
        return {
          ok: false,
          code: 'E_PROBATION_LOCKED',
          message: `Cannot verify sustained repair before probation_ends_at (${current.probationEndsAt?.toISOString()}); attempted by ${event.actor || 'SYSTEM'}`,
          effects: [],
        };
      }

      // Guard: Zero unresolved failure reports
      const hasUnresolvedFailures = current.failures.some((f) => !f.resolved);
      if (hasUnresolvedFailures) {
        return {
          ok: false,
          code: 'E_GUARD_FAILED',
          message: 'Cannot verify sustained repair: unresolved failure reports exist on this ticket',
          effects: [],
        };
      }

      // Guard: ≥2 distinct-cluster confirmations dated on/after probation_ends_at
      // AND strictly from the original reporters' clusters
      const allConfirmations = [
        ...current.confirmations,
        ...(event.confirmations || []),
      ];

      const qualifyingClusters = new Set<string>();
      for (const conf of allConfirmations) {
        if (
          conf.confirmedAt.getTime() >= current.probationEndsAt.getTime() &&
          current.originalReporterClusters.includes(conf.clusterKey)
        ) {
          qualifyingClusters.add(conf.clusterKey);
        }
      }

      if (qualifyingClusters.size < 2) {
        return {
          ok: false,
          code: 'E_GUARD_FAILED',
          message: `Requires ≥2 distinct confirmations from original reporter clusters on/after window end; got ${qualifyingClusters.size}`,
          effects: [],
        };
      }

      const nextSnapshot: ProbationSnapshot = {
        ...current,
        state: 'VERIFIED_SUSTAINED',
        resolvedAt: event.at,
      };

      const effects: Effect[] = [
        {
          kind: 'MARK_BULLETIN_ELIGIBLE',
        },
        {
          kind: 'AUDIT',
          action: 'AUDIT_STATE_CHANGED',
          payload: {
            from: 'PROBATION_ACTIVE',
            to: 'VERIFIED_SUSTAINED',
            ticketId: current.ticketId,
            resolvedAt: event.at.toISOString(),
            qualifyingClusters: Array.from(qualifyingClusters),
            at: event.at.toISOString(),
          },
        },
      ];

      return {
        ok: true,
        next: 'VERIFIED_SUSTAINED',
        snapshot: nextSnapshot,
        effects,
      };
    }

    case 'WINDOW_CLOSED_NO_RESPONSE': {
      // Guard: must be in PROBATION_ACTIVE
      if (current.state !== 'PROBATION_ACTIVE') {
        return {
          ok: false,
          code: 'E_ILLEGAL_TRANSITION',
          message: `Cannot evaluate window closure from state '${current.state}'; expected 'PROBATION_ACTIVE'`,
          effects: [],
        };
      }

      // Guard: Clock must not be paused
      if (current.isPaused) {
        return {
          ok: false,
          code: 'E_GUARD_FAILED',
          message: 'Cannot evaluate window closure while probation clock is paused',
          effects: [],
        };
      }

      // Guard: now >= probation_ends_at
      if (
        !current.probationEndsAt ||
        event.at.getTime() < current.probationEndsAt.getTime()
      ) {
        return {
          ok: false,
          code: 'E_GUARD_FAILED',
          message: 'Cannot close window: probation_ends_at has not elapsed',
          effects: [],
        };
      }

      const maxExtensions = current.maxExtensions ?? 2;

      // Check if we can still extend by 3 days
      if (current.extensionCount < maxExtensions) {
        const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
        const newEndsAtMs = current.probationEndsAt.getTime() + THREE_DAYS_MS;
        const newProbationEndsAt = new Date(newEndsAtMs);
        const newExtensionCount = current.extensionCount + 1;

        const nextSnapshot: ProbationSnapshot = {
          ...current,
          probationEndsAt: newProbationEndsAt,
          extensionCount: newExtensionCount,
        };

        const effects: Effect[] = [
          {
            kind: 'AUDIT',
            action: 'PROBATION_WINDOW_EXTENDED',
            payload: {
              ticketId: current.ticketId,
              extensionCount: newExtensionCount,
              maxExtensions,
              newProbationEndsAt: newProbationEndsAt.toISOString(),
              at: event.at.toISOString(),
            },
          },
        ];

        return {
          ok: true,
          next: 'PROBATION_ACTIVE',
          snapshot: nextSnapshot,
          effects,
        };
      }

      // Extensions exhausted -> transition to PROBATION_FAILED with reason 'no_verification'
      const newFailureCount = current.failureCount + 1;
      const nextSnapshot: ProbationSnapshot = {
        ...current,
        state: 'PROBATION_FAILED',
        failureReasonKey: 'no_verification',
        failureCount: newFailureCount,
        failures: [
          ...current.failures,
          {
            clusterKey: 'SYSTEM',
            reasonKey: 'no_verification',
            reportedAt: event.at,
            resolved: false,
          },
        ],
      };

      const effects: Effect[] = [
        {
          kind: 'INCREMENT_FAILURE_COUNT',
          claimingOrg: current.claimedBy || 'UNKNOWN_ORG',
        },
        {
          kind: 'QUEUE_BULLETIN_FACT',
          reason: 'no_verification',
          ticketId: current.ticketId,
          assetId: current.assetId,
        },
        {
          kind: 'AUDIT',
          action: 'AUDIT_STATE_CHANGED',
          payload: {
            from: 'PROBATION_ACTIVE',
            to: 'PROBATION_FAILED',
            ticketId: current.ticketId,
            reason: 'no_verification',
            failureCount: newFailureCount,
            at: event.at.toISOString(),
          },
        },
      ];

      return {
        ok: true,
        next: 'PROBATION_FAILED',
        snapshot: nextSnapshot,
        effects,
      };
    }

    case 'REPAIR_RECLAIMED': {
      // Guard: must be in PROBATION_FAILED
      if (current.state !== 'PROBATION_FAILED') {
        return {
          ok: false,
          code: 'E_ILLEGAL_TRANSITION',
          message: `Cannot reclaim repair from state '${current.state}'; expected 'PROBATION_FAILED'`,
          effects: [],
        };
      }

      const trimmedClaimedBy = event.claimedBy ? event.claimedBy.trim() : '';
      if (!trimmedClaimedBy) {
        return {
          ok: false,
          code: 'E_GUARD_FAILED',
          message: 'Reclaiming repair requires a valid claiming organisation name',
          effects: [],
        };
      }

      // Restart probation at full length; failure history retained
      const nextSnapshot: ProbationSnapshot = {
        ...current,
        state: 'REPAIR_CLAIMED',
        claimedBy: trimmedClaimedBy,
        repairClaimedAt: event.at,
        probationStartedAt: null,
        probationEndsAt: null,
        extensionCount: 0,
        isPaused: false,
        pausedAt: null,
        confirmations: [],
        failureReasonKey: null,
      };

      const effects: Effect[] = [
        {
          kind: 'AUDIT',
          action: 'AUDIT_STATE_CHANGED',
          payload: {
            from: 'PROBATION_FAILED',
            to: 'REPAIR_CLAIMED',
            ticketId: current.ticketId,
            claimedBy: trimmedClaimedBy,
            retainedFailureCount: current.failureCount,
            at: event.at.toISOString(),
          },
        },
      ];

      return {
        ok: true,
        next: 'REPAIR_CLAIMED',
        snapshot: nextSnapshot,
        effects,
      };
    }

    case 'MANUAL_CLOSE_ATTEMPT': {
      // Hard rule: No role — not admin, not moderator, not system — may manually close.
      // Always rejected with E_PROBATION_LOCKED and empty effects.
      return {
        ok: false,
        code: 'E_PROBATION_LOCKED',
        message: `Manual close attempt rejected for role '${event.actor}': repair tickets can only be sustained through community verification and time`,
        effects: [],
      };
    }

    case 'LINKED_DISCREPANCY_FLAGGED': {
      // Guard: must be in active probation (PROBATION_ACTIVE or PROBATION_DAY_0)
      if (
        current.state !== 'PROBATION_ACTIVE' &&
        current.state !== 'PROBATION_DAY_0'
      ) {
        return {
          ok: false,
          code: 'E_ILLEGAL_TRANSITION',
          message: `Cannot pause probation clock from state '${current.state}'; expected active probation`,
          effects: [],
        };
      }

      // Idempotent guard: if already paused, reject or no-op
      if (current.isPaused) {
        return {
          ok: false,
          code: 'E_GUARD_FAILED',
          message: 'Probation clock is already paused',
          effects: [],
        };
      }

      const nextSnapshot: ProbationSnapshot = {
        ...current,
        isPaused: true,
        pausedAt: event.at,
      };

      const effects: Effect[] = [
        {
          kind: 'AUDIT',
          action: 'PROBATION_CLOCK_PAUSED',
          payload: {
            ticketId: current.ticketId,
            pausedAt: event.at.toISOString(),
            remainingDurationMs: current.probationEndsAt
              ? current.probationEndsAt.getTime() - event.at.getTime()
              : null,
            at: event.at.toISOString(),
          },
        },
      ];

      return {
        ok: true,
        next: current.state,
        snapshot: nextSnapshot,
        effects,
      };
    }

    case 'LINKED_DISCREPANCY_RESOLVED': {
      // Guard: must be in active probation and currently paused
      if (
        current.state !== 'PROBATION_ACTIVE' &&
        current.state !== 'PROBATION_DAY_0'
      ) {
        return {
          ok: false,
          code: 'E_ILLEGAL_TRANSITION',
          message: `Cannot resume probation clock from state '${current.state}'; expected active probation`,
          effects: [],
        };
      }

      if (!current.isPaused || !current.pausedAt) {
        return {
          ok: false,
          code: 'E_GUARD_FAILED',
          message: 'Probation clock is not currently paused',
          effects: [],
        };
      }

      const pauseDurationMs = event.at.getTime() - current.pausedAt.getTime();
      if (pauseDurationMs < 0) {
        return {
          ok: false,
          code: 'E_GUARD_FAILED',
          message: 'Resume timestamp cannot be before pause timestamp',
          effects: [],
        };
      }

      const newEndsAtMs = current.probationEndsAt
        ? current.probationEndsAt.getTime() + pauseDurationMs
        : null;
      const newProbationEndsAt = newEndsAtMs ? new Date(newEndsAtMs) : null;
      const totalAccumulatedPauseMs =
        (current.accumulatedPauseMs || 0) + pauseDurationMs;

      const nextSnapshot: ProbationSnapshot = {
        ...current,
        isPaused: false,
        pausedAt: null,
        probationEndsAt: newProbationEndsAt,
        accumulatedPauseMs: totalAccumulatedPauseMs,
      };

      const effects: Effect[] = [
        {
          kind: 'AUDIT',
          action: 'PROBATION_CLOCK_RESUMED',
          payload: {
            ticketId: current.ticketId,
            pauseDurationMs,
            totalAccumulatedPauseMs,
            newProbationEndsAt: newProbationEndsAt?.toISOString(),
            at: event.at.toISOString(),
          },
        },
      ];

      return {
        ok: true,
        next: current.state,
        snapshot: nextSnapshot,
        effects,
      };
    }

    default: {
      const _exhaustive: never = event;
      return {
        ok: false,
        code: 'E_ILLEGAL_TRANSITION',
        message: `Unhandled event: ${JSON.stringify(_exhaustive)}`,
        effects: [],
      };
    }
  }
}
