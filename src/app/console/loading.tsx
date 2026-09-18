import React from "react";
import { TableSkeleton } from "@/components/ui/Skeleton";

export default function ConsoleLoading() {
  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)] font-sans antialiased p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="border border-[var(--rule)] bg-white p-4 space-y-3">
          <div className="border-b border-[var(--rule)] pb-3">
            <div className="text-[10px] font-mono tracking-widest text-[var(--ink-soft)] uppercase">
              Ward Proof-Line // Municipal Operator Interface
            </div>
            <h1 className="text-base sm:text-lg font-mono font-bold tracking-tight text-[var(--ink)] mt-0.5">
              CONSOLE: Loading Ledger Node...
            </h1>
            <p className="text-xs text-[var(--ink-soft)] font-mono mt-1">
              Loading active project probation ledger and community witness consensus...
            </p>
          </div>
        </header>
        <TableSkeleton rows={6} />
      </div>
    </div>
  );
}
