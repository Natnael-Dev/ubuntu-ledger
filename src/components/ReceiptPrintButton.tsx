'use client';

import React from 'react';

export function ReceiptPrintButton() {
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== 'undefined') {
          window.print();
        }
      }}
      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-slate-800 bg-[#0F172A] text-white hover:bg-slate-800 active:scale-98 text-xs sm:text-sm font-bold transition-all shadow-sm cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
      aria-label="Print or save this public verification receipt"
    >
      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
      </svg>
      <span>Print Receipt</span>
    </button>
  );
}
