// ProbationCountdown Component
// Authoritative sources:
// - docs/specs/08-ui-ux-design.md §7, §8 (days remaining; turns --state-break on failure)
// - docs/specs/04-state-machine.md §3, §7 (INV-01)
// - docs/specs/12-demo-script.md §4 ("Repair claimed. Under 7-day check. 7 days left.")

import React from 'react';
import type { ProbationState } from '@/domain/types';
import { systemClock } from '@/infra/clock';

export interface ProbationCountdownProps {
  state?: ProbationState | string | null;
  probationEndsAt?: Date | string | null;
  asOf?: Date | string;
  failureReasonKey?: string | null;
  className?: string;
  showFullNotice?: boolean;
}

export function ProbationCountdown({
  state,
  probationEndsAt,
  asOf,
  failureReasonKey,
  className = '',
  showFullNotice = false,
}: ProbationCountdownProps) {
  if (!state) {
    return React.createElement(
      'span',
      { className: `text-[var(--ink-soft)] font-mono text-xs ${className}` },
      '—'
    );
  }

  // 1. Sustained State: green
  if (state === 'VERIFIED_SUSTAINED') {
    return React.createElement(
      'span',
      {
        'data-testid': 'countdown-sustained',
        className: `inline-flex items-center gap-1 font-mono text-xs font-semibold text-[var(--state-open)] ${className}`,
      },
      React.createElement('span', null, '●'),
      React.createElement('span', null, 'SUSTAINED')
    );
  }

  // 2. Failure State: turns --state-break (red)
  if (state === 'PROBATION_FAILED') {
    return React.createElement(
      'div',
      {
        'data-testid': 'countdown-failed',
        className: `flex flex-col ${className}`,
      },
      React.createElement(
        'span',
        {
          className:
            'inline-flex items-center gap-1 font-mono text-xs font-bold text-[var(--state-break)]',
        },
        React.createElement('span', null, '✕'),
        React.createElement('span', null, 'PROBATION FAILED')
      ),
      failureReasonKey
        ? React.createElement(
            'span',
            { className: 'text-[11px] font-mono text-[var(--state-break)] opacity-90' },
            failureReasonKey
          )
        : null
    );
  }

  // 3. Broken / Unclaimed State: red
  if (state === 'REPORTED_BROKEN') {
    return React.createElement(
      'span',
      {
        'data-testid': 'countdown-broken',
        className: `inline-flex items-center gap-1 font-mono text-xs font-medium text-[var(--state-break)] ${className}`,
      },
      React.createElement('span', null, '▲'),
      React.createElement('span', null, 'BROKEN (unclaimed)')
    );
  }

  // 4. Active Probation states: REPAIR_CLAIMED, PROBATION_DAY_0, PROBATION_ACTIVE
  // Under amber (--state-hold), NEVER green per INV-01
  if (
    state === 'REPAIR_CLAIMED' ||
    state === 'PROBATION_DAY_0' ||
    state === 'PROBATION_ACTIVE'
  ) {
    const referenceTime = asOf
      ? typeof asOf === 'string'
        ? new Date(asOf).getTime()
        : asOf.getTime()
      : systemClock.now().getTime();

    let daysLeft = 7;
    let hoursLeft = 0;

    if (probationEndsAt) {
      const endTime =
        typeof probationEndsAt === 'string'
          ? new Date(probationEndsAt).getTime()
          : probationEndsAt.getTime();
      const diffMs = endTime - referenceTime;

      if (diffMs > 0) {
        daysLeft = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
        hoursLeft = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
      } else {
        daysLeft = 0;
        hoursLeft = 0;
      }
    }

    const timeLabel =
      daysLeft > 0
        ? `${daysLeft}d left`
        : hoursLeft > 0
        ? `${hoursLeft}h left`
        : 'Window closing';

    return React.createElement(
      'div',
      {
        'data-testid': 'countdown-probation',
        className: `flex flex-col ${className}`,
      },
      React.createElement(
        'div',
        {
          className:
            'inline-flex items-center gap-1 font-mono text-xs font-semibold text-[var(--state-hold)]',
        },
        React.createElement('span', {
          className: 'w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse',
        }),
        React.createElement('span', null, timeLabel)
      ),
      showFullNotice
        ? React.createElement(
            'span',
            {
              className:
                'text-[10px] font-mono text-[var(--state-hold)] opacity-90 mt-0.5',
            },
            'Under 7-day check (unverified claim)'
          )
        : null
    );
  }

  return React.createElement(
    'span',
    { className: `text-[var(--ink-soft)] font-mono text-xs ${className}` },
    String(state)
  );
}
