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
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)] py-10 px-4">
      <div className="max-w-2xl mx-auto mb-4">
        <Link
          href="/"
          className="font-mono text-xs text-[var(--ink-soft)] hover:text-[var(--ink)] hover:underline inline-flex items-center gap-1"
        >
          ← Return to Proof-Line Overview
        </Link>
      </div>

      <h1 className="sr-only">Public Service Fee Divergence Card for {card.serviceCode}</h1>
      <DivergenceCard card={card} />

      {/* Journey navigation */}
      <div className="mt-8 pt-4 border-t border-[var(--rule)] flex justify-between items-center font-mono text-[11px] text-[var(--ink-soft)]">
        <Link href="/receipt/4412" className="hover:text-[var(--ink)] transition-colors">
          ‹ Step 3: Receipt
        </Link>
        <Link href="/pwa" className="hover:text-[var(--ink)] transition-colors">
          Step 5: Offline PWA ›
        </Link>
      </div>
    </div>
  );
}
