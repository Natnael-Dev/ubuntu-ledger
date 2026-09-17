// NarrativeState Component
// Authoritative sources:
// - docs/specs/08-ui-ux-design.md §7, §8 (renders derived state + slots; never computes)
// - docs/specs/04-state-machine.md §8

import React from 'react';
import type { FiscalState, AuditState, ProbationState } from '@/domain/types';

export type StateKind = 'fiscal' | 'audit' | 'probation';

export interface NarrativeStateProps {
  kind: StateKind;
  state: FiscalState | AuditState | ProbationState | string;
  label?: string;
  className?: string;
}

const FISCAL_CONFIG: Record<
  FiscalState,
  { label: string; bg: string; text: string; border: string }
> = {
  PROMISED: {
    label: 'PROMISED',
    bg: 'bg-neutral-100',
    text: 'text-[var(--ink-soft)]',
    border: 'border-[var(--rule)]',
  },
  COMMITTED: {
    label: 'COMMITTED',
    bg: 'bg-amber-50',
    text: 'text-[var(--state-hold)]',
    border: 'border-amber-300',
  },
  DISBURSED: {
    label: 'DISBURSED',
    bg: 'bg-amber-50',
    text: 'text-[var(--state-hold)]',
    border: 'border-amber-300',
  },
  AUDITED: {
    label: 'AUDITED',
    bg: 'bg-emerald-50',
    text: 'text-[var(--state-open)]',
    border: 'border-emerald-400',
  },
};

const AUDIT_CONFIG: Record<
  AuditState,
  { label: string; bg: string; text: string; border: string }
> = {
  NOT_DISPATCHED: {
    label: 'NOT DISPATCHED',
    bg: 'bg-neutral-100',
    text: 'text-[var(--ink-soft)]',
    border: 'border-[var(--rule)]',
  },
  TASK_DISPATCHED: {
    label: 'TASK DISPATCHED',
    bg: 'bg-neutral-100',
    text: 'text-[var(--ink-soft)]',
    border: 'border-[var(--rule)]',
  },
  AWAITING_THRESHOLD: {
    label: 'AWAITING THRESHOLD',
    bg: 'bg-amber-50',
    text: 'text-[var(--state-hold)]',
    border: 'border-amber-300',
  },
  PHYSICALLY_CONFIRMED: {
    label: 'CONFIRMED',
    bg: 'bg-emerald-50',
    text: 'text-[var(--state-open)]',
    border: 'border-emerald-400',
  },
  DISCREPANCY_FLAGGED: {
    label: 'DISCREPANCY',
    bg: 'bg-red-50',
    text: 'text-[var(--state-break)]',
    border: 'border-red-300',
  },
};

const PROBATION_CONFIG: Record<
  ProbationState,
  { label: string; bg: string; text: string; border: string }
> = {
  REPORTED_BROKEN: {
    label: 'REPORTED BROKEN',
    bg: 'bg-red-50',
    text: 'text-[var(--state-break)]',
    border: 'border-red-400',
  },
  REPAIR_CLAIMED: {
    label: 'REPAIR CLAIMED',
    bg: 'bg-amber-50',
    text: 'text-[var(--state-hold)]',
    border: 'border-amber-400',
  },
  PROBATION_DAY_0: {
    label: 'PROBATION DAY 0',
    bg: 'bg-amber-50',
    text: 'text-[var(--state-hold)]',
    border: 'border-amber-400',
  },
  PROBATION_ACTIVE: {
    label: 'PROBATION ACTIVE',
    bg: 'bg-amber-50',
    text: 'text-[var(--state-hold)]',
    border: 'border-amber-400',
  },
  VERIFIED_SUSTAINED: {
    label: 'VERIFIED SUSTAINED',
    bg: 'bg-emerald-50',
    text: 'text-[var(--state-open)]',
    border: 'border-emerald-400',
  },
  PROBATION_FAILED: {
    label: 'PROBATION FAILED',
    bg: 'bg-red-50',
    text: 'text-[var(--state-break)]',
    border: 'border-red-400',
  },
};

export function NarrativeState({
  kind,
  state,
  label,
  className = '',
}: NarrativeStateProps) {
  let config: { label: string; bg: string; text: string; border: string } = {
    label: String(state),
    bg: 'bg-neutral-100',
    text: 'text-[var(--ink-soft)]',
    border: 'border-[var(--rule)]',
  };

  if (kind === 'fiscal' && state in FISCAL_CONFIG) {
    config = FISCAL_CONFIG[state as FiscalState];
  } else if (kind === 'audit' && state in AUDIT_CONFIG) {
    config = AUDIT_CONFIG[state as AuditState];
  } else if (kind === 'probation' && state in PROBATION_CONFIG) {
    config = PROBATION_CONFIG[state as ProbationState];
  }

  const displayText = label || config.label;

  return React.createElement(
    'span',
    {
      'data-testid': `state-badge-${kind}-${state}`,
      className: `inline-flex items-center px-2 py-0.5 text-[11px] font-mono font-medium uppercase tracking-wider border rounded-none ${config.bg} ${config.text} ${config.border} ${className}`,
    },
    displayText
  );
}
