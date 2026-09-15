// Fiscal Lifecycle State Machine
// Authoritative source: docs/specs/04-state-machine.md §1, §7 (INV-03, INV-05, INV-07), §8
// Rule: Pure function. No I/O, no DB imports, no clock imports.

import type {
  FiscalState,
  AuditState,
  SourceConfidence,
  DomainErrorCode,
  Effect,
} from './types';

export interface FiscalSnapshot {
  fiscal: FiscalState | null; // null represents uninitialized / not yet ingested
  confidence: SourceConfidence;
  sourceDocumentId: string | null;
  sourcePage: number | null;
  auditState: AuditState;
}

export type FiscalEvent =
  | {
      type: 'RECEIPT_INGESTED';
      reviewerInitials: string;
      confidence?: SourceConfidence;
      sourceDocumentId?: string | null;
      sourcePage?: number | null;
      at: Date;
    }
  | {
      type: 'BUDGET_LINE_CONFIRMED';
      sourceDocumentId?: string | null;
      sourcePage?: number | null;
      at: Date;
    }
  | {
      type: 'DISBURSEMENT_RECORDED';
      disbursementDocumentId: string;
      at: Date;
    }
  | {
      type: 'RECONCILED';
      at: Date;
    };

export type FiscalResult =
  | {
      ok: true;
      next: FiscalState;
      confidence?: SourceConfidence;
      effects: Effect[];
    }
  | {
      ok: false;
      code: DomainErrorCode;
      message: string;
      effects: never[];
    };

/**
 * Pure transition function for the Fiscal Lifecycle.
 *
 * Implements 04-state-machine.md §1:
 * - uninitialized -> RECEIPT_INGESTED -> PROMISED
 * - PROMISED -> BUDGET_LINE_CONFIRMED -> COMMITTED
 * - COMMITTED -> DISBURSEMENT_RECORDED -> DISBURSED
 * - DISBURSED -> RECONCILED -> AUDITED
 */
