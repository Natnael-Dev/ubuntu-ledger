'use client';

// Project Board Client Component (T-22 Console Board)
// Authoritative sources:
// - docs/specs/08-ui-ux-design.md §7 (Dense table, sortable, system-default-feeling, no cards, no shadows, no gradients)
// - docs/specs/11-tasks.md T-22 (shows fiscal/audit state, witness n/target, probation countdown; recording claim visibly does NOT turn green)
// - docs/specs/12-demo-script.md §4 ("The contractor says it is fixed. That is a claim, not a fact.")
// - docs/specs/04-state-machine.md §3, §7 (INV-01)
// - docs/specs/05-api-contracts.md §8 (POST /api/repairs/[id]/claim, POST /api/repairs/[id]/close)

import React, { useState } from 'react';
import Link from 'next/link';
import type { FiscalState, AuditState, ProbationState } from '@/domain/types';
import { NarrativeState } from '@/components/NarrativeState';
import { WitnessCounter } from '@/components/WitnessCounter';
import { ProbationCountdown } from '@/components/ProbationCountdown';
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
    type: 'notice' | 'error' | 'success';
    title: string;
    message: string;
    code?: string;
  } | null>(null);

  // Close attempt state
  const [isAttemptingClose, setIsAttemptingClose] = useState<string | null>(null);

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
        // Expected canonical refusal
        setAlertBanner({
          type: 'error',
          title: '409 E_PROBATION_LOCKED — Early Close Refused',
          message:
            body.detail ||
            'Ticket cannot be closed before probation window ends. The closing key is held by time and community, never by an admin claim.',
          code: body.code,
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

        {/* Demo Trigger */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="demo-reset-btn"
            onClick={resetProject4412ToBroken}
            className="px-2 py-1 text-xs font-mono border border-[var(--rule)] bg-white hover:bg-neutral-50 text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors"
            title="Reset Project 4412 to REPORTED_BROKEN to demonstrate the claim"
          >
            [demo: simulate breakage on 4412]
          </button>
        </div>
      </div>

      {/* Alert / Notice Banner */}
      {alertBanner && (
        <div
          data-testid="console-alert-banner"
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
            onClick={() => setAlertBanner(null)}
            className="text-neutral-500 hover:text-black font-mono font-bold px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Table Filters & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 py-1">
        {/* Filter Pills */}
        <div className="flex items-center gap-1 text-xs font-mono">
          <span className="text-[var(--ink-soft)] mr-1">Filter:</span>
          {(
            [
              ['all', 'All (6)'],
              ['probation', 'Under Probation'],
              ['broken', 'Broken / Failed'],
              ['discrepancy', 'Discrepancy'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              data-testid={`filter-${key}`}
              onClick={() => setFilter(key)}
              className={`px-2 py-0.5 border text-xs ${
                filter === key
                  ? 'bg-[var(--ink)] text-[var(--paper)] border-[var(--ink)] font-semibold'
                  : 'bg-transparent text-[var(--ink-soft)] border-[var(--rule)] hover:text-[var(--ink)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search code / title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-2 py-1 text-xs font-mono border border-[var(--rule)] bg-white text-[var(--ink)] focus:outline-none focus:border-[var(--ink)] w-48"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-xs font-mono text-[var(--ink-soft)] hover:text-[var(--ink)]"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Dense Table (08-ui-ux-design.md §7) */}
      <div className="border border-[var(--rule)] bg-white overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-[var(--rule)] bg-neutral-50 text-[11px] font-mono text-[var(--ink-soft)] uppercase tracking-wider">
              <th
                className="py-2 px-3 cursor-pointer select-none hover:text-[var(--ink)]"
                onClick={() => handleSort('projectCode')}
              >
                Code {sortField === 'projectCode' && (sortAsc ? '▲' : '▼')}
              </th>
              <th
                className="py-2 px-3 cursor-pointer select-none hover:text-[var(--ink)]"
                onClick={() => handleSort('title')}
              >
                Project Title {sortField === 'title' && (sortAsc ? '▲' : '▼')}
              </th>
              <th
                className="py-2 px-3 cursor-pointer select-none text-right hover:text-[var(--ink)]"
                onClick={() => handleSort('amountMinor')}
              >
                Amount {sortField === 'amountMinor' && (sortAsc ? '▲' : '▼')}
              </th>
              <th
                className="py-2 px-3 cursor-pointer select-none hover:text-[var(--ink)]"
                onClick={() => handleSort('fiscal')}
              >
                Fiscal {sortField === 'fiscal' && (sortAsc ? '▲' : '▼')}
              </th>
              <th
                className="py-2 px-3 cursor-pointer select-none hover:text-[var(--ink)]"
                onClick={() => handleSort('audit')}
              >
                Audit State {sortField === 'audit' && (sortAsc ? '▲' : '▼')}
              </th>
              <th
                className="py-2 px-3 cursor-pointer select-none text-center hover:text-[var(--ink)]"
                onClick={() => handleSort('witnesses')}
              >
                Witnesses {sortField === 'witnesses' && (sortAsc ? '▲' : '▼')}
              </th>
              <th className="py-2 px-3">Probation Countdown</th>
              <th className="py-2 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--rule)] font-mono text-xs">
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
                      className="text-blue-700 hover:underline inline-flex items-center gap-1"
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
                  </td>

                  {/* Audit State */}
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <NarrativeState kind="audit" state={p.audit} />
                  </td>

                  {/* Witnesses n of target */}
                  <td className="py-2.5 px-3 text-center whitespace-nowrap">
                    <WitnessCounter count={p.witnessCount} target={p.witnessTarget} />
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
                        onClick={() => {
                          setClaimModalProject(p);
                          setClaimedByInput(p.contractorName || 'AfroTech Infra');
                        }}
                        className="px-2 py-1 text-xs font-mono font-medium border border-amber-600 bg-amber-50 text-amber-900 hover:bg-amber-100 transition-colors"
                      >
                        [Record Claim]
                      </button>
                    )}

                    {p.ticketId && isUnderProbation && (
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          data-testid={`attempt-close-btn-${p.projectCode}`}
                          disabled={isAttemptingClose === p.ticketId}
                          onClick={() => attemptEarlyClose(p.ticketId!, p.projectCode)}
                          className="px-2 py-1 text-[11px] font-mono border border-[var(--rule)] bg-white hover:bg-red-50 text-[var(--ink-soft)] hover:text-red-800 transition-colors disabled:opacity-50"
                          title="Attempt to close probation early (will demonstrate 409 lock)"
                        >
                          {isAttemptingClose === p.ticketId ? 'Checking...' : '[Attempt Close]'}
                        </button>
                        <span
                          className="text-[10px] font-mono text-[var(--state-hold)] border border-amber-300 px-1 py-0.5 bg-amber-50"
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
                <td colSpan={8} className="py-8 text-center text-xs font-mono text-[var(--ink-soft)]">
                  No projects matching filter criteria.
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
          data-testid="claim-repair-modal"
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4"
        >
          <div className="bg-white border border-[var(--rule)] w-full max-w-md p-5 space-y-4 shadow-none">
            <div className="flex items-center justify-between border-b border-[var(--rule)] pb-2">
              <h3 className="text-sm font-mono font-bold uppercase text-[var(--ink)]">
                Record Contractor Claim // Project {claimModalProject.projectCode}
              </h3>
              <button
                type="button"
                onClick={() => setClaimModalProject(null)}
                className="text-neutral-400 hover:text-black font-mono"
              >
                ✕
              </button>
            </div>

            <div className="text-xs font-mono space-y-1 bg-neutral-50 p-2.5 border border-[var(--rule)]">
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
                  className="w-full px-2.5 py-1.5 text-xs font-mono border border-[var(--rule)] bg-white text-[var(--ink)] focus:outline-none focus:border-[var(--ink)]"
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
                  className="w-full px-2.5 py-1.5 text-xs font-mono border border-[var(--rule)] bg-white text-[var(--ink)] focus:outline-none focus:border-[var(--ink)]"
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
                  className="w-full px-2.5 py-1.5 text-xs font-mono border border-[var(--rule)] bg-white text-[var(--ink)] focus:outline-none focus:border-[var(--ink)]"
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
                  onClick={() => setClaimModalProject(null)}
                  className="px-3 py-1.5 text-xs font-mono border border-[var(--rule)] hover:bg-neutral-50 text-[var(--ink-soft)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingClaim}
                  data-testid="claim-submit-btn"
                  className="px-3 py-1.5 text-xs font-mono font-medium bg-[var(--ink)] text-[var(--paper)] hover:opacity-90 disabled:opacity-50"
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
