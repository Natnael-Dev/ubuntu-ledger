// Public Statutory & Divergence Card Page (T-27)
// Authoritative sources:
// - docs/specs/08-ui-ux-design.md §5, §6
// - docs/specs/05-api-contracts.md §6
// - docs/specs/10-skills.md S-11
// - docs/specs/11-tasks.md T-27

import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getStatutoryService } from '@/app-services/statutory.service';
import { DivergenceCard } from '@/components/DivergenceCard';

interface PageProps {
  params: Promise<{ code: string }>;
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const unwrappedParams = await props.params;
  const code = unwrappedParams?.code || '';
  const card = code ? await getStatutoryService().getStatutoryCard(code).catch(() => null) : null;
  if (!card) {
    return {
      title: 'Service Not Found',
      description: `Service code "${code}" was not recognized in the statutory gazette.`,
    };
  }

  return {
    title: `Divergence Ledger: ${card.serviceCode}`,
    description: `Official statutory ceiling vs citizen observations for office ${card.officeCode}. k-anonymity verified.`,
    openGraph: {
      type: 'article',
      title: `Statutory Divergence Card: ${card.serviceCode} · Ward Proof-Line`,
      description: `Official statutory ceiling vs citizen observations for office ${card.officeCode}.`,
    },
  };
}

export default async function ServiceCardPage(props: PageProps) {
  const unwrappedParams = await props.params;
  const code = unwrappedParams?.code || '';

  const statutoryService = getStatutoryService();
  let card = null;

  if (code) {
    try {
      card = await statutoryService.getStatutoryCard(code);
    } catch {
      card = null;
    }
  }

  if (!card) {
    notFound();
  }

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              body {
                background: #ffffff !important;
                color: #000000 !important;
              }
              .print-hide {
                display: none !important;
              }
            }
          `,
        }}
      />
      <div className="min-h-screen bg-slate-50 text-slate-900 py-10 px-4 sm:px-6 lg:px-8 print:bg-white print:text-black print:p-0">
        <nav aria-label="Return navigation" className="max-w-5xl mx-auto mb-6 print-hide">
          <Link
            href="/"
            className="font-mono text-xs text-slate-800 hover:text-slate-950 px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 inline-flex items-center gap-1.5 shadow-2xs font-bold transition-all active:scale-98"
          >
            ← Return to Proof-Line Overview
          </Link>
        </nav>

        <h1 className="sr-only">Public Service Fee Divergence Card for {card.serviceCode}</h1>
        <DivergenceCard card={card} />

        {/* Journey navigation (Agent 7) */}
        <nav
          aria-label="Proof-Line steps"
          className="max-w-5xl mx-auto mt-12 pt-6 border-t border-slate-200 flex justify-between items-center font-mono text-xs print-hide"
        >
          <Link
            href="/receipt/4412"
            className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 font-bold transition-all shadow-2xs active:scale-98"
          >
            ‹ Step 3: Receipt
          </Link>
          <span aria-current="step" className="font-bold text-slate-900 bg-slate-200/80 px-3.5 py-2 rounded-xl">
            Step 4: Divergence
          </span>
          <Link
            href="/pwa"
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-sm shadow-blue-500/20 active:scale-98"
          >
            Step 5: Offline PWA ›
          </Link>
        </nav>
      </div>
    </>
  );
}
