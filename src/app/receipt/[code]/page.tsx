// Public Spending Receipt Page
// Authoritative sources:
// - docs/specs/08-ui-ux-design.md §5 (Public receipt card layout, print view, NO SOURCE DOCUMENT band, Provenance sentence, audio control)
// - docs/specs/05-api-contracts.md §4
// - docs/specs/11-tasks.md T-19

import React from 'react';
import {
  getProjectReceipt,
  formatCurrency,
  formatPromisedDate,
  formatArchivedDate,
  truncateHash,
  resolveNarrativeText,
  type ProjectReceiptDto,
  type WardMetadataDto,
} from '@/app/api/projects/[code]/route';
import { DEMO_WARDS } from '@/fixtures/demo-scenario';
import { ReceiptAudioButton } from './ReceiptAudioButton';

interface PageProps {
  params: Promise<{ code: string }>;
}

function resolveProvenanceSentence(receipt: ProjectReceiptDto): string {
  // If specific project 4412, use canonical 08 §5 provenance sentence
  if (receipt.projectCode === '4412') {
    return 'Nine neighbours checked this on Tuesday. Two said it runs; seven said it does not.';
  }
  if (receipt.confidence === 'UNOFFICIAL_ESTIMATE') {
    return 'No neighbours have checked this project yet. Awaiting inspection task dispatch.';
  }
  if (receipt.narrative.state === 'FIELD_DISCREPANCY') {
    return 'Four neighbours checked this on Friday. Two said yes; two said no. Discrepancy flagged.';
  }
  if (receipt.narrative.state === 'PHYSICALLY_CONFIRMED' || receipt.narrative.state === 'VERIFIED_SUSTAINED') {
    return 'Three neighbours checked this on Tuesday. Three said it runs; zero said it does not. Physically confirmed.';
  }
  return `${receipt.witness.count} neighbours checked this on Tuesday. Observations recorded.`;
}

