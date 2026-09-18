import React from "react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="max-w-xl w-full">
        <EmptyState
          badge="HTTP 404 // NOT_FOUND"
          title="Civic Record or Route Not Found"
          description="The requested URI or evidence identifier does not match any registered project, statutory gazette entry, or operator route in this ledger node."
          actionLabel="Return to Public Explorer"
          actionHref="/"
          secondaryAction={{
            label: "Open Feature-Phone Simulator",
            href: "/simulator",
          }}
        />

        <div className="mt-6 border border-[var(--rule)] bg-[var(--paper)] p-4 font-mono text-xs">
          <div className="text-[var(--ink-soft)] uppercase text-[10px] tracking-wider mb-2 font-semibold">
            Registered Verification Deep-Links:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Link
              href="/receipt/4412"
              className="p-2 border border-[var(--rule)] hover:border-[var(--ink)] bg-[var(--paper-warm)] text-[var(--ink)] flex items-center justify-between"
            >
              <span>Receipt #4412</span>
              <span className="text-[10px] text-[var(--ink-soft)]">Health Post Overhaul</span>
            </Link>
            <Link
              href="/services/ET-ID-REPLACE"
              className="p-2 border border-[var(--rule)] hover:border-[var(--ink)] bg-[var(--paper-warm)] text-[var(--ink)] flex items-center justify-between"
            >
              <span>Gazette ET-ID-REPLACE</span>
              <span className="text-[10px] text-[var(--ink-soft)]">ID Card Replacement</span>
            </Link>
            <Link
              href="/console"
              className="p-2 border border-[var(--rule)] hover:border-[var(--ink)] bg-[var(--paper-warm)] text-[var(--ink)] flex items-center justify-between"
            >
              <span>Municipal Console</span>
              <span className="text-[10px] text-[var(--ink-soft)]">Operator View</span>
            </Link>
            <Link
              href="/pwa"
              className="p-2 border border-[var(--rule)] hover:border-[var(--ink)] bg-[var(--paper-warm)] text-[var(--ink)] flex items-center justify-between"
            >
              <span>Field Monitor Outbox</span>
              <span className="text-[10px] text-[var(--ink-soft)]">Offline Sync</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
