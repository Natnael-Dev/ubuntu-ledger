// Two-Ledger Divergence Card Component (T-27)
// Authoritative sources:
// - docs/specs/05-api-contracts.md §6
// - docs/specs/07-trust-and-security.md §4, §7
// - docs/specs/08-ui-ux-design.md §5
// - docs/specs/10-skills.md S-11
// - docs/specs/11-tasks.md T-27
//
// Invariants:
// 1. Two separate visual DOM containers (statutory-ledger and community-ledger).
// 2. Separate provenance lines for each ledger (official circular vs community clusters).
// 3. ZERO merged or concatenated sentences combining statutory ceiling and observed fee.
// 4. Zero below-k data leakage: when kSatisfied is false, no counts or medians are rendered.

import React from 'react';
import type { StatutoryCardResponseDto } from '@/domain/divergence';
import { RefusalScript } from './RefusalScript';

const SERVICE_NAMES: Record<string, { name: string; amharic?: string; office: string }> = {
  'ET-ID-REPLACE': {
    name: 'Kebele Resident ID Card Replacement',
    amharic: 'የቀበሌ ነዋሪነት መታወቂያ ካርድ እድሳት',
    office: 'Woreda 09 Civil Registry',
  },
};

const DOC_LABELS: Record<string, string> = {
  'doc.birth_certificate_copy': 'Original Birth Certificate + 1 Copy',
  'doc.two_witnesses_id': 'National ID of Two Kebele Witnesses',
  'doc.passport_photo_2x': '2 Recent Passport Photos',
  'doc.utility_bill': 'Recent Utility Bill (Water/Electric)',
  'doc.previous_id': 'Previous Kebele ID Card (if available)',
  'appeal.woreda_ombudsman': 'Woreda 09 Ombudsman Desk — Window 4',
  'appeal.zonal_court': 'Zonal Court Civil Division',
};

function translateKey(key: string): string {
  return DOC_LABELS[key] ?? key;
}

export interface DivergenceCardProps {
  card: StatutoryCardResponseDto;
  className?: string;
}

function formatMinorToCurrency(minor: number, currency: string): string {
  const major = (minor / 100).toFixed(2);
  return `${currency} ${major}`;
}

