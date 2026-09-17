// Public Statutory & Divergence Card Page (T-27)
// Authoritative sources:
// - docs/specs/08-ui-ux-design.md §5, §6
// - docs/specs/05-api-contracts.md §6
// - docs/specs/10-skills.md S-11
// - docs/specs/11-tasks.md T-27

import React from 'react';
import Link from 'next/link';
import { getStatutoryService } from '@/app-services/statutory.service';
import { DivergenceCard } from '@/components/DivergenceCard';

interface PageProps {
  params: Promise<{ code: string }>;
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
    return (
      <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)] flex items-center justify-center p-4">
        <div className="max-w-md w-full border border-[var(--rule)] bg-[var(--paper)] p-6 text-center space-y-4">
          <div className="text-xs font-mono uppercase tracking-widest text-[var(--ink-soft)]">
            Service Not Found
          </div>
          <p className="font-mono text-sm text-[var(--ink)]">
            Service code &ldquo;{code || 'UNKNOWN'}&rdquo; was not recognized in
            the statutory gazette.
          </p>
          <Link
            href="/"
            className="inline-block font-mono text-xs text-[var(--ink)] underline hover:opacity-80"
          >
            ← Return to index
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)] py-10 px-4">
      <div className="max-w-2xl mx-auto mb-6">
        <Link
          href="/"
          className="font-mono text-xs text-[var(--ink-soft)] hover:text-[var(--ink)] underline"
        >
          ← Back to Ledger
        </Link>
      </div>

      <DivergenceCard card={card} />
    </main>
  );
}
