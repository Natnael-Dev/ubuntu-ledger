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
      <div className="mt-8 pt-4 border-t border-[var(--rule)] flex justify-between items-center font-mono text-[11px] text-[var(--ink-soft)] max-w-4xl mx-auto px-4 pb-8">
        <Link href="/services/ET-ID-REPLACE" className="hover:text-[var(--ink)] transition-colors">
          ‹ Step 4: Divergence
        </Link>
        <Link href="/" className="hover:text-[var(--ink)] transition-colors">
          Return to overview ›
        </Link>
      </div>
    </>
  );
}
