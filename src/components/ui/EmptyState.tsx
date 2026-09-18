import React from "react";
import Link from "next/link";

export interface EmptyStateProps {
  title: string;
  description: string;
  query?: string;
  filterLabel?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
  secondaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  badge?: string;
  className?: string;
}

export function EmptyState({
  title,
  description,
  query,
  filterLabel,
  actionLabel,
  onAction,
  actionHref,
  secondaryAction,
  badge = "EMPTY_SET",
  className = "",
}: EmptyStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`border border-dashed border-[var(--rule)] bg-[var(--paper-warm)]/50 p-8 text-center font-mono ${className}`}
    >
      <div className="inline-block px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider border border-[var(--ink-soft)]/30 text-[var(--ink-soft)] mb-3">
        {badge}
      </div>
      <h3 className="text-sm font-semibold text-[var(--ink)] mb-1">
        {title}
      </h3>
      <p className="text-xs text-[var(--ink-soft)] max-w-md mx-auto mb-4 leading-relaxed">
        {description}
      </p>

      {(query || filterLabel) && (
        <div className="mb-4 text-xs inline-flex flex-wrap items-center justify-center gap-2 bg-[var(--paper)] border border-[var(--rule)] px-3 py-1.5 text-[var(--ink)]">
          {filterLabel && (
            <span>
              Filter: <strong className="font-semibold">{filterLabel}</strong>
            </span>
          )}
          {query && (
            <span>
              Query: <strong className="font-semibold font-mono">"{query}"</strong>
            </span>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3">
        {actionLabel && (
          actionHref ? (
            <Link
              href={actionHref}
              className="px-3 py-1.5 text-xs font-semibold bg-[var(--ink)] text-[var(--paper)] hover:bg-[var(--ink)]/90 transition-colors"
            >
              {actionLabel}
            </Link>
          ) : (
            <button
              type="button"
              onClick={onAction}
              className="px-3 py-1.5 text-xs font-semibold bg-[var(--ink)] text-[var(--paper)] hover:bg-[var(--ink)]/90 transition-colors cursor-pointer"
            >
              {actionLabel}
            </button>
          )
        )}

        {secondaryAction && (
          secondaryAction.href ? (
            <Link
              href={secondaryAction.href}
              className="px-3 py-1.5 text-xs border border-[var(--rule)] bg-[var(--paper)] text-[var(--ink)] hover:bg-[var(--paper-warm)] transition-colors"
            >
              {secondaryAction.label}
            </Link>
          ) : (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className="px-3 py-1.5 text-xs border border-[var(--rule)] bg-[var(--paper)] text-[var(--ink)] hover:bg-[var(--paper-warm)] transition-colors cursor-pointer"
            >
              {secondaryAction.label}
            </button>
          )
        )}
      </div>
    </div>
  );
}
