// Operator Console — Project Board Server Page
// Authoritative sources:
// - docs/specs/08-ui-ux-design.md §7 (Four screens only, deliberately plain, system-default-feeling)
// - docs/specs/11-tasks.md T-22
// - docs/specs/15-deployment-and-run.md §2 (http://localhost:3000/console)

import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  DEMO_PROJECTS,
  DEMO_INSPECTION_TASKS,
  DEMO_REPAIR_TICKETS,
  DEMO_WARDS,
  DEMO_TIMELINE,
} from '@/fixtures/demo-scenario';
import { ProjectBoard, type ProjectBoardItem } from './ProjectBoard';

export const metadata: Metadata = {
  title: 'Municipal Operator Console',
  description: 'Municipal operator console for witness triangulation and repair probation',
  robots: {
    index: false,
    follow: false,
  },
};

export default function ConsolePage() {
  const ward = DEMO_WARDS[0]; // Woreda 9 (ET-AA-W09)

  // Assemble project board items server-side from canonical fixtures
  const projectItems: ProjectBoardItem[] = DEMO_PROJECTS.map((proj) => {
    const task = DEMO_INSPECTION_TASKS.find((t) => t.projectId === proj.id);
    const ticket = DEMO_REPAIR_TICKETS.find((tk) => tk.projectId === proj.id);

    return {
      id: proj.id,
      projectCode: proj.projectCode,
      title: proj.title,
      officialTitle: proj.officialTitle,
      contractorName: proj.contractorName,
      amountMinor: proj.amountMinor,
      currency: proj.currency,
      fiscal: proj.fiscal,
      audit: proj.audit,
      witnessCount: task ? task.witnessCount : 0,
      witnessTarget: task ? task.witnessTarget : 3,
      ticketId: ticket ? ticket.id : null,
      probationState: ticket ? ticket.state : null,
      claimedBy: ticket ? ticket.claimedBy : null,
      probationEndsAt: ticket ? ticket.probationEndsAt : null,
      probationDays: ticket ? ticket.probationDays : 7,
      failureReasonKey: ticket ? ticket.failureReasonKey : null,
    };
  });

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)] font-sans antialiased">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-12 py-8 space-y-8">
        {/* Top Operational Bar (Deliberate Charcoal Operator Header - Agent 7) */}
        <header className="border border-slate-800 bg-[#0B0F17] text-white rounded-2xl p-6 sm:p-8 shadow-lg space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
            <div>
              <div className="text-xs font-mono tracking-widest text-emerald-400 uppercase font-bold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Ward Proof-Line // Municipal Operator Interface</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mt-1.5 font-sans">
                CONSOLE: {ward.name.toUpperCase()} ({ward.code})
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
              <div className="flex items-center gap-2 border border-slate-700 px-3 py-1.5 bg-[#131924] rounded-xl text-slate-200">
                <span className="font-bold text-amber-400">Role: ADMIN</span>
              </div>
              <div className="flex items-center gap-2 border border-emerald-900/60 px-3 py-1.5 bg-emerald-950/40 text-emerald-300 rounded-xl font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Audit Chain: Genesis-linked</span>
              </div>
              <Link
                href="/simulator"
                className="px-3 py-1.5 border border-slate-700 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-colors inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                target="_blank"
              >
                <span>Simulator</span>
                <span className="text-xs">↗</span>
              </Link>
            </div>
          </div>

          {/* Console Section Header Sub-bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 bg-[#131924] rounded-xl border border-slate-800/80">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs font-bold text-white bg-blue-600 px-3 py-1 rounded-lg shadow-xs">
                Project Board
              </span>
              <span className="text-xs text-slate-300 font-medium">
                {ward.name} · {projectItems.length} Municipal Projects Under Oversight
              </span>
            </div>
            <div className="text-xs font-mono text-slate-300 flex items-center gap-2">
              <span className="border border-amber-500/50 bg-amber-950/40 text-amber-300 px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase">
                Statutory Hold: Locked Funds
              </span>
              <span className="text-xs text-slate-400 hidden lg:inline">
                Funds held in escrow pending community quorum
              </span>
            </div>
          </div>
        </header>

        {/* Primary Project Board */}
        <section className="bg-transparent">
          <ProjectBoard
            initialProjects={projectItems}
            wardName={ward.name}
            wardCode={ward.code}
            currentAsOfIso={DEMO_TIMELINE.DEMO_ANCHOR_TIME}
          />
        </section>
      </div>
    </div>
  );
}
