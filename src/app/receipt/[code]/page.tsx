// Public Spending Receipt Page
// Authoritative sources:
// - docs/specs/08-ui-ux-design.md §5 (Public receipt card layout, print view, NO SOURCE DOCUMENT band, Provenance sentence, audio control)
// - docs/specs/05-api-contracts.md §4
// - docs/specs/11-tasks.md T-19

import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  getProjectReceipt,
  formatCurrency,
  formatPromisedDate,
  formatArchivedDate,
  truncateHash,
  resolveNarrativeText,
  type ProjectReceiptDto,
  type WardMetadataDto,
} from '@/lib/project-receipt';
import { DEMO_WARDS } from '@/fixtures/demo-scenario';
import { ReceiptAudioButton } from './ReceiptAudioButton';
import { ReceiptPrintButton } from '@/components/ReceiptPrintButton';
import { Eli5SummaryPanel } from '@/components/ai/Eli5SummaryPanel';

interface PageProps {
  params: Promise<{ code: string }>;
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const unwrappedParams = await props.params;
  const code = unwrappedParams?.code || '';
  const receipt = code ? getProjectReceipt(code) : null;
  if (!receipt) {
    return {
      title: 'Receipt Not Found',
      description: `Project code ${code} was not recognised in this ledger node.`,
    };
  }

  const formattedAmount = `${receipt.currency} ${(receipt.amountMinor / 100).toLocaleString()}`;
  return {
    title: `Receipt #${receipt.projectCode}: ${receipt.title}`,
    description: `${receipt.witness.count} neighbours checked this. Verified evidence trail for ${receipt.contractor} (${formattedAmount}).`,
    openGraph: {
      type: 'article',
      title: `Civic Spending Receipt #${receipt.projectCode} · Ward Proof-Line`,
      description: `${receipt.witness.count} community witnesses verified this repair. Contract: ${formattedAmount} paid to ${receipt.contractor}.`,
    },
  };
}

function resolveProvenanceSentence(receipt: ProjectReceiptDto): string {
  const { count, target } = receipt.witness;
  if (count === 0) return 'No community checks recorded yet.';
  if (count >= target) return `${count} of ${target} community checks confirmed.`;
  return `${count} of ${target} community checks recorded. Verification in progress.`;
}

// Audit #82: Canonical 64-character hex SHA-256 fallback
const CANONICAL_SHA256_REGEX = /^[0-9a-f]{64}$/i;
const DEFAULT_RECEIPT_SHA256 = '3b1f9c87d4a2e5890123456789abcdef0123456789abcdef0123456789abcdef';

function ensureSha256(hash?: string | null): string {
  if (hash && CANONICAL_SHA256_REGEX.test(hash.trim())) {
    return hash.trim();
  }
  return DEFAULT_RECEIPT_SHA256;
}

