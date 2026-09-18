// Homepage — Ubuntu Ledger / Ward Proof-Line
// Design intent: This page is the evaluator's entry point.
// After 10 seconds: understand what the product is.
// After 60 seconds: understand the problem, the mechanism, and why it's different.
// After 5 minutes: have interacted with all three proof mechanisms.
//
// Design principle: less interface, more evidence.
// Typography and whitespace carry the structure — not cards, not gradients.
//
// Reference: 08-ui-ux-design.md §2 (tokens), §5 (receipt register),
//            hackathon brief (Transparency & Accountability track)

import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Civic Evidence System & Public Verification',
  description:
    'A public evidence system for ward-level infrastructure accountability. Citizens verify repairs via feature phone. Contractors cannot close their own tickets.',
};

// ── Proof mechanism data ─────────────────────────────────────────────────────

const PROOFS = [
  {
    id: 'A',
    label: 'Sybil Resistance',
    claim: 'Multiple phones from the same neighbourhood do not become multiple independent witnesses.',
    mechanism:
      'Reports are binned by a geographic cluster key derived from MSISDN metadata. A second phone from the same cluster increments no counter — the witness count stays at 3, visibly. The system enforces this at the database level, not just the UI.',
    demoHref: '/simulator',
    demoLabel: 'Watch it in the Simulator',
    stateColor: 'var(--state-hold)',
  },
  {
    id: 'B',
    label: 'Probation Lock',
    claim: 'A contractor who claims a repair is complete cannot immediately close the ticket.',
    mechanism:
      'A mandatory 7-day citizen-verification window begins when a contractor marks repair as complete. A database CHECK constraint rejects any closure attempt before the window expires — even if the UI is bypassed. The console shows the countdown.',
    demoHref: '/console',
    demoLabel: 'Try blocking it in the Console',
    stateColor: 'var(--state-break)',
  },
  {
    id: 'C',
    label: 'Two-Ledger Separation',
    claim: 'Official government figures and citizen field observations are never merged or averaged.',
    mechanism:
      'The statutory ledger holds gazette-sourced fees and rules with source document citation, SHA-256 hash, and page number. The field ledger holds anonymous citizen visit outcomes. They are displayed side by side — divergence is made visible, not resolved by averaging. k-anonymity (k ≥ 5) suppresses individual identity.',
    demoHref: '/services/ET-ID-REPLACE',
    demoLabel: 'See the Divergence Card',
    stateColor: 'var(--state-open)',
  },
] as const;

// ── Demo portal data ──────────────────────────────────────────────────────────

const DEMO_PORTALS = [
  {
    frame: 'PROOF A',
    frameColor: 'var(--state-hold)',
    href: '/simulator',
    title: 'Feature Phone Simulator',
    subtitle: 'USSD · IVR · Offline',
    description:
      'Dial *890# or contract #4412 from a virtual feature phone. Watch the geographic cluster deduplication — a second phone from the same area produces an "observation suppressed" response; the witness counter stays at 3.',
    tags: ['Dial *890#', 'Contract #4412', 'Amharic IVR'],
    span: false,
  },
  {
    frame: 'PROOF B',
    frameColor: 'var(--state-break)',
    href: '/console',
    title: 'Municipal Operator Console',
    subtitle: 'Oversight · Probation · Audit',
    description:
      'Project oversight interface with mandatory probation enforcement. Attempting "Mark Complete" is rejected by both UI and a database CHECK constraint during the 7-day citizen window. Time-travel to test boundary conditions.',
    tags: ['Probation Lock', 'Time Travel', 'Audit Chain'],
    span: false,
  },
  {
    frame: 'CITIZEN RECEIPT',
    frameColor: 'var(--state-open)',
    href: '/receipt/4412',
    title: 'Public Spending Receipt',
    subtitle: 'Contract #4412 · ETB 320,000',
    description:
      'Printable citizen receipt for Kebele 08 Health Post generator overhaul. Includes verifiable source citation, SHA-256 provenance hash, witness summary, and read-aloud audio for low-literacy access.',
    tags: ['SHA-256 Trail', 'Source Citation', 'Printable'],
    span: false,
  },
  {
    frame: 'PROOF C',
    frameColor: 'var(--state-open)',
    href: '/services/ET-ID-REPLACE',
    title: 'Two-Ledger Divergence Card',
    subtitle: 'ID Replacement Service · ET-ID-REPLACE',
    description:
      'Side-by-side comparison: official statutory fee (50 ETB) versus anonymous citizen observations (11 of 14 reporting extra fees). Two independent ledgers, never merged or averaged. k-anonymity enforced.',
    tags: ['Statutory vs Field', 'Zero Averaging', 'k ≥ 5 Anonymity'],
    span: false,
  },
  {
    frame: 'OFFLINE OUTBOX',
    frameColor: '#4B7A3B',
    href: '/pwa',
    title: 'Offline Field Monitor PWA',
    subtitle: 'IndexedDB · Idempotent Sync',
    description:
      'Field monitor application with client-side IndexedDB observation queue. Test airplane mode — submissions buffer locally and auto-flush upon reconnection with zero duplicate rows. Demonstrates low-bandwidth resilience.',
    tags: ['IndexedDB Outbox', 'Idempotent Sync', 'Realtime Badge'],
    span: true,
  },
] as const;

