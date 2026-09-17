// WitnessCounter Component
// Authoritative sources:
// - docs/specs/08-ui-ux-design.md §5, §8 (n of target in mono; pulse-without-increment on suppressed)
// - docs/specs/07-trust-and-security.md §4

import React from 'react';

export interface WitnessCounterProps {
  count: number;
  target: number;
  pulsing?: boolean;
  className?: string;
}

export function WitnessCounter({
  count,
  target,
  pulsing = false,
  className = '',
}: WitnessCounterProps) {
  const isSatisfied = count >= target;

  return React.createElement(
    'span',
    {
      'data-testid': 'witness-counter',
      'aria-live': 'polite',
      className: `inline-flex items-center gap-1 font-mono text-xs tabular-nums ${
        isSatisfied ? 'text-[var(--state-open)] font-semibold' : 'text-[var(--ink)]'
      } ${pulsing ? 'animate-pulse text-amber-600' : ''} ${className}`,
    },
    React.createElement('span', null, count),
    React.createElement('span', { className: 'text-[var(--ink-soft)]' }, 'of'),
    React.createElement('span', null, target)
  );
}