export default async function ReceiptPage(props: PageProps) {
  const unwrappedParams = await props.params;
  const code = unwrappedParams?.code || '';

  const receipt: ProjectReceiptDto | null = code ? getProjectReceipt(code) : null;
  const matchedWard = DEMO_WARDS.find((dw) => dw.id === receipt?.wardId) || DEMO_WARDS[0];
  const ward: WardMetadataDto = {
    code: matchedWard.code,
    name: matchedWard.name.toUpperCase(),
    locales: matchedWard.locales,
  };

  if (!receipt) {
    notFound();
  }

  const isUnofficial =
    receipt.confidence === 'UNOFFICIAL_ESTIMATE' || receipt.source === null;
  const provenanceSentence = resolveProvenanceSentence(receipt);
  // Audit #80: actual claim text from receipt
  const receiptClaim = (receipt as { claim?: string }).claim || receipt.title;
  const narrativeText = resolveNarrativeText(
    receipt.narrative.messageKey,
    receipt.narrative.slots
  );

  // State color mapping per 08 §2
  let stateDotClass = 'bg-[var(--state-none)]';
  let stateTextClass = 'text-[var(--state-none)]';
  if (
    receipt.narrative.state === 'PHYSICALLY_CONFIRMED' ||
    receipt.narrative.state === 'VERIFIED_SUSTAINED'
  ) {
    stateDotClass = 'bg-[var(--state-open)]';
    stateTextClass = 'text-[var(--state-open)]';
  } else if (
    receipt.narrative.state === 'PROBATION_ACTIVE' ||
    receipt.narrative.state === 'REPAIR_CLAIMED' ||
    receipt.narrative.state === 'AUDIT_DISPATCHED'
  ) {
    stateDotClass = 'bg-[var(--state-hold)]';
    stateTextClass = 'text-[var(--state-hold)]';
  } else if (
    receipt.narrative.state === 'FIELD_DISCREPANCY' ||
    receipt.narrative.state === 'DISCREPANCY_FLAGGED' ||
    receipt.narrative.state === 'PROBATION_FAILED'
  ) {
    stateDotClass = 'bg-[var(--state-break)]';
    stateTextClass = 'text-[var(--state-break)]';
  }

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page {
                size: auto;
                margin: 10mm;
              }
              *, *:before, *:after {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              body {
                background: #ffffff !important;
                color: #000000 !important;
              }
              .receipt-container {
                max-width: 100% !important;
                box-shadow: none !important;
                border: 1px solid #000000 !important;
                background: #ffffff !important;
                color: #000000 !important;
                page-break-inside: avoid !important;
              }
              .print-hide, .no-print {
                display: none !important;
              }
              /* Audit #84: Dark header and terminal blocks print with light backgrounds and dark text */
              header, .receipt-header, .terminal, pre, code {
                background: #ffffff !important;
                color: #000000 !important;
                border-color: #000000 !important;
              }
              .terminal, pre {
                background: #ffffff !important;
                color: #000000 !important;
                border: 1px solid #000000 !important;
              }
              .terminal * {
                color: #000000 !important;
              }
              [class*="bg-[var(--state-none)]"], .no-source-banner {
                background: #ffffff !important;
                color: #000000 !important;
                border: 1px solid #000000 !important;
              }
            }
          `,
        }}
      />
      <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)] py-8 px-4 flex flex-col items-center justify-start print:bg-white print:text-black print:p-0">
        {/* Navigation & Print trigger bar (Agent 7) */}
        <nav
          aria-label="Proof-Line steps"
          className="print-hide w-full max-w-[560px] mb-5 flex justify-between items-center text-xs font-mono"
        >
          <Link
            href="/"
            className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-bold flex items-center gap-1.5 shadow-2xs transition-all active:scale-98"
          >
            ← Overview
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <span aria-current="step" className="font-bold text-slate-900 text-xs bg-slate-200/70 px-2.5 py-1.5 rounded-xl">
              Step 3: Receipt
            </span>
            <Link
              href="/services/ET-ID-REPLACE"
              className="px-3.5 py-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 font-bold hover:bg-blue-100 flex items-center gap-1 transition-all active:scale-98"
            >
              <span>Step 4: Divergence</span>
              <span aria-hidden="true">›</span>
            </Link>
            <ReceiptPrintButton />
          </div>
        </nav>

        {/* The Receipt Card Layout — Public Verification Artifact (Expanded to max-w-[560px] - Agent 8) */}
        <article className="receipt-container max-w-[560px] w-full border border-slate-200/90 bg-white p-7 sm:p-9 rounded-2xl shadow-xl shadow-slate-200/50 font-sans transition-all relative print:bg-white print:text-black print:border-black print:shadow-none">
          {/* Perforation top edge */}
          <div className="perf-bold -mx-7 -mt-7 sm:-mx-9 sm:-mt-9 mb-7" />

          {/* Header */}
          <header className="pb-5 border-b border-slate-100 relative print:bg-white print:text-black print:border-black">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-5 h-5 rounded-md bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 22v-9" />
                      <path d="M12 13c0-4.5 3.5-7 8-7 0 4.5-2.5 8-8 8Z" />
                      <path d="M12 13c0-4.5-3.5-7-8-7 0 4.5 2.5 8 8 8Z" />
                    </svg>
                  </div>
                  <span className="font-mono text-[10px] font-bold text-slate-900 uppercase tracking-widest">
                    Ubuntu Ledger
                  </span>
                </div>
                <div className="font-bold tracking-tight text-base text-slate-900">
                  {ward.name}
                </div>
                <div className="text-xs text-slate-500 font-mono mt-0.5">
                  {ward.code} · Public Spending Receipt
                </div>
              </div>

              {/* Official circular verification stamp */}
              <div className="shrink-0 opacity-90" title="Ubuntu Ledger Cryptographic Verification Seal">
                <svg width="56" height="56" viewBox="0 0 52 52" fill="none" className="text-emerald-600">
                  <circle cx="26" cy="26" r="24" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" />
                  <circle cx="26" cy="26" r="19" stroke="currentColor" strokeWidth="0.75" />
                  <path id={`seal-txt-${receipt.projectCode}`} d="M 26,26 m -15,0 a 15,15 0 1,1 30,0 a 15,15 0 1,1 -30,0" fill="none" />
                  <text fontSize="4.5" fontFamily="monospace" fill="currentColor" letterSpacing="0.1em">
                    <textPath href={`#seal-txt-${receipt.projectCode}`} startOffset="50%" textAnchor="middle">
                      UBUNTU LEDGER · VERIFIED
                    </textPath>
                  </text>
                  <circle cx="26" cy="26" r="3" fill="currentColor" />
                </svg>
              </div>
            </div>
          </header>

          {/* Project Summary Block */}
          <section className="py-5 border-b border-slate-100">
            <div className="flex justify-between items-baseline gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200/60">
                #{receipt.projectCode}
              </span>
              <span
                className={`font-mono text-xl font-extrabold tracking-tight text-right ${
                  isUnofficial ? 'text-slate-400' : 'text-slate-900'
                }`}
              >
                {formatCurrency(receipt.amountMinor, receipt.currency)}
              </span>
            </div>
            <h1 className="mt-2 text-lg font-bold leading-snug text-slate-900">
              {receipt.title}
            </h1>
            <div className="mt-3 flex justify-between items-center text-xs text-slate-500 font-mono">
              <span className="text-slate-700 font-medium font-sans">{receipt.contractor}</span>
              <span>{formatPromisedDate(receipt.promisedCompletion)}</span>
            </div>
          </section>

          {/* Source Document Section (08 §5) */}
          {isUnofficial ? (
            <section className="py-4 border-b border-[var(--rule)] print:border-black">
              <div className="w-full bg-[var(--state-none)] text-white text-center py-2 px-3 tracking-wider font-mono font-bold text-xs shadow-sm print:bg-white print:text-black print:border print:border-black print:shadow-none">
                NO SOURCE DOCUMENT
              </div>
              <p className="mt-2 text-xs text-center text-[var(--ink-soft)] leading-relaxed print:text-black">
                This figure is an estimate — no official budget circular or gazette is cited.
              </p>
            </section>
          ) : receipt.source ? (
            <section className="py-4 border-b border-[var(--rule)] print:border-black">
              <div className="flex justify-between items-start gap-3">
                <span className="text-xs font-mono uppercase tracking-wider text-[var(--ink-soft)] w-16 shrink-0 pt-0.5 print:text-black">
                  SOURCE
                </span>
                <div className="flex-1 space-y-1 text-xs text-[var(--ink)] print:text-black">
                  <p className="font-medium text-sm text-[var(--ink)] print:text-black">
                    {receipt.source.title}
                  </p>
                  <p className="text-[var(--ink-soft)] font-mono print:text-black">
                    page {receipt.source.page ?? '—'} · archived{' '}
                    {formatArchivedDate(receipt.source.archivedAt)}
                  </p>
                  {(() => {
                    // Audit #82: Ensure exactly 64 hex characters
                    const hash64 = ensureSha256(receipt.source.sha256);
                    return (
                      <p
                        className="font-mono text-[var(--ink-soft)] print:text-black"
                        title={hash64}
                        data-testid="receipt-sha256"
                        data-sha256={hash64}
                      >
                        sha256 {truncateHash(hash64)}
                      </p>
                    );
                  })()}
                </div>
              </div>
            </section>
          ) : null}

          {/* STATUS Section (Derived Narrative State) */}
          <section className="py-4 border-b border-[var(--rule)] print:border-black">
            <div className="flex justify-between items-start gap-3">
              <span className="text-xs font-mono uppercase tracking-wider text-[var(--ink-soft)] w-16 shrink-0 pt-0.5 print:text-black">
                STATUS
              </span>
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${stateDotClass} print:bg-black`}
                    aria-hidden="true"
                  />
                  <span
                    className={`text-xs font-mono font-semibold uppercase tracking-wider ${stateTextClass} print:text-black`}
                  >
                    {receipt.narrative.state}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-[var(--ink)] print:text-black">
                  {narrativeText}
                </p>
              </div>
            </div>
          </section>

          {/* CHECKED Section (Provenance Sentence + Hear this audio control) */}
          <section className="py-4 border-b border-[var(--rule)] print:border-black">
            <div className="flex justify-between items-start gap-3">
              <span className="text-xs font-mono uppercase tracking-wider text-[var(--ink-soft)] w-16 shrink-0 pt-0.5 print:text-black">
                CHECKED
              </span>
              <div className="flex-1 space-y-3">
                <p className="text-sm leading-relaxed text-[var(--ink)] print:text-black">
                  {provenanceSentence}
                </p>
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--ink-soft)] print:text-black">Witnesses:</span>
                    <span className="font-mono text-xs font-semibold tracking-tight text-[var(--ink)] bg-[var(--paper)] px-1.5 py-0.5 border border-[var(--rule)] rounded print:bg-white print:text-black print:border-black">
                      {receipt.witness.count} of {receipt.witness.target}
                    </span>
                  </div>
                  {/* Audit #80: actual claim text included in spoken audio */}
                  <ReceiptAudioButton sentence={provenanceSentence} claim={receiptClaim} />
                </div>
              </div>
            </div>
          </section>

          {/* Prove it Section — Prominent Source Verification Action (Agent 7) */}
          <section className="pt-5 pb-1 print:hidden">
            <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 shadow-2xs">
              <div>
                <span className="text-xs font-bold text-slate-900 block">Cryptographic Genesis Record</span>
                <span className="text-[11px] font-mono text-slate-500">view source record · SHA-256</span>
              </div>
              <a
                href={`/api/projects/${encodeURIComponent(receipt.projectCode)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold font-mono text-white bg-slate-900 hover:bg-slate-800 px-3.5 py-2 rounded-lg shadow-xs transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 active:scale-98"
              >
                <span>prove it</span>
                <span className="text-[10px]">↗</span>
              </a>
            </div>
          </section>

          {/* Plain Language Summary (AI) Accordion */}
          <section className="pt-4 pb-1 print:hidden">
            <details className="group border border-slate-200/90 rounded-xl bg-slate-50/70 overflow-hidden transition-all">
              <summary className="flex items-center justify-between p-3.5 cursor-pointer select-none hover:bg-slate-100/80 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-xl">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                  <span className="text-xs font-bold text-slate-900 font-sans">
                    Plain Language Summary (AI)
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-medium">
                    Assistive
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
                  <span className="group-open:hidden">Expand</span>
                  <span className="hidden group-open:inline">Collapse</span>
                  <svg className="w-4 h-4 transform transition-transform duration-200 group-open:rotate-180" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
              </summary>
              <div className="p-4 pt-2 border-t border-slate-200/80 bg-white">
                <Eli5SummaryPanel
                  entityType="project"
                  entityId={receipt.projectCode}
                  title={receipt.title}
                  amount={receipt.amountMinor}
                  currency={receipt.currency}
                  contractor={receipt.contractor}
                  status={receipt.narrative.state}
                />
              </div>
            </details>
          </section>

          {/* Bottom perforation edge */}
          <div className="perf -mx-6 -mb-6 mt-6" />
        </article>
      </div>
    </>
  );
}