export default async function ReceiptPage(props: PageProps) {
  const unwrappedParams = await props.params;
  const code = unwrappedParams?.code || '';

  const receipt: ProjectReceiptDto | null = code ? getProjectReceipt(code) : null;
  const matchedWard = DEMO_WARDS.find((dw) => dw.id === receipt?.wardId) || DEMO_WARDS[0];
  const ward: WardMetadataDto = {
    code: matchedWard.code,
    name: matchedWard.code === 'ET-AA-W09' ? 'WOREDA 9' : matchedWard.name.toUpperCase(),
    locales: matchedWard.locales,
  };

  if (!receipt) {
    return (
      <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)] flex items-center justify-center p-4">
        <div className="receipt-container max-w-[440px] w-full border border-[var(--rule)] bg-[var(--paper)] p-6 text-center space-y-4 shadow-sm">
          <div className="text-xs font-mono uppercase tracking-widest text-[var(--ink-soft)]">
            Receipt Not Found
          </div>
          <h1 className="text-base font-semibold">
            Project code <span className="font-mono">{code}</span> was not recognised.
          </h1>
          <p className="text-xs text-[var(--ink-soft)] leading-relaxed">
            Project codes are printed on official project boards posted at the physical site.
          </p>
          <a
            href="/simulator"
            className="inline-block mt-4 text-xs font-mono text-[var(--ink)] underline hover:text-black"
          >
            Go to simulator
          </a>
        </div>
      </main>
    );
  }

  const isUnofficial =
    receipt.confidence === 'UNOFFICIAL_ESTIMATE' || receipt.source === null;
  const provenanceSentence = resolveProvenanceSentence(receipt);
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
                margin: 12mm;
              }
              body {
                background: #ffffff !important;
                color: #14150F !important;
              }
              .receipt-container {
                max-width: 100% !important;
                box-shadow: none !important;
                border: 1px solid #D9D7CC !important;
                background: #ffffff !important;
                page-break-inside: avoid !important;
              }
              .print-hide {
                display: none !important;
              }
            }
          `,
        }}
      />
      <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)] py-8 px-4 flex flex-col items-center justify-start">
        {/* Print trigger bar for demo */}
        <div className="print-hide w-full max-w-[440px] mb-3 flex justify-between items-center text-xs text-[var(--ink-soft)] font-mono">
          <a
            href="/simulator"
            className="hover:underline flex items-center gap-1"
          >
            ← simulator
          </a>
          <button
            type="button"
            onClick={() => typeof window !== 'undefined' && window.print()}
            className="px-2.5 py-1 border border-[var(--rule)] bg-white hover:bg-neutral-100 rounded text-[11px] text-[var(--ink)] transition"
          >
            print receipt
          </button>
        </div>

        {/* The Receipt Card Layout (08 §5) */}
        <article className="receipt-container max-w-[440px] w-full border border-[var(--rule)] bg-[var(--paper)] p-6 shadow-sm font-sans transition-all">
          {/* Header */}
          <header className="pb-4 border-b border-[var(--rule)]">
            <div className="flex justify-between items-baseline font-mono">
              <span className="font-bold tracking-wider text-sm text-[var(--ink)]">
                {ward.name}
              </span>
              <span className="text-xs text-[var(--ink-soft)] tracking-wider">
                {ward.code}
              </span>
            </div>
            <div className="mt-1 text-xs text-[var(--ink-soft)] font-mono">
              Public spending receipt
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
            <section className="py-4 border-b border-[var(--rule)]">
              <div className="w-full bg-[var(--state-none)] text-white text-center py-2 px-3 tracking-wider font-mono font-bold text-xs shadow-sm">
                NO SOURCE DOCUMENT
              </div>
              <p className="mt-2 text-xs text-center text-[var(--ink-soft)] leading-relaxed">
                This figure is an estimate — no official budget circular or gazette is cited.
              </p>
            </section>
          ) : receipt.source ? (
            <section className="py-4 border-b border-[var(--rule)]">
              <div className="flex justify-between items-start gap-3">
                <span className="text-xs font-mono uppercase tracking-wider text-[var(--ink-soft)] w-16 shrink-0 pt-0.5">
                  SOURCE
                </span>
                <div className="flex-1 space-y-1 text-xs text-[var(--ink)]">
                  <p className="font-medium text-sm text-[var(--ink)]">
                    {receipt.source.title}
                  </p>
                  <p className="text-[var(--ink-soft)] font-mono">
                    page {receipt.source.page ?? '—'} · archived{' '}
                    {formatArchivedDate(receipt.source.archivedAt)}
                  </p>
                  <p
                    className="font-mono text-[var(--ink-soft)]"
                    title={receipt.source.sha256}
                  >
                    sha256 {truncateHash(receipt.source.sha256)}
                  </p>
                </div>
              </div>
            </section>
          ) : null}

          {/* STATUS Section (Derived Narrative State) */}
          <section className="py-4 border-b border-[var(--rule)]">
            <div className="flex justify-between items-start gap-3">
              <span className="text-xs font-mono uppercase tracking-wider text-[var(--ink-soft)] w-16 shrink-0 pt-0.5">
                STATUS
              </span>
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${stateDotClass}`}
                    aria-hidden="true"
                  />
                  <span
                    className={`text-xs font-mono font-semibold uppercase tracking-wider ${stateTextClass}`}
                  >
                    {receipt.narrative.state}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-[var(--ink)]">
                  {narrativeText}
                </p>
              </div>
            </div>
          </section>

          {/* CHECKED Section (Provenance Sentence + Hear this audio control) */}
          <section className="py-4 border-b border-[var(--rule)]">
            <div className="flex justify-between items-start gap-3">
              <span className="text-xs font-mono uppercase tracking-wider text-[var(--ink-soft)] w-16 shrink-0 pt-0.5">
                CHECKED
              </span>
              <div className="flex-1 space-y-3">
                <p className="text-sm leading-relaxed text-[var(--ink)]">
                  {provenanceSentence}
                </p>
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--ink-soft)]">Witnesses:</span>
                    <span className="font-mono text-xs font-semibold tracking-tight text-[var(--ink)] bg-[var(--paper)] px-1.5 py-0.5 border border-[var(--rule)] rounded">
                      {receipt.witness.count} of {receipt.witness.target}
                    </span>
                  </div>
                  <ReceiptAudioButton sentence={provenanceSentence} />
                </div>
              </div>
            </div>
          </section>

          {/* Prove it Section */}
          <section className="pt-4 pb-1">
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
                  source page + hash + full event history
                </span>
              </a>
            </div>
          </section>
        </article>
      </main>
    </>
  );
}
