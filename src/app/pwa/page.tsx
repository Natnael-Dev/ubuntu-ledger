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
      <div className="mt-10 pt-5 border-t border-[var(--rule)] flex justify-between items-center font-mono text-xs text-slate-500 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
        <Link href="/services/ET-ID-REPLACE" className="hover:text-slate-900 transition-colors">
          ‹ Step 4: Divergence
        </Link>
        <Link href="/" className="hover:text-slate-900 transition-colors">
          Return to overview ›
        </Link>
      </div>
    </>
  );
}
