// Services Index Page — lists all demo statutory services so /services doesn't 404
// Fixes C-2: undiscoverable services pages

import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Service Fee Divergence Cards — Ubuntu Ledger',
  description: 'Statutory gazette fees vs. citizen-reported fees for Ward 09 municipal services.',
};

const DEMO_SERVICE_INDEX = [
  {
    code: 'ET-CIVIL-ID',
    internalCode: 'ET-ID-REPLACE',
    name: 'Kebele Resident ID Card Replacement',
    amharic: 'የቀበሌ ነዋሪነት መታወቂያ ካርድ እድሳት',
    office: 'Woreda 09 Civil Registry',
    country: 'Ethiopia (ET)',
    statutoryFee: 'ETB 50',
    finding: '11 of 14 citizens reported unofficial surcharges',
  },
  {
    code: 'ET-CLINIC-INTAKE',
    name: 'Public Clinic Intake Registration',
    amharic: 'የህዝብ ክሊኒክ ምዝገባ',
    office: 'Woreda 09 Health Centre',
    country: 'Ethiopia (ET)',
    statutoryFee: 'Free',
    finding: 'Baseline service — comparison reference',
  },
];

export default function ServicesIndexPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="mb-8">
          <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-600 font-bold mb-2">
            Ward Proof-Line · Dual-Ledger Accountability
          </p>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 mb-3">
            Service Fee Divergence Cards
          </h1>
          <p className="text-base text-slate-600 leading-relaxed max-w-2xl">
            Official gazette-mandated fees (statutory ledger) compared against anonymised citizen
            reports (community ledger). Divergence is made transparently visible. The two ledgers
            are never merged or averaged.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {DEMO_SERVICE_INDEX.map(({ code, name, amharic, office, country, statutoryFee, finding }) => (
            <Link
              key={code}
              href={`/services/${code}`}
              className="group bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">
                  {code}
                </span>
                <span className="text-[10px] font-mono text-slate-400 group-hover:text-emerald-500 transition-colors">
                  View card ›
                </span>
              </div>
              <h2 className="text-sm font-bold text-slate-900 mb-0.5 leading-snug">{name}</h2>
              {amharic && (
                <p className="text-xs text-slate-500 mb-2 font-mono">{amharic}</p>
              )}
              <div className="text-xs text-slate-500 font-mono space-y-0.5">
                <div>{office} · {country}</div>
                <div className="text-slate-700 font-semibold">Statutory: {statutoryFee}</div>
                <div className="text-amber-700 font-medium text-[11px] mt-1">{finding}</div>
              </div>
            </Link>
          ))}
        </div>

        <nav className="mt-10 pt-6 border-t border-slate-200 flex justify-between items-center text-xs font-medium text-slate-500">
          <Link href="/receipt" className="hover:text-slate-900 transition-colors px-2 py-1 rounded focus-visible:ring-2 focus-visible:ring-blue-600">
            ‹ Spending Receipts
          </Link>
          <Link href="/pwa" className="hover:text-blue-600 font-semibold text-slate-900 transition-colors px-2 py-1 rounded focus-visible:ring-2 focus-visible:ring-blue-600">
            Field Monitor PWA ›
          </Link>
        </nav>
      </div>
    </div>
  );
}
