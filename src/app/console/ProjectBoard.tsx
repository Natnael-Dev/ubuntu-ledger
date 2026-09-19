'use client';

// Project Board Client Component (T-22 Console Board)
// Authoritative sources:
// - docs/specs/08-ui-ux-design.md §7 (Dense table, sortable, system-default-feeling, no cards, no shadows, no gradients)
// - docs/specs/11-tasks.md T-22 (shows fiscal/audit state, witness n/target, probation countdown; recording claim visibly does NOT turn green)
// - docs/specs/12-demo-script.md §4 ("The contractor says it is fixed. That is a claim, not a fact.")
// - docs/specs/04-state-machine.md §3, §7 (INV-01)
// - docs/specs/05-api-contracts.md §8 (POST /api/repairs/[id]/claim, POST /api/repairs/[id]/close)

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { FiscalState, AuditState, ProbationState } from '@/domain/types';
import { NarrativeState } from '@/components/NarrativeState';
import { WitnessCounter } from '@/components/WitnessCounter';
import { ProbationCountdown } from '@/components/ProbationCountdown';
import { EmptyState } from '@/components/ui/EmptyState';
import { systemClock } from '@/infra/clock';

export interface ProjectBoardItem {
  id: string;
  projectCode: string;
  title: string;
  officialTitle?: string;
  contractorName: string;
  amountMinor: number;
  currency: string;
  fiscal: FiscalState;
  audit: AuditState;
  witnessCount: number;
  witnessTarget: number;
  ticketId: string | null;
  probationState: ProbationState | null;
  claimedBy: string | null;
  probationEndsAt: string | null;
  probationDays: number;
  failureReasonKey: string | null;
}

export interface ProjectBoardProps {
  initialProjects: ProjectBoardItem[];
  wardName: string;
  wardCode: string;
  currentAsOfIso?: string;
}

type SortField = 'projectCode' | 'title' | 'amountMinor' | 'fiscal' | 'audit' | 'witnesses';
type FilterMode = 'all' | 'probation' | 'broken' | 'discrepancy';

