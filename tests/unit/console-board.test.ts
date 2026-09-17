// Unit Tests for Console Project Board & Components (T-22)
// Authoritative sources:
// - docs/specs/08-ui-ux-design.md §7, §8
// - docs/specs/11-tasks.md T-22
// - docs/specs/04-state-machine.md §3, §7 (INV-01)
// - docs/specs/12-demo-script.md §4

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { NarrativeState } from '@/components/NarrativeState';
import { WitnessCounter } from '@/components/WitnessCounter';
import { ProbationCountdown } from '@/components/ProbationCountdown';
import {
  DEMO_PROJECTS,
  DEMO_INSPECTION_TASKS,
  DEMO_REPAIR_TICKETS,
  DEMO_IDS,
  DEMO_TIMELINE,
} from '@/fixtures/demo-scenario';

describe('T-22: Console Board Components & Invariants', () => {
  // ==========================================================================
  // 1. NarrativeState Component (08 §8: renders derived state; never computes)
  // ==========================================================================
  describe('1. NarrativeState Component', () => {
    it('renders fiscal states with correct semantic tokens and labels', () => {
      const htmlCommitted = renderToString(
        React.createElement(NarrativeState, { kind: 'fiscal', state: 'COMMITTED' })
      );
      expect(htmlCommitted).toContain('COMMITTED');
      expect(htmlCommitted).toContain('var(--state-hold)');

      const htmlAudited = renderToString(
        React.createElement(NarrativeState, { kind: 'fiscal', state: 'AUDITED' })
      );
      expect(htmlAudited).toContain('AUDITED');
      expect(htmlAudited).toContain('var(--state-open)');

      const htmlPromised = renderToString(
        React.createElement(NarrativeState, { kind: 'fiscal', state: 'PROMISED' })
      );
      expect(htmlPromised).toContain('PROMISED');
      expect(htmlPromised).toContain('var(--ink-soft)');
    });

    it('renders audit states with correct semantic tokens and labels', () => {
      const htmlAwaiting = renderToString(
        React.createElement(NarrativeState, { kind: 'audit', state: 'AWAITING_THRESHOLD' })
      );
      expect(htmlAwaiting).toContain('AWAITING THRESHOLD');
      expect(htmlAwaiting).toContain('var(--state-hold)');

      const htmlConfirmed = renderToString(
        React.createElement(NarrativeState, { kind: 'audit', state: 'PHYSICALLY_CONFIRMED' })
      );
      expect(htmlConfirmed).toContain('CONFIRMED');
      expect(htmlConfirmed).toContain('var(--state-open)');

      const htmlDiscrepancy = renderToString(
        React.createElement(NarrativeState, { kind: 'audit', state: 'DISCREPANCY_FLAGGED' })
      );
      expect(htmlDiscrepancy).toContain('DISCREPANCY');
      expect(htmlDiscrepancy).toContain('var(--state-break)');
    });

    it('INV-01: REPAIR_CLAIMED state renders in amber (--state-hold), NEVER green (--state-open)', () => {
      const htmlClaimed = renderToString(
        React.createElement(NarrativeState, { kind: 'probation', state: 'REPAIR_CLAIMED' })
      );
      expect(htmlClaimed).toContain('REPAIR CLAIMED');
      expect(htmlClaimed).toContain('var(--state-hold)');
      expect(htmlClaimed).not.toContain('var(--state-open)');
    });

    it('renders VERIFIED_SUSTAINED in green (--state-open)', () => {
      const htmlSustained = renderToString(
        React.createElement(NarrativeState, { kind: 'probation', state: 'VERIFIED_SUSTAINED' })
      );
      expect(htmlSustained).toContain('VERIFIED SUSTAINED');
      expect(htmlSustained).toContain('var(--state-open)');
    });

    it('renders PROBATION_FAILED in red (--state-break)', () => {
      const htmlFailed = renderToString(
        React.createElement(NarrativeState, { kind: 'probation', state: 'PROBATION_FAILED' })
      );
      expect(htmlFailed).toContain('PROBATION FAILED');
      expect(htmlFailed).toContain('var(--state-break)');
    });
  });

  // ==========================================================================
  // 2. WitnessCounter Component (08 §5, §8: n of target in mono; no charts)
  // ==========================================================================
  describe('2. WitnessCounter Component', () => {
    it('renders witness count formatted as "n of target" in mono', () => {
      const html = renderToString(React.createElement(WitnessCounter, { count: 2, target: 3 }));
      expect(html).toContain('2');
      expect(html).toContain('of');
      expect(html).toContain('3');
      expect(html).toContain('font-mono');
      expect(html).toContain('aria-live="polite"');
    });

    it('applies open/green highlight when target is met or exceeded', () => {
      const html = renderToString(React.createElement(WitnessCounter, { count: 3, target: 3 }));
      expect(html).toContain('var(--state-open)');
      expect(html).toContain('font-semibold');
    });

    it('does not contain any canvas, svg charts, or progress rings', () => {
      const html = renderToString(React.createElement(WitnessCounter, { count: 2, target: 3 }));
      expect(html).not.toContain('<svg');
      expect(html).not.toContain('<canvas');
      expect(html).not.toContain('role="progressbar"');
    });
  });

  // ==========================================================================
  // 3. ProbationCountdown Component (08 §8, 11-tasks T-22)
  // ==========================================================================
  describe('3. ProbationCountdown Component', () => {
    const NOW_TIME = new Date('2026-09-17T08:00:00.000Z');
    const END_TIME_5D = new Date('2026-09-22T08:00:00.000Z'); // exactly 5 days left

    it('INV-01: Displays countdown under REPAIR_CLAIMED in amber, never green', () => {
      const html = renderToString(
        React.createElement(ProbationCountdown, {
          state: 'REPAIR_CLAIMED',
          probationEndsAt: END_TIME_5D,
          asOf: NOW_TIME,
        })
      );

      expect(html).toContain('5d left');
      expect(html).toContain('var(--state-hold)');
      expect(html).not.toContain('var(--state-open)');
      expect(html).not.toContain('SUSTAINED');
    });

    it('turns red (--state-break) on PROBATION_FAILED', () => {
      const html = renderToString(
        React.createElement(ProbationCountdown, {
          state: 'PROBATION_FAILED',
          failureReasonKey: 'probation.failure_day_3_reported',
        })
      );

      expect(html).toContain('PROBATION FAILED');
      expect(html).toContain('var(--state-break)');
      expect(html).toContain('probation.failure_day_3_reported');
      expect(html).not.toContain('var(--state-open)');
    });

    it('displays SUSTAINED in green on VERIFIED_SUSTAINED', () => {
      const html = renderToString(
        React.createElement(ProbationCountdown, { state: 'VERIFIED_SUSTAINED' })
      );

      expect(html).toContain('SUSTAINED');
      expect(html).toContain('var(--state-open)');
    });

    it('displays BROKEN for unclaimed tickets', () => {
      const html = renderToString(
        React.createElement(ProbationCountdown, { state: 'REPORTED_BROKEN' })
      );

      expect(html).toContain('BROKEN (unclaimed)');
      expect(html).toContain('var(--state-break)');
    });

    it('renders placeholder dash when state is null or undefined', () => {
      const html = renderToString(React.createElement(ProbationCountdown, { state: null }));
      expect(html).toContain('—');
    });
  });

  // ==========================================================================
  // 4. Canonical Project Board Data Mapping (T-22 Acceptance)
  // ==========================================================================
  describe('4. Canonical Project Board Data Mapping', () => {
    it('contains all 6 projects from Woreda 9', () => {
      expect(DEMO_PROJECTS.length).toBe(6);
      const codes = DEMO_PROJECTS.map((p) => p.projectCode);
      expect(codes).toEqual(['4412', '4413', '4414', '4415', '4416', '4417']);
    });

    it('correctly maps Project 4412 with Task 4412 (2 of 3 witnesses) and Ticket 4412', () => {
      const proj4412 = DEMO_PROJECTS.find((p) => p.projectCode === '4412')!;
      const task4412 = DEMO_INSPECTION_TASKS.find((t) => t.projectId === proj4412.id)!;
      const ticket4412 = DEMO_REPAIR_TICKETS.find((tk) => tk.projectId === proj4412.id)!;

      expect(proj4412.id).toBe(DEMO_IDS.PROJECT_4412);
      expect(task4412.witnessCount).toBe(2);
      expect(task4412.witnessTarget).toBe(3);
      expect(ticket4412.claimedBy).toBe('AfroTech Infra');
      expect(ticket4412.state).toBe('REPAIR_CLAIMED');
      expect(ticket4412.probationEndsAt).toBe(DEMO_TIMELINE.PROBATION_ENDS_AT);
    });

    it('correctly maps Project 4413 with sustained repair ticket and physically confirmed audit state', () => {
      const proj4413 = DEMO_PROJECTS.find((p) => p.projectCode === '4413')!;
      const ticket4413 = DEMO_REPAIR_TICKETS.find((tk) => tk.projectId === proj4413.id)!;

      expect(proj4413.fiscal).toBe('AUDITED');
      expect(proj4413.audit).toBe('PHYSICALLY_CONFIRMED');
      expect(ticket4413.state).toBe('VERIFIED_SUSTAINED');
      expect(ticket4413.claimedBy).toBe('Abyssinia Water Works');
    });

    it('correctly maps Project 4415 as DISCREPANCY_FLAGGED', () => {
      const proj4415 = DEMO_PROJECTS.find((p) => p.projectCode === '4415')!;
      expect(proj4415.audit).toBe('DISCREPANCY_FLAGGED');
    });
  });
});
