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
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)] font-sans antialiased p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Top Operational Bar (Modern Civic Header) */}
        <header className="border border-slate-200/80 bg-white rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div className="text-[10px] font-mono tracking-widest text-slate-500 uppercase font-semibold">
                Ward Proof-Line // Municipal Operator Interface
              </div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 mt-1">
                CONSOLE: {ward.name.toUpperCase()} ({ward.code})
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono">
              <div className="flex items-center gap-1.5 border border-slate-200 px-2.5 py-1 bg-slate-50 rounded-lg text-slate-700">
                <span className="font-semibold">Role: ADMIN</span>
              </div>
              <div className="flex items-center gap-1.5 border border-emerald-200 px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-lg font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                <span>Audit Chain: Genesis-linked</span>
              </div>
              <Link
                href="/simulator"
                className="px-2.5 py-1 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg transition-colors inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                target="_blank"
              >
                <span>Simulator</span>
                <span className="text-[10px]">↗</span>
              </Link>
            </div>
          </div>

          {/* Console Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-2.5 bg-slate-50/70 rounded-xl border border-slate-100">
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-xs font-bold text-white bg-blue-600 px-3 py-1 rounded-md">
                Project Board
              </span>
              <span className="text-xs text-slate-600 font-medium">
                {ward.name} · {projectItems.length} Municipal Projects
              </span>
            </div>
            <div className="text-[11px] font-mono text-slate-600 flex items-center gap-1.5">
              <span className="border border-amber-300 bg-amber-50 text-amber-900 px-2 py-0.5 rounded text-[10px] font-semibold uppercase">
                Stat: Locked Funds
              </span>
              <span className="text-[11px] text-slate-500 hidden sm:inline">
                Funds committed / held in escrow / non-disbursable pending community verification
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
