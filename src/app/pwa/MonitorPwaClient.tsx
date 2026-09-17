'use client';

// Monitor PWA Client Component (T-29)
// Authoritative sources: docs/specs/08-ui-ux-design.md §4, docs/specs/11-tasks.md T-29

import React, { useState, useEffect } from 'react';
import { SyncBadge } from '@/components/SyncBadge';
import { getSyncEngine } from '@/lib/outbox/sync-engine';
import { getOutboxStore } from '@/lib/outbox/outbox-store';
import { SystemClock } from '@/infra/clock';
import type { OfflineObservationRecord } from '@/lib/outbox/types';

// Deterministic demo IDs
const DEFAULT_TASK_ID = '00000000-0000-4000-a000-000000000300'; // TASK_4412
// Amina's canonical phone hash from demo-scenario
const DEFAULT_PHONE_HASH = '435eef566c8beff9f57f26e9072010466319187fa2f673b636e44084e913ef65';

export function MonitorPwaClient() {
  const [taskId, setTaskId] = useState(DEFAULT_TASK_ID);
  const [phoneHash, setPhoneHash] = useState(DEFAULT_PHONE_HASH);
  const [q1, setQ1] = useState(true);
  const [q2, setQ2] = useState(true);
  const [q3, setQ3] = useState(true);
  const [isAirplaneMode, setIsAirplaneMode] = useState(false);
  const [outboxItems, setOutboxItems] = useState<OfflineObservationRecord[]>([]);
  const [lastSubmissionNotice, setLastSubmissionNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadItems = async () => {
    const store = getOutboxStore();
    const all = await store.getAll();
    setOutboxItems(all);
  };

  useEffect(() => {
    void loadItems();
    const engine = getSyncEngine();
    const unsubscribe = engine.subscribe(() => {
      void loadItems();
    });
    return () => unsubscribe();
  }, []);

  const handleToggleAirplane = () => {
    const nextState = !isAirplaneMode;
    setIsAirplaneMode(nextState);
    const engine = getSyncEngine();
    engine.setSimulatedOffline(nextState);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setLastSubmissionNotice(null);

    const clock = new SystemClock();
    const idempotencyKey = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `key-${clock.nowMs()}-${Math.random().toString(36).substring(2, 9)}`;

    const engine = getSyncEngine();
    try {
      await engine.enqueue({
        clientIdempotencyKey: idempotencyKey,
        taskId,
        phoneHash,
        channel: 'PWA',
        answers: { q1, q2, q3 },
        geoCell: 'et-aa-0917',
        msisdnPrefixBucket: '251993',
        submittedAt: clock.nowIso(),
      });

      if (isAirplaneMode || !engine.isOnline()) {
        setLastSubmissionNotice(`Observation saved locally in offline outbox (key: ${idempotencyKey.slice(0, 8)}...). Will sync when online.`);
      } else {
        setLastSubmissionNotice(`Observation dispatched for synchronization.`);
      }
      await loadItems();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Submission failed';
      setLastSubmissionNotice(`Error: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualSync = async () => {
    const engine = getSyncEngine();
    await engine.flush();
    await loadItems();
  };

  const handleClearOutbox = async () => {
    const store = getOutboxStore();
    await store.clear();
    await loadItems();
    setLastSubmissionNotice('Outbox cleared.');
  };

  return (
    <div className="min-h-screen bg-[#FBFBFA] text-[#111110] font-sans antialiased">
      {/* Header */}
      <header className="border-b border-[#E6E4DF] bg-white px-6 py-4">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-mono tracking-widest text-[#706E6A] uppercase">
              Ward Proof-Line · T-29
            </div>
            <h1 className="text-xl font-bold font-serif tracking-tight text-[#111110]">
              Monitor Field Observation (PWA)
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <SyncBadge />
            <button
              type="button"
              data-testid="airplane-mode-toggle"
              onClick={handleToggleAirplane}
              className={`px-3 py-1 text-xs font-mono rounded border transition-colors ${
                isAirplaneMode
                  ? 'bg-amber-600 text-white border-amber-700 shadow-sm'
                  : 'bg-white text-[#706E6A] border-[#D1CFCA] hover:bg-[#F4F3F0]'
              }`}
            >
              {isAirplaneMode ? '✈ Airplane Mode: ON' : '✈ Airplane Mode: OFF'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Notice Banner */}
        {lastSubmissionNotice && (
          <div
            data-testid="submission-notice"
            className="p-3 text-sm font-mono rounded border bg-blue-50 text-blue-900 border-blue-200"
          >
            {lastSubmissionNotice}
          </div>
        )}

        {/* Observation Form */}
        <section className="bg-white border border-[#E6E4DF] rounded-lg p-6 shadow-sm">
          <h2 className="text-base font-semibold font-serif mb-4 text-[#111110]">
            Record Field Inspection
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono text-[#706E6A] uppercase mb-1">
                  Inspection Task ID
                </label>
                <input
                  type="text"
                  value={taskId}
                  onChange={(e) => setTaskId(e.target.value)}
                  className="w-full text-xs font-mono p-2 border border-[#D1CFCA] rounded bg-[#FAF9F7]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-[#706E6A] uppercase mb-1">
                  Monitor Phone Hash
                </label>
                <input
                  type="text"
                  value={phoneHash}
                  onChange={(e) => setPhoneHash(e.target.value)}
                  className="w-full text-xs font-mono p-2 border border-[#D1CFCA] rounded bg-[#FAF9F7]"
                  required
                />
              </div>
            </div>

            {/* Checklist */}
            <div className="border-t border-[#E6E4DF] pt-4 space-y-2">
              <div className="text-xs font-mono text-[#706E6A] uppercase mb-2">
                Physical Verification Questions
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={q1}
                  onChange={(e) => setQ1(e.target.checked)}
                  className="rounded border-[#D1CFCA] text-[#1F5C3D] focus:ring-0"
                />
                <span>Q1: Generator installed and physically present?</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={q2}
                  onChange={(e) => setQ2(e.target.checked)}
                  className="rounded border-[#D1CFCA] text-[#1F5C3D] focus:ring-0"
                />
                <span>Q2: Asset nameplate and municipal serial tag verified?</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={q3}
                  onChange={(e) => setQ3(e.target.checked)}
                  className="rounded border-[#D1CFCA] text-[#1F5C3D] focus:ring-0"
                />
                <span>Q3: Logbook maintenance entries inspected?</span>
              </label>
            </div>

            {/* Actions */}
            <div className="border-t border-[#E6E4DF] pt-4 flex items-center justify-between gap-4">
              <button
                type="submit"
                disabled={isSubmitting}
                data-testid="btn-submit-observation"
                className="px-4 py-2 bg-[#1F5C3D] text-white text-xs font-mono uppercase tracking-wider rounded hover:bg-[#16442D] transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Recording...' : 'Submit Field Observation'}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid="btn-sync-now"
                  onClick={handleManualSync}
                  className="px-3 py-1.5 text-xs font-mono border border-[#D1CFCA] rounded hover:bg-[#F4F3F0] transition-colors"
                >
                  Sync Now
                </button>
                <button
                  type="button"
                  data-testid="btn-clear-outbox"
                  onClick={handleClearOutbox}
                  className="px-3 py-1.5 text-xs font-mono border border-red-200 text-red-700 rounded hover:bg-red-50 transition-colors"
                >
                  Clear Queue
                </button>
              </div>
            </div>
          </form>
        </section>

        {/* Outbox Records Table */}
        <section className="bg-white border border-[#E6E4DF] rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold font-serif text-[#111110]">
              Offline Outbox Records ({outboxItems.length})
            </h2>
            <div className="text-xs font-mono text-[#706E6A]">
              Stores locally in IndexedDB until flushed
            </div>
          </div>

          {outboxItems.length === 0 ? (
            <div className="text-center py-8 text-xs font-mono text-[#706E6A]">
              Outbox is empty. Record an observation above to test.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table data-testid="outbox-table" className="w-full text-xs font-mono border-collapse">
                <thead>
                  <tr className="border-b border-[#E6E4DF] text-left text-[#706E6A]">
                    <th className="py-2 px-2">Idempotency Key</th>
                    <th className="py-2 px-2">Task</th>
                    <th className="py-2 px-2">Status</th>
                    <th className="py-2 px-2">Answers</th>
                    <th className="py-2 px-2">Result / Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0EFEA]">
                  {outboxItems.map((item) => (
                    <tr key={item.clientIdempotencyKey} className="hover:bg-[#FAF9F7]">
                      <td className="py-2.5 px-2 font-semibold">
                        {item.clientIdempotencyKey.slice(0, 8)}...
                      </td>
                      <td className="py-2.5 px-2 text-[#706E6A]">
                        {item.taskId.slice(0, 8)}...
                      </td>
                      <td className="py-2.5 px-2">
                        <span
                          data-testid="item-status"
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.status === 'SYNCED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.status === 'SYNCING'
                              ? 'bg-amber-100 text-amber-800 animate-pulse'
                              : item.status === 'FAILED'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-zinc-100 text-zinc-800'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-[#706E6A]">
                        {JSON.stringify(item.answers)}
                      </td>
                      <td className="py-2.5 px-2 max-w-xs truncate text-[#706E6A]">
                        {item.serverResponse
                          ? `Witnesses: ${item.serverResponse.witnessCount}/${item.serverResponse.witnessTarget}`
                          : item.lastError || (item.status === 'QUEUED' ? 'Pending flush' : '-')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