export function transition(
  current: FiscalSnapshot | null,
  event: FiscalEvent
): FiscalResult {
  switch (event.type) {
    case 'RECEIPT_INGESTED': {
      // Guard: must be uninitialized (current is null or fiscal is null)
      if (current !== null && current.fiscal !== null) {
        return {
          ok: false,
          code: 'E_ALREADY_INITIALIZED',
          message: `Project receipt has already been ingested into state ${current.fiscal}`,
          effects: [],
        };
      }

      // Guard: ingest reviewer must be present
      if (!event.reviewerInitials || event.reviewerInitials.trim().length === 0) {
        return {
          ok: false,
          code: 'E_GUARD_FAILED',
          message: 'Receipt ingestion requires confirmed ingest reviewer initials',
          effects: [],
        };
      }

      // Determine initial confidence
      const hasCitation = Boolean(
        event.sourceDocumentId &&
          event.sourceDocumentId.trim().length > 0 &&
          event.sourcePage !== undefined &&
          event.sourcePage !== null &&
          event.sourcePage > 0
      );

      const confidence: SourceConfidence = hasCitation
        ? (event.confidence ?? 'OFFICIAL_CITED')
        : 'UNOFFICIAL_ESTIMATE';

      const effects: Effect[] = [
        {
          kind: 'AUDIT',
          action: 'PROJECT_CREATED',
          payload: {
            fiscal: 'PROMISED',
            confidence,
            reviewerInitials: event.reviewerInitials.trim(),
            sourceDocumentId: event.sourceDocumentId ?? null,
            sourcePage: event.sourcePage ?? null,
            at: event.at.toISOString(),
          },
        },
      ];

      return {
        ok: true,
        next: 'PROMISED',
        confidence,
        effects,
      };
    }

    case 'BUDGET_LINE_CONFIRMED': {
      // Guard: must be initialized
      if (current === null || current.fiscal === null) {
        return {
          ok: false,
          code: 'E_UNINITIALIZED',
          message: 'Cannot confirm budget line for an uninitialized project',
          effects: [],
        };
      }

      // Terminal state check
      if (current.fiscal === 'AUDITED') {
        return {
          ok: false,
          code: 'E_TERMINAL_STATE',
          message: 'Project fiscal state is AUDITED and cannot be transitioned',
          effects: [],
        };
      }

      // State sequence check
      if (current.fiscal !== 'PROMISED') {
        return {
          ok: false,
          code: 'E_ILLEGAL_TRANSITION',
          message: `Cannot confirm budget line from fiscal state '${current.fiscal}'; expected 'PROMISED'`,
          effects: [],
        };
      }

      // Citation verification (INV-07)
      const docId = event.sourceDocumentId ?? current.sourceDocumentId;
      const page = event.sourcePage ?? current.sourcePage;

      const hasValidCitation = Boolean(
        docId &&
          docId.trim().length > 0 &&
          page !== undefined &&
          page !== null &&
          page > 0
      );

      if (!hasValidCitation) {
        return {
          ok: false,
          code: 'E_UNOFFICIAL_ESTIMATE_CANNOT_COMMIT',
          message:
            'A project lacking valid source_document_id and source_page is an UNOFFICIAL_ESTIMATE and can never reach COMMITTED (INV-07)',
          effects: [],
        };
      }

      const effects: Effect[] = [
        {
          kind: 'SET_CONFIDENCE',
          confidence: 'OFFICIAL_CITED',
        },
        {
          kind: 'AUDIT',
          action: 'FISCAL_STATE_CHANGED',
          payload: {
            from: 'PROMISED',
            to: 'COMMITTED',
            confidence: 'OFFICIAL_CITED',
            sourceDocumentId: docId,
            sourcePage: page,
            at: event.at.toISOString(),
          },
        },
      ];

      return {
        ok: true,
        next: 'COMMITTED',
        confidence: 'OFFICIAL_CITED',
        effects,
      };
    }

    case 'DISBURSEMENT_RECORDED': {
      // Guard: must be initialized
      if (current === null || current.fiscal === null) {
        return {
          ok: false,
          code: 'E_UNINITIALIZED',
          message: 'Cannot record disbursement for an uninitialized project',
          effects: [],
        };
      }

      // Terminal state check
      if (current.fiscal === 'AUDITED') {
        return {
          ok: false,
          code: 'E_TERMINAL_STATE',
          message: 'Project fiscal state is AUDITED and cannot be transitioned',
          effects: [],
        };
      }

      // State sequence check
      if (current.fiscal !== 'COMMITTED') {
        return {
          ok: false,
          code: 'E_ILLEGAL_TRANSITION',
          message: `Cannot record disbursement from fiscal state '${current.fiscal}'; expected 'COMMITTED'`,
          effects: [],
        };
      }

      // Guard: disbursement record cites a document
      if (
        !event.disbursementDocumentId ||
        event.disbursementDocumentId.trim().length === 0
      ) {
        return {
          ok: false,
          code: 'E_MISSING_DISBURSEMENT_DOCUMENT',
          message: 'Disbursement record must cite an official source document',
          effects: [],
        };
      }

      const effects: Effect[] = [
        {
          kind: 'AUDIT',
          action: 'FISCAL_STATE_CHANGED',
          payload: {
            from: 'COMMITTED',
            to: 'DISBURSED',
            disbursementDocumentId: event.disbursementDocumentId.trim(),
            at: event.at.toISOString(),
          },
        },
      ];

      return {
        ok: true,
        next: 'DISBURSED',
        effects,
      };
    }

    case 'RECONCILED': {
      // Guard: must be initialized
      if (current === null || current.fiscal === null) {
        return {
          ok: false,
          code: 'E_UNINITIALIZED',
          message: 'Cannot reconcile an uninitialized project',
          effects: [],
        };
      }

      // Terminal state check
      if (current.fiscal === 'AUDITED') {
        return {
          ok: false,
          code: 'E_TERMINAL_STATE',
          message: 'Project fiscal state is AUDITED and cannot be transitioned',
          effects: [],
        };
      }

      // State sequence check
      if (current.fiscal !== 'DISBURSED') {
        return {
          ok: false,
          code: 'E_ILLEGAL_TRANSITION',
          message: `Cannot reconcile fiscal state from '${current.fiscal}'; expected 'DISBURSED'`,
          effects: [],
        };
      }

      // Guard: project audit state must be PHYSICALLY_CONFIRMED or DISCREPANCY_FLAGGED
      const isSettled =
        current.auditState === 'PHYSICALLY_CONFIRMED' ||
        current.auditState === 'DISCREPANCY_FLAGGED';

      if (!isSettled) {
        return {
          ok: false,
          code: 'E_AUDIT_NOT_SETTLED',
          message: `Cannot reconcile fiscal record while community audit state is '${current.auditState}'; must be PHYSICALLY_CONFIRMED or DISCREPANCY_FLAGGED`,
          effects: [],
        };
      }

      const effects: Effect[] = [
        {
          kind: 'AUDIT',
          action: 'FISCAL_STATE_CHANGED',
          payload: {
            from: 'DISBURSED',
            to: 'AUDITED',
            auditState: current.auditState,
            at: event.at.toISOString(),
          },
        },
        {
          kind: 'MARK_BULLETIN_ELIGIBLE',
        },
      ];

      return {
        ok: true,
        next: 'AUDITED',
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
