import React from 'react';
import { MonitorPwaClient } from './MonitorPwaClient';

export const metadata = {
  title: 'Field Monitor Outbox (Offline PWA)',
  description: 'Field monitor PWA with offline IndexedDB outbox and automatic synchronization.',
};

import Link from 'next/link';

export default function PwaPage() {
  return (
    <>
      <MonitorPwaClient />
      <div className="mt-12 pt-6 border-t border-slate-200 flex flex-wrap justify-between items-center gap-4 text-xs font-mono max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <Link
          href="/services/ET-ID-REPLACE"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors shadow-xs"
        >
          ‹ Step 4: Divergence
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors shadow-xs"
        >
          Return to overview ›
        </Link>
      </div>
    </>
  );
}
