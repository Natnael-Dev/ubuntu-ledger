import React from 'react';
import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--rule)] bg-[var(--paper)] mt-20 no-print">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid sm:grid-cols-3 gap-8 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-4 h-4 border border-[var(--ink)] flex items-center justify-center">
                <div className="w-1.5 h-1.5 bg-[var(--state-open)]" />
              </div>
              <div>
                <div className="font-mono text-[10px] font-bold text-[var(--ink)] uppercase tracking-widest">
                  Ubuntu Ledger
                </div>
                <div className="font-mono text-[9px] text-[var(--state-open)] uppercase tracking-widest">
                  Ward Proof-Line
                </div>
              </div>
            </div>
            <p className="font-mono text-[11px] text-[var(--ink-soft)] leading-relaxed">
              Civic evidence and infrastructure accountability system for Kenya and Ethiopia.
              Built for the OSF × Andela Transparency &amp; Accountability track. Evidence is not opinion. Contradictions are not errors.
            </p>
          </div>

          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-soft)] font-bold mb-3">
              System Surfaces
            </div>
            <div className="grid grid-cols-2 gap-y-1.5 gap-x-4">
              <Link href="/simulator" className="font-mono text-[11px] text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
                Simulator
              </Link>
              <Link href="/console" className="font-mono text-[11px] text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
                Console
              </Link>
              <Link href="/receipt/4412" className="font-mono text-[11px] text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
                Receipt
              </Link>
              <Link href="/services/ET-ID-REPLACE" className="font-mono text-[11px] text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
                Services
              </Link>
              <Link href="/pwa" className="font-mono text-[11px] text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
                Field PWA
              </Link>
              <Link href="/" className="font-mono text-[11px] text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
                Home
              </Link>
            </div>
          </div>

          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-soft)] font-bold mb-3">
              Evidence Standards
            </div>
            <div className="font-mono text-[11px] text-[var(--ink-soft)] space-y-1.5 leading-relaxed">
              <div>Hash: SHA-256 append-only chain</div>
              <div>Privacy: k-anonymity (k &ge; 5)</div>
              <div>Timestamps: ISO 8601 UTC</div>
              <div>Transport: GSM USSD / IVR + PWA</div>
              <div>Contract: Zero contractor self-close</div>
            </div>
          </div>
        </div>

        <div className="h-px bg-[var(--rule)] w-full mb-5" />

        <div className="flex flex-wrap justify-between gap-2">
          <span className="font-mono text-[10px] text-[var(--ink-soft)]">
            Ubuntu Ledger · Ward Proof-Line · OSF × Andela 2026
          </span>
          <span className="font-mono text-[10px] text-[var(--ink-soft)]">
            A contractor cannot close their own ticket.
          </span>
        </div>
      </div>
    </footer>
  );
}