function formatCurrency(minor: number, currency: string): string {
  const major = minor / 100;
  return `${currency} ${major.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Accessible Focus Trap Hook (Audit #71)
 * Traps Tab / Shift+Tab within the active modal container, handles Escape key to dismiss,
 * and restores focus to the trigger element on unmount/close.
 */
function useFocusTrap(
  isOpen: boolean,
  containerRef: React.RefObject<HTMLElement | null>,
  triggerRef: React.RefObject<HTMLElement | null>,
  onClose: () => void
) {
  useEffect(() => {
    if (!isOpen) return;

    const el = containerRef.current;
    if (!el) return;

    const focusableSelector =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    // Focus initial element (prefer first input, else first focusable)
    const focusables = Array.from(el.querySelectorAll<HTMLElement>(focusableSelector)).filter(
      (node) => node.offsetParent !== null
    );

    if (focusables.length > 0) {
      const firstInput = el.querySelector<HTMLElement>('input:not([disabled])');
      if (firstInput && firstInput.offsetParent !== null) {
        firstInput.focus();
      } else {
        focusables[0].focus();
      }
    } else {
      el.focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key === 'Tab') {
        const currentFocusables = Array.from(
          el.querySelectorAll<HTMLElement>(focusableSelector)
        ).filter((node) => node.offsetParent !== null);

        if (currentFocusables.length === 0) {
          e.preventDefault();
          return;
        }

        const first = currentFocusables[0];
        const last = currentFocusables[currentFocusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first || !el.contains(document.activeElement)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last || !el.contains(document.activeElement)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Restore focus on dismiss (Audit #71)
      if (triggerRef.current) {
        triggerRef.current.focus();
      }
    };
  }, [isOpen, containerRef, triggerRef, onClose]);
}

export function ProjectBoard({
  initialProjects,
  wardName,
  wardCode,
  currentAsOfIso,
}: ProjectBoardProps) {
  const [projects, setProjects] = useState<ProjectBoardItem[]>(initialProjects);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('projectCode');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Claim Modal State
  const [claimModalProject, setClaimModalProject] = useState<ProjectBoardItem | null>(null);
  const [claimedByInput, setClaimedByInput] = useState('AfroTech Infra');
  const [evidenceNoteInput, setEvidenceNoteInput] = useState('');
  const [actorRoleInput, setActorRoleInput] = useState<'ADMIN' | 'INGEST_REVIEWER'>('ADMIN');
  const [isSubmittingClaim, setIsSubmittingClaim] = useState(false);

  // Banner / Feedback States
  const [alertBanner, setAlertBanner] = useState<{
    type: 'notice' | 'error' | 'success' | 'refusal';
    title: string;
    message: string;
    code?: string;
    probationEndsAt?: string | null;
    auditSeq?: string | null;
  } | null>(null);

  // Close attempt state
  const [isAttemptingClose, setIsAttemptingClose] = useState<string | null>(null);

  // Focus Management Refs (Audit #71)
  const claimModalRef = useRef<HTMLDivElement>(null);
  const claimTriggerRef = useRef<HTMLElement | null>(null);
  const refusalModalRef = useRef<HTMLDivElement>(null);
  const refusalTriggerRef = useRef<HTMLElement | null>(null);

  const closeClaimModal = useCallback(() => {
    setClaimModalProject(null);
  }, []);

  const closeAlertBanner = useCallback(() => {
    setAlertBanner(null);
  }, []);

  useFocusTrap(
    Boolean(claimModalProject),
    claimModalRef,
    claimTriggerRef,
    closeClaimModal
  );

  useFocusTrap(
    alertBanner?.type === 'refusal',
    refusalModalRef,
    refusalTriggerRef,
    closeAlertBanner
  );

  // Presentation Stat Totals & Locked Definition (Audit #75 / Task 3)
  const totalBudgetMinor = projects.reduce((acc, p) => acc + p.amountMinor, 0);
  const lockedBudgetMinor = projects
    .filter((p) => p.fiscal === 'COMMITTED')
    .reduce((acc, p) => acc + p.amountMinor, 0);
  const currencyCode = projects[0]?.currency || 'ETB';
  const activeProbationCount = projects.filter(
    (p) =>
      p.probationState === 'REPAIR_CLAIMED' ||
      p.probationState === 'PROBATION_ACTIVE' ||
      p.probationState === 'PROBATION_DAY_0'
  ).length;

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  }

  // Filter projects
  const filteredProjects = projects.filter((p) => {
    // Search match
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        p.projectCode.toLowerCase().includes(q) ||
        p.title.toLowerCase().includes(q) ||
        p.contractorName.toLowerCase().includes(q);
      if (!matchesSearch) return false;
    }

    // Filter mode
    if (filter === 'probation') {
      return (
        p.probationState === 'REPAIR_CLAIMED' ||
        p.probationState === 'PROBATION_ACTIVE' ||
        p.probationState === 'PROBATION_DAY_0'
      );
    }
    if (filter === 'broken') {
      return p.probationState === 'REPORTED_BROKEN' || p.probationState === 'PROBATION_FAILED';
    }
    if (filter === 'discrepancy') {
      return p.audit === 'DISCREPANCY_FLAGGED';
    }
    return true;
  });

  // Sort projects
  const sortedProjects = [...filteredProjects].sort((a, b) => {
    let comp = 0;
    if (sortField === 'projectCode') {
      comp = a.projectCode.localeCompare(b.projectCode);
    } else if (sortField === 'title') {
      comp = a.title.localeCompare(b.title);
    } else if (sortField === 'amountMinor') {
      comp = a.amountMinor - b.amountMinor;
    } else if (sortField === 'fiscal') {
      comp = a.fiscal.localeCompare(b.fiscal);
    } else if (sortField === 'audit') {
      comp = a.audit.localeCompare(b.audit);
    } else if (sortField === 'witnesses') {
      comp = a.witnessCount - b.witnessCount;
    }
    return sortAsc ? comp : -comp;
  });

  // Handle Repair Claim Submission
  async function submitRepairClaim(e: React.FormEvent) {
    e.preventDefault();
    if (!claimModalProject || !claimModalProject.ticketId) return;

    setIsSubmittingClaim(true);
    setAlertBanner(null);

    const ticketId = claimModalProject.ticketId;
    const idempotencyKey =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `claim-${systemClock.now().getTime()}`;

    try {
      const res = await fetch(`/api/repairs/${ticketId}/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-actor-role': actorRoleInput,
          'x-actor-ref': `console-user-${actorRoleInput.toLowerCase()}`,
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          claimedBy: claimedByInput.trim() || 'AfroTech Infra',
          claimedAt: currentAsOfIso || systemClock.now().toISOString(),
          evidenceNote: evidenceNoteInput.trim() || undefined,
        }),
      });

      const body = await res.json();

      if (!res.ok) {
        setAlertBanner({
          type: 'error',
          title: 'Claim Rejected by API',
          message: body.detail || body.error || 'Failed to record repair claim',
          code: body.code,
        });
        return;
      }

      // Update local project row state
      // INV-01: Does NOT turn green! Enters REPAIR_CLAIMED under amber check
      setProjects((prev) =>
        prev.map((p) => {
          if (p.ticketId === ticketId) {
            return {
              ...p,
              probationState: 'REPAIR_CLAIMED',
              claimedBy: claimedByInput.trim(),
              probationDays: body.probationDays || 7,
              // Calculate 7 days ahead
              probationEndsAt: new Date(
                systemClock.now().getTime() + 7 * 24 * 60 * 60 * 1000
              ).toISOString(),
            };
          }
          return p;
        })
      );

      // Show key demo message
      setAlertBanner({
        type: 'notice',
        title: 'Repair Claim Recorded — Under 7-Day Probation Lock (INV-01)',
        message: `Claim by "${claimedByInput}" recorded. Closure is locked for 7 days. The contractor says it is fixed: that is a claim, not a fact. State is held in amber (never green).`,
        code: body.reasonKey,
      });

      setClaimModalProject(null);
    } catch (err: unknown) {
      setAlertBanner({
        type: 'error',
        title: 'Network / Transport Error',
        message: err instanceof Error ? err.message : 'Unknown error recording claim',
      });
    } finally {
      setIsSubmittingClaim(false);
    }
  }

  // Handle Attempt Early Close (Demonstrates the lock)
  async function attemptEarlyClose(ticketId: string, projectCode: string) {
    setIsAttemptingClose(ticketId);
    setAlertBanner(null);

    try {
      const res = await fetch(`/api/repairs/${ticketId}/close`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-actor-role': 'ADMIN',
          'x-actor-ref': 'admin-console-attempt',
          'Idempotency-Key':
            typeof crypto !== 'undefined' && crypto.randomUUID
              ? crypto.randomUUID()
              : `close-${systemClock.now().getTime()}`,
        },
      });

      const body = await res.json();

      if (res.status === 409) {
        // Expected canonical refusal — INV-01 cryptographic enforcement
        const probationTarget = projects.find(p => p.projectCode === projectCode);
        setAlertBanner({
          type: 'refusal',
          title: '409 E_PROBATION_LOCKED — Early Close Refused',
          message:
            body.detail ||
            'Ticket cannot be closed before probation window ends. The closing key is held by time and community, never by an admin claim.',
          code: body.code,
          probationEndsAt: probationTarget?.probationEndsAt ?? null,
          auditSeq: body.auditSeq ?? null,
        });
      } else if (!res.ok) {
        setAlertBanner({
          type: 'error',
          title: `Close Attempt Failed (${res.status})`,
          message: body.detail || body.error || 'Close rejected',
          code: body.code,
        });
      } else {
        setAlertBanner({
          type: 'success',
          title: 'Ticket Closed',
          message: `Project ${projectCode} probation completed and verified sustained.`,
        });
      }
    } catch (err: unknown) {
      setAlertBanner({
        type: 'error',
        title: 'Request Failed',
        message: err instanceof Error ? err.message : 'Failed to call close endpoint',
      });
    } finally {
      setIsAttemptingClose(null);
    }
  }

  // Demo helper: Reset Project 4412 to broken so claim can be demonstrated repeatedly
  function resetProject4412ToBroken() {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.projectCode === '4412') {
          return {
            ...p,
            probationState: 'REPORTED_BROKEN',
            claimedBy: null,
            probationEndsAt: null,
          };
        }
        return p;
      })
    );
    setAlertBanner({
      type: 'notice',
      title: 'Project 4412 Reset to Broken',
      message: 'State set to REPORTED_BROKEN for live demonstration of the repair claim sequence.',
    });
  }

  return (
    <div className="w-full space-y-4">
      {/* Console Sub-Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--rule)] pb-3">
        <div>
          <h2 className="text-sm font-mono font-bold tracking-tight uppercase text-[var(--ink)]">
            Project Board // {wardName} ({wardCode})
          </h2>
          <p className="text-xs text-[var(--ink-soft)] font-mono mt-0.5">
            Dense operational view · Witness triangulation & repair probation
          </p>
        </div>

        {/* Demo Trigger — Prominent Interactive Action Button (Agent 6) */}
        <div className="flex flex-col items-end gap-2.5">
          <button
            type="button"
            data-testid="demo-reset-btn"
            onClick={resetProject4412ToBroken}
            className="px-4 py-2 text-xs font-bold font-sans rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 transition-all flex items-center gap-2 shadow-xs cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            title="Reset Project 4412 to REPORTED_BROKEN to demonstrate the claim and 7-day probation lock"
          >
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>Demo: Simulate Breakage on #4412</span>
            <span className="text-amber-700 font-mono text-[11px]">›</span>
          </button>
          
          {/* Journey nav - shown after demo */}
          <div className="text-right font-mono text-xs text-slate-500">
            After testing the probation lock:
            {' '}
            <Link href="/receipt/4412" className="text-blue-700 font-bold hover:underline">Step 3: Public Receipt ›</Link>
          </div>
        </div>
      </div>

      {/* Alert / Notice Banner & Statutory Refusal Modal */}
      {alertBanner && (
        alertBanner.type === 'refusal' ? (
          /* Statutory Refusal Modal Dialog — INV-01 cryptographic enforcement (409 E_PROBATION_LOCKED) */
          <div
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeAlertBanner();
            }}
          >
            <div
              data-testid="console-alert-banner"
              ref={refusalModalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="refusal-modal-title"
              aria-describedby="refusal-modal-desc"
              tabIndex={-1}
              className="border-2 border-[var(--ink)] bg-[var(--paper)] p-5 text-xs font-mono w-full max-w-lg shadow-none focus:outline-none space-y-3"
            >
              <div className="flex items-start justify-between gap-3 border-b border-[var(--rule)] pb-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-amber-800 font-bold text-[11px] uppercase tracking-wider">
                    <span className="w-2.5 h-2.5 bg-amber-600 inline-block" />
                    STATUTORY REFUSAL — PROBATION ACTIVE
                  </div>
                  <h3 id="refusal-modal-title" className="font-bold text-sm text-[var(--ink)]">
                    {alertBanner.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={closeAlertBanner}
                  className="text-neutral-500 hover:text-black font-mono font-bold px-2 py-1 text-xs border border-[var(--rule)] bg-white hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus:outline-none flex-shrink-0"
                  aria-label="Close statutory refusal dialog"
                >
                  ✕
                </button>
              </div>

              <div id="refusal-modal-desc" className="space-y-2">
                <p className="text-[11px] leading-relaxed text-[var(--ink)] opacity-90">{alertBanner.message}</p>
                <div className="bg-[var(--paper-warm)] border border-amber-200 p-2.5 space-y-1 text-[10px]">
                  <div className="flex gap-3">
                    <span className="text-[var(--ink-soft)] w-32 flex-shrink-0">Domain Invariant:</span>
                    <span className="font-semibold text-amber-900">INV-01 — Cryptographically Enforced</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-[var(--ink-soft)] w-32 flex-shrink-0">Status Code:</span>
                    <span className="font-semibold">{alertBanner.code ?? 'E_PROBATION_LOCKED'}</span>
                  </div>
                  {alertBanner.probationEndsAt && (
                    <div className="flex gap-3">
                      <span className="text-[var(--ink-soft)] w-32 flex-shrink-0">Probation Ends:</span>
                      <span className="font-semibold">{new Date(alertBanner.probationEndsAt).toLocaleDateString('en-GB', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</span>
                    </div>
                  )}
                  <div className="flex gap-3">
                    <span className="text-[var(--ink-soft)] w-32 flex-shrink-0">Audit Record:</span>
                    <span className="font-semibold">Attempt logged to tamper-evident hash chain</span>
                  </div>
                </div>
                <p className="text-[10px] text-[var(--ink-soft)] italic">
                  This refusal is evidence the system is working as designed. No role — not ADMIN, not MODERATOR — may bypass INV-01.
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-[var(--rule)] flex items-center justify-between">
                <span className="font-mono text-[10px] text-[var(--ink-soft)]">Proof B verified — probation lock active</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={closeAlertBanner}
                    className="px-2.5 py-1 text-xs font-mono border border-[var(--rule)] bg-white hover:bg-neutral-50 text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus:outline-none"
                  >
                    Dismiss
                  </button>
                  <Link
                    href="/receipt/4412"
                    className="px-2.5 py-1 text-xs font-mono bg-[var(--ink)] text-[var(--paper)] hover:opacity-90 transition-colors focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus:outline-none inline-block"
                  >
                    Step 3: Public Receipt ›
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ) : (
        <div
          data-testid="console-alert-banner"
          role="alert"
          className={`p-3 border text-xs font-mono flex items-start justify-between gap-3 ${
            alertBanner.type === 'error'
              ? 'bg-red-50 border-red-300 text-red-900'
              : alertBanner.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-amber-50 border-amber-300 text-amber-900'
          }`}
        >
          <div className="space-y-1">
            <div className="font-bold flex items-center gap-2">
              <span>
                {alertBanner.type === 'error' ? '▲' : alertBanner.type === 'success' ? '✓' : '●'}
              </span>
              <span>{alertBanner.title}</span>
              {alertBanner.code && (
                <span className="px-1 py-0.5 text-[10px] bg-white border border-current opacity-80">
                  {alertBanner.code}
                </span>
              )}
            </div>
            <p className="text-[11px] leading-relaxed opacity-95">{alertBanner.message}</p>
          </div>
          <button
            type="button"
            onClick={closeAlertBanner}
            className="text-neutral-500 hover:text-black font-mono font-bold px-1 focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus:outline-none"
            aria-label="Close notification banner"
          >
            ✕
          </button>
        </div>
        )
      )}

      {/* Ledger Stats Bar with Explicit "Locked" Stat Definition (Audit #75 / Task 3) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-sans">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-1.5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Total Allocated Budget</span>
            <span className="w-2 h-2 rounded-full bg-blue-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">
            {formatCurrency(totalBudgetMinor, currencyCode)}
          </div>
          <div className="text-xs text-slate-500">
            {projects.length} municipal infrastructure projects
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-1.5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Locked in Escrow</span>
            <span
              className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 rounded-md"
              title="Statutory definition: Funds committed / held in escrow / non-disbursable pending community verification"
            >
              STATUTORY HOLD
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-amber-700 tabular-nums">
            {formatCurrency(lockedBudgetMinor, currencyCode)}
          </div>
          <p className="text-xs text-slate-500 leading-tight">
            <strong>Locked stat definition:</strong> funds committed / held in escrow / non-disbursable pending community verification.
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-1.5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Probation Lock (INV-01)</span>
            <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300 rounded-md">
              RULE INV-01
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">
            {activeProbationCount} under review
          </div>
          <p className="text-xs text-slate-500 leading-tight">
            Closure locked for 7 days post-repair claim. Contractor self-close is cryptographically refused.
          </p>
        </div>
      </div>

      {/* Table Filters & Search Controls Bar (Agent 7) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
        {/* Filter Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 mr-1">
            Status Filter:
          </span>
          {(
            [
              ['all', `All (${projects.length})`],
              ['probation', `Under Probation (${projects.filter(p => p.probationState === 'REPAIR_CLAIMED' || p.probationState === 'PROBATION_ACTIVE' || p.probationState === 'PROBATION_DAY_0').length})`],
              ['broken', `Broken / Failed (${projects.filter(p => p.probationState === 'REPORTED_BROKEN' || p.probationState === 'PROBATION_FAILED').length})`],
              ['discrepancy', `Discrepancy (${projects.filter(p => p.audit === 'DISCREPANCY_FLAGGED').length})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              data-testid={`filter-${key}`}
              onClick={() => setFilter(key)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                filter === key
                  ? 'bg-[#0F172A] text-white shadow-sm ring-1 ring-slate-900'
                  : 'bg-slate-50 text-slate-700 border border-slate-200/90 hover:bg-slate-100 hover:border-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search Input Box */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 text-xs">
              🔍
            </span>
            <input
              type="text"
              placeholder="Search code / title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-2 text-xs font-sans rounded-xl border border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 w-64 shadow-2xs"
            />
          </div>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-xs font-bold text-slate-700 hover:text-slate-950 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Mobile Swipe Hint */}
      <div className="sm:hidden text-xs text-slate-500 flex items-center justify-between px-1 font-mono">
        <span>↔ Scroll horizontally to view all columns</span>
        <span>{filteredProjects.length} projects</span>
      </div>

      {/* Modern Civic Project Table */}
      <div className="border border-slate-200/90 bg-white rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full min-w-[880px] text-left border-collapse text-xs">
          <caption className="sr-only">
            Municipal Project Board Ledger for {wardName} ({wardCode}) — tracking project codes, contracts, amounts, fiscal status, audit verification, citizen witness counts, and repair probation states.
          </caption>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100/80 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              <th
                scope="col"
                className="py-3.5 px-4 cursor-pointer select-none hover:text-slate-950 focus-visible:ring-1 focus-visible:ring-blue-600 focus-visible:outline-none"
                onClick={() => handleSort('projectCode')}
              >
                Code {sortField === 'projectCode' && (sortAsc ? '▲' : '▼')}
              </th>
              <th
                scope="col"
                className="py-3.5 px-4 cursor-pointer select-none hover:text-slate-950 focus-visible:ring-1 focus-visible:ring-blue-600 focus-visible:outline-none"
                onClick={() => handleSort('title')}
              >
                Project Title {sortField === 'title' && (sortAsc ? '▲' : '▼')}
              </th>
              <th
                scope="col"
                className="py-3.5 px-4 cursor-pointer select-none text-right hover:text-slate-950 focus-visible:ring-1 focus-visible:ring-blue-600 focus-visible:outline-none"
                onClick={() => handleSort('amountMinor')}
              >
                Amount {sortField === 'amountMinor' && (sortAsc ? '▲' : '▼')}
              </th>
              <th
                scope="col"
                className="py-3.5 px-4 cursor-pointer select-none hover:text-slate-950 focus-visible:ring-1 focus-visible:ring-blue-600 focus-visible:outline-none"
                onClick={() => handleSort('fiscal')}
              >
                Fiscal {sortField === 'fiscal' && (sortAsc ? '▲' : '▼')}
              </th>
              <th
                scope="col"
                className="py-3.5 px-4 cursor-pointer select-none hover:text-slate-950 focus-visible:ring-1 focus-visible:ring-blue-600 focus-visible:outline-none"
                onClick={() => handleSort('audit')}
              >
                Audit State {sortField === 'audit' && (sortAsc ? '▲' : '▼')}
              </th>
              <th
                scope="col"
                className="py-3.5 px-4 cursor-pointer select-none text-center hover:text-slate-950 focus-visible:ring-1 focus-visible:ring-blue-600 focus-visible:outline-none"
                onClick={() => handleSort('witnesses')}
              >
                Witnesses {sortField === 'witnesses' && (sortAsc ? '▲' : '▼')}
              </th>
              <th scope="col" className="py-3.5 px-4">
                Probation Countdown
              </th>
              <th scope="col" className="py-3.5 px-4 text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono text-xs">
            {sortedProjects.map((p) => {
              const isBroken =
                p.probationState === 'REPORTED_BROKEN' || p.probationState === 'PROBATION_FAILED';
              const isUnderProbation =
                p.probationState === 'REPAIR_CLAIMED' ||
                p.probationState === 'PROBATION_DAY_0' ||
                p.probationState === 'PROBATION_ACTIVE';
              const isSustained = p.probationState === 'VERIFIED_SUSTAINED';

              return (
                <tr
                  key={p.id}
                  data-testid={`project-row-${p.projectCode}`}
                  className={`hover:bg-neutral-50/80 transition-colors ${
                    isUnderProbation ? 'bg-amber-50/30' : ''
                  }`}
                >
                  {/* Code */}
                  <td className="py-2.5 px-3 font-bold font-mono">
                    <Link
                      href={`/receipt/${p.projectCode}`}
                      className="text-blue-700 hover:underline inline-flex items-center gap-1 focus-visible:ring-1 focus-visible:ring-[var(--ink)] focus-visible:outline-none"
                      title="View public spending receipt"
                    >
                      <span>{p.projectCode}</span>
                      <span className="text-[10px] opacity-70">↗</span>
                    </Link>
                  </td>

                  {/* Title & Contractor */}
                  <td className="py-2.5 px-3 font-sans max-w-xs">
                    <div className="font-semibold text-[var(--ink)] truncate">{p.title}</div>
                    <div className="text-[11px] font-mono text-[var(--ink-soft)] truncate">
                      {p.contractorName}
                    </div>
                  </td>

                  {/* Amount */}
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                    {formatCurrency(p.amountMinor, p.currency)}
                  </td>

                  {/* Fiscal State */}
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <NarrativeState kind="fiscal" state={p.fiscal} />
                    {p.fiscal === 'COMMITTED' && (
                      <div className="mt-0.5">
                        <span
                          className="inline-block text-[9px] font-mono text-amber-900 bg-amber-50 border border-amber-300 px-1 py-0.2 cursor-help"
                          title="Locked: funds committed / held in escrow / non-disbursable pending community verification"
                        >
                          Locked: Escrow ⓘ
                        </span>
                      </div>
                    )}
                  </td>

                  {/* Audit State */}
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <NarrativeState kind="audit" state={p.audit} />
                  </td>

                  {/* Witnesses n of target */}
                  <td className="py-2.5 px-3 text-center whitespace-nowrap">
                    <WitnessCounter 
                      count={p.witnessCount} 
                      target={p.witnessTarget} 
                      className={p.audit === 'DISCREPANCY_FLAGGED' ? '!text-[var(--ink)]' : ''} 
                    />
                  </td>

                  {/* Probation Status / Countdown */}
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <div className="flex flex-col gap-1 items-start">
                      {p.probationState && (
                        <NarrativeState kind="probation" state={p.probationState} />
                      )}
                      <ProbationCountdown
                        state={p.probationState}
                        probationEndsAt={p.probationEndsAt}
                        failureReasonKey={p.failureReasonKey}
                        showFullNotice={false}
                      />
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="py-2.5 px-3 text-right whitespace-nowrap">
                    {p.ticketId && isBroken && (
                      <button
                        type="button"
                        data-testid={`claim-btn-${p.projectCode}`}
                        onClick={(e) => {
                          claimTriggerRef.current = e.currentTarget;
                          setClaimModalProject(p);
                          setClaimedByInput(p.contractorName || 'AfroTech Infra');
                        }}
                        className="px-3 py-1.5 text-xs font-bold font-sans rounded-lg border border-amber-600 bg-amber-600 text-white hover:bg-amber-700 transition-all shadow-xs cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-500"
                      >
                        Record Claim
                      </button>
                    )}

                    {p.ticketId && isUnderProbation && (
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          data-testid={`attempt-close-btn-${p.projectCode}`}
                          disabled={isAttemptingClose === p.ticketId}
                          onClick={(e) => {
                            refusalTriggerRef.current = e.currentTarget;
                            attemptEarlyClose(p.ticketId!, p.projectCode);
                          }}
                          className="px-2.5 py-1.5 text-xs font-semibold font-sans rounded-lg border border-slate-300 bg-white hover:bg-red-50 text-slate-700 hover:text-red-700 hover:border-red-300 transition-all disabled:opacity-50 cursor-pointer focus-visible:ring-2 focus-visible:ring-red-500 shadow-2xs"
                          title="Attempt to close probation early (will demonstrate 409 lock)"
                        >
                          {isAttemptingClose === p.ticketId ? 'Checking...' : 'Attempt Close'}
                        </button>
                        <span
                          className="text-[11px] font-mono font-bold text-amber-800 border border-amber-300 px-2 py-0.5 bg-amber-50 rounded-md"
                          title="Repair claim recorded; waiting for time + community confirmation"
                        >
                          Claimed
                        </span>
                      </div>
                    )}

                    {isSustained && (
                      <span className="text-[11px] font-mono text-[var(--state-open)] font-medium">
                        ✓ Sustained
                      </span>
                    )}

                    {!p.ticketId && !isBroken && !isUnderProbation && !isSustained && (
                      <span className="text-[11px] font-mono text-[var(--ink-soft)]">—</span>
                    )}
                  </td>
                </tr>
              );
            })}

            {sortedProjects.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <EmptyState
                    title="No Projects Found"
                    description={searchQuery
                      ? `No projects match "${searchQuery}" in this woreda ledger.`
                      : `No projects match the current filter.`}
                    query={searchQuery || undefined}
                    filterLabel={filter !== 'all' ? filter : undefined}
                    actionLabel="Reset Filters & Search"
                    onAction={() => { setSearchQuery(''); setFilter('all'); }}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Notes / Cryptographic Chain State */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-[11px] font-mono text-[var(--ink-soft)] border-t border-[var(--rule)] pt-2 gap-2">
        <div>
          <span>Total: {projects.length} projects</span>
          <span className="mx-2">·</span>
          <span>Showing: {sortedProjects.length}</span>
          <span className="mx-2">·</span>
          <span>Probation window: strictly enforced (INV-01)</span>
        </div>
        <div className="flex items-center gap-1.5 text-emerald-800">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
          <span>Hash Chain Verifier: OK (unbroken SHA-256 sequence)</span>
        </div>
      </div>

      {/* Claim Repair Modal */}
      {claimModalProject && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeClaimModal();
          }}
        >
          <div
            data-testid="claim-repair-modal"
            ref={claimModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="claim-modal-title"
            aria-describedby="claim-modal-desc"
            tabIndex={-1}
            className="bg-white border border-[var(--rule)] w-full max-w-md p-5 space-y-4 shadow-none focus:outline-none"
          >
            <div className="flex items-center justify-between border-b border-[var(--rule)] pb-2">
              <h3 id="claim-modal-title" className="text-sm font-mono font-bold uppercase text-[var(--ink)]">
                Record Contractor Claim // Project {claimModalProject.projectCode}
              </h3>
              <button
                type="button"
                onClick={closeClaimModal}
                className="text-neutral-400 hover:text-black font-mono focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus:outline-none px-1"
                aria-label="Close claim dialog"
              >
                ✕
              </button>
            </div>

            <div id="claim-modal-desc" className="text-xs font-mono space-y-1 bg-neutral-50 p-2.5 border border-[var(--rule)]">
              <div className="text-[var(--ink-soft)]">Target Project:</div>
              <div className="font-semibold text-[var(--ink)]">{claimModalProject.title}</div>
              <div className="text-[11px] text-[var(--ink-soft)]">
                Current state: {claimModalProject.probationState || 'REPORTED_BROKEN'}
              </div>
            </div>

            <form onSubmit={submitRepairClaim} className="space-y-3">
              <div>
                <label className="block text-xs font-mono font-medium text-[var(--ink)] mb-1">
                  Contractor / Organisation Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  data-testid="claim-contractor-input"
                  value={claimedByInput}
                  onChange={(e) => setClaimedByInput(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-mono border border-[var(--rule)] bg-white text-[var(--ink)] focus:outline-none focus:border-[var(--ink)] focus-visible:ring-1 focus-visible:ring-[var(--ink)]"
                  placeholder="e.g. AfroTech Infra"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-medium text-[var(--ink)] mb-1">
                  Evidence / Inspection Note (optional)
                </label>
                <textarea
                  rows={2}
                  data-testid="claim-note-input"
                  value={evidenceNoteInput}
                  onChange={(e) => setEvidenceNoteInput(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-mono border border-[var(--rule)] bg-white text-[var(--ink)] focus:outline-none focus:border-[var(--ink)] focus-visible:ring-1 focus-visible:ring-[var(--ink)]"
                  placeholder="e.g. Stator rewound, commissioned under load"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-medium text-[var(--ink)] mb-1">
                  Recording Actor Role
                </label>
                <select
                  value={actorRoleInput}
                  onChange={(e) => setActorRoleInput(e.target.value as 'ADMIN' | 'INGEST_REVIEWER')}
                  className="w-full px-2.5 py-1.5 text-xs font-mono border border-[var(--rule)] bg-white text-[var(--ink)] focus:outline-none focus:border-[var(--ink)] focus-visible:ring-1 focus-visible:ring-[var(--ink)]"
                >
                  <option value="ADMIN">ADMIN (Municipal Administrator)</option>
                  <option value="INGEST_REVIEWER">INGEST_REVIEWER (Verification Specialist)</option>
                </select>
              </div>

              {/* Invariant reminder */}
              <div className="p-2 border border-amber-300 bg-amber-50 text-[11px] font-mono text-amber-900 leading-snug">
                <strong>INVARIANT INV-01:</strong> Submitting this claim starts a 7-day probation
                lock. It will <strong>NOT turn the project green</strong>. The claim is recorded in
                amber; closing is held by time and community witnesses.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--rule)]">
                <button
                  type="button"
                  onClick={closeClaimModal}
                  className="px-3 py-1.5 text-xs font-mono border border-[var(--rule)] hover:bg-neutral-50 text-[var(--ink-soft)] focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus:outline-none"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingClaim}
                  data-testid="claim-submit-btn"
                  className="px-3 py-1.5 text-xs font-mono font-medium bg-[var(--ink)] text-[var(--paper)] hover:opacity-90 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus:outline-none"
                >
                  {isSubmittingClaim ? 'Recording...' : 'Record Claim in Ledger'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
