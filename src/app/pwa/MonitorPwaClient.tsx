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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HASH_64_REGEX = /^[0-9a-f]{64}$/i;

// Form steps for the 5-step progress indicator (Audit #104)
const FORM_STEPS = [
  { id: 1, label: 'Identification', shortLabel: '01. TASK ID', description: 'Task UUID verification' },
  { id: 2, label: 'Monitor', shortLabel: '02. MONITOR', description: 'Monitor hash (Zero-PII)' },
  { id: 3, label: 'Checklist', shortLabel: '03. CHECKLIST', description: 'Physical ground inspection' },
  { id: 4, label: 'Review', shortLabel: '04. REVIEW', description: 'Integrity check & audit review' },
  { id: 5, label: 'Submit', shortLabel: '05. TRANSMIT', description: 'Local outbox & sync' },
] as const;

export function MonitorPwaClient() {
  const [taskId, setTaskId] = useState(DEFAULT_TASK_ID);
  const [phoneHash, setPhoneHash] = useState(DEFAULT_PHONE_HASH);
  const [q1, setQ1] = useState(true);
  const [q2, setQ2] = useState(true);
  const [q3, setQ3] = useState(true);
  // Audit #102: initialised from navigator.onLine; manual demo override allowed
  const [isAirplaneMode, setIsAirplaneMode] = useState(false);
  const [systemOnline, setSystemOnline] = useState(true);
  const [outboxItems, setOutboxItems] = useState<OfflineObservationRecord[]>([]);
  const [lastSubmissionNotice, setLastSubmissionNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Audit #103: demo-accessible sync-error state
  const [hasForcedSyncError, setHasForcedSyncError] = useState(false);
  // Audit #104: active form step (1-based, outdoor progress tracking)
  const [formStep, setFormStep] = useState(1);

  const isTaskIdValid = !taskId || UUID_REGEX.test(taskId.trim());
  const isPhoneRawNumber = /^\+?\d{9,15}$/.test(phoneHash.trim());
  const isPhoneHashValid = !phoneHash || (HASH_64_REGEX.test(phoneHash.trim()) && !isPhoneRawNumber);

  const loadItems = async () => {
    const store = getOutboxStore();
    const all = await store.getAll();
    setOutboxItems(all);
  };

  // Audit #102: track physical connectivity and initialise airplane-mode from navigator.onLine on mount
  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      const isOnline = navigator.onLine;
      setSystemOnline(isOnline);
      if (!isOnline) {
        const engine = getSyncEngine();
        setIsAirplaneMode(true);
        engine.setSimulatedOffline(true);
      }
    }

    const handleWindowOnline = () => {
      setSystemOnline(true);
    };
    const handleWindowOffline = () => {
      setSystemOnline(false);
    };

    window.addEventListener('online', handleWindowOnline);
    window.addEventListener('offline', handleWindowOffline);

    return () => {
      window.removeEventListener('online', handleWindowOnline);
      window.removeEventListener('offline', handleWindowOffline);
    };
  }, []);

  useEffect(() => {
    void loadItems();
    const engine = getSyncEngine();
    const unsubscribe = engine.subscribe(() => {
      void loadItems();
    });
    return () => unsubscribe();
  }, []);

  // Audit #104: automatically track form progression based on field completion state
  useEffect(() => {
    if (!taskId.trim() || !UUID_REGEX.test(taskId.trim())) {
      setFormStep(1);
    } else if (!phoneHash.trim() || !HASH_64_REGEX.test(phoneHash.trim()) || isPhoneRawNumber) {
      setFormStep(2);
    } else if (!q1 || !q2 || !q3) {
      setFormStep(3);
    } else {
      setFormStep(4);
    }
  }, [taskId, phoneHash, isTaskIdValid, isPhoneHashValid, isPhoneRawNumber, q1, q2, q3]);

  const handleToggleAirplane = () => {
    const nextState = !isAirplaneMode;
    setIsAirplaneMode(nextState);
    const engine = getSyncEngine();
    engine.setSimulatedOffline(nextState);
  };

  // Audit #103: inject a FAILED record into the outbox so the error state is reachable and testable
  const handleForceSyncError = async () => {
    const store = getOutboxStore();
    const clock = new SystemClock();
    const errorKey = `demo-error-${clock.nowMs()}`;

    // Enqueue valid record first, then update status to FAILED with deterministic downstream ledger error
    const record = await store.enqueue({
      clientIdempotencyKey: errorKey,
      taskId: taskId.trim() || DEFAULT_TASK_ID,
      phoneHash: phoneHash.trim() || DEFAULT_PHONE_HASH,
      channel: 'PWA',
      answers: { q1, q2, q3 },
      geoCell: 'et-aa-0917',
      msisdnPrefixBucket: '251993',
      submittedAt: clock.nowIso(),
    });

    await store.updateStatus(record.clientIdempotencyKey, 'FAILED', {
      retryCount: 3,
      lastError: 'HTTP 409 Conflict: Upstream Task window closed or duplicate observation rejected by proof ledger.',
    });

    setHasForcedSyncError(true);
    setLastSubmissionNotice('Simulated sync failure injected (Audit #103: HTTP 409 Conflict). Error state active with recovery actions.');
    await loadItems();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('outbox-updated'));
    }
  };

  // Audit #103: recovery action 1 — retry all failed items
  const handleRetryAllFailed = async () => {
    const engine = getSyncEngine();
    await engine.retryFailed();
    setHasForcedSyncError(false);
    setLastSubmissionNotice('Retrying all failed observations via background sync...');
    await loadItems();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('outbox-updated'));
    }
  };

  // Audit #103: recovery action 2 — export outbox records as forensic JSON ledger
  const handleExportOutbox = () => {
    const clock = new SystemClock();
    const nowIso = clock.nowIso();
    const exportPayload = {
      exportedAt: nowIso,
      recordCount: outboxItems.length,
      outboxRecords: outboxItems,
      systemState: {
        isAirplaneMode,
        hardwareOnline: systemOnline,
      },
    };
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ward-proofline-outbox-${nowIso.slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setLastSubmissionNotice(`Exported ${outboxItems.length} outbox observation records to JSON.`);
  };

  // Audit #103: recovery action 3 — discard all failed items
  const handleDiscardAllFailed = async () => {
    const store = getOutboxStore();
    const failed = outboxItems.filter((i) => i.status === 'FAILED');
    for (const item of failed) {
      await store.deleteRecord(item.clientIdempotencyKey);
    }
    setHasForcedSyncError(false);
    setLastSubmissionNotice(`Discarded ${failed.length} failed record(s) from offline outbox.`);
    await loadItems();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('outbox-updated'));
    }
  };

  const handleRetryItem = async (clientIdempotencyKey: string) => {
    const engine = getSyncEngine();
    await engine.retryFailed(clientIdempotencyKey);
    setLastSubmissionNotice(`Retried item ${clientIdempotencyKey.slice(0, 8)}...`);
    await loadItems();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('outbox-updated'));
    }
  };

  const handleDiscardItem = async (clientIdempotencyKey: string) => {
    const store = getOutboxStore();
    await store.deleteRecord(clientIdempotencyKey);
    setLastSubmissionNotice(`Discarded record ${clientIdempotencyKey.slice(0, 8)}...`);
    await loadItems();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('outbox-updated'));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setLastSubmissionNotice(null);

    const trimmedTaskId = taskId.trim();
    const trimmedPhoneHash = phoneHash.trim();

    if (!UUID_REGEX.test(trimmedTaskId)) {
      setLastSubmissionNotice('Validation Error: Task ID must be a valid UUID v4.');
      setIsSubmitting(false);
      return;
    }

    if (isPhoneRawNumber) {
      setLastSubmissionNotice('Zero-PII Error: Raw phone numbers are strictly forbidden. Enter a 64-character SHA-256 hex hash.');
      setIsSubmitting(false);
      return;
    }

    if (!HASH_64_REGEX.test(trimmedPhoneHash)) {
      setLastSubmissionNotice('Validation Error: Phone hash must be exactly 64 hexadecimal characters.');
      setIsSubmitting(false);
      return;
    }

    const clock = new SystemClock();
    const idempotencyKey = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `key-${clock.nowMs()}-${Math.random().toString(36).substring(2, 9)}`;

    const engine = getSyncEngine();
    try {
      await engine.enqueue({
        clientIdempotencyKey: idempotencyKey,
        taskId: trimmedTaskId,
        phoneHash: trimmedPhoneHash,
        channel: 'PWA',
        answers: { q1, q2, q3 },
        geoCell: 'et-aa-0917',
        msisdnPrefixBucket: '251993',
        submittedAt: clock.nowIso(),
      });

      setFormStep(5);

      if (isAirplaneMode || !engine.isOnline()) {
        setLastSubmissionNotice(`Observation saved locally in offline outbox (key: ${idempotencyKey.slice(0, 8)}...). Will sync when online.`);
      } else {
        setLastSubmissionNotice(`Observation dispatched for synchronization.`);
      }
      await loadItems();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('outbox-updated'));
      }
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
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('outbox-updated'));
    }
  };

  const handleClearOutbox = async () => {
    const store = getOutboxStore();
    await store.clear();
    setHasForcedSyncError(false);
    await loadItems();
    setLastSubmissionNotice('Outbox cleared.');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('outbox-updated'));
    }
  };

  const failedItems = outboxItems.filter((item) => item.status === 'FAILED');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased pb-16">
      {/* Header */}
      <header className="border-b border-slate-800 bg-[#0B0F17] px-4 sm:px-6 lg:px-8 py-5 shadow-lg text-white">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-amber-400 shadow-md flex-shrink-0 bg-slate-800">
              <img
                src="/personas/field-monitor.jpg"
                alt="Field Monitor Volunteer"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-bold flex items-center gap-2">
                <span>Ward Proof-Line</span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-400">Field Monitor PWA</span>
              </div>
              <h1 className="text-lg sm:text-xl font-bold font-sans tracking-tight text-white mt-0.5">
                Monitor Field Observation (PWA)
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Offline observation outbox with client-side IndexedDB and idempotent background sync.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
            <SyncBadge />

            {/* Audit #102: Labeled connectivity control with role="switch" and aria attributes */}
            <div className="flex items-center gap-2">
              <label
                htmlFor="airplane-mode-toggle"
                id="connectivity-label"
                className="text-[11px] font-mono uppercase tracking-wider text-slate-400 sr-only sm:not-sr-only font-bold"
              >
                Simulation:
              </label>
              <button
                id="airplane-mode-toggle"
                type="button"
                role="switch"
                aria-checked={isAirplaneMode}
                aria-labelledby="connectivity-label"
                aria-label={
                  isAirplaneMode
                    ? 'Airplane mode enabled: simulating offline coverage dead zone. Press to switch online.'
                    : 'Airplane mode disabled: live network connection. Press to simulate offline coverage dead zone.'
                }
                data-testid="airplane-mode-toggle"
                onClick={handleToggleAirplane}
                className={`px-3 py-2.5 min-h-[44px] text-xs font-mono rounded-xl border transition-all shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-400 ${
                  isAirplaneMode
                    ? 'bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-amber-500/20'
                    : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {isAirplaneMode ? '✈ Airplane Mode: ON (Buffered)' : '✈ Airplane Mode: OFF (Live)'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Context & Demo Scenario Banner */}
        <div className="border border-slate-200 bg-white rounded-2xl p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
            <p className="font-mono text-[10px] uppercase tracking-widest text-blue-600 font-bold">
              Field Monitor Protocol // Low-Connectivity Ward Verification
            </p>
            <div className="flex items-center gap-2">
              {hasForcedSyncError && (
                <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 bg-red-100 text-red-850 border border-red-300 font-semibold">
                  Fault Simulation Active
                </span>
              )}
              {!systemOnline && (
                <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 bg-neutral-200 text-neutral-800 border border-neutral-400">
                  Hardware Link: Disconnected
                </span>
              )}
            </div>
          </div>
          <p className="text-sm text-[var(--ink)] leading-relaxed mb-3">
            Field monitors inspect public infrastructure in areas without cellular coverage. This outbox queues observations locally and syncs automatically when connectivity returns — with zero duplicate submissions.
          </p>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[var(--rule)]">
            <div className="flex flex-col gap-1 font-mono text-[11px] text-[var(--ink-soft)]">
              <span>1. Toggle <strong className="text-[var(--ink)]">Airplane Mode</strong> to simulate a dead zone.</span>
              <span>2. Complete the physical checklist and record observation.</span>
              <span>3. Re-enable connectivity to auto-flush queued records.</span>
            </div>

            {/* Audit #103: Reachable demo sync error trigger */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                data-testid="btn-force-sync-error"
                onClick={handleForceSyncError}
                className="px-3 py-2 text-xs font-mono border border-red-300 text-red-800 bg-white hover:bg-red-50 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-red-800"
                title="Demo tool: injects a synthetic network failure to demonstrate how the offline outbox handles sync errors and recovers"
              >
                ⚠ Test: Simulate Sync Failure
              </button>
            </div>
          </div>
        </div>

        {/* Notice Banner */}
        {lastSubmissionNotice && (
          <div
            data-testid="submission-notice"
            role="status"
            aria-live="polite"
            className="p-4 text-sm font-mono border rounded-xl bg-blue-50 text-blue-900 border-blue-200 shadow-sm"
          >
            {lastSubmissionNotice}
          </div>
        )}

        {/* Audit #103: Reachable Sync Error Diagnostics & Recovery Actions Section */}
        {failedItems.length > 0 && (
          <section
            data-testid="sync-error-banner"
            aria-labelledby="sync-error-heading"
            className="border-2 border-red-500 bg-red-50/90 rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm"
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-red-200 pb-3">
              <div>
                <div className="inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-red-800 font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" aria-hidden="true" />
                  Audit #103 // Dispatch Diagnostics
                </div>
                <h2 id="sync-error-heading" className="text-base font-bold font-mono text-red-950 mt-1">
                  Sync Error Detected · Cryptographic Records Preserved ({failedItems.length} failed)
                </h2>
                <p className="text-xs text-red-800 mt-1">
                  One or more observations failed synchronization. Client records remain safely buffered in IndexedDB with valid integrity digests.
                </p>
              </div>

              {/* Recovery Actions */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  data-testid="btn-retry-failed"
                  onClick={handleRetryAllFailed}
                  className="px-3 py-2 min-h-[40px] text-xs font-mono font-bold bg-amber-600 text-white hover:bg-amber-700 rounded-xl transition-all shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-800"
                  title="Retry sending all failed observations"
                >
                  ↻ Retry Sync
                </button>
                <button
                  type="button"
                  data-testid="btn-export-outbox"
                  onClick={handleExportOutbox}
                  className="px-3 py-2 min-h-[40px] text-xs font-mono font-semibold border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 rounded-xl transition-all shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-800"
                  title="Download outbox records as forensic JSON audit trail"
                >
                  ⬇ Export Outbox (JSON)
                </button>
                <button
                  type="button"
                  data-testid="btn-discard-failed"
                  onClick={handleDiscardAllFailed}
                  className="px-3 py-2 min-h-[40px] text-xs font-mono border border-red-300 text-red-700 bg-white hover:bg-red-50 rounded-xl transition-all shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-red-700"
                  title="Discard failed observations from local store"
                >
                  ✕ Discard Failed
                </button>
              </div>
            </div>

            <div className="space-y-1.5 font-mono text-xs">
              <div className="text-[11px] text-red-900 font-semibold uppercase tracking-wider">
                Failed Records Detail:
              </div>
              <ul className="space-y-1 text-red-900 bg-white border border-red-200 rounded-xl p-3 shadow-inner">
                {failedItems.map((item) => (
                  <li key={item.clientIdempotencyKey} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-1.5 border-b border-neutral-100 last:border-0">
                    <div>
                      <span className="font-bold">Key: {item.clientIdempotencyKey.slice(0, 12)}...</span>
                      <span className="text-[11px] text-neutral-600 ml-2">[{item.lastError || 'Unknown transmission error'}]</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleRetryItem(item.clientIdempotencyKey)}
                        className="px-2.5 py-1 text-[11px] rounded-lg border border-amber-600 bg-amber-50 text-amber-900 hover:bg-amber-100 transition-colors"
                      >
                        Retry Single
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDiscardItem(item.clientIdempotencyKey)}
                        className="px-2.5 py-1 text-[11px] rounded-lg border border-red-300 bg-red-50 text-red-800 hover:bg-red-100 transition-colors"
                      >
                        Discard
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* Observation Form Section */}
        <section
          aria-labelledby="record-inspection-heading"
          className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5 shadow-sm"
        >
          <div className="border-b border-slate-200 pb-3">
            <h2 id="record-inspection-heading" className="text-sm sm:text-base font-bold font-sans text-slate-900">
              Record Field Inspection
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">
              Captures ground physical verification for municipal project tasks
            </p>
          </div>

          {/* ─── Demo Credentials (inside form — first thing user sees) ─── */}
          <div
            className="border-2 border-amber-400 bg-amber-50 rounded-2xl p-4 sm:p-5 shadow-sm"
            role="note"
            aria-label="Demo credentials for testing"
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="space-y-2.5 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" aria-hidden="true" />
                  <p className="font-mono text-[10px] uppercase tracking-widest text-amber-800 font-bold">
                    Demo Mode · Pre-loaded Test Credentials
                  </p>
                </div>
                <p className="text-xs text-amber-900 font-sans leading-relaxed">
                  Both fields are pre-filled. Click <strong>Submit Field Observation</strong> to test the offline queue, or use the reset button if you cleared them.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="bg-white border border-amber-200 rounded-xl px-3 py-2">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-amber-700 font-bold mb-0.5">Task ID (Task #4412)</div>
                    <code className="text-[11px] font-mono text-slate-800 break-all select-all">00000000-0000-4000-a000-000000000300</code>
                  </div>
                  <div className="bg-white border border-amber-200 rounded-xl px-3 py-2">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-amber-700 font-bold mb-0.5">Monitor Hash (Amina · SHA-256)</div>
                    <code className="text-[11px] font-mono text-slate-800 break-all select-all leading-relaxed">435eef566c8beff9f57f26e9072010466319187fa2f673b636e44084e913ef65</code>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setTaskId(DEFAULT_TASK_ID); setPhoneHash(DEFAULT_PHONE_HASH); }}
                className="flex-shrink-0 px-4 py-2.5 min-h-[44px] text-xs font-mono font-bold bg-amber-500 text-white hover:bg-amber-600 active:scale-[0.98] rounded-xl transition-all shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-700 whitespace-nowrap"
              >
                ↺ Reset to Demo Values
              </button>
            </div>
          </div>

          {/* Audit #104: Thickened 5-Step Form Progress Bar for Outdoor Visibility */}
          <div
            aria-labelledby="progress-bar-heading"
            className="border-2 border-slate-900 bg-slate-50 rounded-xl p-3 sm:p-4 space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span id="progress-bar-heading" className="font-mono text-[11px] font-bold uppercase tracking-widest text-slate-900">
                Field Progress Indicator // High-Contrast Outdoor Mode
              </span>
              <span className="font-mono text-xs font-bold text-slate-900">
                Step {formStep} of 5: {FORM_STEPS[formStep - 1]?.label} ({Math.round((formStep / 5) * 100)}%)
              </span>
            </div>

            {/* Thick Outdoor Progress Bar */}
            <div
              role="progressbar"
              aria-valuenow={formStep}
              aria-valuemin={1}
              aria-valuemax={5}
              aria-label={`Form progression: step ${formStep} of 5 (${FORM_STEPS[formStep - 1]?.label})`}
              className="w-full h-4 sm:h-5 bg-slate-200 border-2 border-slate-900 rounded-full overflow-hidden"
            >
              <div
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${(formStep / 5) * 100}%` }}
              />
            </div>

            {/* 5 Step Indicator Blocks */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 font-mono text-xs">
              {FORM_STEPS.map((step) => {
                const isActive = step.id === formStep;
                const isDone = step.id < formStep;
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setFormStep(step.id)}
                    aria-current={isActive ? 'step' : undefined}
                    aria-label={`Step ${step.id}: ${step.label} (${isDone ? 'Completed' : isActive ? 'Active' : 'Pending'})`}
                    className={`p-2 border-2 text-left rounded-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600 ${
                      isActive
                        ? 'border-blue-600 bg-blue-600 text-white font-bold shadow-sm'
                        : isDone
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold hover:bg-emerald-100'
                        : 'border-slate-300 bg-white text-slate-500 font-medium hover:border-slate-400'
                    }`}
                  >
                    <div className="text-[10px] tracking-wider uppercase font-semibold">
                      {isDone ? `✓ ${step.shortLabel}` : step.shortLabel}
                    </div>
                    <div className="text-[11px] truncate mt-0.5">
                      {step.label}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form Fields */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="task-id-input" className="block text-[11px] font-mono text-slate-600 uppercase tracking-wider mb-1 font-semibold">
                  Inspection Task ID
                </label>
                <input
                  id="task-id-input"
                  type="text"
                  value={taskId}
                  onChange={(e) => setTaskId(e.target.value)}
                  aria-invalid={taskId.length > 0 ? !isTaskIdValid : undefined}
                  aria-describedby="task-id-hint"
                  className={`w-full text-xs font-mono p-2.5 rounded-xl border bg-slate-50 text-slate-900 focus:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                    taskId.length > 0 && !isTaskIdValid
                      ? 'border-red-500 ring-1 ring-red-300'
                      : 'border-slate-200 focus:border-blue-600'
                  }`}
                  required
                />
                <p id="task-id-hint" className={`text-[10px] mt-1 font-mono ${taskId.length > 0 && !isTaskIdValid ? 'text-red-600' : 'text-slate-500'}`}>
                  {taskId.length > 0 && !isTaskIdValid
                    ? '✗ Must be a valid UUID v4 — e.g. 00000000-0000-4000-a000-000000000300 (Task #4412)'
                    : 'UUID v4 task identifier — demo value: 00000000-0000-4000-a000-000000000300'}
                </p>
              </div>

              <div>
                <label htmlFor="phone-hash-input" className="block text-[11px] font-mono text-slate-600 uppercase tracking-wider mb-1 font-semibold">
                  Monitor Phone Hash
                  <span className="ml-1.5 text-[9px] normal-case font-normal text-slate-400">(auto-generated in live system)</span>
                </label>
                <input
                  id="phone-hash-input"
                  type="text"
                  value={phoneHash}
                  onChange={(e) => setPhoneHash(e.target.value)}
                  aria-invalid={phoneHash.length > 0 ? (!isPhoneHashValid || isPhoneRawNumber) : undefined}
                  aria-describedby="phone-hash-hint"
                  className={`w-full text-xs font-mono p-2.5 rounded-xl border bg-slate-50 text-slate-900 focus:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                    phoneHash.length > 0 && (!isPhoneHashValid || isPhoneRawNumber)
                      ? 'border-red-500 ring-1 ring-red-300'
                      : 'border-slate-200 focus:border-blue-600'
                  }`}
                  required
                />
                <p id="phone-hash-hint" className={`text-[10px] mt-1 font-mono ${phoneHash.length > 0 && (!isPhoneHashValid || isPhoneRawNumber) ? 'text-red-600' : 'text-slate-500'}`}>
                  {isPhoneRawNumber
                    ? '✗ ZERO-PII: Raw phone numbers are strictly rejected. Use SHA-256 hash.'
                    : phoneHash.length > 0 && !isPhoneHashValid
                    ? '✗ Must be exactly 64 hexadecimal characters (SHA-256 hex digest)'
                    : 'In the live system your app generates this automatically. For this demo, the value is pre-filled above.'}
                </p>
              </div>
            </div>

            {/* Physical Checklist Section */}
            <div className="border-t border-slate-200 pt-4 space-y-2">
              <div className="text-[11px] font-mono text-slate-600 uppercase tracking-wider mb-2 font-bold">
                Physical Verification Questions
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer text-xs sm:text-sm text-slate-800 py-2 focus-within:ring-1 focus-within:ring-blue-600">
                <input
                  type="checkbox"
                  checked={q1}
                  onChange={(e) => setQ1(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Q1: Generator installed and physically present?</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer text-xs sm:text-sm text-slate-800 py-2 focus-within:ring-1 focus-within:ring-blue-600">
                <input
                  type="checkbox"
                  checked={q2}
                  onChange={(e) => setQ2(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Q2: Asset nameplate and municipal serial tag verified?</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer text-xs sm:text-sm text-slate-800 py-2 focus-within:ring-1 focus-within:ring-blue-600">
                <input
                  type="checkbox"
                  checked={q3}
                  onChange={(e) => setQ3(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Q3: Logbook maintenance entries inspected?</span>
              </label>
            </div>

            {/* Verification Review Summary (Step 4 preview) */}
            <div className="border border-slate-200 bg-slate-50 rounded-xl p-3.5 font-mono text-xs space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                Verification Ledger Summary
              </div>
              <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-800 gap-2">
                <span>Task: {taskId ? `${taskId.slice(0, 8)}...` : '(empty)'}</span>
                <span>Monitor: {phoneHash ? `${phoneHash.slice(0, 10)}...` : '(empty)'}</span>
                <span>Verification: {[q1, q2, q3].filter(Boolean).length}/3 Checked</span>
                <span>Channel: PWA / Local Outbox</span>
              </div>
            </div>

            {/* Actions */}
            <div className="border-t border-slate-200 pt-4 flex flex-wrap items-center justify-between gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                data-testid="btn-submit-observation"
                className="px-5 py-2.5 min-h-[44px] bg-blue-600 text-white text-xs font-mono font-semibold uppercase tracking-wider rounded-xl hover:bg-blue-700 active:scale-[0.99] transition-all shadow-sm disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600"
              >
                {isSubmitting ? 'Recording...' : 'Submit Field Observation'}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid="btn-sync-now"
                  onClick={handleManualSync}
                  className="px-3.5 py-2.5 min-h-[44px] text-xs font-mono font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-all shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600"
                >
                  Sync Now
                </button>
                <button
                  type="button"
                  data-testid="btn-clear-outbox"
                  onClick={handleClearOutbox}
                  className="px-3.5 py-2.5 min-h-[44px] text-xs font-mono font-semibold rounded-xl border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 transition-all shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-red-700"
                >
                  Clear Queue
                </button>
              </div>
            </div>
          </form>
        </section>

        {/* Outbox Records Table Section */}
        <section
          aria-labelledby="outbox-records-heading"
          className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <h2 id="outbox-records-heading" className="text-sm sm:text-base font-bold font-sans text-slate-900">
              Offline Outbox Records ({outboxItems.length})
            </h2>
            <div className="text-xs font-mono text-slate-500">
              Stores locally in IndexedDB until flushed
            </div>
          </div>

          {outboxItems.length === 0 ? (
            <div className="text-center py-8 text-xs font-mono text-slate-500">
              Outbox is empty. Record an observation above to test offline queueing.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table data-testid="outbox-table" className="w-full text-xs font-mono border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500 uppercase text-[10px]">
                    <th className="py-2.5 px-3">Idempotency Key</th>
                    <th className="py-2.5 px-3">Task</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Answers</th>
                    <th className="py-2.5 px-3">Result / Detail</th>
                    <th className="py-2.5 px-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {outboxItems.map((item) => (
                    <tr key={item.clientIdempotencyKey} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 font-semibold text-slate-900">
                        {item.clientIdempotencyKey.slice(0, 8)}...
                      </td>
                      <td className="py-3 px-3 text-slate-500">
                        {item.taskId.slice(0, 8)}...
                      </td>
                      <td className="py-3 px-3">
                        <span
                          data-testid="item-status"
                          className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-md ${
                            item.status === 'SYNCED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.status === 'SYNCING'
                              ? 'bg-amber-100 text-amber-800 animate-pulse'
                              : item.status === 'FAILED'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        {(() => {
                          const total = Object.keys(item.answers).length;
                          const passed = Object.values(item.answers).filter(Boolean).length;
                          return `${passed}/${total} ✓`;
                        })()}
                      </td>
                      <td className="py-3 px-3 max-w-xs truncate text-slate-600">
                        {item.serverResponse
                          ? `Witnesses: ${item.serverResponse.witnessCount}/${item.serverResponse.witnessTarget}`
                          : item.lastError || (item.status === 'QUEUED' ? 'Pending flush' : '-')}
                      </td>
                      <td className="py-3 px-3">
                        {item.status === 'FAILED' ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              data-testid="btn-retry-item"
                              onClick={() => void handleRetryItem(item.clientIdempotencyKey)}
                              className="px-2.5 py-1.5 min-h-[32px] text-xs font-mono rounded-lg border border-amber-400 text-amber-800 bg-amber-50 hover:bg-amber-100 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-800"
                              title="Retry this failed observation"
                            >
                              Retry
                            </button>
                            <button
                              type="button"
                              data-testid="btn-discard-item"
                              onClick={() => void handleDiscardItem(item.clientIdempotencyKey)}
                              className="px-2.5 py-1.5 min-h-[32px] text-xs font-mono rounded-lg border border-red-300 text-red-800 bg-white hover:bg-red-50 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-800"
                              title="Discard this failed observation"
                            >
                              Discard
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

