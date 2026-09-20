'use client';

// VoiceEvidenceRecorder Component (T-AI-021)
// Authoritative sources:
// - docs/specs/06-voice-and-ussd.md §7
// - docs/specs/07-trust-and-security.md §3, §5
// - docs/specs/08-ui-ux-design.md §5
//
// Invariants:
// 1. Strictly assistive: outputs require human inspector confirmation before ledger commit.
// 2. Resilient input: supports live Web Audio recording, manual text transcript, or demo presets.
// 3. Accessibility: ARIA status regions, clear high-contrast states, and keyboard navigable controls.

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { VoiceToEvidenceResult } from '@/lib/ai/types';

export interface VoiceEvidenceRecorderProps {
  taskId?: string;
  onObservationExtracted?: (result: VoiceToEvidenceResult) => void;
  className?: string;
}

type TabMode = 'record' | 'text' | 'sample';
type RecordingStatus = 'idle' | 'recording' | 'processing' | 'success' | 'error';

const SAMPLE_VOICE_NOTES = [
  {
    label: 'Borehole Handpump (Partial Repair)',
    text: 'Borehole pump broken: handle repaired yesterday but no water flows when pumped for 30 seconds. Contractor sign is posted on the tree.',
  },
  {
    label: 'Drainage Culvert (Completed)',
    text: 'Culvert drainage work inspection: concrete headwalls are cured and structurally solid, water channel is clear, project board is visible.',
  },
  {
    label: 'Health Wing Solar (Critical Outage)',
    text: 'Solar battery array at maternity clinic failed completely during heavy rain. Panels exist on roof but inverter emits error code and lights are dark.',
  },
];

const QUESTION_DESCRIPTIONS: Record<string, string> = {
  q1: 'Physical asset present and installed',
  q2: 'Asset operational and delivering public service',
  q3: 'Official project signage / identification visible',
};