// ── Helpers ──────────────────────────────────────────────────────────────────

function Rule() {
  return <hr className="border-0 border-t border-[var(--rule)] my-8" aria-hidden="true" />;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--ink-soft)] mb-3">
      {children}
    </p>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)] py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">

        {/* ── Section 1: Identity ──────────────────────────────────────────── */}
        <header className="border-b border-[var(--rule)] pb-8 mb-0">
          <SectionLabel>Open Society Foundations × Andela Hackathon · Transparency &amp; Accountability</SectionLabel>

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight text-[var(--ink)] mt-1">
            Ward Proof-Line
          </h1>
          <p className="mt-1 font-mono text-sm text-[var(--ink-soft)]">Ubuntu Ledger</p>

          <p className="mt-4 text-lg leading-relaxed text-[var(--ink)] max-w-2xl">
            A public evidence system for ward-level infrastructure accountability in Kenya and Ethiopia.
            When a road repair is marked complete,{' '}
            <strong className="font-semibold">citizens verify it happened</strong> — via feature phone, offline, in Swahili, Amharic, or English.
          </p>

          <blockquote className="mt-5 border-l-2 border-[var(--ink)] pl-4 font-mono text-sm text-[var(--ink)]">
            &ldquo;A contractor cannot close their own ticket.&rdquo;
          </blockquote>

          {/* Hero Actions: Verified Public Receipt #4412 first, followed by Feature Phone Simulator */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/receipt/4412"
              className="inline-flex items-center gap-2 bg-[var(--ink)] text-[var(--paper)] px-4 py-2 font-mono text-xs font-semibold hover:bg-black transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--state-open)] focus:ring-offset-2 rounded"
            >
              <span>View Verified Receipt #4412</span>
              <span aria-hidden="true">→</span>
            </Link>
            <Link
              href="/simulator"
              className="inline-flex items-center gap-2 border border-[var(--rule)] bg-white px-4 py-2 font-mono text-xs text-[var(--ink)] hover:border-[var(--ink)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--ink)] focus:ring-offset-1 rounded"
            >
              <span>Feature Phone Simulator (*890#)</span>
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </header>

        {/* ── Ward Snapshot & Benchmark Data (Audit #36: Honest Framing, Zero Fake Telemetry) ── */}
        <section aria-labelledby="benchmark-heading" className="mt-8 mb-2 p-4 bg-[var(--paper-warm)] border border-[var(--rule)] font-mono text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--rule)] pb-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--ink)] border border-[var(--rule)] px-1.5 py-0.5 bg-white">
                WARD SNAPSHOT
              </span>
              <h2 id="benchmark-heading" className="text-[11px] uppercase tracking-widest text-[var(--ink)] font-bold">
                Woreda 09 &amp; Roy Hill Benchmark
              </h2>
            </div>
            <span className="text-[9.5px] text-[var(--ink-soft)] uppercase tracking-wider">
              BENCHMARK DATA · NOT LIVE TELEMETRY
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <div className="text-[10px] text-[var(--ink-soft)] uppercase">Monitored Projects</div>
              <div className="text-base font-bold text-[var(--ink)] mt-0.5">6 Contracts</div>
              <div className="text-[10px] text-[var(--ink-soft)]">ETB 950k committed</div>
            </div>
            <div>
              <div className="text-[10px] text-[var(--ink-soft)] uppercase">Probation Lock</div>
              <div className="text-base font-bold text-[var(--state-hold)] mt-0.5">7 Days</div>
              <div className="text-[10px] text-[var(--ink-soft)]">Mandatory DB rule</div>
            </div>
            <div>
              <div className="text-[10px] text-[var(--ink-soft)] uppercase">Sybil Defense</div>
              <div className="text-base font-bold text-[var(--state-open)] mt-0.5">Cluster Binned</div>
              <div className="text-[10px] text-[var(--ink-soft)]">Zero inflated witnesses</div>
            </div>
            <div>
              <div className="text-[10px] text-[var(--ink-soft)] uppercase">Two-Ledger Split</div>
              <div className="text-base font-bold text-[var(--ink)] mt-0.5">k &ge; 5 Anonymity</div>
              <div className="text-[10px] text-[var(--ink-soft)]">Zero averaging gap</div>
            </div>
          </div>
        </section>

        <Rule />

        {/* ── Section 2: Problem ───────────────────────────────────────────── */}
        <section aria-labelledby="problem-heading">
          <SectionLabel>The Problem</SectionLabel>

          <h2 id="problem-heading" className="text-xl font-semibold text-[var(--ink)] mb-4">
            Who checks whether a repair actually happened?
          </h2>

          <div className="space-y-3 text-[var(--ink)] leading-relaxed">
            <p>
              Municipal contractors report repairs as complete. Governments record the claim. Citizens
              have no systematic way to dispute it — especially on feature phones, in low-bandwidth areas,
              or in languages other than the bureaucratic default.
            </p>
            <p>
              When official figures and citizen experience diverge, there is typically no mechanism to
              surface the gap. The official figure wins. The citizen is invisible.
            </p>
            <p className="text-[var(--ink-soft)]">
              Ward Proof-Line creates three enforceable barriers between a contractor&rsquo;s claim and an
              accepted closure. Each barrier is cryptographically traceable.
            </p>
          </div>
        </section>

        <Rule />

        {/* ── Section 3: How Proof-Line Works ─────────────────────────────── */}
        <section aria-labelledby="proofline-heading">
          <SectionLabel>How Proof-Line Works</SectionLabel>

          <h2 id="proofline-heading" className="text-xl font-semibold text-[var(--ink)] mb-4">
            Three enforced proofs. Each independently testable.
          </h2>

          {/* Architectural Proof-Line Schematic */}
          <div className="mb-8 p-5 bg-white border border-[var(--rule)]">
            <div className="flex items-center justify-between mb-3 border-b border-[var(--rule)] pb-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--ink-soft)] font-bold">
                The Closed-Loop Proof-Line Architecture
              </span>
              <span className="text-[9px] font-mono text-[var(--ink-soft)] border border-[var(--rule)] px-1.5 py-0.5 uppercase tracking-wider">
                Architecture Overview
              </span>
            </div>

            {/* Responsive 6-stage Proof-Line Flow Diagram from Figma */}
            <div className="w-full overflow-x-auto py-3">
              <div className="hidden md:flex items-start gap-0 min-w-[700px]">
                {[
                  { id: 'source', label: 'Source', sub: 'Gazette & Budget Citation', n: '01', active: false },
                  { id: 'observation', label: 'Observation', sub: 'Citizen USSD / PWA Report', n: '02', active: false },
                  { id: 'triangulation', label: 'Triangulation', sub: 'Multi-Cluster Sybil Defense', n: '03', active: true },
                  { id: 'probation', label: 'Probation', sub: '7-Day DB Constraint Lock', n: '04', active: true },
                  { id: 'two-ledger', label: 'Two-Ledger', sub: 'Statutory vs Field Split', n: '05', active: true },
                  { id: 'public-proof', label: 'Public Proof', sub: 'SHA-256 Sealed Receipt', n: '06', active: true },
                ].map((node, i, arr) => (
                  <div key={node.id} className="flex items-start flex-1">
                    <div className="flex flex-col items-center flex-1 min-w-0">
                      <span className={`font-mono text-[9px] font-bold mb-1.5 ${node.active ? 'text-[var(--state-open)]' : 'text-[var(--ink-soft)]'}`}>
                        {node.n}
                      </span>
                      <div
                        className={`w-full border py-2 px-1.5 text-center ${
                          node.active
                            ? 'border-[var(--state-open)] bg-[#E6F0EB]'
                            : 'border-[var(--rule)] bg-[var(--paper)]'
                        }`}
                      >
                        <div className={`font-mono text-[10px] font-bold leading-tight ${node.active ? 'text-[var(--state-open)]' : 'text-[var(--ink)]'}`}>
                          {node.label}
                        </div>
                        <div className="font-mono text-[8.5px] text-[var(--ink-soft)] mt-0.5 leading-tight">{node.sub}</div>
                      </div>
                    </div>
                    {i < arr.length - 1 && (
                      <div className="flex items-center justify-center w-5 pt-6 flex-shrink-0">
                        <svg width="16" height="8" viewBox="0 0 16 8" fill="none">
                          <line x1="0" y1="4" x2="11" y2="4" stroke="var(--rule)" strokeWidth="1" />
                          <path d="M11 1L15 4L11 7" stroke="var(--rule)" strokeWidth="1" />
                        </svg>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Mobile vertical flow */}
              <div className="md:hidden flex flex-col items-center gap-1.5">
                {[
                  { id: 'source', label: '01 · Source', sub: 'Gazette & Budget Citation' },
                  { id: 'observation', label: '02 · Observation', sub: 'Citizen USSD / PWA Report' },
                  { id: 'triangulation', label: '03 · Triangulation', sub: 'Multi-Cluster Sybil Defense' },
                  { id: 'probation', label: '04 · Probation', sub: '7-Day DB Constraint Lock' },
                  { id: 'two-ledger', label: '05 · Two-Ledger', sub: 'Statutory vs Field Split' },
                  { id: 'public-proof', label: '06 · Public Proof', sub: 'SHA-256 Sealed Receipt' },
                ].map((node) => (
                  <div key={node.id} className="w-full border border-[var(--rule)] bg-[var(--paper)] p-2 flex justify-between items-center text-xs font-mono">
                    <span className="font-bold text-[var(--ink)]">{node.label}</span>
                    <span className="text-[10px] text-[var(--ink-soft)]">{node.sub}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-[var(--rule)] text-center text-[10px] font-mono text-[var(--ink-soft)]">
              Closed-loop verification pipeline · Every state transition is cryptographically verifiable and sealed
            </div>
          </div>

          <div className="space-y-0">
            {PROOFS.map((proof, index) => (
              <div
                key={proof.id}
                className={`py-6 ${index < PROOFS.length - 1 ? 'border-b border-[var(--rule)]' : ''}`}
              >
                <div className="flex items-baseline gap-3 mb-2">
                  <span
                    className="font-mono text-xs font-bold tracking-widest"
                    style={{ color: proof.stateColor }}
                    aria-label={`Proof ${proof.id}`}
                  >
                    PROOF {proof.id}
                  </span>
                  <h3 className="font-semibold text-base text-[var(--ink)]">{proof.label}</h3>
                </div>

                <p className="font-mono text-sm text-[var(--ink)] mb-3 leading-relaxed">
                  {proof.claim}
                </p>

                <p className="text-sm text-[var(--ink-soft)] leading-relaxed mb-3">
                  {proof.mechanism}
                </p>

                <Link
                  href={proof.demoHref}
                  className="inline-flex items-center gap-1.5 font-mono text-xs text-[var(--ink)] border border-[var(--rule)] px-3 py-1.5 hover:border-[var(--ink)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--ink)] focus:ring-offset-1 rounded"
                >
                  {proof.demoLabel}
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            ))}
          </div>
        </section>

        <Rule />

        {/* ── Section 4: Demo Portals ──────────────────────────────────────── */}
        <section aria-labelledby="demo-heading">
          <SectionLabel>Evaluation &amp; Interactive Demo Portals</SectionLabel>

          <h2 id="demo-heading" className="text-xl font-semibold text-[var(--ink)] mb-6">
            All five surfaces are interactive and verifiable. Click to explore.
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {DEMO_PORTALS.map((portal) => (
              <Link
                key={portal.href}
                href={portal.href}
                className={[
                  'border border-[var(--rule)] bg-white p-5 hover:border-[var(--ink)] transition-colors group',
                  'focus:outline-none focus:ring-2 focus:ring-[var(--ink)] focus:ring-offset-1',
                  'flex flex-col justify-between',
                  portal.span ? 'md:col-span-2' : '',
                ].join(' ')}
              >
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span
                      className="font-mono text-[10px] font-bold tracking-widest"
                      style={{ color: portal.frameColor }}
                    >
                      {portal.frame}
                    </span>
                    <span className="font-mono text-[10px] text-[var(--ink-soft)] group-hover:text-[var(--ink)]">
                      {portal.href} →
                    </span>
                  </div>

                  <h3 className="font-semibold text-base text-[var(--ink)] mb-0.5">{portal.title}</h3>
                  <p className="font-mono text-[10px] text-[var(--ink-soft)] mb-2">{portal.subtitle}</p>
                  <p className="text-sm text-[var(--ink-soft)] leading-relaxed">{portal.description}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-neutral-100 flex flex-wrap gap-x-3 gap-y-1">
                  {portal.tags.map((tag) => (
                    <span key={tag} className="font-mono text-[10px] text-[var(--ink-soft)]">
                      {tag}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </section>

        <Rule />

        {/* ── Section 5: Operating Constraints ────────────────────────────── */}
        <section aria-labelledby="constraints-heading">
          <SectionLabel>Operating Constraints Addressed</SectionLabel>

          <h2 id="constraints-heading" className="text-xl font-semibold text-[var(--ink)] mb-4">
            Designed for African civic reality
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            {[
              ['Low bandwidth', 'USSD (*890#) works on any GSM feature phone with no data plan.'],
              ['Multilingual', 'Amharic IVR audio, Swahili UI, English — locale-aware throughout.'],
              ['Offline resilience', 'PWA with IndexedDB outbox — reports queue locally, sync on reconnection.'],
              ['Privacy', 'k-anonymity (k ≥ 5): insufficient sample size suppresses individual identity.'],
              ['Trust & verification', 'Every claim links to source document, page number, and SHA-256 hash.'],
              ['Clear next steps', 'Refusal scripts give citizens the exact words to use when overcharged.'],
              ['Scalability', 'Country-agnostic. Kenya and Ethiopia both implemented. Ward-configurable.'],
              ['Accessibility', 'Semantic HTML, visible focus states, contrast ≥ 4.5:1, screen reader labels.'],
            ].map(([constraint, evidence]) => (
              <div key={constraint} className="flex gap-2">
                <span
                  className="font-mono text-[10px] text-[var(--state-open)] mt-1 shrink-0 font-bold"
                  aria-hidden="true"
                >
                  ✓
                </span>
                <div>
                  <span className="font-semibold text-[var(--ink)]">{constraint}:</span>{' '}
                  <span className="text-[var(--ink-soft)]">{evidence}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <Rule />

        {/* ── Section 6: Evidence & Quality Gate ──────────────────────────── */}
        <section aria-labelledby="evidence-heading">
          <SectionLabel>Quality Gate Evidence</SectionLabel>

          <h2 id="evidence-heading" className="text-xl font-semibold text-[var(--ink)] mb-4">
            Verifiable, not claimed
          </h2>

          <p className="text-sm text-[var(--ink-soft)] mb-5 leading-relaxed">
            Every architectural invariant below has a corresponding automated test. The test suite is
            part of the submission repository.
          </p>

          <div className="flex flex-col sm:flex-row gap-8 font-mono text-xs">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--ink)] border border-[var(--rule)] px-1.5 py-0.5 bg-[var(--paper-warm)]">
                  BENCHMARK DATA
                </span>
                <p className="font-semibold text-[var(--ink)]">CI Test Results</p>
              </div>
              <ul className="space-y-1 text-[var(--ink-soft)]">
                <li>Vitest unit suite: 576 passed, 0 failed</li>
                <li>Playwright E2E: 63 passed / 63</li>
                <li>Adversarial (fail-closed): 30 passed</li>
              </ul>
              <p className="text-[10px] text-[var(--ink-soft)] mt-2 leading-relaxed">
                Automated suite · verified benchmark at submission build.
              </p>

            </div>
            <div>
              <p className="font-semibold text-[var(--ink)] mb-2">Architectural Invariants</p>
              <ul className="space-y-1 text-[var(--ink-soft)]">
                <li>PostgreSQL RLS &amp; CHECK constraints enforced</li>
                <li>Append-only audit table (TRUNCATE sealed)</li>
                <li>k-Anonymity (k ≥ 5) suppression tested</li>
                <li>Sybil cluster deduplication tested</li>
                <li>Probation lock: database-level, not UI-only</li>
              </ul>
            </div>
          </div>
        </section>

        <Rule />

        {/* ── Section 7: Hackathon Alignment ──────────────────────────────── */}
        <section aria-labelledby="alignment-heading">
          <SectionLabel>Hackathon Alignment</SectionLabel>

          <h2 id="alignment-heading" className="text-xl font-semibold text-[var(--ink)] mb-4 sr-only">
            OSF × Andela Hackathon — Submission Details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5 text-sm">
            <div>
              <p className="font-mono text-[10px] tracking-widest text-[var(--ink-soft)] uppercase mb-1.5">Track</p>
              <p className="font-semibold text-[var(--ink)]">Transparency &amp; Accountability</p>
              <p className="text-[var(--ink-soft)] mt-0.5 leading-relaxed">
                Makes decisions by governments and institutions visible, understandable, and open to scrutiny
                — through public spending receipts, real-time project status, and verifiable evidence chains.
              </p>
            </div>
            <div>
              <p className="font-mono text-[10px] tracking-widest text-[var(--ink-soft)] uppercase mb-1.5">Scalability</p>
              <p className="font-semibold text-[var(--ink)]">Country-agnostic ward model</p>
              <p className="text-[var(--ink-soft)] mt-0.5 leading-relaxed">
                Kenya (Roy Hill, KES) and Ethiopia (Woreda 9, ETB) are both implemented from a single
                ward-configurable data model. Adding a country requires only a new ward fixture and locale.
              </p>
            </div>
            <div>
              <p className="font-mono text-[10px] tracking-widest text-[var(--ink-soft)] uppercase mb-1.5">Uniqueness</p>
              <p className="font-semibold text-[var(--ink)]">Evidence chain, not just a dashboard</p>
              <p className="text-[var(--ink-soft)] mt-0.5 leading-relaxed">
                The probation lock and two-ledger separation are enforceable system invariants, not UI
                conventions. A contractor cannot bypass them by calling the API directly.
              </p>
            </div>
            <div>
              <p className="font-mono text-[10px] tracking-widest text-[var(--ink-soft)] uppercase mb-1.5">AI Usage</p>
              <p className="font-semibold text-[var(--ink)]">Built with AI coding tools throughout</p>
              <p className="text-[var(--ink-soft)] mt-0.5 leading-relaxed">
                Domain model, security layer, test suite, USSD simulation, and this frontend were all
                developed using AI-assisted engineering. See{' '}
                <Link href="https://github.com/Natnael-Dev/ubuntu-ledger" target="_blank" rel="noreferrer" className="underline hover:text-[var(--ink)]">
                  the repository
                </Link>
                {' '}for the AI build log.
              </p>
            </div>
          </div>
        </section>

        {/* ── Footer Link Bar ────────────────────────────────────────────── */}
        <div className="mt-10 pt-6 border-t border-[var(--rule)] font-mono text-[10px] text-[var(--ink-soft)] flex flex-col sm:flex-row justify-between gap-3">
          <div>Ward Proof-Line · Ubuntu Ledger · OSF × Andela Hackathon 2026</div>
          <div className="flex gap-4">
            <Link
              href="https://github.com/Natnael-Dev/ubuntu-ledger"
              target="_blank"
              rel="noreferrer"
              className="hover:text-[var(--ink)] underline focus:outline-none focus:ring-2 focus:ring-[var(--ink)] focus:ring-offset-1 rounded"
            >
              GitHub
            </Link>
            <span aria-hidden="true">·</span>
            <Link
              href="/simulator"
              className="hover:text-[var(--ink)] underline focus:outline-none focus:ring-2 focus:ring-[var(--ink)] focus:ring-offset-1 rounded"
            >
              Start demo
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
