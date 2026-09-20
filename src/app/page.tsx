// Homepage — Ubuntu Ledger / Ward Proof-Line
// Modern civic architecture: Evidence → Human observation → Independent confirmation → Accountability
// Design North Star: Light canvas (#F8FAFC), crisp surfaces (#FFFFFF), restrained charcoal section (#0B0F17), civic blue (#2563EB) accents.

import React from 'react';
import Link from 'next/link';
import { UbuntuLedgerIcon } from '@/components/UbuntuLedgerIcon';

export const metadata = {
  title: 'Ward Proof-Line · Ubuntu Ledger — Civic Evidence System',
  description:
    'A public evidence system for ward-level infrastructure accountability. Citizens verify repairs via feature phone. Contractors cannot close their own tickets.',
};

const PROOFS = [
  {
    id: 'A',
    badge: 'Proof A · Sybil Defense',
    title: 'Geographic Cluster Deduplication',
    claim: 'Multiple phones from the same cell area do not become multiple independent witnesses.',
    mechanism:
      'Reports are binned by an irreversible geographic cluster key derived from telecom metadata. A second phone from the same geographic cluster is recognized as a duplicate and cannot artificially inflate the quorum.',
    href: '/simulator',
    action: 'Test in Feature Phone Simulator',
    accent: 'blue',
  },
  {
    id: 'B',
    badge: 'Proof B · Probation Lock',
    title: 'Enforced 7-Day Verification Window',
    claim: 'A contractor who claims a repair is complete cannot close their own ticket.',
    mechanism:
      'A mandatory 7-day citizen probation window begins the moment a repair is claimed. A database CHECK constraint programmatically blocks ticket closure until independent citizen witnesses confirm the asset is functional.',
    href: '/console',
    action: 'Inspect Operator Console',
    accent: 'amber',
  },
  {
    id: 'C',
    badge: 'Proof C · Two-Ledger Separation',
    title: 'Statutory Law vs. Community Ground Truth',
    claim: 'Official gazette mandates and citizen field observations are never merged or averaged.',
    mechanism:
      'Official statutory rules (with archived gazette citation and SHA-256 provenance) are kept in a separate cryptographic ledger from anonymous citizen observations. Divergence is made transparently visible.',
    href: '/services/ET-ID-REPLACE',
    action: 'Explore Fee Divergence Card',
    accent: 'emerald',
  },
] as const;

const PORTALS = [
  {
    href: '/simulator',
    title: 'Feature Phone Simulator',
    category: 'Interactive USSD & IVR',
    description:
      'Dial *890# on an authentic Alcatel 1066 handset. Experience real GSM protocol interactions, answer questions for Contract #4412, and observe real-time cluster deduplication.',
    tag: 'Flagship Experience',
  },
  {
    href: '/console',
    title: 'Municipal Operator Cockpit',
    category: 'Operational Oversight',
    description:
      'Real-time municipal dashboard enforcing INV-01 probation invariants. See why claimed repairs turn amber (never green) until citizen witness quorums are satisfied.',
    tag: 'Public Sector Cockpit',
  },
  {
    href: '/receipt/4412',
    title: 'Verifiable Spending Receipt',
    category: 'Cryptographic Provenance',
    description:
      'Public verification artifact for Health Post Generator overhaul (ETB 320,000). Features SHA-256 genesis audit chain, witness evidence, and low-literacy audio readout.',
    tag: 'Public Artifact',
  },
  {
    href: '/services/ET-ID-REPLACE',
    title: 'Service Fee Divergence',
    category: 'Dual-Ledger Accountability',
    description:
      'Compare statutory fees against actual citizen payments. 11 of 14 citizens reported unofficial surcharges. Verified through strict k-anonymity (k >= 5).',
    tag: 'Anti-Corruption Proof',
  },
  {
    href: '/pwa',
    title: 'Field Monitor PWA',
    category: 'Offline-First Field Tool',
    description:
      'High-contrast, sunlight-resilient tool for field monitors. Capture observations offline with local cryptographic storage and automatic synchronization when reconnected.',
    tag: 'Sunlight-Resilient',
  },
] as const;

