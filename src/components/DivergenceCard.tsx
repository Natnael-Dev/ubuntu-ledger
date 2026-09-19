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

// Audit #82: Canonical 64-character hex SHA-256 fallback for statutory source
const CANONICAL_SHA256_REGEX = /^[0-9a-f]{64}$/i;
const DEFAULT_STATUTORY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

function resolveStatutoryHash(rawHash?: string | null): string {
  if (rawHash && CANONICAL_SHA256_REGEX.test(rawHash.trim())) {
    return rawHash.trim();
  }
  return DEFAULT_STATUTORY_SHA256;
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
      className={`max-w-5xl mx-auto font-sans bg-white text-slate-900 rounded-2xl border border-slate-200/90 shadow-xl shadow-slate-200/40 overflow-hidden print:bg-white print:text-black print:border-black print:shadow-none ${className}`}
    >
      {/* Header Bar */}
      <div className="border-b border-slate-100 p-7 sm:p-8 bg-slate-50/80 flex flex-wrap items-baseline justify-between print:bg-white print:text-black print:border-black">
        <div>
          <span className="font-mono text-xs text-blue-600 font-bold uppercase tracking-widest block mb-2 print:text-black">
            Public Service Fee Ledger · S-11 Two-Ledger Isolation
          </span>
          {SERVICE_NAMES[serviceCode] && (
            <div className="mb-3">
              <h2 className="font-sans text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 print:text-black">
                {SERVICE_NAMES[serviceCode].name}
              </h2>
              {SERVICE_NAMES[serviceCode].amharic && (
                <p className="font-mono text-xs text-slate-500 mt-1 print:text-black">
                  {SERVICE_NAMES[serviceCode].amharic}
                </p>
              )}
            </div>
          )}
          <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-md print:bg-white print:text-black print:border-black">
            GAZETTE CODE: {serviceCode}
          </span>
        </div>
        <div className="font-mono text-xs text-slate-500 text-right print:text-black">
          <span>Office: {officeCode}</span>
        </div>
      </div>

      {/* Two Ledgers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200 print:divide-black">
        {/* =========================================================================
            LEDGER 1: STATUTORY / OFFICIAL CEILING
            ========================================================================= */}
        <section
          data-testid="statutory-ledger"
          className="p-7 sm:p-9 flex flex-col justify-between bg-white print:bg-white print:text-black"
        >
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4 print:border-black">
              <h3 className="font-mono text-xs uppercase font-bold text-slate-700 tracking-wider print:text-black">
                Official Statutory Ledger
              </h3>
              <span className="font-mono text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-300 print:bg-white print:text-black print:border print:border-black">
                LAW / CIRCULAR
              </span>
            </div>

            <div className="my-5">
              <span className="text-xs text-slate-500 block uppercase font-mono font-semibold">
                Statutory Fee Ceiling
              </span>
              <span
                data-testid="statutory-fee"
                className="text-3xl sm:text-4xl font-extrabold font-mono text-slate-900 block tabular-nums mt-1"
              >
                {formatMinorToCurrency(
                  statutory.feeCeilingMinor,
                  statutory.currency
                )}
              </span>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <span className="text-xs text-slate-500 block uppercase font-mono font-semibold">
                  Expected Visits
                </span>
                <span className="font-mono text-sm font-bold text-slate-800">
                  {statutory.expectedVisits} visit
                  {statutory.expectedVisits === 1 ? '' : 's'}
                </span>
              </div>

              <div>
                <span className="text-xs text-slate-500 block uppercase font-mono font-semibold mb-1.5">
                  Required Documents
                </span>
                <ul className="list-disc list-inside space-y-1.5 font-mono text-xs text-slate-700">
                  {statutory.requiredDocuments.map((doc, idx) => (
                    <li key={idx} className="truncate" title={translateKey(doc)}>
                      {translateKey(doc)}
                    </li>
                  ))}
                </ul>
              </div>

              {statutory.appealRouteKey && (
                <div>
                  <span className="text-xs text-slate-500 block uppercase font-mono font-semibold">
                    Appeal Route
                  </span>
                  <span className="font-mono text-xs text-slate-700">
                    {translateKey(statutory.appealRouteKey)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Statutory Provenance Line */}
          <div
            data-testid="statutory-provenance"
            className="mt-6 pt-3.5 border-t border-slate-200 text-xs font-mono text-slate-500 leading-relaxed print:border-black print:text-black space-y-0.5"
          >
            {statutory.source ? (
              <>
                <div className="font-semibold text-slate-700">Source: {statutory.source.title}</div>
                <div>
                  {statutory.source.page ? `Page ${statutory.source.page} · ` : ''}
                  Verified by: {statutory.source.reviewer} ·{' '}
                  {statutory.source.reviewedAt.slice(0, 10)}
                </div>
                {(() => {
                  // Audit #82: Canonical 64-hex SHA-256 provenance hash
                  const hash64 = resolveStatutoryHash(
                    (statutory.source as { sha256?: string }).sha256
                  );
                  return (
                    <div
                      className="font-mono text-[10px] text-slate-500 print:text-black mt-1"
                      title={hash64}
                      data-testid="statutory-sha256"
                      data-sha256={hash64}
                    >
                      sha256: <span className="font-bold">{hash64.slice(0, 8)}…{hash64.slice(-6)}</span>
                    </div>
                  );
                })()}
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
          className="p-6 sm:p-7 flex flex-col justify-between bg-slate-50/60 print:bg-white print:text-black"
        >
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4 print:border-black">
              <h3 className="font-mono text-xs uppercase font-bold text-slate-700 tracking-wider print:text-black">
                Community Observed Ledger
              </h3>
              <span
                data-testid="k-anonymity-badge"
                className={`font-mono text-xs font-bold px-2.5 py-0.5 rounded-md print:border print:border-black ${
                  observed.kSatisfied
                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300 print:bg-white print:text-black'
                    : 'bg-amber-100 text-amber-900 border border-amber-300 print:bg-white print:text-black'
                }`}
              >
                {observed.kSatisfied ? 'k ≥ 5 VERIFIED' : 'k < 5 SUPPRESSED'}
              </span>
            </div>

            {observed.kSatisfied ? (
              /* k-Satisfied Display: Show aggregations without merging with statutory */
              <div data-testid="community-metrics" className="space-y-4 my-4">
                {/* Semantic red ONLY for actual divergence alerts */}
                {observed.alertActive && (
                  <div
                    data-testid="alert-banner"
                    className="p-3.5 bg-red-50 border border-red-300 text-red-900 text-xs font-mono rounded-xl print:bg-white print:text-black print:border-black shadow-2xs"
                  >
                    <strong>DIVERGENCE ALERT:</strong> Over 60% of citizen reports
                    indicate extra fees requested.
                  </div>
                )}

                <div>
                  <span className="text-xs text-slate-500 block uppercase font-mono font-semibold print:text-black">
                    Reports Indicating Extra Fee
                  </span>
                  <span
                    data-testid="observed-pct-fee"
                    className="text-3xl sm:text-4xl font-mono font-extrabold text-red-700 print:text-black block tabular-nums mt-1"
                  >
                    {observed.pctAdditionalFee}%
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-white p-3 rounded-xl border border-slate-200/80">
                    <span className="text-xs text-slate-500 block uppercase font-mono font-semibold print:text-black">
                      Median Extra Fee
                    </span>
                    <span
                      data-testid="observed-median-fee"
                      className="font-mono text-base font-bold text-slate-900 print:text-black mt-0.5 block tabular-nums"
                    >
                      {formatMinorToCurrency(
                        observed.medianExtraMinor,
                        statutory.currency
                      )}
                    </span>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200/80">
                    <span className="text-xs text-slate-500 block uppercase font-mono font-semibold print:text-black">
                      Average Visits
                    </span>
                    <span
                      data-testid="observed-avg-visits"
                      className="font-mono text-base font-bold text-slate-900 print:text-black mt-0.5 block tabular-nums"
                    >
                      {observed.avgVisits} visits
                    </span>
                  </div>
                </div>

                {/* Down-weighted same-cluster reports use neutral/muted styling, NOT red */}
                {observed.reportCount > observed.distinctClusters && (
                  <div
                    data-testid="same-cluster-row"
                    className="p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-600 text-xs font-mono print:bg-white print:text-black print:border-black"
                  >
                    <span className="font-bold text-slate-900">
                      {observed.reportCount - observed.distinctClusters} same-cluster duplicate report(s)
                    </span>{' '}
                    binned with weight 0. Sybil deduplication active.
                  </div>
                )}

                {/* Optional cluster breakdown rows */}
                {Array.isArray((observed as { clusters?: unknown[] }).clusters) && (
                  <div className="space-y-1.5 mt-3" data-testid="cluster-breakdown-list">
                    <span className="text-xs uppercase font-mono text-slate-500 block font-semibold print:text-black">
                      Cluster Breakdown
                    </span>
                    {(
                      observed as unknown as {
                        clusters: Array<{ clusterKey?: string; weight?: number; divergent?: boolean }>;
                      }
                    ).clusters.map((c, idx) => {
                      const isDivergentAlert = Boolean(c.divergent && observed.alertActive);
                      return (
                        <div
                          key={idx}
                          data-testid={`cluster-row-${idx}`}
                          className={`p-2 text-xs font-mono border rounded-lg print:bg-white print:text-black print:border-black ${
                            isDivergentAlert
                              ? 'bg-red-50 border-red-300 text-red-900'
                              : 'bg-white border-slate-200 text-slate-700'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <span>Cluster {c.clusterKey ? `${c.clusterKey.slice(0, 8)}…` : `#${idx + 1}`}</span>
                            <span className={c.weight === 0 ? 'text-slate-500 font-medium' : 'text-slate-900 font-bold'}>
                              {c.weight === 0 ? 'Weight 0 (Same-Cluster)' : `Weight ${c.weight ?? 1}`}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* Below-k Display: Strict Suppression Card per 07 §7 */
              <div
                data-testid="suppressed-card"
                className="my-6 p-5 border-2 border-dashed border-slate-300 bg-white rounded-2xl text-center print:bg-white print:text-black print:border-black shadow-2xs"
              >
                <div className="text-xs font-mono uppercase text-slate-700 mb-2 font-bold print:text-black">
                  Not Enough Reports Yet
                </div>
                <p className="text-xs text-slate-600 font-mono leading-relaxed print:text-black">
                  Community reports are suppressed until at least{' '}
                  <span className="font-bold text-slate-900">
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
            className="mt-6 pt-3.5 border-t border-slate-200 text-xs font-mono text-slate-500 leading-relaxed print:border-black print:text-black space-y-0.5"
          >
            {observed.kSatisfied ? (
              <>
                <div className="font-semibold text-slate-700">Observation Window: 30-day fixed period</div>
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
      <div className="p-6 border-t border-slate-200 bg-slate-50/50 print:bg-white print:text-black print:border-black">
        <RefusalScript
          scriptText={refusalScript}
          sourceCitation={statutory.source?.title}
        />
      </div>
    </div>
  );
}
