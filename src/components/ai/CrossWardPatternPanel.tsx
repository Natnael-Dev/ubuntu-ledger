'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { CrossWardPatternResult, FlaggedPattern } from '@/lib/ai/types';

export interface CrossWardPatternPanelProps {
  contractorName?: string;
  initialData?: CrossWardPatternResult;
  className?: string;
}

const PRESET_CONTRACTORS = [
  'Apex Rift Engineering Ltd',
  'AfroTech Infra',
  'Kapsabet Civil Works Ltd',
  'Highland Boreholes Consortium',
];

function formatCurrencyMinor(minor: number): string {
  const major = minor / 100;
  return `KES ${major.toLocaleString('en-KE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function getSeverityBadgeClass(severity: FlaggedPattern['severity']): string {
  switch (severity) {
    case 'HIGH':
      return 'bg-rose-100 text-rose-800 border-rose-300';
    case 'MEDIUM':
      return 'bg-amber-100 text-amber-800 border-amber-300';
    case 'LOW':
    default:
      return 'bg-sky-100 text-sky-800 border-sky-300';
  }
}

export function CrossWardPatternPanel({
  contractorName: initialContractor = 'Apex Rift Engineering Ltd',
  initialData,
  className = '',
}: CrossWardPatternPanelProps) {
  const [contractor, setContractor] = useState(
    initialData?.contractorName ?? initialContractor
  );
  const [searchInput, setSearchInput] = useState(
    initialData?.contractorName ?? initialContractor
  );
  const [data, setData] = useState<CrossWardPatternResult | null>(
    initialData ?? null
  );
  const [isLoading, setIsLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);

  const fetchPatterns = useCallback(async (targetContractor: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/insights/cross-ward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractorName: targetContractor }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch patterns: HTTP ${response.status}`);
      }

      const result: CrossWardPatternResult = await response.json();
      setData(result);
      setContractor(targetContractor);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Unknown error fetching pattern data'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialData) {
      void fetchPatterns(initialContractor);
    }
  }, [fetchPatterns, initialContractor, initialData]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim().length > 0) {
      void fetchPatterns(searchInput.trim());
    }
  };

  const handleSelectPreset = (name: string) => {
    setSearchInput(name);
    void fetchPatterns(name);
  };

  return (
    <div
      data-testid="cross-ward-pattern-panel"
      className={`max-w-5xl mx-auto font-sans bg-white text-slate-900 rounded-2xl border border-slate-200/90 shadow-lg shadow-slate-200/40 overflow-hidden ${className}`}
    >
      {/* Top Header */}
      <div className="border-b border-slate-100 p-6 sm:p-7 bg-slate-50/80">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold tracking-wider uppercase bg-blue-100 text-blue-800 border border-blue-200">
                Civic Intelligence
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                T-AI-023 · Assistive Model
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Cross-Ward Contractor Patterns
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl">
              Monitors multi-ward project concentration, concurrent capacity over-allocation, and historical durability probation failure trends without compromising citizen privacy.
            </p>
          </div>

          <div className="font-mono text-xs text-right text-slate-500 bg-white px-3 py-2 rounded-lg border border-slate-200">
            <span className="block text-[10px] uppercase font-bold text-slate-400">
              Isolation Boundary
            </span>
            <span className="font-bold text-slate-700">INV-01 Assistive Only</span>
          </div>
        </div>

        {/* Search & Preset Contractor Selector */}
        <div className="mt-6 pt-5 border-t border-slate-200/80 space-y-3">
          <form
            onSubmit={handleSearchSubmit}
            className="flex flex-col sm:flex-row gap-2"
          >
            <div className="relative flex-1">
              <input
                type="text"
                data-testid="contractor-search-input"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search contractor name (e.g. Apex Rift Engineering Ltd)..."
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-sans"
              />
            </div>
            <button
              type="submit"
              data-testid="contractor-search-button"
              disabled={isLoading}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium text-sm rounded-lg transition-colors flex items-center justify-center gap-2 shrink-0 shadow-sm"
            >
              {isLoading ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-1 h-4 w-4 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Analyzing...
                </>
              ) : (
                'Run Analysis'
              )}
            </button>
          </form>

          {/* Quick preset chips */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-500 font-medium mr-1">Presets:</span>
            {PRESET_CONTRACTORS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  contractor === preset
                    ? 'bg-blue-50 text-blue-700 border-blue-300 font-semibold'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Body */}
      <div className="p-6 sm:p-7 space-y-6">
        {/* Error State */}
        {error && (
          <div
            data-testid="error-banner"
            className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm flex items-start justify-between"
          >
            <div>
              <p className="font-semibold">Analysis Failed</p>
              <p className="mt-0.5 text-xs text-rose-700">{error}</p>
            </div>
            <button
              onClick={() => void fetchPatterns(contractor)}
              className="text-xs bg-rose-100 hover:bg-rose-200 text-rose-900 font-semibold px-2.5 py-1 rounded border border-rose-300 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading Skeleton */}
        {isLoading && !data && (
          <div data-testid="loading-state" className="space-y-4 animate-pulse">
            <div className="h-16 bg-slate-100 rounded-xl" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="h-24 bg-slate-100 rounded-xl" />
              <div className="h-24 bg-slate-100 rounded-xl" />
              <div className="h-24 bg-slate-100 rounded-xl" />
            </div>
            <div className="h-32 bg-slate-100 rounded-xl" />
          </div>
        )}

        {/* Results Container */}
        {data && (
          <div className="space-y-6">
            {/* Anomaly Detection Banner */}
            <div
              data-testid="anomaly-banner"
              className={`p-4 sm:p-5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all ${
                data.anomalyDetected
                  ? 'bg-rose-50/90 border-rose-300 text-rose-950 shadow-sm shadow-rose-100'
                  : 'bg-emerald-50/90 border-emerald-300 text-emerald-950 shadow-sm shadow-emerald-100'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                    data.anomalyDetected
                      ? 'bg-rose-600 text-white'
                      : 'bg-emerald-600 text-white'
                  }`}
                >
                  {data.anomalyDetected ? (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      data-testid="anomaly-status-badge"
                      className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                        data.anomalyDetected
                          ? 'bg-rose-100 text-rose-800 border-rose-200'
                          : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      }`}
                    >
                      {data.anomalyDetected
                        ? 'Anomaly Detected'
                        : 'Within Thresholds'}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      Contractor: {data.contractorName}
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold mt-1 text-slate-900">
                    {data.anomalyDetected
                      ? 'Cross-Ward Allocation Anomaly Flagged'
                      : 'Standard Multi-Ward Distribution Profile'}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                    {data.anomalyDetected
                      ? 'Contractor displays elevated concurrent contract commitments or probation failure tendencies across neighboring wards.'
                      : 'Contractor workload and project distribution conform to county operational safety limits.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Concentration Score */}
              <div
                data-testid="metric-concentration"
                className="p-5 bg-slate-50 border border-slate-200 rounded-xl"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wider">
                    Concentration Score
                  </span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded ${
                      data.concentrationScore >= 0.7
                        ? 'bg-rose-100 text-rose-800'
                        : data.concentrationScore >= 0.4
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {data.concentrationScore >= 0.7
                      ? 'HIGH RISK'
                      : data.concentrationScore >= 0.4
                      ? 'MODERATE'
                      : 'LOW RISK'}
                  </span>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span
                    data-testid="concentration-score-value"
                    className="text-3xl font-extrabold font-mono text-slate-900"
                  >
                    {(data.concentrationScore * 100).toFixed(0)}%
                  </span>
                  <span className="text-xs text-slate-500 font-mono">
                    ({data.concentrationScore.toFixed(2)})
                  </span>
                </div>
                {/* Progress Bar */}
                <div className="w-full bg-slate-200 h-2 rounded-full mt-3 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      data.concentrationScore >= 0.7
                        ? 'bg-rose-500'
                        : data.concentrationScore >= 0.4
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{
                      width: `${Math.min(
                        Math.max(data.concentrationScore * 100, 0),
                        100
                      )}%`,
                    }}
                  />
                </div>
              </div>

              {/* Active Projects Count */}
              <div
                data-testid="metric-active-projects"
                className="p-5 bg-slate-50 border border-slate-200 rounded-xl"
              >
                <span className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wider block">
                  Active Projects
                </span>
                <div className="mt-3 flex items-baseline gap-2">
                  <span
                    data-testid="active-projects-value"
                    className="text-3xl font-extrabold font-mono text-slate-900"
                  >
                    {data.activeProjectsCount}
                  </span>
                  <span className="text-xs text-slate-500 font-mono">
                    concurrent
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-2">
                  Spanning {data.wardsInvolved.length} administrative ward
                  {data.wardsInvolved.length === 1 ? '' : 's'}.
                </p>
              </div>

              {/* Total Committed Budget */}
              <div
                data-testid="metric-total-budget"
                className="p-5 bg-slate-50 border border-slate-200 rounded-xl"
              >
                <span className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wider block">
                  Committed Public Funds
                </span>
                <div className="mt-3">
                  <span
                    data-testid="total-budget-value"
                    className="text-2xl sm:text-3xl font-extrabold font-mono text-slate-900 block truncate"
                  >
                    {formatCurrencyMinor(data.totalCommittedBudgetMinor)}
                  </span>
                </div>
                <span className="text-[11px] font-mono text-slate-400 mt-1 block">
                  Minor units: {data.totalCommittedBudgetMinor.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Wards Involved Tag Chips */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wider block mb-2">
                Active Ward Footprint ({data.wardsInvolved.length})
              </span>
              <div className="flex flex-wrap gap-2">
                {data.wardsInvolved.map((wardId) => (
                  <span
                    key={wardId}
                    data-testid="ward-tag"
                    className="px-2.5 py-1 text-xs font-mono font-semibold bg-white text-slate-700 border border-slate-300 rounded-md shadow-2xs"
                  >
                    {wardId}
                  </span>
                ))}
              </div>
            </div>

            {/* Flagged Patterns List */}
            <div
              data-testid="flagged-patterns-section"
              className="border border-slate-200 rounded-xl overflow-hidden"
            >
              <div className="px-5 py-3.5 bg-slate-100/90 border-b border-slate-200 flex items-center justify-between">
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700">
                  Flagged Risk Patterns ({data.flaggedPatterns.length})
                </h4>
                <span className="text-[11px] font-mono text-slate-500">
                  Pattern Classification
                </span>
              </div>

              {data.flaggedPatterns.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-500 font-sans">
                  No anomalous patterns detected for this contractor.
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {data.flaggedPatterns.map((pattern, idx) => (
                    <div
                      key={`${pattern.type}-${idx}`}
                      data-testid="flagged-pattern-item"
                      className="p-5 hover:bg-slate-50/60 transition-colors"
                    >
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span
                          className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${getSeverityBadgeClass(
                            pattern.severity
                          )}`}
                        >
                          {pattern.severity} SEVERITY
                        </span>
                        <span className="font-mono text-xs font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                          {pattern.type}
                        </span>
                      </div>
                      <p className="text-sm text-slate-800 font-medium">
                        {pattern.description}
                      </p>
                      {pattern.wardIds && pattern.wardIds.length > 0 && (
                        <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] font-mono text-slate-400">
                            Implicated Wards:
                          </span>
                          {pattern.wardIds.map((wid) => (
                            <span
                              key={wid}
                              className="text-[11px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200"
                            >
                              {wid}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actionable Civic Recommendation Advisory Box */}
            <div
              data-testid="recommendation-box"
              className="p-5 sm:p-6 bg-blue-50/70 border border-blue-200 rounded-xl text-blue-950"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-600 text-white rounded-lg shrink-0 mt-0.5">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-700 block mb-1">
                    Actionable Civic Oversight Recommendation
                  </span>
                  <h4 className="text-base font-bold text-slate-900 mb-1.5">
                    Ward Committee Advisory
                  </h4>
                  <p
                    data-testid="recommendation-text"
                    className="text-sm sm:text-base text-slate-800 leading-relaxed"
                  >
                    {data.recommendation}
                  </p>
                  <div className="mt-3 pt-3 border-t border-blue-200/80 flex items-center justify-between text-[11px] font-mono text-blue-700">
                    <span>
                      Compliance: INV-01 Assistive AI. Requires human signoff.
                    </span>
                    <span>Confidence: Calibrated</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
export default CrossWardPatternPanel;