export default function HomePage() {
  return (
    <div className="bg-[#F8FAFC] min-h-screen text-slate-900 font-sans">
      {/* ─── Hero Section ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-slate-200/80 bg-white pt-16 pb-24 md:pt-24 md:pb-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            {/* Tracked Uppercase Eyebrow with Canonical Brand Icon */}
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full text-xs font-mono font-bold tracking-widest uppercase bg-slate-50 text-slate-800 border border-slate-200 shadow-2xs mb-6">
              <UbuntuLedgerIcon className="w-4 h-4 rounded-sm shrink-0" size={16} />
              <span>CIVIC EVIDENCE SYSTEM // OSF TRACK</span>
            </div>

            {/* Primary Brand Heading — Dark Navy Language */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-[#0F172A] leading-[1.1] mb-3 font-sans">
              Ward Proof-Line
            </h1>
            <h2 className="text-2xl sm:text-3xl md:text-4xl text-blue-600 font-bold mb-6 font-sans">
              Citizens verify repairs. Contractors cannot self-close.
            </h2>

            {/* Mission Paragraph */}
            <p className="text-base sm:text-lg md:text-xl text-slate-600 leading-relaxed mb-8">
              A modern public evidence system for ward-level infrastructure accountability.
              Citizens in rural Kenya and Ethiopia confirm government works via basic USSD feature phones,
              anchoring public funds to independent physical evidence.
            </p>

            {/* Core Principle Banner */}
            <div className="border-l-4 border-blue-600 bg-blue-50/60 p-5 rounded-r-2xl mb-10 shadow-xs">
              <p className="text-base sm:text-lg font-bold text-[#0F172A]">
                Core Architectural Rule: <span className="text-blue-700 font-extrabold">A contractor cannot close their own ticket.</span>
              </p>
              <p className="text-sm sm:text-base text-slate-600 mt-1.5 leading-relaxed">
                Database-level constraints enforce citizen quorums and a mandatory 7-day probation lock before public funds are unlocked.
              </p>
            </div>

            {/* Large, Tactile Action Buttons with Generous Spacing */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                href="/receipt/4412"
                className="inline-flex items-center justify-center px-8 py-4 rounded-xl text-base font-bold bg-blue-600 text-white hover:bg-blue-700 active:scale-98 shadow-md shadow-blue-500/20 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                View Verified Receipt
              </Link>
              <Link
                href="/simulator"
                className="inline-flex items-center justify-center px-8 py-4 rounded-xl text-base font-bold bg-white text-slate-800 hover:bg-slate-50 hover:text-slate-950 border-2 border-slate-300 hover:border-slate-400 active:scale-98 transition-all shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                Feature Phone Simulator
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Restrained Charcoal Civic Verification Overview ────────────── */}
      <section className="py-20 md:py-28 bg-[#0B0F17] text-white border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 pb-8 border-b border-slate-800/80">
            <div>
              <p className="text-xs font-mono font-bold uppercase tracking-widest text-emerald-400 mb-2.5">
                Woreda 09 · Municipal Audit Status
              </p>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white font-sans">
                Civic Verification Overview
              </h2>
            </div>
            <p className="text-sm text-slate-400 mt-3 md:mt-0 font-mono">
              Anchor: FY2026 Kirkos Capital Budget
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            {/* Metric 1 */}
            <div className="bg-[#131924] p-7 sm:p-8 rounded-2xl border border-slate-800 shadow-md hover:border-slate-700 transition-colors flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-5">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Monitored Projects
                  </span>
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-xs shadow-blue-500/50" />
                </div>
                <div className="text-3xl sm:text-4xl font-extrabold text-white mb-3 tabular-nums">6 Contracts</div>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed pt-2 border-t border-slate-800/60">
                Generator, borehole, sanitation, &amp; solar assets under active citizen monitoring.
              </p>
            </div>

            {/* Metric 2 */}
            <div className="bg-[#131924] p-7 sm:p-8 rounded-2xl border border-slate-800 shadow-md hover:border-slate-700 transition-colors flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-5">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Probation Lock
                  </span>
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-xs shadow-amber-400/50" />
                </div>
                <div className="text-3xl sm:text-4xl font-extrabold text-white mb-3 tabular-nums">7 Days</div>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed pt-2 border-t border-slate-800/60">
                Mandatory waiting window enforced by PostgreSQL CHECK constraints.
              </p>
            </div>

            {/* Metric 3 */}
            <div className="bg-[#131924] p-7 sm:p-8 rounded-2xl border border-slate-800 shadow-md hover:border-slate-700 transition-colors flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-5">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Sybil Defense
                  </span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-xs shadow-emerald-400/50" />
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-white mb-3">Cluster-Binned</div>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed pt-2 border-t border-slate-800/60">
                Telecom cell deduplication stops colluding SIM rings from manipulating quorums.
              </p>
            </div>

            {/* Metric 4 */}
            <div className="bg-[#131924] p-7 sm:p-8 rounded-2xl border border-slate-800 shadow-md hover:border-slate-700 transition-colors flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-5">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Two-Ledger Split
                  </span>
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 shadow-xs shadow-indigo-400/50" />
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-white mb-3">Strict Isolation</div>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed pt-2 border-t border-slate-800/60">
                Statutory gazette regulations and citizen reports remain cryptographically distinct.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── The Three Proof Mechanisms ────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mb-14">
            <p className="text-xs font-mono font-bold uppercase tracking-widest text-blue-600 mb-2">
              Cryptographic &amp; Institutional Guarantees
            </p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900">
              Three Proofs That Power Public Trust
            </h2>
            <p className="text-base sm:text-lg text-slate-600 mt-4 leading-relaxed">
              Unlike typical reporting apps that rely on goodwill, Ubuntu Ledger enforces accountability at the database schema level.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {PROOFS.map((proof) => (
              <div
                key={proof.id}
                className="bg-slate-50/80 rounded-2xl border border-slate-200 p-8 sm:p-9 flex flex-col justify-between hover:border-blue-300 hover:shadow-md transition-all"
              >
                <div>
                  <div className="inline-block px-3.5 py-1.5 rounded-md text-xs font-mono font-bold tracking-wider uppercase bg-white border border-slate-200 text-slate-800 mb-5 shadow-2xs">
                    {proof.badge}
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-3 font-sans leading-snug">
                    {proof.title}
                  </h3>
                  <p className="text-base font-bold text-blue-700 mb-4 leading-snug">
                    &ldquo;{proof.claim}&rdquo;
                  </p>
                  <p className="text-base text-slate-700 leading-relaxed mb-8">
                    {proof.mechanism}
                  </p>
                </div>

                <Link
                  href={proof.href}
                  className="inline-flex items-center text-base font-bold text-blue-600 hover:text-blue-800 group pt-4 border-t border-slate-200"
                >
                  <span>{proof.action}</span>
                  <span className="ml-2 group-hover:translate-x-1.5 transition-transform text-lg">&rarr;</span>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Interactive Portals Bento ─────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-[#F8FAFC]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mb-14">
            <p className="text-xs font-mono font-bold uppercase tracking-widest text-blue-600 mb-2">
              Live Product Surfaces
            </p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900">
              Explore the Working Surfaces
            </h2>
            <p className="text-base sm:text-lg text-slate-600 mt-4 leading-relaxed">
              Every route connects to a live backend database and authentic telecom protocol handlers.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {PORTALS.map((portal) => (
              <Link
                key={portal.href}
                href={portal.href}
                className="group bg-white rounded-2xl border border-slate-200 p-8 flex flex-col justify-between hover:border-blue-400 hover:shadow-lg transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <span className="text-xs font-mono text-slate-500 uppercase tracking-wider font-bold">
                      {portal.category}
                    </span>
                    <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 text-slate-700 group-hover:bg-blue-50 group-hover:text-blue-700 transition-colors">
                      {portal.tag}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors mb-3 font-sans">
                    {portal.title}
                  </h3>
                  <p className="text-base text-slate-600 leading-relaxed mb-8">
                    {portal.description}
                  </p>
                </div>

                <div className="text-base font-bold text-blue-600 flex items-center gap-2 group-hover:translate-x-1.5 transition-transform pt-4 border-t border-slate-100">
                  <span>Open surface</span>
                  <span className="text-lg">&rarr;</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

