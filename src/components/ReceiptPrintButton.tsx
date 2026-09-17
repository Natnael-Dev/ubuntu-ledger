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
      className="px-2.5 py-1 border border-[var(--rule)] bg-white hover:bg-neutral-100 rounded text-[11px] text-[var(--ink)] transition"
    >
      print receipt
    </button>
  );
}