export function VoiceEvidenceRecorder({
  taskId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  onObservationExtracted,
  className = '',
}: VoiceEvidenceRecorderProps) {
  const [activeTab, setActiveTab] = useState<TabMode>('record');
  const [status, setStatus] = useState<RecordingStatus>('idle');
  const [duration, setDuration] = useState<number>(0);
  const [textInput, setTextInput] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<VoiceToEvidenceResult | null>(null);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clear timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const handleSendToApi = useCallback(
    async (payload: { audioBase64?: string; textTranscript?: string }) => {
      setStatus('processing');
      setErrorMessage(null);

      try {
        const response = await fetch('/api/ai/voice-to-evidence', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...payload,
            taskId,
          }),
        });

        if (!response.ok) {
          throw new Error(`API returned HTTP ${response.status}`);
        }

        const data: VoiceToEvidenceResult = await response.json();
        setResult(data);
        setAnswers(data.answers || {});
        setStatus('success');
        onObservationExtracted?.(data);
      } catch (err) {
        setStatus('error');
        const message = err instanceof Error ? err.message : 'Failed to process voice evidence';
        setErrorMessage(message);
      }
    },
    [taskId, onObservationExtracted]
  );

  const startRecording = async () => {
    setErrorMessage(null);
    setResult(null);

    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setErrorMessage('Microphone recording is not supported in this browser. Please use text fallback.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop audio tracks
        stream.getTracks().forEach((track) => track.stop());

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (audioBlob.size === 0) {
          setStatus('idle');
          return;
        }

        // Convert blob to base64
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64Data = (reader.result as string)?.split(',')[1] || '';
          void handleSendToApi({ audioBase64: base64Data });
        };
      };

      mediaRecorder.start();
      setStatus('recording');
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      const errorMsg =
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'Microphone permission was denied. You can still use the text transcript or demo samples.'
          : 'Unable to initialize audio recording hardware.';
      setErrorMessage(errorMsg);
      setStatus('idle');
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    void handleSendToApi({ textTranscript: textInput.trim() });
  };

  const handleSampleSelect = (sampleText: string) => {
    setTextInput(sampleText);
    void handleSendToApi({ textTranscript: sampleText });
  };

  const toggleAnswer = (key: string) => {
    setAnswers((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getUrgencyBadgeClasses = (urgency: string) => {
    switch (urgency) {
      case 'CRITICAL':
        return 'bg-red-50 text-red-800 border-red-300 font-bold';
      case 'HIGH':
        return 'bg-amber-50 text-amber-800 border-amber-300 font-semibold';
      case 'MEDIUM':
        return 'bg-blue-50 text-blue-800 border-blue-300 font-medium';
      case 'LOW':
      default:
        return 'bg-emerald-50 text-emerald-800 border-emerald-300 font-medium';
    }
  };

  return (
    <div
      className={`border border-[var(--rule,#cbd5e1)] bg-[var(--paper,#ffffff)] p-5 font-sans text-[var(--ink,#0f172a)] shadow-sm ${className}`}
      aria-label="Voice-to-Evidence AI Assistive Recorder"
    >
      {/* Component Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--rule,#e2e8f0)] pb-3 mb-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-mono font-semibold uppercase tracking-wider bg-[var(--paper-warm,#f8fafc)] border border-[var(--rule,#cbd5e1)] text-[var(--ink-soft,#475569)]">
            <span className="w-2 h-2 rounded-full bg-blue-600 inline-block"></span>
            T-AI-021 Voice-to-Evidence
          </div>
          <h2 className="text-base font-semibold text-[var(--ink,#0f172a)] mt-1">
            Citizen Voice Evidence Capture
          </h2>
        </div>
        <div className="text-xs font-mono text-[var(--ink-soft,#64748b)]">
          Task: <span className="font-semibold text-[var(--ink,#0f172a)]">{taskId.slice(0, 8)}...</span>
        </div>
      </div>

      {/* Input Mode Switcher Tabs */}
      <div className="flex border-b border-[var(--rule,#e2e8f0)] mb-4" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'record'}
          onClick={() => setActiveTab('record')}
          className={`px-4 py-2 text-xs font-mono font-semibold transition-colors cursor-pointer border-b-2 ${
            activeTab === 'record'
              ? 'border-[var(--ink,#0f172a)] text-[var(--ink,#0f172a)] bg-[var(--paper-warm,#f8fafc)]'
              : 'border-transparent text-[var(--ink-soft,#64748b)] hover:text-[var(--ink,#0f172a)]'
          }`}
        >
          🎙️ Live Voice Recording
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'sample'}
          onClick={() => setActiveTab('sample')}
          className={`px-4 py-2 text-xs font-mono font-semibold transition-colors cursor-pointer border-b-2 ${
            activeTab === 'sample'
              ? 'border-[var(--ink,#0f172a)] text-[var(--ink,#0f172a)] bg-[var(--paper-warm,#f8fafc)]'
              : 'border-transparent text-[var(--ink-soft,#64748b)] hover:text-[var(--ink,#0f172a)]'
          }`}
        >
          ⚡ Demo Voice Presets
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'text'}
          onClick={() => setActiveTab('text')}
          className={`px-4 py-2 text-xs font-mono font-semibold transition-colors cursor-pointer border-b-2 ${
            activeTab === 'text'
              ? 'border-[var(--ink,#0f172a)] text-[var(--ink,#0f172a)] bg-[var(--paper-warm,#f8fafc)]'
              : 'border-transparent text-[var(--ink-soft,#64748b)] hover:text-[var(--ink,#0f172a)]'
          }`}
        >
          ✍️ Transcript Fallback
        </button>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div
          role="alert"
          className="mb-4 p-3 bg-red-50 border border-red-200 text-xs font-mono text-red-800 flex items-start gap-2"
        >
          <span className="font-bold">NOTICE:</span>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Tab 1: Live Voice Recording */}
      {activeTab === 'record' && (
        <div className="p-4 bg-[var(--paper-warm,#f8fafc)] border border-[var(--rule,#e2e8f0)] rounded-sm mb-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {status === 'recording' ? (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-mono font-semibold rounded-sm shadow-sm flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse"></span>
                  Stop Recording ({formatTimer(duration)})
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={status === 'processing'}
                  className="px-4 py-2.5 bg-[var(--ink,#0f172a)] hover:bg-[var(--ink,#0f172a)]/90 disabled:opacity-50 text-white text-xs font-mono font-semibold rounded-sm shadow-sm flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                  Record Spoken Observation
                </button>
              )}

              {/* Status Indicator */}
              <div className="text-xs font-mono text-[var(--ink-soft,#64748b)]">
                {status === 'recording' && (
                  <span className="text-red-700 font-semibold flex items-center gap-1">
                    ● Recording citizen audio...
                  </span>
                )}
                {status === 'processing' && (
                  <span className="text-blue-700 font-semibold flex items-center gap-1 animate-pulse">
                    ⚙ Extracting structured evidence via Gemini 1.5 Flash...
                  </span>
                )}
                {status === 'idle' && <span>Ready to capture spoken report.</span>}
                {status === 'success' && <span className="text-emerald-700 font-semibold">✓ Observation extracted</span>}
              </div>
            </div>

            <div className="text-[11px] font-mono text-[var(--ink-soft,#64748b)] text-right">
              2000ms AbortSignal · Zero PII Enforced
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Demo Voice Presets */}
      {activeTab === 'sample' && (
        <div className="mb-4">
          <p className="text-xs text-[var(--ink-soft,#64748b)] mb-2 font-mono">
            Select a verified civic field report sample to trigger deterministic extraction:
          </p>
          <div className="grid grid-cols-1 gap-2">
            {SAMPLE_VOICE_NOTES.map((sample, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSampleSelect(sample.text)}
                disabled={status === 'processing'}
                className="text-left p-3 border border-[var(--rule,#cbd5e1)] hover:border-[var(--ink,#0f172a)] hover:bg-[var(--paper-warm,#f8fafc)] transition-all rounded-sm cursor-pointer disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--ink,#0f172a)] font-mono">
                    {sample.label}
                  </span>
                  <span className="text-[10px] font-mono uppercase text-blue-700 bg-blue-50 px-1.5 py-0.5 border border-blue-200">
                    Run Analysis →
                  </span>
                </div>
                <p className="text-xs text-[var(--ink-soft,#475569)] mt-1 italic">
                  "{sample.text}"
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Transcript Fallback */}
      {activeTab === 'text' && (
        <form onSubmit={handleTextSubmit} className="mb-4">
          <label htmlFor="voice-transcript-input" className="block text-xs font-mono font-semibold mb-1 text-[var(--ink,#0f172a)]">
            Spoken Transcript / IVR Text:
          </label>
          <textarea
            id="voice-transcript-input"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="e.g. Borehole pump handle was repaired yesterday but no water flows when pumped..."
            rows={3}
            className="w-full p-2.5 text-xs font-mono border border-[var(--rule,#cbd5e1)] bg-[var(--paper,#ffffff)] text-[var(--ink,#0f172a)] focus:outline-none focus:ring-1 focus:ring-[var(--ink,#0f172a)]"
          />
          <div className="flex justify-end mt-2">
            <button
              type="submit"
              disabled={status === 'processing' || !textInput.trim()}
              className="px-4 py-2 bg-[var(--ink,#0f172a)] text-white text-xs font-mono font-semibold hover:bg-[var(--ink,#0f172a)]/90 disabled:opacity-50 cursor-pointer transition-colors"
            >
              {status === 'processing' ? 'Processing...' : 'Analyze Spoken Transcript'}
            </button>
          </div>
        </form>
      )}

      {/* Extracted Evidence Output Card */}
      {result && (
        <div
          role="status"
          aria-live="polite"
          className="border border-[var(--rule,#cbd5e1)] bg-[var(--paper-warm,#f8fafc)] p-4 rounded-sm mt-4"
        >
          {/* Metadata Badges Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--rule,#e2e8f0)] pb-2 mb-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`px-2 py-0.5 text-xs font-mono border uppercase tracking-wider ${getUrgencyBadgeClasses(
                  result.urgency
                )}`}
              >
                Urgency: {result.urgency}
              </span>
              <span className="px-2 py-0.5 text-xs font-mono border border-[var(--rule,#cbd5e1)] bg-white text-[var(--ink-soft,#475569)]">
                Lang: <strong className="uppercase">{result.detectedLanguage}</strong>
              </span>
              <span className="px-2 py-0.5 text-xs font-mono border border-[var(--rule,#cbd5e1)] bg-white text-[var(--ink-soft,#475569)]">
                Confidence: {Math.round(result.confidence * 100)}%
              </span>
            </div>

            <span className="text-[10px] font-mono text-[var(--ink-soft,#64748b)] bg-slate-100 px-2 py-0.5 border border-slate-200">
              X-AI-Assistive-Only: true
            </span>
          </div>

          {/* Factual Summary */}
          <div className="mb-3">
            <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--ink-soft,#64748b)] font-semibold mb-1">
              Factual Synthesis Summary
            </div>
            <p className="text-xs text-[var(--ink,#0f172a)] leading-relaxed bg-white p-2.5 border border-[var(--rule,#e2e8f0)] font-sans">
              {result.summary}
            </p>
          </div>

          {/* Spoken Transcription */}
          {result.transcription && (
            <div className="mb-3">
              <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--ink-soft,#64748b)] font-semibold mb-1">
                Citizen Transcript
              </div>
              <p className="text-xs text-[var(--ink-soft,#475569)] italic bg-white p-2.5 border border-[var(--rule,#e2e8f0)] font-mono">
                "{result.transcription}"
              </p>
            </div>
          )}

          {/* Extracted Proof Task Answers */}
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--ink-soft,#64748b)] font-semibold mb-2">
              Extracted Verification Answers (Proof Tasks)
            </div>

            <div className="space-y-2">
              {Object.keys(answers).length > 0 ? (
                Object.entries(answers).map(([key, value]) => {
                  const description = QUESTION_DESCRIPTIONS[key] || `Observation condition ${key}`;
                  return (
                    <label
                      key={key}
                      className="flex items-center justify-between p-2 bg-white border border-[var(--rule,#e2e8f0)] hover:bg-[var(--paper-warm,#f8fafc)] cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={value}
                          onChange={() => toggleAnswer(key)}
                          className="h-4 w-4 text-[var(--ink,#0f172a)] border-[var(--rule,#cbd5e1)] focus:ring-0 cursor-pointer"
                        />
                        <span className="font-mono text-xs font-semibold text-[var(--ink,#0f172a)]">
                          {key.toUpperCase()}:
                        </span>
                        <span className="text-xs text-[var(--ink-soft,#334155)]">
                          {description}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 border ${
                          value
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold'
                            : 'bg-rose-50 text-rose-800 border-rose-300 font-semibold'
                        }`}
                      >
                        {value ? 'VERIFIED (TRUE)' : 'UNMET (FALSE)'}
                      </span>
                    </label>
                  );
                })
              ) : (
                <div className="text-xs font-mono text-[var(--ink-soft,#64748b)] italic">
                  No boolean questions extracted.
                </div>
              )}
            </div>
          </div>

          {/* Assistive Governance Note */}
          <div className="mt-4 pt-3 border-t border-[var(--rule,#e2e8f0)] text-[10px] font-mono text-[var(--ink-soft,#64748b)] flex items-center justify-between">
            <span>
              ℹ️ Assistive AI Output: Verification answers require human confirmation prior to ledger publication.
            </span>
            <span className="font-bold">INV-01 Protected</span>
          </div>
        </div>
      )}
    </div>
  );
}
export default VoiceEvidenceRecorder;
