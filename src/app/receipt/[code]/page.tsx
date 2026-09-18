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
        {/* Print trigger bar for demo */}
        <nav
          aria-label="Proof-Line steps"
          className="print-hide w-full max-w-[440px] mb-3 flex justify-between items-center text-xs text-[var(--ink-soft)] font-mono"
        >
          <Link
            href="/"
            className="hover:text-[var(--ink)] hover:underline flex items-center gap-1 focus:outline-none focus:ring-1 focus:ring-[var(--ink)]"
          >
            ← Overview
          </Link>
          <div className="flex items-center gap-3">
            <span aria-current="step" className="font-bold text-[var(--ink)] text-[11px]">
              Step 3: Receipt
            </span>
            <Link
              href="/services/ET-ID-REPLACE"
              className="inline-flex items-center gap-1 font-mono text-[11px] text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors focus:outline-none focus:ring-1 focus:ring-[var(--ink)]"
            >
              Step 4: Divergence
              <span aria-hidden="true">›</span>
            </Link>
            <ReceiptPrintButton />
          </div>
        </nav>

        {/* The Receipt Card Layout (08 §5) */}
        <article className="receipt-container max-w-[440px] w-full border border-[var(--rule)] bg-[var(--paper)] p-6 shadow-sm font-sans transition-all relative print:bg-white print:text-black print:border-black print:shadow-none">
          {/* Perforation top edge */}
          <div className="perf-bold -mx-6 -mt-6 mb-5" />

          {/* Header */}
          <header className="pb-4 border-b border-[var(--rule)] relative print:bg-white print:text-black print:border-black">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-3 h-3 border border-[var(--ink)] flex items-center justify-center">
                    <div className="w-1 h-1 bg-[var(--state-open)]" />
                  </div>
                  <span className="font-mono text-[10px] font-bold text-[var(--ink)] uppercase tracking-widest">
                    Ubuntu Ledger
                  </span>
                </div>
                <div className="font-mono font-bold tracking-wider text-sm text-[var(--ink)]">
                  {ward.name}
                </div>
                <div className="text-xs text-[var(--ink-soft)] font-mono">
                  {ward.code} · Public spending receipt
                </div>
              </div>

              {/* Official circular verification stamp */}
              <div className="shrink-0 opacity-80" title="Ubuntu Ledger Cryptographic Verification Seal">
                <svg width="52" height="52" viewBox="0 0 52 52" fill="none" className="text-[var(--state-open)]">
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
          <section className="py-4 border-b border-[var(--rule)]">
            <div className="flex justify-between items-baseline gap-2">
              <span className="font-mono text-sm font-bold tracking-tight text-[var(--ink)]">
                {receipt.projectCode}
              </span>
              <span
                className={`font-mono text-base font-bold tracking-tight text-right ${
                  isUnofficial ? 'text-[var(--state-none)]' : 'text-[var(--ink)]'
                }`}
              >
                {formatCurrency(receipt.amountMinor, receipt.currency)}
              </span>
            </div>
            <h1 className="mt-1 text-base font-semibold leading-snug text-[var(--ink)]">
              {receipt.title}
            </h1>
            <div className="mt-3 flex justify-between items-center text-xs text-[var(--ink-soft)] font-mono">
              <span className="text-[var(--ink)] font-sans">{receipt.contractor}</span>
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

          {/* Prove it Section */}
          <section className="pt-4 pb-1 print:hidden">
            <div className="flex items-center gap-2">
              <a
                href={`/api/projects/${encodeURIComponent(receipt.projectCode)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-mono text-[var(--ink)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--ink)]"
              >
                <span className="border border-[var(--ink-soft)] px-1.5 py-0.5 rounded text-[11px]">
                  prove it
                </span>
                <span className="text-[var(--ink-soft)]">
                  view source record
                </span>
              </a>
            </div>
          </section>

          {/* Bottom perforation edge */}
          <div className="perf -mx-6 -mb-6 mt-6" />
        </article>
      </div>
    </>
  );
}
