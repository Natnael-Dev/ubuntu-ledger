// Unit tests for DivergenceCard and RefusalScript components (T-27)
// Authoritative sources:
// - docs/specs/05-api-contracts.md §6
// - docs/specs/07-trust-and-security.md §4, §7
// - docs/specs/08-ui-ux-design.md §5
// - docs/specs/10-skills.md S-11
// - docs/specs/11-tasks.md T-27

import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { DivergenceCard } from '@/components/DivergenceCard';
import { RefusalScript } from '@/components/RefusalScript';
import type { StatutoryCardResponseDto } from '@/domain/divergence';

describe('T-27: Two-Ledger Divergence Card & Refusal Script (S-11)', () => {
  const mockSatisfiedCard: StatutoryCardResponseDto = {
    serviceCode: 'ET-ID-REPLACE',
    officeCode: 'ET-AA-W09-OFFICE',
    statutory: {
      feeCeilingMinor: 10000, // ETB 100.00
      currency: 'ETB',
      requiredDocuments: ['Kebele ID card', 'Two passport photos', 'Police report'],
      expectedVisits: 1,
      refusalScriptKey: 'script.request_official_receipt',
      appealRouteKey: 'Woreda Grievance Desk Window 4',
      source: {
        title: 'Addis Ababa City Revenue Circular FY2026',
        page: 4,
        reviewer: 'S.A.',
        reviewedAt: '2026-08-15T10:00:00Z',
      },
    },
    observed: {
      kSatisfied: true,
      windowDays: 30,
      reportCount: 14,
      distinctClusters: 6,
      pctAdditionalFee: 78.6,
      medianExtraMinor: 20000, // ETB 200.00
      avgVisits: 2.1,
      alertActive: true,
    },
  };

  const mockSuppressedCard: StatutoryCardResponseDto = {
    serviceCode: 'ET-CLINIC-INTAKE',
    officeCode: 'ET-AA-W09-CLINIC',
    statutory: {
      feeCeilingMinor: 0, // Free
      currency: 'ETB',
      requiredDocuments: ['Kebele ID card or guardian letter'],
      expectedVisits: 1,
      refusalScriptKey: 'script.request_official_receipt',
      appealRouteKey: 'Woreda Health Office Desk 2',
      source: {
        title: 'Ministry of Health Primary Care Directive 2025',
        page: 12,
        reviewer: 'T.M.',
        reviewedAt: '2026-07-01T08:30:00Z',
      },
    },
    observed: {
      kSatisfied: false,
      windowDays: 30,
      noticeKey: 'divergence.not_enough_reports',
      minimumRequired: 5,
    },
  };

  // ============================================================================
  // 1. DOM SEPARATION (S-11)
  // ============================================================================
  describe('1. Two Visually Distinct DOM Containers with Separate Provenance', () => {
    it('renders two separate visual DOM containers with data-testid attributes', () => {
      const html = renderToString(
        React.createElement(DivergenceCard, { card: mockSatisfiedCard })
      );

      expect(html).toContain('data-testid="statutory-ledger"');
      expect(html).toContain('data-testid="community-ledger"');
      expect(html).toContain('data-testid="statutory-provenance"');
      expect(html).toContain('data-testid="community-provenance"');
    });

    it('renders separate provenance lines for statutory circular and community clusters', () => {
      const html = renderToString(
        React.createElement(DivergenceCard, { card: mockSatisfiedCard })
      ).replace(/<!--.*?-->/g, '');

      // Statutory provenance line contains circular title, page, reviewer
      expect(html).toContain('Addis Ababa City Revenue Circular FY2026');
      expect(html).toContain('Page 4');
      expect(html).toContain('Verified by: S.A.');

      // Community provenance line contains distinct cluster count
      expect(html).toContain('6 distinct clusters');
      expect(html).toContain('14 reports total');
      expect(html).toContain('30-day fixed period');
    });
  });

  // ============================================================================
  // 2. INVARIANT: ZERO MERGED SENTENCES (S-11)
  // ============================================================================
  describe('2. Trust Invariant: No Merged Sentences (S-11)', () => {
    it('never concatenates statutory ceiling and observed payment into a single sentence', () => {
      const html = renderToString(
        React.createElement(DivergenceCard, { card: mockSatisfiedCard })
      ).replace(/<!--.*?-->/g, '');

      // Prohibited patterns: merging the official fee with observed extra fee in one prose sentence
      expect(html).not.toMatch(/official fee is ETB 100\.00 but (people|citizens|neighbours) paid/i);
      expect(html).not.toMatch(/statutory (ceiling|fee) of ETB 100\.00 diverged to ETB 200\.00/i);
      expect(html).not.toMatch(/instead of ETB 100\.00.*?ETB 200\.00/i);
    });
  });

  // ============================================================================
  // 3. BELOW-K SUPPRESSION (07 §7)
  // ============================================================================
  describe('3. Below-k Suppression Handling', () => {
    it('strictly suppresses metrics and renders suppression card when k < 5', () => {
      const html = renderToString(
        React.createElement(DivergenceCard, { card: mockSuppressedCard })
      ).replace(/<!--.*?-->/g, '');

      expect(html).toContain('data-testid="suppressed-card"');
      expect(html).toContain('k &lt; 5 SUPPRESSED');
      expect(html).toContain('Not Enough Reports Yet');
      expect(html).toContain('5 distinct clusters');

      // Security Invariant: no community metrics in suppressed state
      expect(html).not.toContain('data-testid="community-metrics"');
      expect(html).not.toContain('data-testid="observed-pct-fee"');
      expect(html).not.toContain('data-testid="observed-median-fee"');
      expect(html).not.toContain('data-testid="observed-avg-visits"');
    });

    it('renders full divergence metrics and alert banner when k >= 5 and alertActive is true', () => {
      const html = renderToString(
        React.createElement(DivergenceCard, { card: mockSatisfiedCard })
      ).replace(/<!--.*?-->/g, '');

      expect(html).toContain('k ≥ 5 VERIFIED');
      expect(html).toContain('data-testid="community-metrics"');
      expect(html).toContain('78.6%');
      expect(html).toContain('ETB 200.00');
      expect(html).toContain('2.1 visits');
      expect(html).toContain('data-testid="alert-banner"');
    });
  });

  // ============================================================================
  // 4. REFUSAL SCRIPT & AUDIO (08 §5, 08 §6)
  // ============================================================================
  describe('4. Refusal Script with Copy Control and Audio Button', () => {
    it('renders refusal script with copy and hear-this controls', () => {
      const html = renderToString(
        React.createElement(RefusalScript, {
          scriptText:
            'Addis Ababa City Revenue Circular FY2026 states the fee is ETB 100.00. May I have an official receipt for any additional amount?',
          sourceCitation: 'Addis Ababa City Revenue Circular FY2026',
        })
      );

      expect(html).toContain('data-testid="refusal-script"');
      expect(html).toContain('data-testid="copy-script-btn"');
      expect(html).toContain('Copy script');
      expect(html).toContain('data-testid="audio-script-btn"');
      expect(html).toContain('Hear this');
    });
  });
});
