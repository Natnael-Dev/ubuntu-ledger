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

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
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
      <div
        data-testid="sync-badge"
        onClick={handleClick}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded border transition-colors cursor-pointer bg-amber-50 text-amber-900 border-amber-300 ${className}`}
        title="Network offline. Click to check sync status."
      >
        <span className="w-2 h-2 rounded-full bg-amber-500" />
        <span data-testid="sync-status">Offline</span>
        {summary.queued > 0 && (
          <span data-testid="sync-count" className="font-semibold">
            ({summary.queued} queued)
          </span>
        )}
      </div>
    );
  }

  if (summary.syncing > 0) {
    return (
      <div
        data-testid="sync-badge"
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded border bg-amber-50 text-amber-900 border-amber-300 animate-pulse ${className}`}
      >
        <span className="w-2 h-2 rounded-full bg-amber-600 animate-ping" />
        <span data-testid="sync-status">Syncing</span>
        <span data-testid="sync-count">({summary.syncing} in flight)...</span>
      </div>
    );
  }

  if (summary.failed > 0) {
    return (
      <div
        data-testid="sync-badge"
        onClick={handleClick}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded border transition-colors cursor-pointer bg-red-50 text-red-900 border-red-300 hover:bg-red-100 ${className}`}
        title="Some observations failed to sync. Click to retry."
      >
        <span className="w-2 h-2 rounded-full bg-red-600" />
        <span data-testid="sync-status">Sync error</span>
        <span data-testid="sync-count" className="font-semibold">
          ({summary.failed} failed)
        </span>
      </div>
    );
  }

  if (summary.queued > 0) {
    return (
      <div
        data-testid="sync-badge"
        onClick={handleClick}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded border transition-colors cursor-pointer bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 ${className}`}
        title="Pending observations. Click to sync now."
      >
        <span className="w-2 h-2 rounded-full bg-amber-500" />
        <span data-testid="sync-status">Online</span>
        <span data-testid="sync-count" className="font-semibold">
          ({summary.queued} queued)
        </span>
      </div>
    );
  }

  return (
    <div
      data-testid="sync-badge"
      onClick={handleClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded border transition-colors cursor-pointer bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 ${className}`}
      title="All observations synced. Click to refresh."
    >
      <span className="w-2 h-2 rounded-full bg-emerald-500" />
      <span data-testid="sync-status">Online</span>
      <span data-testid="sync-count">(All synced)</span>
    </div>
  );
}