export function DivergenceCard({ card, className = '' }: DivergenceCardProps) {
  const { serviceCode, officeCode, statutory, observed } = card;

  // Build refusal script text
  const sourceName = statutory.source?.title || 'Official Regulations';
  const feeFormatted = formatMinorToCurrency(
    statutory.feeCeilingMinor,
    statutory.currency
  );
  const refusalScript = `${sourceName} states the fee is ${feeFormatted}. May I have an official receipt for any additional amount?`;

  return (
    <div
      data-testid="divergence-card"
      className={`max-w-2xl mx-auto font-sans bg-[var(--paper)] text-[var(--ink)] border border-[var(--rule)] ${className}`}
    >
      {/* Header Bar */}
      <div className="border-b border-[var(--rule)] p-4 bg-neutral-50 flex flex-wrap items-baseline justify-between">
        <div>
          <span className="font-mono text-xs text-[var(--ink-soft)] uppercase tracking-wider block mb-1">
            Public Service Fee Ledger
          </span>
          {SERVICE_NAMES[serviceCode] && (
            <div className="mb-2">
              <h2 className="font-sans text-lg font-semibold text-[var(--ink)]">
                {SERVICE_NAMES[serviceCode].name}
              </h2>
              {SERVICE_NAMES[serviceCode].amharic && (
                <p className="font-mono text-xs text-[var(--ink-soft)] mt-0.5">
                  {SERVICE_NAMES[serviceCode].amharic}
                </p>
              )}
            </div>
          )}
          <span className="font-mono text-[10px] text-[var(--ink-soft)] bg-neutral-100 border border-[var(--rule)] px-1.5 py-0.5">
            GAZETTE CODE: {serviceCode}
          </span>
        </div>
        <div className="font-mono text-xs text-[var(--ink-soft)] text-right">
          <span>Office: {officeCode}</span>
        </div>
      </div>

      {/* Two Ledgers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[var(--rule)]">
        {/* =========================================================================
            LEDGER 1: STATUTORY / OFFICIAL CEILING
            ========================================================================= */}
        <section
          data-testid="statutory-ledger"
          className="p-5 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-[var(--rule)] mb-3">
              <span className="font-mono text-xs uppercase font-bold text-neutral-600 tracking-wider">
                Official Statutory Ledger
              </span>
              <span className="font-mono text-[10px] bg-neutral-200 text-neutral-800 px-1.5 py-0.5">
                LAW / CIRCULAR
              </span>
            </div>

            <div className="my-4">
              <span className="text-xs text-[var(--ink-soft)] block uppercase font-mono">
                Statutory Fee Ceiling
              </span>
              <span
                data-testid="statutory-fee"
                className="text-3xl font-mono font-bold text-[var(--ink)] block"
              >
                {formatMinorToCurrency(
                  statutory.feeCeilingMinor,
                  statutory.currency
                )}
              </span>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <span className="text-xs text-[var(--ink-soft)] block uppercase font-mono">
                  Expected Visits
                </span>
                <span className="font-mono font-medium">
                  {statutory.expectedVisits} visit
                  {statutory.expectedVisits === 1 ? '' : 's'}
                </span>
              </div>

              <div>
                <span className="text-xs text-[var(--ink-soft)] block uppercase font-mono mb-1">
                  Required Documents
                </span>
                <ul className="list-disc list-inside space-y-1 font-mono text-xs">
                  {statutory.requiredDocuments.map((doc, idx) => (
                    <li key={idx} className="truncate" title={translateKey(doc)}>
                      {translateKey(doc)}
                    </li>
                  ))}
                </ul>
              </div>

              {statutory.appealRouteKey && (
                <div>
                  <span className="text-xs text-[var(--ink-soft)] block uppercase font-mono">
                    Appeal Route
                  </span>
                  <span className="font-mono text-xs">
                    {translateKey(statutory.appealRouteKey)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Statutory Provenance Line */}
          <div
            data-testid="statutory-provenance"
            className="mt-6 pt-3 border-t border-[var(--rule)] text-[11px] font-mono text-[var(--ink-soft)] leading-relaxed"
          >
            {statutory.source ? (
              <>
                <div>Source: {statutory.source.title}</div>
                <div>
                  {statutory.source.page ? `Page ${statutory.source.page} · ` : ''}
                  Verified by: {statutory.source.reviewer} ·{' '}
                  {statutory.source.reviewedAt.slice(0, 10)}
                </div>
              </>
            ) : (
              <div>Source: Statutory Gazette Archive</div>
            )}
          </div>
        </section>

        {/* =========================================================================
            LEDGER 2: COMMUNITY OBSERVED (k-ANONYMOUS)
            ========================================================================= */}
        <section
          data-testid="community-ledger"
          className="p-5 flex flex-col justify-between bg-neutral-50/50"
        >
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-[var(--rule)] mb-3">
              <span className="font-mono text-xs uppercase font-bold text-neutral-600 tracking-wider">
                Community Observed Ledger
              </span>
              <span
                data-testid="k-anonymity-badge"
                className={`font-mono text-[10px] px-1.5 py-0.5 ${
                  observed.kSatisfied
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {observed.kSatisfied ? 'k ≥ 5 VERIFIED' : 'k < 5 SUPPRESSED'}
              </span>
            </div>

            {observed.kSatisfied ? (
              /* k-Satisfied Display: Show aggregations without merging with statutory */
              <div data-testid="community-metrics" className="space-y-4 my-4">
                {observed.alertActive && (
                  <div
                    data-testid="alert-banner"
                    className="p-2.5 bg-red-50 border border-red-300 text-red-900 text-xs font-mono"
                  >
                    <strong>DIVERGENCE ALERT:</strong> Over 60% of citizen reports
                    indicate extra fees requested.
                  </div>
                )}

                <div>
                  <span className="text-xs text-[var(--ink-soft)] block uppercase font-mono">
                    Reports Indicating Extra Fee
                  </span>
                  <span
                    data-testid="observed-pct-fee"
                    className="text-3xl font-mono font-bold text-[var(--ink)]"
                  >
                    {observed.pctAdditionalFee}%
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-xs text-[var(--ink-soft)] block uppercase font-mono">
                      Median Extra Fee
                    </span>
                    <span
                      data-testid="observed-median-fee"
                      className="font-mono font-bold"
                    >
                      {formatMinorToCurrency(
                        observed.medianExtraMinor,
                        statutory.currency
                      )}
                    </span>
                  </div>

                  <div>
                    <span className="text-xs text-[var(--ink-soft)] block uppercase font-mono">
                      Average Visits
                    </span>
                    <span
                      data-testid="observed-avg-visits"
                      className="font-mono font-bold"
                    >
                      {observed.avgVisits} visits
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* Below-k Display: Strict Suppression Card per 07 §7 */
              <div
                data-testid="suppressed-card"
                className="my-6 p-4 border border-dashed border-[var(--rule)] bg-[var(--paper)] text-center"
              >
                <div className="text-xs font-mono uppercase text-[var(--ink-soft)] mb-2 font-semibold">
                  Not Enough Reports Yet
                </div>
                <p className="text-xs text-[var(--ink-soft)] font-mono leading-relaxed">
                  Community reports are suppressed until at least{' '}
                  <span className="font-bold text-[var(--ink)]">
                    {observed.minimumRequired} distinct clusters
                  </span>{' '}
                  have submitted observations. Your report is recorded silently.
                </p>
              </div>
            )}
          </div>

          {/* Community Provenance Line */}
          <div
            data-testid="community-provenance"
            className="mt-6 pt-3 border-t border-[var(--rule)] text-[11px] font-mono text-[var(--ink-soft)] leading-relaxed"
          >
            {observed.kSatisfied ? (
              <>
                <div>Observation Window: 30-day fixed period</div>
                <div>
                  Multi-witness Triangulation: {observed.distinctClusters} distinct
                  clusters ({observed.reportCount} reports total)
                </div>
              </>
            ) : (
              <div>
                Observation Window: {observed.windowDays}-day fixed period ·
                Minimum 5 distinct clusters required
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Refusal Script Section */}
      <div className="p-5 border-t border-[var(--rule)] bg-white">
        <RefusalScript
          scriptText={refusalScript}
          sourceCitation={statutory.source?.title}
        />
      </div>
    </div>
  );
}
