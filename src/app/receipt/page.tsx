// Receipt Index Page — lists all demo receipts so /receipt doesn't 404
// Fixes C-2: undiscoverable receipt pages

import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { DEMO_PROJECTS } from '@/fixtures/demo-scenario';

export const metadata: Metadata = {
  title: 'Public Spending Receipts — Ubuntu Ledger',
  description: 'Verifiable public spending receipts for Ward 09 municipal infrastructure projects.',
};

const RECEIPT_CODES = DEMO_PROJECTS.map((p) => ({
  code: p.projectCode,
  title: p.title,
  contractorName: p.contractorName,
  amountMinor: p.amountMinor,
  currency: p.currency,
}));

export default function ReceiptsIndexPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="mb-8">
          <p className="font-mono text-[10px] uppercase tracking-widest text-blue-600 font-bold mb-2">
            Ward Proof-Line · Ward 09 (Woreda 9)
          </p>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 mb-3">
            Public Spending Receipts
          </h1>
          <p className="text-base text-slate-600 leading-relaxed max-w-2xl">
            Cryptographically verified receipts for municipal infrastructure contracts. Each receipt includes
            SHA-256 provenance, witness evidence, and community verification status.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {RECEIPT_CODES.map(({ code, title, contractorName, amountMinor, currency }) => (
            <Link
              key={code}
              href={`/receipt/${code}`}
              className="group bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:border-blue-300 hover:shadow-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">
                  #{code}
                </span>
                <span className="text-[10px] font-mono text-slate-400 group-hover:text-blue-500 transition-colors">
                  View receipt ›
                </span>
              </div>
              <h2 className="text-sm font-bold text-slate-900 mb-1 leading-snug">{title}</h2>
              <div className="text-xs text-slate-500 font-mono">
                {contractorName} · {currency} {(amountMinor / 100).toLocaleString()}
              </div>
            </Link>
          ))}
        </div>

        <nav className="mt-10 pt-6 border-t border-slate-200 flex justify-between items-center text-xs font-medium text-slate-500">
          <Link href="/" className="hover:text-slate-900 transition-colors px-2 py-1 rounded focus-visible:ring-2 focus-visible:ring-blue-600">
            ‹ Overview
          </Link>
          <Link href="/services/ET-CIVIL-ID" className="hover:text-blue-600 font-semibold text-slate-900 transition-colors px-2 py-1 rounded focus-visible:ring-2 focus-visible:ring-blue-600">
            Fee Divergence Cards ›
          </Link>
        </nav>
      </div>
    </div>
  );
}
