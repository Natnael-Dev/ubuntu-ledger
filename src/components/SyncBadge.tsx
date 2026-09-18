'use client';

// SyncBadge UI Component (T-29)
// Authoritative sources: docs/specs/08-ui-ux-design.md §8 (SyncBadge), docs/specs/11-tasks.md T-29

import React, { useEffect, useState } from 'react';
import type { OutboxSummary } from '@/lib/outbox/types';
import { getSyncEngine } from '@/lib/outbox/sync-engine';

interface SyncBadgeProps {
  className?: string;
  onSyncTrigger?: () => void;
}

export function SyncBadge({ className = '', onSyncTrigger }: SyncBadgeProps) {
  const [summary, setSummary] = useState<OutboxSummary>({
    total: 0,
    queued: 0,
    syncing: 0,
    synced: 0,
    failed: 0,
  });
  const [isOnline, setIsOnline] = useState<boolean>(true);

  useEffect(() => {
    const engine = getSyncEngine();
    setIsOnline(engine.isOnline());

    const unsubscribe = engine.subscribe((s) => {
      setSummary(s);
      setIsOnline(engine.isOnline());
    });

    const handleOnline = () => setIsOnline(engine.isOnline());
    const handleOffline = () => setIsOnline(false);

    const handleRefresh = async () => {
      const s = await engine.getSummary();
      setSummary(s);
      setIsOnline(engine.isOnline());
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('outbox-updated', handleRefresh);

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('outbox-updated', handleRefresh);
    };
  }, []);

  const handleClick = () => {
    const engine = getSyncEngine();
    if (summary.failed > 0) {
      void engine.retryFailed();
    } else {
      void engine.flush();
    }
    if (onSyncTrigger) onSyncTrigger();
  };

  // Determine visual state
  if (!isOnline) {
    return (
      <button
        type="button"
        data-testid="sync-badge"
        onClick={handleClick}
        aria-label={`Network offline. ${summary.queued > 0 ? `${summary.queued} queued.` : ''} Click to check sync status.`}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded border transition-colors cursor-pointer bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-800 ${className}`}
        title="Network offline. Click to check sync status."
      >
        <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" aria-hidden="true" />
        <span data-testid="sync-status">Offline</span>
        {summary.queued > 0 && (
          <span data-testid="sync-count" className="font-semibold">
            ({summary.queued} queued)
          </span>
        )}
      </button>
    );
  }

  if (summary.syncing > 0) {
    return (
      <div
        data-testid="sync-badge"
        role="status"
        aria-live="polite"
        aria-label={`Syncing ${summary.syncing} observations in flight.`}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded border bg-amber-50 text-amber-900 border-amber-300 animate-pulse ${className}`}
      >
        <span className="w-2 h-2 rounded-full bg-amber-600 animate-ping shrink-0" aria-hidden="true" />
        <span data-testid="sync-status">Syncing</span>
        <span data-testid="sync-count">({summary.syncing} in flight)...</span>
      </div>
    );
  }

  if (summary.failed > 0) {
    return (
      <button
        type="button"
        data-testid="sync-badge"
        onClick={handleClick}
        aria-label={`Sync error: ${summary.failed} observation(s) failed. Click to retry.`}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded border transition-colors cursor-pointer bg-red-50 text-red-900 border-red-300 hover:bg-red-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-red-800 ${className}`}
        title="Some observations failed to sync. Click to retry."
      >
        <span className="w-2 h-2 rounded-full bg-red-600 shrink-0" aria-hidden="true" />
        <span data-testid="sync-status">Sync error</span>
        <span data-testid="sync-count" className="font-semibold">
          ({summary.failed} failed)
        </span>
      </button>
    );
  }

  if (summary.queued > 0) {
    return (
      <button
        type="button"
        data-testid="sync-badge"
        onClick={handleClick}
        aria-label={`Online: ${summary.queued} pending observations queued. Click to sync now.`}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded border transition-colors cursor-pointer bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-800 ${className}`}
        title="Pending observations. Click to sync now."
      >
        <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" aria-hidden="true" />
        <span data-testid="sync-status">Online</span>
        <span data-testid="sync-count" className="font-semibold">
          ({summary.queued} queued)
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      data-testid="sync-badge"
      onClick={handleClick}
      aria-label="Online: all observations synced. Click to refresh."
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded border transition-colors cursor-pointer bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-800 ${className}`}
      title="All observations synced. Click to refresh."
    >
      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" aria-hidden="true" />
      <span data-testid="sync-status">Online</span>
      <span data-testid="sync-count">(All synced)</span>
    </button>
  );
}
