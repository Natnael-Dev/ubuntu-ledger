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
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)] font-sans antialiased">
      {/* Header */}
      <header className="border-b border-[var(--rule)] bg-white px-4 sm:px-6 py-4">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--ink-soft)]">
              Ward Proof-Line // Field Monitor Interface
            </div>
            <h1 className="text-lg sm:text-xl font-bold font-sans tracking-tight text-[var(--ink)] mt-0.5">
              Monitor Field Observation (PWA)
            </h1>
            <p className="text-xs text-[var(--ink-soft)] mt-0.5">
              Offline observation outbox with client-side IndexedDB and idempotent background sync.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
            <SyncBadge />

            {/* Audit #102: Labeled connectivity control with role="switch" and aria attributes */}
            <div className="flex items-center gap-2">
              <label
                htmlFor="airplane-mode-toggle"
                id="connectivity-label"
                className="text-[11px] font-mono uppercase tracking-wider text-[var(--ink-soft)] sr-only sm:not-sr-only"
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
                className={`px-3 py-2.5 min-h-[44px] text-xs font-mono border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ink)] ${
                  isAirplaneMode
                    ? 'bg-amber-600 text-white border-amber-700 font-semibold'
                    : 'bg-white text-[var(--ink-soft)] border-[var(--rule)] hover:bg-neutral-50 hover:text-[var(--ink)]'
                }`}
              >
                {isAirplaneMode ? '✈ Airplane Mode: ON (Buffered)' : '✈ Airplane Mode: OFF (Live)'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Container (Layout provides root <main>) */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Context & Demo Scenario Banner */}
        <div className="border border-[var(--rule)] bg-[var(--paper-warm)] p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-soft)] font-bold">
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
                title="Inject a simulated sync failure to test error recovery (Audit #103)"
              >
                ⚠ Simulate Sync Error (Audit #103)
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
            className="p-3 text-sm font-mono border bg-blue-50 text-blue-900 border-blue-200"
          >
            {lastSubmissionNotice}
          </div>
        )}

        {/* Audit #103: Reachable Sync Error Diagnostics & Recovery Actions Section */}
        {failedItems.length > 0 && (
          <section
            data-testid="sync-error-banner"
            aria-labelledby="sync-error-heading"
            className="border-2 border-red-500 bg-red-50/80 p-5 space-y-4"
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
                  className="px-3 py-2 min-h-[40px] text-xs font-mono font-bold bg-amber-700 text-white hover:bg-amber-800 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-950"
                  title="Retry sending all failed observations"
                >
                  ↻ Retry Sync
                </button>
                <button
                  type="button"
                  data-testid="btn-export-outbox"
                  onClick={handleExportOutbox}
                  className="px-3 py-2 min-h-[40px] text-xs font-mono font-semibold border border-[var(--ink)] bg-white text-[var(--ink)] hover:bg-neutral-100 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ink)]"
                  title="Download outbox records as forensic JSON audit trail"
                >
                  ⬇ Export Outbox (JSON)
                </button>
                <button
                  type="button"
                  data-testid="btn-discard-failed"
                  onClick={handleDiscardAllFailed}
                  className="px-3 py-2 min-h-[40px] text-xs font-mono border border-red-400 text-red-800 bg-white hover:bg-red-100 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-red-800"
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
              <ul className="space-y-1 text-red-900 bg-white border border-red-200 p-3">
                {failedItems.map((item) => (
                  <li key={item.clientIdempotencyKey} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-1 border-b border-neutral-100 last:border-0">
                    <div>
                      <span className="font-bold">Key: {item.clientIdempotencyKey.slice(0, 12)}...</span>
                      <span className="text-[11px] text-neutral-600 ml-2">[{item.lastError || 'Unknown transmission error'}]</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleRetryItem(item.clientIdempotencyKey)}
                        className="px-2 py-1 text-[11px] border border-amber-600 bg-amber-50 text-amber-900 hover:bg-amber-100 transition-colors"
                      >
                        Retry Single
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDiscardItem(item.clientIdempotencyKey)}
                        className="px-2 py-1 text-[11px] border border-red-300 bg-red-50 text-red-800 hover:bg-red-100 transition-colors"
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
          className="bg-white border border-[var(--rule)] p-5 sm:p-6 space-y-5"
        >
          <div className="border-b border-[var(--rule)] pb-3">
            <h2 id="record-inspection-heading" className="text-sm sm:text-base font-bold font-sans text-[var(--ink)]">
              Record Field Inspection
            </h2>
            <p className="text-xs text-[var(--ink-soft)] mt-0.5 font-mono">
              Captures ground physical verification for municipal project tasks
            </p>
          </div>

          {/* Audit #104: Thickened 5-Step Form Progress Bar for Outdoor Visibility */}
          <div
            aria-labelledby="progress-bar-heading"
            className="border-2 border-[var(--ink)] bg-[var(--paper)] p-3 sm:p-4 space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span id="progress-bar-heading" className="font-mono text-[11px] font-bold uppercase tracking-widest text-[var(--ink)]">
                Field Progress Indicator // High-Contrast Outdoor Mode
              </span>
              <span className="font-mono text-xs font-bold text-[var(--ink)]">
                Step {formStep} of 5: {FORM_STEPS[formStep - 1]?.label} ({Math.round((formStep / 5) * 100)}%)
              </span>
            </div>

            {/* Thick Outdoor Progress Bar (16px high with stark 2px ink border) */}
            <div
              role="progressbar"
              aria-valuenow={formStep}
              aria-valuemin={1}
              aria-valuemax={5}
              aria-label={`Form progression: step ${formStep} of 5 (${FORM_STEPS[formStep - 1]?.label})`}
              className="w-full h-4 sm:h-5 bg-neutral-200 border-2 border-[var(--ink)] overflow-hidden"
            >
              <div
                className="h-full bg-[var(--ink)] transition-all duration-300"
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
                    className={`p-2 border-2 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ink)] ${
                      isActive
                        ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)] font-bold shadow-sm'
                        : isDone
                        ? 'border-[var(--ink)] bg-emerald-50 text-emerald-950 font-bold hover:bg-emerald-100'
                        : 'border-neutral-300 bg-white text-[var(--ink-soft)] font-medium hover:border-neutral-400'
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
                <label htmlFor="task-id-input" className="block text-[11px] font-mono text-[var(--ink-soft)] uppercase tracking-wider mb-1">
                  Inspection Task ID
                </label>
                <input
                  id="task-id-input"
                  type="text"
                  value={taskId}
                  onChange={(e) => setTaskId(e.target.value)}
                  aria-invalid={taskId.length > 0 ? !isTaskIdValid : undefined}
                  aria-describedby="task-id-hint"
                  className={`w-full text-xs font-mono p-2.5 border bg-[var(--paper)] text-[var(--ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)] ${
                    taskId.length > 0 && !isTaskIdValid
                      ? 'border-red-500 ring-1 ring-red-300'
                      : 'border-[var(--rule)] focus:border-[var(--ink)]'
                  }`}
                  required
                />
                <p id="task-id-hint" className={`text-[10px] mt-1 font-mono ${taskId.length > 0 && !isTaskIdValid ? 'text-red-600' : 'text-[var(--ink-soft)]'}`}>
                  {taskId.length > 0 && !isTaskIdValid
                    ? '✗ Must be a valid UUID v4 (e.g. 00000000-0000-4000-a000-...)'
                    : 'UUID v4 task identifier from the inspection ledger'}
                </p>
              </div>

              <div>
                <label htmlFor="phone-hash-input" className="block text-[11px] font-mono text-[var(--ink-soft)] uppercase tracking-wider mb-1">
                  Monitor Phone Hash
                </label>
                <input
                  id="phone-hash-input"
                  type="text"
                  value={phoneHash}
                  onChange={(e) => setPhoneHash(e.target.value)}
                  aria-invalid={phoneHash.length > 0 ? (!isPhoneHashValid || isPhoneRawNumber) : undefined}
                  aria-describedby="phone-hash-hint"
                  className={`w-full text-xs font-mono p-2.5 border bg-[var(--paper)] text-[var(--ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)] ${
                    phoneHash.length > 0 && (!isPhoneHashValid || isPhoneRawNumber)
                      ? 'border-red-500 ring-1 ring-red-300'
                      : 'border-[var(--rule)] focus:border-[var(--ink)]'
                  }`}
                  required
                />
                <p id="phone-hash-hint" className={`text-[10px] mt-1 font-mono ${phoneHash.length > 0 && (!isPhoneHashValid || isPhoneRawNumber) ? 'text-red-600' : 'text-[var(--ink-soft)]'}`}>
                  {isPhoneRawNumber
                    ? '✗ ZERO-PII: Raw phone numbers are strictly rejected. Use SHA-256 hash.'
                    : phoneHash.length > 0 && !isPhoneHashValid
                    ? '✗ Must be exactly 64 hexadecimal characters (SHA-256 hex digest)'
                    : '64-character SHA-256 hex hash of the monitor MSISDN (zero raw phone numbers)'}
                </p>
              </div>
            </div>

            {/* Physical Checklist Section */}
            <div className="border-t border-[var(--rule)] pt-4 space-y-2">
              <div className="text-[11px] font-mono text-[var(--ink-soft)] uppercase tracking-wider mb-2">
                Physical Verification Questions
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer text-xs sm:text-sm text-[var(--ink)] py-2 focus-within:ring-1 focus-within:ring-[var(--ink)]">
                <input
                  type="checkbox"
                  checked={q1}
                  onChange={(e) => setQ1(e.target.checked)}
                  className="rounded border-[var(--rule)] text-[var(--state-open)] focus:ring-0"
                />
                <span>Q1: Generator installed and physically present?</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer text-xs sm:text-sm text-[var(--ink)] py-2 focus-within:ring-1 focus-within:ring-[var(--ink)]">
                <input
                  type="checkbox"
                  checked={q2}
                  onChange={(e) => setQ2(e.target.checked)}
                  className="rounded border-[var(--rule)] text-[var(--state-open)] focus:ring-0"
                />
                <span>Q2: Asset nameplate and municipal serial tag verified?</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer text-xs sm:text-sm text-[var(--ink)] py-2 focus-within:ring-1 focus-within:ring-[var(--ink)]">
                <input
                  type="checkbox"
                  checked={q3}
                  onChange={(e) => setQ3(e.target.checked)}
                  className="rounded border-[var(--rule)] text-[var(--state-open)] focus:ring-0"
                />
                <span>Q3: Logbook maintenance entries inspected?</span>
              </label>
            </div>

            {/* Verification Review Summary (Step 4 preview) */}
            <div className="border border-[var(--rule)] bg-[var(--paper-warm)] p-3 font-mono text-xs space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-[var(--ink-soft)] font-bold">
                Verification Ledger Summary
              </div>
              <div className="flex flex-wrap items-center justify-between text-[11px] text-[var(--ink)] gap-2">
                <span>Task: {taskId ? `${taskId.slice(0, 8)}...` : '(empty)'}</span>
                <span>Monitor: {phoneHash ? `${phoneHash.slice(0, 10)}...` : '(empty)'}</span>
                <span>Verification: {[q1, q2, q3].filter(Boolean).length}/3 Checked</span>
                <span>Channel: PWA / Local Outbox</span>
              </div>
            </div>

            {/* Actions */}
            <div className="border-t border-[var(--rule)] pt-4 flex flex-wrap items-center justify-between gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                data-testid="btn-submit-observation"
                className="px-4 py-2.5 min-h-[44px] bg-[var(--ink)] text-[var(--paper)] text-xs font-mono uppercase tracking-wider hover:bg-neutral-800 transition-colors disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ink)]"
              >
                {isSubmitting ? 'Recording...' : 'Submit Field Observation'}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid="btn-sync-now"
                  onClick={handleManualSync}
                  className="px-3 py-2.5 min-h-[44px] text-xs font-mono border border-[var(--rule)] bg-white text-[var(--ink)] hover:bg-neutral-50 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ink)]"
                >
                  Sync Now
                </button>
                <button
                  type="button"
                  data-testid="btn-clear-outbox"
                  onClick={handleClearOutbox}
                  className="px-3 py-2.5 min-h-[44px] text-xs font-mono border border-red-300 text-red-700 bg-red-50 hover:bg-red-100 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-red-700"
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
          className="bg-white border border-[var(--rule)] p-5 sm:p-6 space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--rule)] pb-3">
            <h2 id="outbox-records-heading" className="text-sm sm:text-base font-bold font-sans text-[var(--ink)]">
              Offline Outbox Records ({outboxItems.length})
            </h2>
            <div className="text-xs font-mono text-[var(--ink-soft)]">
              Stores locally in IndexedDB until flushed
            </div>
          </div>

          {outboxItems.length === 0 ? (
            <div className="text-center py-8 text-xs font-mono text-[var(--ink-soft)]">
              Outbox is empty. Record an observation above to test offline queueing.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table data-testid="outbox-table" className="w-full text-xs font-mono border-collapse">
                <thead>
                  <tr className="border-b border-[var(--rule)] text-left text-[var(--ink-soft)] uppercase text-[10px]">
                    <th className="py-2 px-2">Idempotency Key</th>
                    <th className="py-2 px-2">Task</th>
                    <th className="py-2 px-2">Status</th>
                    <th className="py-2 px-2">Answers</th>
                    <th className="py-2 px-2">Result / Detail</th>
                    <th className="py-2 px-2">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--rule)]">
                  {outboxItems.map((item) => (
                    <tr key={item.clientIdempotencyKey} className="hover:bg-neutral-50">
                      <td className="py-2.5 px-2 font-semibold text-[var(--ink)]">
                        {item.clientIdempotencyKey.slice(0, 8)}...
                      </td>
                      <td className="py-2.5 px-2 text-[var(--ink-soft)]">
                        {item.taskId.slice(0, 8)}...
                      </td>
                      <td className="py-2.5 px-2">
                        <span
                          data-testid="item-status"
                          className={`inline-block px-2 py-0.5 text-[10px] font-bold ${
                            item.status === 'SYNCED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.status === 'SYNCING'
                              ? 'bg-amber-100 text-amber-800 animate-pulse'
                              : item.status === 'FAILED'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-neutral-100 text-neutral-800'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-[var(--ink-soft)]">
                        {(() => {
                          const total = Object.keys(item.answers).length;
                          const passed = Object.values(item.answers).filter(Boolean).length;
                          return `${passed}/${total} ✓`;
                        })()}
                      </td>
                      <td className="py-2.5 px-2 max-w-xs truncate text-[var(--ink-soft)]">
                        {item.serverResponse
                          ? `Witnesses: ${item.serverResponse.witnessCount}/${item.serverResponse.witnessTarget}`
                          : item.lastError || (item.status === 'QUEUED' ? 'Pending flush' : '-')}
                      </td>
                      <td className="py-2.5 px-2">
                        {item.status === 'FAILED' ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              data-testid="btn-retry-item"
                              onClick={() => void handleRetryItem(item.clientIdempotencyKey)}
                              className="px-2.5 py-1.5 min-h-[32px] text-xs font-mono border border-amber-400 text-amber-800 bg-amber-50 hover:bg-amber-100 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-800"
                              title="Retry this failed observation"
                            >
                              Retry
                            </button>
                            <button
                              type="button"
                              data-testid="btn-discard-item"
                              onClick={() => void handleDiscardItem(item.clientIdempotencyKey)}
                              className="px-2 py-1.5 min-h-[32px] text-xs font-mono border border-red-300 text-red-800 bg-white hover:bg-red-50 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-800"
                              title="Discard this failed observation"
                            >
                              Discard
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-[var(--ink-soft)]">-</span>
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

