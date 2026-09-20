'use client';

// Sybil & Collusion Detection Panel Component (T-AI-022)
// Contract: Assistive intelligence panel visualizing collusion risks, similarity metrics,
// and flagged observation patterns without exposing citizen PII.

import React, { useState } from 'react';
import type { SybilCollusionResult } from '@/lib/ai/types';
import type { SybilObservationItem } from '@/app-services/ai/sybil-detect.service';
import fallbackFixture from '@/content/fixtures/ai/sybil-collusion.json';

const DEMO_BURST_OBSERVATIONS: SybilObservationItem[] = [
  {
    id: 'c8a1b2c3-1111-4000-8000-000000000001',
    text: 'Water point 4 in Woreda 09 is completely dry and has broken valve pipes.',
    timestamp: '2026-09-20T05:42:01.000Z',
    msisdnPrefix: '254712',
    answers: { is_operational: false, pipe_leak: true, fee_charged: true },
  },
  {
    id: 'c8a1b2c3-2222-4000-8000-000000000002',
    text: 'Water point 4 in Woreda 09 is completely dry and has broken valve pipes.',
    timestamp: '2026-09-20T05:42:03.000Z',
    msisdnPrefix: '254712',
    answers: { is_operational: false, pipe_leak: true, fee_charged: true },
  },
  {
    id: 'c8a1b2c3-3333-4000-8000-000000000003',
    text: 'Water point 4 in Woreda 09 is completely dry and has broken valve pipes.',
    timestamp: '2026-09-20T05:42:05.000Z',
    msisdnPrefix: '254712',
    answers: { is_operational: false, pipe_leak: true, fee_charged: true },
  },
];

export interface SybilCollusionPanelProps {
  observations?: SybilObservationItem[];
  initialData?: SybilCollusionResult;
  className?: string;
}

