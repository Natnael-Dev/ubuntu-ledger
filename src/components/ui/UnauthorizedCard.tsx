import React from "react";
import Link from "next/link";

export interface UnauthorizedCardProps {
  title?: string;
  roleRequired?: string;
  currentRole?: string;
  detail?: string;
  returnHref?: string;
}

export function UnauthorizedCard({
  title = "403 E_FORBIDDEN_ROLE — Security Boundary",
  roleRequired = "ADMIN or MODERATOR",
  currentRole = "CITIZEN",
  detail = "The authenticated persona lacks cryptographic authorization to perform this administrative action.",
  returnHref = "/console",
}: UnauthorizedCardProps) {
  return (
    <div
      role="alert"
      className="border-2 border-[var(--ink)] bg-[var(--paper)] p-6 font-mono max-w-xl mx-auto shadow-sm"
    >
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-700 mb-2">
        <span className="w-2.5 h-2.5 bg-red-700 inline-block" />
        SECURITY PERIMETER REFUSAL
      </div>
      <h3 className="text-base font-bold text-[var(--ink)] mb-2">
        {title}
      </h3>
      <p className="text-xs text-[var(--ink-soft)] leading-relaxed mb-4">
        {detail}
      </p>

      <div className="bg-[var(--paper-warm)] border border-[var(--rule)] p-3 text-xs space-y-1 mb-4">
        <div className="flex justify-between">
          <span className="text-[var(--ink-soft)]">Current Actor Role:</span>
          <span className="font-semibold text-[var(--ink)]">{currentRole}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--ink-soft)]">Required Minimum Role:</span>
          <span className="font-semibold text-[var(--ink)]">{roleRequired}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--ink-soft)]">Boundary Type:</span>
          <span className="font-semibold text-[var(--ink)]">Actor Authorization Check</span>
        </div>
      </div>

      <div className="flex gap-3">
        <Link
          href={returnHref}
          className="px-4 py-2 text-xs font-semibold bg-[var(--ink)] text-[var(--paper)] hover:bg-[var(--ink)]/90"
        >
          Return to Console
        </Link>
        <Link
          href="/simulator"
          className="px-4 py-2 text-xs border border-[var(--rule)] bg-[var(--paper)] text-[var(--ink)] hover:bg-[var(--paper-warm)]"
        >
          Switch Persona in Simulator
        </Link>
      </div>
    </div>
  );
}
