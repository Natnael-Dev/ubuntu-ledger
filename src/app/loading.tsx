import React from "react";
import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="min-h-[60vh] flex flex-col items-center justify-center p-6"
    >
      <div className="w-full max-w-lg border border-[var(--ink)] bg-[var(--paper)] p-6 space-y-4 font-mono text-xs">
        <div className="flex items-center justify-between border-b border-[var(--rule)] pb-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--state-open)] animate-ping" />
            <span className="font-semibold text-[var(--ink)]">Streaming Ledger View...</span>
          </div>
          <span className="text-[var(--ink-soft)] text-[10px]">SYNCING_PROOF</span>
        </div>
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <div className="space-y-2 pt-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </div>
  );
}