export function SybilCollusionPanel({
  observations,
  initialData,
  className = '',
}: SybilCollusionPanelProps) {
  const [data, setData] = useState<SybilCollusionResult | null>(initialData ?? null);
  const [activeObservations, setActiveObservations] = useState<SybilObservationItem[]>(
    observations && observations.length > 0 ? observations : DEMO_BURST_OBSERVATIONS
  );
  const [isDemoActive, setIsDemoActive] = useState<boolean>(
    !observations || observations.length === 0
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggleDemoScenario = () => {
    if (isDemoActive) {
      setIsDemoActive(false);
      setActiveObservations(observations ?? []);
      setData(null);
    } else {
      setIsDemoActive(true);
      setActiveObservations(DEMO_BURST_OBSERVATIONS);
      setData(null);
    }
    setError(null);
  };

  const handleRunAudit = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/insights/sybil', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          observations: activeObservations,
        }),
      });

      if (!response.ok) {
        throw new Error(`Audit request failed with status: ${response.status}`);
      }

      const result = (await response.json()) as SybilCollusionResult;
      setData(result);
    } catch (err: unknown) {
      // Gracefully fallback to deterministic fixture on client error
      setData(fallbackFixture as SybilCollusionResult);
      setError(
        err instanceof Error
          ? `${err.message}. Showing deterministic fallback analysis.`
          : 'Unable to connect to service. Showing deterministic fallback analysis.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const collusionRisk = data?.collusionRisk ?? 'LOW';
  const similarityPercentage = Math.round((data?.similarityScore ?? 0) * 100);

  const getRiskBadgeClasses = (risk: 'LOW' | 'MEDIUM' | 'HIGH') => {
    switch (risk) {
      case 'HIGH':
        return 'bg-red-500/10 text-red-600 border-red-500/30';
      case 'MEDIUM':
        return 'bg-amber-500/10 text-amber-600 border-amber-500/30';
      case 'LOW':
      default:
        return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30';
    }
  };

  const getMeterColor = (score: number) => {
    if (score >= 0.75) return 'bg-red-500';
    if (score >= 0.4) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  return (
    <div
      className={`border border-[var(--rule)] bg-[var(--bg-surface)] p-6 font-mono text-[var(--ink)] shadow-sm ${className}`}
      data-testid="sybil-collusion-panel"
    >
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--rule)] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[var(--civic-blue-subtle)] text-[var(--civic-blue)] border border-[var(--civic-blue)]/20">
              AI-ASSISTIVE INTEGRITY
            </span>
            <span className="text-[11px] text-[var(--ink-soft)]">T-AI-022</span>
          </div>
          <h2 className="text-base font-bold mt-1 tracking-tight">
            Sybil &amp; Collusion Ring Auditor
          </h2>
          <p className="text-xs text-[var(--ink-soft)] mt-0.5">
            Cross-submission burst detection, answer congruence, and NLP narrative analysis.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleToggleDemoScenario}
            className="px-3 py-1.5 text-xs font-semibold border border-[var(--rule)] bg-[var(--paper-warm)] hover:bg-[var(--rule)]/60 transition-colors cursor-pointer"
            title="Toggle between demo scenario and active inputs"
          >
            {isDemoActive ? '✓ Demo Scenario Loaded' : 'Load Coordinated Burst Fixture'}
          </button>

          <button
            type="button"
            onClick={handleRunAudit}
            disabled={isLoading || activeObservations.length === 0}
            className="px-4 py-1.5 text-xs font-bold bg-[var(--ink)] text-[var(--paper)] hover:bg-[var(--ink)]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Analyzing Ring...
              </>
            ) : (
              'Run Collusion Audit'
            )}
          </button>
        </div>
      </div>

      {/* Inputs Overview */}
      <div className="mt-4 text-xs text-[var(--ink-soft)] flex items-center justify-between">
        <div>
          Evaluating <strong className="text-[var(--ink)]">{activeObservations.length}</strong> observation submissions
          {isDemoActive && ' (Coordinated Burst Demo)'}
        </div>
        {activeObservations.length === 0 && (
          <span className="text-amber-600 font-semibold">No observations to audit.</span>
        )}
      </div>

      {/* Error alert */}
      {error && (
        <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 text-amber-700 text-xs">
          <strong>Notice:</strong> {error}
        </div>
      )}

      {/* Results View */}
      {data && (
        <div className="mt-6 space-y-6">
          {/* Status & Risk Metric Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Risk Badge Card */}
            <div className="p-4 border border-[var(--rule)] bg-[var(--paper-warm)]/40 flex flex-col justify-between">
              <span className="text-[11px] text-[var(--ink-soft)] font-semibold uppercase tracking-wider">
                Assessed Collusion Risk
              </span>
              <div className="mt-2 flex items-center gap-2">
                <span
                  data-testid="collusion-risk-badge"
                  className={`px-2.5 py-1 text-xs font-bold tracking-wider uppercase border ${getRiskBadgeClasses(
                    collusionRisk
                  )}`}
                >
                  {collusionRisk} RISK
                </span>
              </div>
              <p className="text-[11px] text-[var(--ink-soft)] mt-2">
                {collusionRisk === 'HIGH'
                  ? 'High probability of coordinated manipulation or synthetic ring.'
                  : collusionRisk === 'MEDIUM'
                  ? 'Suspicious congruences detected; warrants supervisor sampling.'
                  : 'Normal variance across submissions within natural bounds.'}
              </p>
            </div>

            {/* Similarity Score Card */}
            <div className="p-4 border border-[var(--rule)] bg-[var(--paper-warm)]/40 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[var(--ink-soft)] font-semibold uppercase tracking-wider">
                  Similarity Score
                </span>
                <span className="text-sm font-bold">{similarityPercentage}%</span>
              </div>
              <div className="mt-3 w-full bg-[var(--rule)] h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${getMeterColor(data.similarityScore)}`}
                  style={{ width: `${Math.min(100, Math.max(0, similarityPercentage))}%` }}
                />
              </div>
              <p className="text-[11px] text-[var(--ink-soft)] mt-2">
                Cross-submission semantic &amp; temporal correlation metric.
              </p>
            </div>

            {/* Cluster Key & Cohort */}
            <div className="p-4 border border-[var(--rule)] bg-[var(--paper-warm)]/40 flex flex-col justify-between">
              <span className="text-[11px] text-[var(--ink-soft)] font-semibold uppercase tracking-wider">
                Cohort / Cluster Key
              </span>
              <div className="mt-2 text-xs font-bold text-[var(--ink)] truncate">
                {data.clusterKey ? (
                  <span className="bg-[var(--rule)]/60 px-2 py-0.5 rounded font-mono">
                    {data.clusterKey}
                  </span>
                ) : (
                  <span className="text-[var(--ink-soft)]">Unclustered</span>
                )}
              </div>
              <p className="text-[11px] text-[var(--ink-soft)] mt-2 truncate">
                {data.flaggedCohorts && data.flaggedCohorts.length > 0
                  ? `Cohorts: ${data.flaggedCohorts.join(', ')}`
                  : 'Zero-PII cohort isolation active.'}
              </p>
            </div>
          </div>

          {/* Narrative Explanation */}
          <div className="p-4 border border-[var(--rule)] bg-[var(--bg-canvas)]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ink-soft)] mb-1">
              Narrative Finding
            </h3>
            <p className="text-xs text-[var(--ink)] leading-relaxed">
              {data.narrative}
            </p>
          </div>

          {/* Flagged Observations & Indicators */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Specific Indicators */}
            <div className="p-4 border border-[var(--rule)] bg-[var(--paper-warm)]/30">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ink-soft)] mb-2">
                Detection Indicators ({data.reasons.length})
              </h3>
              {data.reasons.length === 0 ? (
                <p className="text-xs text-[var(--ink-soft)]">No anomalies detected.</p>
              ) : (
                <ul className="space-y-1.5 text-xs text-[var(--ink)]">
                  {data.reasons.map((reason, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-amber-500 font-bold">•</span>
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Flagged IDs */}
            <div className="p-4 border border-[var(--rule)] bg-[var(--paper-warm)]/30">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ink-soft)] mb-2">
                Flagged Observation IDs ({data.flaggedObservationIds.length})
              </h3>
              {data.flaggedObservationIds.length === 0 ? (
                <p className="text-xs text-[var(--ink-soft)]">Zero observations flagged.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                  {data.flaggedObservationIds.map((id) => (
                    <span
                      key={id}
                      className="px-2 py-0.5 text-[11px] bg-red-500/10 text-red-700 border border-red-500/20 rounded-sm font-mono"
                      title={id}
                    >
                      {id.length > 18 ? `${id.slice(0, 8)}...${id.slice(-6)}` : id}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
