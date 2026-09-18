// Operator Console — Project Board Server Page
// Authoritative sources:
// - docs/specs/08-ui-ux-design.md §7 (Four screens only, deliberately plain, system-default-feeling)
// - docs/specs/11-tasks.md T-22
// - docs/specs/15-deployment-and-run.md §2 (http://localhost:3000/console)

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
        {/* Top Operational Bar (Plain System Style per 08 §7) */}
        <header className="border border-[var(--rule)] bg-white p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--rule)] pb-3">
            <div>
              <div className="text-[10px] font-mono tracking-widest text-[var(--ink-soft)] uppercase">
                Ward Proof-Line // Municipal Operator Interface
              </div>
              <h1 className="text-base sm:text-lg font-mono font-bold tracking-tight text-[var(--ink)] mt-0.5">
                CONSOLE: {ward.name.toUpperCase()} ({ward.code})
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
              <div className="flex items-center gap-1.5 border border-[var(--rule)] px-2 py-1 bg-neutral-50">
                <span className="font-semibold text-[var(--ink)]">Role: ADMIN</span>
              </div>
              <div className="flex items-center gap-1.5 border border-emerald-300 px-2 py-1 bg-emerald-50 text-emerald-900">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                <span>Audit Chain: Genesis-linked</span>
              </div>
              <Link
                href="/simulator"
                className="px-2 py-1 border border-[var(--rule)] bg-white hover:bg-neutral-50 text-[var(--ink)] transition-colors inline-flex items-center gap-1"
                target="_blank"
              >
                <span>Simulator</span>
                <span className="text-[10px]">↗</span>
              </Link>
            </div>
          </div>

          {/* Console Section Header */}
          <div className="flex items-center gap-2 border-b border-[var(--rule)] px-4 py-2">
            <span className="font-mono text-xs font-semibold text-[var(--ink)] bg-[var(--ink)] text-[var(--paper)] px-3 py-1.5">
              Project Board
            </span>
            <span className="font-mono text-[10px] text-[var(--ink-soft)] uppercase">
              {ward.name} · {projectItems.length} Projects
            </span>
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
