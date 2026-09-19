import React from 'react';
import Link from 'next/link';
import { UbuntuLedgerIcon } from '@/components/UbuntuLedgerIcon';

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50 mt-20 no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid sm:grid-cols-3 gap-8 mb-10">
          <div>
            <div className="flex items-center gap-3 mb-3.5">
              <UbuntuLedgerIcon className="w-6 h-6 rounded-md shadow-2xs shrink-0" size={24} />
              <div>
                <div className="font-sans text-sm font-bold text-slate-900 tracking-tight">
                  Ubuntu Ledger
                </div>
                <div className="font-mono text-[10px] text-blue-600 uppercase tracking-widest font-semibold">
                  Ward Proof-Line
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed font-sans">
              Civic evidence and infrastructure accountability system for Kenya and Ethiopia.
              Built for the OSF × Andela Transparency &amp; Accountability track. Evidence is not opinion. Contradictions are not errors.
            </p>
          </div>

          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-3">
              System Surfaces
            </div>
            <div className="grid grid-cols-2 gap-y-2 gap-x-4">
              <Link href="/simulator" className="text-xs text-slate-600 hover:text-blue-600 transition-colors">
                Simulator
              </Link>
              <Link href="/console" className="text-xs text-slate-600 hover:text-blue-600 transition-colors">
                Console
              </Link>
              <Link href="/receipt/4412" className="text-xs text-slate-600 hover:text-blue-600 transition-colors">
                Receipt
              </Link>
              <Link href="/services/ET-ID-REPLACE" className="text-xs text-slate-600 hover:text-blue-600 transition-colors">
                Services
              </Link>
              <Link href="/pwa" className="text-xs text-slate-600 hover:text-blue-600 transition-colors">
                Field PWA
              </Link>
              <Link href="/" className="text-xs text-slate-600 hover:text-blue-600 transition-colors">
                Home
              </Link>
            </div>
          </div>

          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-3">
              Evidence Standards
            </div>
            <div className="font-mono text-[11px] text-slate-600 space-y-1.5 leading-relaxed">
              <div>Hash: SHA-256 append-only chain</div>
              <div>Privacy: k-anonymity (k &ge; 5)</div>
              <div>Timestamps: ISO 8601 UTC</div>
              <div>Transport: GSM USSD / IVR + PWA</div>
              <div>Contract: Zero contractor self-close</div>
            </div>
          </div>
        </div>

        <div className="h-px bg-slate-200 w-full mb-5" />

        <div className="flex flex-wrap justify-between gap-2">
          <span className="font-mono text-[10px] text-slate-500">
            Ubuntu Ledger · Ward Proof-Line · OSF × Andela 2026
          </span>
          <span className="font-mono text-[10px] text-slate-500">
            A contractor cannot close their own ticket.
          </span>
        </div>
      </div>
    </footer>
  );
}
