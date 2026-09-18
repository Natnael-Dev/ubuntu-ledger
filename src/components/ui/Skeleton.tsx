import React from "react";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function Skeleton({ className = "", ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`bg-[var(--rule)]/60 animate-pulse rounded-none ${className}`}
      {...props}
    />
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="w-full border border-[var(--ink)] bg-[var(--paper)]" aria-busy="true" aria-live="polite">
      <div className="border-b border-[var(--ink)] px-4 py-2 bg-[var(--paper-warm)] flex items-center justify-between text-xs font-mono">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="divide-y divide-[var(--rule)]">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="p-3 grid grid-cols-8 gap-3 items-center">
            <Skeleton className="h-4 w-12 col-span-1" />
            <Skeleton className="h-4 w-40 col-span-2" />
            <Skeleton className="h-4 w-16 col-span-1" />
            <Skeleton className="h-4 w-16 col-span-1" />
            <Skeleton className="h-4 w-20 col-span-1" />
            <Skeleton className="h-4 w-16 col-span-1" />
            <Skeleton className="h-6 w-20 col-span-1 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReceiptSkeleton() {
  return (
    <div className="max-w-xl mx-auto border-2 border-[var(--ink)] bg-[var(--paper)] p-6 font-mono space-y-4 shadow-sm" aria-busy="true" aria-live="polite">
      <div className="flex justify-between items-center border-b border-[var(--rule)] pb-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-24" />
      </div>
      <Skeleton className="h-7 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <div className="border-t border-b border-dashed border-[var(--rule)] py-4 space-y-2">
        <div className="flex justify-between"><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-20" /></div>
        <div className="flex justify-between"><Skeleton className="h-4 w-28" /><Skeleton className="h-4 w-24" /></div>
        <div className="flex justify-between"><Skeleton className="h-4 w-32" /><Skeleton className="h-4 w-28" /></div>
      </div>
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

export function DivergenceSkeleton() {
  return (
    <div className="max-w-3xl mx-auto border border-[var(--ink)] bg-[var(--paper)] p-6 space-y-6" aria-busy="true" aria-live="polite">
      <div className="border-b border-[var(--rule)] pb-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 border border-[var(--rule)] space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-3 w-full" />
        </div>
        <div className="p-4 border border-[var(--rule)] space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-3 w-full" />
        </div>
      </div>
    </div>
  );
}
