import { describe, it, expect } from 'vitest';
import {
  transition,
  type FiscalSnapshot,
  type FiscalEvent,
} from '@/domain/fiscal-lifecycle';

describe('T-07: Fiscal Lifecycle State Machine (04-state-machine.md §1)', () => {
  const TEST_DATE = new Date('2026-09-15T12:00:00.000Z');

  describe('1. uninitialized -> PROMISED (RECEIPT_INGESTED)', () => {
    it('transitions uninitialized project to PROMISED when confirmed by ingest reviewer with citation', () => {
      const event: FiscalEvent = {
        type: 'RECEIPT_INGESTED',
        reviewerInitials: 'JD',
        sourceDocumentId: 'doc-uuid-1',
        sourcePage: 12,
        at: TEST_DATE,
      };

      const result = transition(null, event);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.next).toBe('PROMISED');
        expect(result.confidence).toBe('OFFICIAL_CITED');
        expect(result.effects).toEqual([
          {
            kind: 'AUDIT',
            action: 'PROJECT_CREATED',
            payload: {
              fiscal: 'PROMISED',
              confidence: 'OFFICIAL_CITED',
              reviewerInitials: 'JD',
              sourceDocumentId: 'doc-uuid-1',
              sourcePage: 12,
              at: TEST_DATE.toISOString(),
            },
          },
        ]);
      }
    });

    it('transitions uninitialized project to PROMISED with UNOFFICIAL_ESTIMATE when no citation is provided', () => {
      const event: FiscalEvent = {
        type: 'RECEIPT_INGESTED',
        reviewerInitials: 'JD',
        at: TEST_DATE,
      };

      const result = transition(null, event);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.next).toBe('PROMISED');
        expect(result.confidence).toBe('UNOFFICIAL_ESTIMATE');
        expect(result.effects).toEqual([
          {
            kind: 'AUDIT',
            action: 'PROJECT_CREATED',
            payload: {
              fiscal: 'PROMISED',
              confidence: 'UNOFFICIAL_ESTIMATE',
              reviewerInitials: 'JD',
              sourceDocumentId: null,
              sourcePage: null,
              at: TEST_DATE.toISOString(),
            },
          },
        ]);
      }
    });

    it('rejects RECEIPT_INGESTED when reviewer initials are missing or empty', () => {
      const event: FiscalEvent = {
        type: 'RECEIPT_INGESTED',
        reviewerInitials: '   ',
        at: TEST_DATE,
      };

      const result = transition(null, event);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('E_GUARD_FAILED');
        expect(result.effects).toEqual([]);
      }
    });

    it('rejects RECEIPT_INGESTED if project is already initialized', () => {
      const snapshot: FiscalSnapshot = {
        fiscal: 'PROMISED',
        confidence: 'OFFICIAL_CITED',
        sourceDocumentId: 'doc-1',
        sourcePage: 1,
        auditState: 'NOT_DISPATCHED',
      };

      const event: FiscalEvent = {
        type: 'RECEIPT_INGESTED',
        reviewerInitials: 'AB',
        at: TEST_DATE,
      };

      const result = transition(snapshot, event);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('E_ALREADY_INITIALIZED');
        expect(result.effects).toEqual([]);
      }
    });
  });

  describe('2. PROMISED -> COMMITTED (BUDGET_LINE_CONFIRMED)', () => {
    it('transitions PROMISED to COMMITTED when source document citation is present', () => {
      const snapshot: FiscalSnapshot = {
        fiscal: 'PROMISED',
        confidence: 'OFFICIAL_CITED',
        sourceDocumentId: 'doc-uuid-1',
        sourcePage: 15,
        auditState: 'NOT_DISPATCHED',
      };

      const event: FiscalEvent = {
        type: 'BUDGET_LINE_CONFIRMED',
        at: TEST_DATE,
      };

      const result = transition(snapshot, event);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.next).toBe('COMMITTED');
        expect(result.confidence).toBe('OFFICIAL_CITED');
        expect(result.effects).toEqual([
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
              sourceDocumentId: 'doc-uuid-1',
              sourcePage: 15,
              at: TEST_DATE.toISOString(),
            },
          },
        ]);
      }
    });

    it('transitions PROMISED to COMMITTED when citation is provided in the event itself', () => {
      const snapshot: FiscalSnapshot = {
        fiscal: 'PROMISED',
        confidence: 'UNOFFICIAL_ESTIMATE',
        sourceDocumentId: null,
        sourcePage: null,
        auditState: 'NOT_DISPATCHED',
      };

      const event: FiscalEvent = {
        type: 'BUDGET_LINE_CONFIRMED',
        sourceDocumentId: 'gazette-2026-44',
        sourcePage: 88,
        at: TEST_DATE,
      };

      const result = transition(snapshot, event);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.next).toBe('COMMITTED');
        expect(result.confidence).toBe('OFFICIAL_CITED');
      }
    });

    it('enforces INV-07: project with UNOFFICIAL_ESTIMATE and missing citation NEVER reaches COMMITTED', () => {
      const snapshot: FiscalSnapshot = {
        fiscal: 'PROMISED',
        confidence: 'UNOFFICIAL_ESTIMATE',
        sourceDocumentId: null,
        sourcePage: null,
        auditState: 'NOT_DISPATCHED',
      };

      const event: FiscalEvent = {
        type: 'BUDGET_LINE_CONFIRMED',
        at: TEST_DATE,
      };

      const result = transition(snapshot, event);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('E_UNOFFICIAL_ESTIMATE_CANNOT_COMMIT');
        expect(result.effects).toEqual([]);
      }
    });

    it('rejects BUDGET_LINE_CONFIRMED if sourcePage is non-positive or missing', () => {
      const snapshot: FiscalSnapshot = {
        fiscal: 'PROMISED',
        confidence: 'OFFICIAL_UNCITED',
        sourceDocumentId: 'doc-1',
        sourcePage: 0,
        auditState: 'NOT_DISPATCHED',
      };

      const event: FiscalEvent = {
        type: 'BUDGET_LINE_CONFIRMED',
        at: TEST_DATE,
      };

      const result = transition(snapshot, event);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('E_UNOFFICIAL_ESTIMATE_CANNOT_COMMIT');
        expect(result.effects).toEqual([]);
      }
    });
  });

  describe('3. COMMITTED -> DISBURSED (DISBURSEMENT_RECORDED)', () => {
    it('transitions COMMITTED to DISBURSED when disbursement document is cited', () => {
      const snapshot: FiscalSnapshot = {
        fiscal: 'COMMITTED',
        confidence: 'OFFICIAL_CITED',
        sourceDocumentId: 'doc-1',
        sourcePage: 10,
        auditState: 'NOT_DISPATCHED',
      };

      const event: FiscalEvent = {
        type: 'DISBURSEMENT_RECORDED',
        disbursementDocumentId: 'disbursement-doc-99',
        at: TEST_DATE,
      };

      const result = transition(snapshot, event);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.next).toBe('DISBURSED');
        expect(result.effects).toEqual([
          {
            kind: 'AUDIT',
            action: 'FISCAL_STATE_CHANGED',
            payload: {
              from: 'COMMITTED',
              to: 'DISBURSED',
              disbursementDocumentId: 'disbursement-doc-99',
              at: TEST_DATE.toISOString(),
            },
          },
        ]);
      }
    });

    it('rejects DISBURSEMENT_RECORDED when disbursement document id is missing or empty', () => {
      const snapshot: FiscalSnapshot = {
        fiscal: 'COMMITTED',
        confidence: 'OFFICIAL_CITED',
        sourceDocumentId: 'doc-1',
        sourcePage: 10,
        auditState: 'NOT_DISPATCHED',
      };

      const event: FiscalEvent = {
        type: 'DISBURSEMENT_RECORDED',
        disbursementDocumentId: '',
        at: TEST_DATE,
      };

      const result = transition(snapshot, event);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('E_MISSING_DISBURSEMENT_DOCUMENT');
        expect(result.effects).toEqual([]);
      }
    });
  });

  describe('4. DISBURSED -> AUDITED (RECONCILED)', () => {
    it('transitions DISBURSED to AUDITED when community audit state is PHYSICALLY_CONFIRMED', () => {
      const snapshot: FiscalSnapshot = {
        fiscal: 'DISBURSED',
        confidence: 'OFFICIAL_CITED',
        sourceDocumentId: 'doc-1',
        sourcePage: 10,
        auditState: 'PHYSICALLY_CONFIRMED',
      };

      const event: FiscalEvent = {
        type: 'RECONCILED',
        at: TEST_DATE,
      };

      const result = transition(snapshot, event);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.next).toBe('AUDITED');
        expect(result.effects).toEqual([
          {
            kind: 'AUDIT',
            action: 'FISCAL_STATE_CHANGED',
            payload: {
              from: 'DISBURSED',
              to: 'AUDITED',
              auditState: 'PHYSICALLY_CONFIRMED',
              at: TEST_DATE.toISOString(),
            },
          },
          {
            kind: 'MARK_BULLETIN_ELIGIBLE',
          },
        ]);
      }
    });

    it('transitions DISBURSED to AUDITED when community audit state is DISCREPANCY_FLAGGED (AUDITED does not mean clean)', () => {
      const snapshot: FiscalSnapshot = {
        fiscal: 'DISBURSED',
        confidence: 'OFFICIAL_CITED',
        sourceDocumentId: 'doc-1',
        sourcePage: 10,
        auditState: 'DISCREPANCY_FLAGGED',
      };

      const event: FiscalEvent = {
        type: 'RECONCILED',
        at: TEST_DATE,
      };

      const result = transition(snapshot, event);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.next).toBe('AUDITED');
        expect(result.effects).toContainEqual({
          kind: 'MARK_BULLETIN_ELIGIBLE',
        });
      }
    });

    it('rejects RECONCILED when community audit state is not settled (e.g. AWAITING_THRESHOLD)', () => {
      const unsettledStates: FiscalSnapshot['auditState'][] = [
        'NOT_DISPATCHED',
        'TASK_DISPATCHED',
        'AWAITING_THRESHOLD',
      ];

      for (const auditState of unsettledStates) {
        const snapshot: FiscalSnapshot = {
          fiscal: 'DISBURSED',
          confidence: 'OFFICIAL_CITED',
          sourceDocumentId: 'doc-1',
          sourcePage: 10,
          auditState,
        };

        const event: FiscalEvent = {
          type: 'RECONCILED',
          at: TEST_DATE,
        };

        const result = transition(snapshot, event);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.code).toBe('E_AUDIT_NOT_SETTLED');
          expect(result.effects).toEqual([]);
        }
      }
    });
  });

  describe('5. Illegal Transitions, Regressions, and Terminal State Enforcement', () => {
    it('rejects skipped transitions (INV-05)', () => {
      // Uninitialized -> BUDGET_LINE_CONFIRMED
      expect(
        transition(null, {
          type: 'BUDGET_LINE_CONFIRMED',
          sourceDocumentId: 'doc',
          sourcePage: 1,
          at: TEST_DATE,
        }).ok
      ).toBe(false);

      // PROMISED -> DISBURSEMENT_RECORDED
      const promisedSnapshot: FiscalSnapshot = {
        fiscal: 'PROMISED',
        confidence: 'OFFICIAL_CITED',
        sourceDocumentId: 'doc-1',
        sourcePage: 1,
        auditState: 'NOT_DISPATCHED',
      };
      const skipToDisbursed = transition(promisedSnapshot, {
        type: 'DISBURSEMENT_RECORDED',
        disbursementDocumentId: 'disb-1',
        at: TEST_DATE,
      });
      expect(skipToDisbursed.ok).toBe(false);
      if (!skipToDisbursed.ok) {
        expect(skipToDisbursed.code).toBe('E_ILLEGAL_TRANSITION');
        expect(skipToDisbursed.effects).toEqual([]);
      }

      // COMMITTED -> RECONCILED
      const committedSnapshot: FiscalSnapshot = {
        fiscal: 'COMMITTED',
        confidence: 'OFFICIAL_CITED',
        sourceDocumentId: 'doc-1',
        sourcePage: 1,
        auditState: 'PHYSICALLY_CONFIRMED',
      };
      const skipToReconciled = transition(committedSnapshot, {
        type: 'RECONCILED',
        at: TEST_DATE,
      });
      expect(skipToReconciled.ok).toBe(false);
      if (!skipToReconciled.ok) {
        expect(skipToReconciled.code).toBe('E_ILLEGAL_TRANSITION');
        expect(skipToReconciled.effects).toEqual([]);
      }
    });

    it('rejects regressions (e.g. COMMITTED -> PROMISED, DISBURSED -> COMMITTED)', () => {
      const disbursedSnapshot: FiscalSnapshot = {
        fiscal: 'DISBURSED',
        confidence: 'OFFICIAL_CITED',
        sourceDocumentId: 'doc-1',
        sourcePage: 1,
        auditState: 'NOT_DISPATCHED',
      };

      const regressEvent = transition(disbursedSnapshot, {
        type: 'BUDGET_LINE_CONFIRMED',
        sourceDocumentId: 'doc-1',
        sourcePage: 1,
        at: TEST_DATE,
      });

      expect(regressEvent.ok).toBe(false);
      if (!regressEvent.ok) {
        expect(regressEvent.code).toBe('E_ILLEGAL_TRANSITION');
        expect(regressEvent.effects).toEqual([]);
      }
    });

    it('enforces AUDITED as a terminal state: all subsequent events are rejected', () => {
      const auditedSnapshot: FiscalSnapshot = {
        fiscal: 'AUDITED',
        confidence: 'OFFICIAL_CITED',
        sourceDocumentId: 'doc-1',
        sourcePage: 1,
        auditState: 'PHYSICALLY_CONFIRMED',
      };

      const events: FiscalEvent[] = [
        {
          type: 'RECEIPT_INGESTED',
          reviewerInitials: 'JD',
          at: TEST_DATE,
        },
        {
          type: 'BUDGET_LINE_CONFIRMED',
          sourceDocumentId: 'doc-1',
          sourcePage: 1,
          at: TEST_DATE,
        },
        {
          type: 'DISBURSEMENT_RECORDED',
          disbursementDocumentId: 'disb-1',
          at: TEST_DATE,
        },
        {
          type: 'RECONCILED',
          at: TEST_DATE,
        },
      ];

      for (const event of events) {
        const result = transition(auditedSnapshot, event);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(
            result.code === 'E_TERMINAL_STATE' ||
              result.code === 'E_ALREADY_INITIALIZED'
          ).toBe(true);
          expect(result.effects).toEqual([]);
        }
      }
    });
  });

  describe('6. Invariant Assertions: INV-03, INV-05, INV-07', () => {
    it('INV-03: Every successful transition produces exactly one AUDIT effect descriptor', () => {
      // 1. Ingest
      const r1 = transition(null, {
        type: 'RECEIPT_INGESTED',
        reviewerInitials: 'REV',
        sourceDocumentId: 'd',
        sourcePage: 1,
        at: TEST_DATE,
      });
      expect(r1.ok).toBe(true);
      if (r1.ok) {
        expect(r1.effects.filter((e) => e.kind === 'AUDIT').length).toBe(1);
      }

      // 2. Commit
      const s1: FiscalSnapshot = {
        fiscal: 'PROMISED',
        confidence: 'OFFICIAL_CITED',
        sourceDocumentId: 'd',
        sourcePage: 1,
        auditState: 'NOT_DISPATCHED',
      };
      const r2 = transition(s1, {
        type: 'BUDGET_LINE_CONFIRMED',
        at: TEST_DATE,
      });
      expect(r2.ok).toBe(true);
      if (r2.ok) {
        expect(r2.effects.filter((e) => e.kind === 'AUDIT').length).toBe(1);
      }

      // 3. Disburse
      const s2: FiscalSnapshot = {
        fiscal: 'COMMITTED',
        confidence: 'OFFICIAL_CITED',
        sourceDocumentId: 'd',
        sourcePage: 1,
        auditState: 'NOT_DISPATCHED',
      };
      const r3 = transition(s2, {
        type: 'DISBURSEMENT_RECORDED',
        disbursementDocumentId: 'doc-d',
        at: TEST_DATE,
      });
      expect(r3.ok).toBe(true);
      if (r3.ok) {
        expect(r3.effects.filter((e) => e.kind === 'AUDIT').length).toBe(1);
      }

      // 4. Reconcile
      const s3: FiscalSnapshot = {
        fiscal: 'DISBURSED',
        confidence: 'OFFICIAL_CITED',
        sourceDocumentId: 'd',
        sourcePage: 1,
        auditState: 'PHYSICALLY_CONFIRMED',
      };
      const r4 = transition(s3, {
        type: 'RECONCILED',
        at: TEST_DATE,
      });
      expect(r4.ok).toBe(true);
      if (r4.ok) {
        expect(r4.effects.filter((e) => e.kind === 'AUDIT').length).toBe(1);
      }
    });

    it('INV-05: Illegal transitions produce zero effects and return typed error', () => {
      const s: FiscalSnapshot = {
        fiscal: 'PROMISED',
        confidence: 'UNOFFICIAL_ESTIMATE',
        sourceDocumentId: null,
        sourcePage: null,
        auditState: 'NOT_DISPATCHED',
      };

      const result = transition(s, {
        type: 'RECONCILED',
        at: TEST_DATE,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('E_ILLEGAL_TRANSITION');
        expect(result.effects).toEqual([]);
      }
    });

    it('INV-07: Unofficial estimate project never reaches COMMITTED', () => {
      const s: FiscalSnapshot = {
        fiscal: 'PROMISED',
        confidence: 'UNOFFICIAL_ESTIMATE',
        sourceDocumentId: null,
        sourcePage: null,
        auditState: 'NOT_DISPATCHED',
      };

      const result = transition(s, {
        type: 'BUDGET_LINE_CONFIRMED',
        at: TEST_DATE,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('E_UNOFFICIAL_ESTIMATE_CANNOT_COMMIT');
        expect(result.effects).toEqual([]);
      }
    });
  });
});
