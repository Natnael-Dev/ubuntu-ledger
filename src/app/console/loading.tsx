import React from "react";
import { TableSkeleton } from "@/components/ui/Skeleton";

export default function ConsoleLoading() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="border-b border-[var(--ink)] pb-4">
        <h1 className="text-xl font-bold font-mono tracking-tight text-[var(--ink)]">
          Ward Proof-Line // Municipal Operator Interface
        </h1>
        <p className="text-xs text-[var(--ink-soft)] font-mono mt-1">
          Loading active project probation ledger and community witness consensus...
        </p>
      </div>
      <TableSkeleton rows={6} />
    </div>
  );
}
