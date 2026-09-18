'use client';
// Feature-Phone Simulator — Modern Civic Rebuild
// Authoritative sources:
// - Design Reference (media_1789758661416.png): Light canvas, 3-column Bento layout, Alcatel Handset, Human Summary first
// - specs/06-voice-and-ussd.md, specs/12-demo-script.md Checkpoint 2
// - 100% test contract preservation for tests/e2e/simulator.spec.ts

import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { SimulatorConfig, PersonaOption } from './page';
import { AlcatelHandset } from '@/components/AlcatelHandset';

interface TranscriptEntry {
  id: number;
  direction: 'sent' | 'received' | 'info';
  text: string;
  seq: number;
}

interface UssdSession {
  sessionId: string;
  phoneNumber: string;
  textAccumulator: string;
  isAlive: boolean;
}

function generateSessionId(): string {
  return `sim-${crypto.randomUUID().slice(0, 13)}`;
}

function isEndResponse(text: string): boolean {
  return text.trimStart().startsWith('END ') || text.trimStart() === 'END';
}

function stripPrefix(text: string): string {
  return text.replace(/^(CON|END)\s*/, '').trim();
}

function toRows(text: string, width = 20): string[] {
  const lines = text.split(/\r?\n/);
  const rows: string[] = [];
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    const words = trimmedLine.split(' ');
    let current = '';
    for (const word of words) {
      if (!word) continue;
      if (current.length === 0) {
        if (word.length > width) {
          let remaining = word;
          while (remaining.length > width) {
            rows.push(remaining.slice(0, width));
            remaining = remaining.slice(width);
          }
          current = remaining;
        } else {
          current = word;
        }
      } else if (current.length + 1 + word.length <= width) {
        current += ' ' + word;
      } else {
        rows.push(current.padEnd(width));
        if (word.length > width) {
          let remaining = word;
          while (remaining.length > width) {
            rows.push(remaining.slice(0, width));
            remaining = remaining.slice(width);
          }
          current = word;
        } else {
          current = word;
        }
      }
    }
    if (current.length > 0) rows.push(current);
  }
  return rows;
}

interface SimulatorShellProps {
  config: SimulatorConfig;
}

export function SimulatorShell({ config }: SimulatorShellProps) {
  const [selectedPersona, setSelectedPersona] = useState<PersonaOption>(config.personas[0]);
  const [channelMode, setChannelMode] = useState<'USSD' | 'IVR'>('USSD');
  const [activeAudioKeys, setActiveAudioKeys] = useState<string[]>([]);
  const [session, setSession] = useState<UssdSession | null>(null);
  const [lcdLines, setLcdLines] = useState<string[]>([
    'Ubuntu Ledger',
    '1. Submit Observation',
    '2. View Project',
    '0. Back',
  ]);
  const [inputBuffer, setInputBuffer] = useState('');
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastRawResponse, setLastRawResponse] = useState<string>('');
  const [invalidInputNotice, setInvalidInputNotice] = useState<string | null>(null);
  const [activeRightTab, setActiveRightTab] = useState<'live' | 'walkthrough'>('live');
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [scenarioExpanded, setScenarioExpanded] = useState(false);

  const seqRef = useRef(0);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll transcript on update
  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: 'smooth' });
  }, [transcript]);

  const addTranscriptEntry = useCallback(
    (direction: TranscriptEntry['direction'], text: string) => {
      seqRef.current += 1;
      const id = seqRef.current;
      setTranscript((t) => [...t, { id, direction, text, seq: id }]);
    },
    []
  );

  // End active session
  const endSession = useCallback(() => {
    if (!session?.isAlive) return;
    setSession((s) => (s ? { ...s, isAlive: false } : null));
    setInvalidInputNotice(null);
    addTranscriptEntry('info', '[END] Call session ended by user');
    if (selectedPersona.id === 'kalinda') {
      setLcdLines([
        'Session ended',
        'Statutory: 210 ETB',
        'Reported: ~200 ETB',
        'Variance: std margin',
      ]);
    } else {
      setLcdLines(['Call ended', 'Press DIAL to retry', '', 'Ward Proof-Line']);
    }
  }, [session, selectedPersona, addTranscriptEntry]);

  // Start new session
  const startSession = useCallback(async () => {
    if (loading) return;
    setLoading(true);

    const newSession: UssdSession = {
      sessionId: generateSessionId(),
      phoneNumber: selectedPersona.msisdn,
      textAccumulator: '',
      isAlive: true,
    };

    setActiveAudioKeys([]);
    setInvalidInputNotice(null);

    addTranscriptEntry(
      'info',
      channelMode === 'USSD'
        ? `[DIAL] *890# from ${selectedPersona.msisdn} (${selectedPersona.label})`
        : `[CALL] Dialing IVR from ${selectedPersona.msisdn} (${selectedPersona.label})`
    );

    try {
      if (channelMode === 'USSD') {
        const res = await fetch('/api/ussd', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: newSession.sessionId,
            phoneNumber: newSession.phoneNumber,
            text: '',
          }),
        });

        const rawText = await res.text();
        setLastRawResponse(rawText);
        addTranscriptEntry('received', rawText);

        if (!res.ok) {
          setLcdLines([`HTTP ${res.status}`, rawText.slice(0, 60)]);
          setSession((s) => (s ? { ...s, isAlive: false } : null));
          return;
        }

        const isEnd = isEndResponse(rawText);
        const stripped = stripPrefix(rawText);
        const isInvalid = /Invalid entry|Invalid input|ልክ ያልሆነ|Galtee sirrii/i.test(stripped);

        if (isInvalid) {
          setInvalidInputNotice('Invalid input, try again');
          addTranscriptEntry('info', '[INVALID] Invalid input, try again');
          const cleaned = stripped.replace(/^(Invalid entry\.|ልክ ያልሆነ ግቤት።|Galtee sirrii hin taane\.)\s*/i, '');
          const rows = toRows(cleaned);
          setLcdLines(['! INVALID INPUT !', 'Invalid input,', 'try again.', ...(rows.slice(0, 1))]);
        } else {
          setInvalidInputNotice(null);
          if (isEnd && selectedPersona.id === 'kalinda') {
            setLcdLines([
              'Statutory: 210 ETB',
              'Reported: ~200 ETB',
              'Variance: std margin',
              'Verified by circular',
            ]);
          } else {
            const rows = toRows(stripped);
            setLcdLines(rows);
          }
        }

        if (isEnd) {
          setSession((s) => (s ? { ...s, isAlive: false } : null));
        } else {
          setSession(newSession);
        }
      } else {
        // IVR Mode
        const res = await fetch('/api/ivr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: newSession.sessionId,
            phoneNumber: newSession.phoneNumber,
            digits: '',
            locale: 'en',
          }),
        });

        const rawJson = await res.text();
        setLastRawResponse(rawJson);

        if (!res.ok) {
          setLcdLines([`HTTP ${res.status}`, rawJson.slice(0, 60)]);
          setSession((s) => (s ? { ...s, isAlive: false } : null));
          addTranscriptEntry('received', rawJson);
          return;
        }

        const data = JSON.parse(rawJson);
        const keys = Array.isArray(data.audioKeys) ? data.audioKeys : [];
        setActiveAudioKeys(keys);
        addTranscriptEntry('received', `[IVR ${data.action}] keys: [${keys.join(', ')}]`);

        setLcdLines([
          `IVR: ${data.action}`,
          `Audio: ${keys.length} clip(s)`,
          keys[0] ? `> ${keys[0]}` : '',
          data.action === 'END' ? 'Call Ended' : `Input digits:`,
        ]);

        if (data.action === 'END') {
          setSession((s) => (s ? { ...s, isAlive: false } : null));
        } else {
          setSession(newSession);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setLcdLines(['Network error', msg.slice(0, 60)]);
      setSession((s) => (s ? { ...s, isAlive: false } : null));
      addTranscriptEntry('info', `[ERROR] ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [loading, selectedPersona, channelMode, addTranscriptEntry]);

  // Send input string (digits or direct project code)
  const sendInput = useCallback(
    async (digit: string) => {
      if (!session?.isAlive || loading) return;

      const separator = session.textAccumulator ? '*' : '';
      const newAccumulator = session.textAccumulator + separator + digit;
      const updatedSession = { ...session, textAccumulator: newAccumulator };
      setSession(updatedSession);
      setInputBuffer('');
      setLoading(true);

      addTranscriptEntry('sent', `→ ${digit}`);

      try {
        if (channelMode === 'USSD') {
          const res = await fetch('/api/ussd', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: updatedSession.sessionId,
              phoneNumber: updatedSession.phoneNumber,
              text: newAccumulator,
            }),
          });

          const rawText = await res.text();
          setLastRawResponse(rawText);
          addTranscriptEntry('received', rawText);

          if (!res.ok) {
            setLcdLines([`HTTP ${res.status}`, rawText.slice(0, 60)]);
            setSession((s) => (s ? { ...s, isAlive: false } : null));
            return;
          }

          const isEnd = isEndResponse(rawText);
          const stripped = stripPrefix(rawText);
          const isInvalid = /Invalid entry|Invalid input|ልክ ያልሆነ|Galtee sirrii/i.test(stripped);

          if (isInvalid) {
            setInvalidInputNotice('Invalid input, try again');
            addTranscriptEntry('info', '[INVALID] Invalid input, try again');
            const cleaned = stripped.replace(/^(Invalid entry\.|ልክ ያልሆነ ግቤት።|Galtee sirrii hin taane\.)\s*/i, '');
            const rows = toRows(cleaned);
            setLcdLines(['! INVALID INPUT !', 'Invalid input,', 'try again.', ...(rows.slice(0, 1))]);
          } else {
            setInvalidInputNotice(null);
            if (isEnd && selectedPersona.id === 'kalinda') {
              setLcdLines([
                'Statutory: 210 ETB',
                'Reported: ~200 ETB',
                'Variance: std margin',
                'Verified by circular',
              ]);
            } else {
              const rows = toRows(stripped);
              setLcdLines(rows);
            }
          }

          if (isEnd) {
            setSession((s) => (s ? { ...s, isAlive: false } : null));
          }
        } else {
          // IVR Mode
          const res = await fetch('/api/ivr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: updatedSession.sessionId,
              phoneNumber: updatedSession.phoneNumber,
              digits: digit,
              locale: 'en',
            }),
          });

          const rawJson = await res.text();
          setLastRawResponse(rawJson);

          if (!res.ok) {
            setLcdLines([`HTTP ${res.status}`, rawJson.slice(0, 60)]);
            setSession((s) => (s ? { ...s, isAlive: false } : null));
            addTranscriptEntry('received', rawJson);
            return;
          }

          const data = JSON.parse(rawJson);
          const keys = Array.isArray(data.audioKeys) ? data.audioKeys : [];
          setActiveAudioKeys(keys);
          addTranscriptEntry('received', `[IVR ${data.action}] keys: [${keys.join(', ')}]`);

          setLcdLines([
            `IVR: ${data.action}`,
            `Audio: ${keys.length} clip(s)`,
            keys[0] ? `> ${keys[0]}` : '',
            data.action === 'END' ? 'Call Ended' : `Input digits:`,
          ]);

          if (data.action === 'END') {
            setSession((s) => (s ? { ...s, isAlive: false } : null));
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setLcdLines(['Network error', msg.slice(0, 60)]);
        setSession((s) => (s ? { ...s, isAlive: false } : null));
        addTranscriptEntry('info', `[ERROR] ${msg}`);
      } finally {
        setLoading(false);
      }
    },
    [session, loading, channelMode, selectedPersona, addTranscriptEntry]
  );

  // Keypad press handler
  const handleKeypadPress = useCallback(
    (key: string) => {
      if (!session?.isAlive) return;
      sendInput(key);
    },
    [session, sendInput]
  );

  // Direct text input handler (e.g. 4412 on Enter)
  const sendDirectText = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !session?.isAlive) return;
      sendInput(trimmed);
      setInputBuffer('');
    },
    [session, sendInput]
  );

  // Switch persona: resets session state & updates LCD
  const handleSelectPersona = (p: PersonaOption) => {
    setSelectedPersona(p);
    setSession(null);
    setInputBuffer('');
    setInvalidInputNotice(null);
    setLastRawResponse('');
    if (p.id === 'kalinda') {
      setLcdLines(['Ubuntu Ledger', 'Fee Verification', 'Press DIAL to call', 'Woreda 09']);
    } else {
      setLcdLines(['Ubuntu Ledger', '1. Submit Observation', '2. View Project', '0. Back']);
    }
    addTranscriptEntry('info', `Switched persona to ${p.label} (${p.msisdn})`);
  };

  // Stepper state calculation
  const currentStep =
    selectedPersona.id === 'kalinda'
      ? 3
      : selectedPersona.role === 'duplicate'
      ? 2
      : 1;

  return (
    <div className="space-y-8">
      {/* ─── Compact Stepper (Reference 2 §14) ─── */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="grid grid-cols-3 gap-2 sm:gap-4 flex-1">
            {/* Step 1: Amina */}
            <div
              onClick={() => {
                const p = config.personas.find((x) => x.role === 'primary');
                if (p) handleSelectPersona(p);
              }}
              className={`flex items-center gap-2 sm:gap-3 p-2 rounded-xl transition-all cursor-pointer ${
                currentStep === 1
                  ? 'bg-blue-50/80 text-blue-900 font-semibold border border-blue-200/60'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  currentStep === 1
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                1
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold leading-tight truncate">Amina</p>
                <p className="text-[10px] text-slate-500 truncate hidden sm:block">
                  Submit observation
                </p>
              </div>
            </div>

            {/* Step 2: Girma */}
            <div
              onClick={() => {
                const p = config.personas.find((x) => x.role === 'duplicate');
                if (p) handleSelectPersona(p);
              }}
              className={`flex items-center gap-2 sm:gap-3 p-2 rounded-xl transition-all cursor-pointer ${
                currentStep === 2
                  ? 'bg-amber-50/80 text-amber-900 font-semibold border border-amber-200/60'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  currentStep === 2
                    ? 'bg-amber-500 text-white'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                2
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold leading-tight truncate">Girma</p>
                <p className="text-[10px] text-slate-500 truncate hidden sm:block">
                  Duplicate cluster (rejected)
                </p>
              </div>
            </div>

            {/* Step 3: Kalinda */}
            <div
              onClick={() => {
                const p = config.personas.find((x) => x.id === 'kalinda');
                if (p) handleSelectPersona(p);
              }}
              className={`flex items-center gap-2 sm:gap-3 p-2 rounded-xl transition-all cursor-pointer ${
                currentStep === 3
                  ? 'bg-emerald-50/80 text-emerald-900 font-semibold border border-emerald-200/60'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  currentStep === 3
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                3
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold leading-tight truncate">Kalinda</p>
                <p className="text-[10px] text-slate-500 truncate hidden sm:block">
                  Independent confirmation
                </p>
              </div>
            </div>
          </div>

          {/* Stepper Progress bar & indicator */}
          <div className="sm:w-36 flex flex-col justify-center border-t sm:border-t-0 sm:border-l border-slate-100 pt-2 sm:pt-0 sm:pl-4">
            <div className="flex justify-between items-center text-[11px] font-semibold text-slate-600 mb-1">
              <span>Step {currentStep} of 3</span>
              <span>{Math.round((currentStep / 3) * 100)}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-300"
                style={{ width: `${(currentStep / 3) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ─── 3-Column Bento Architecture (Reference 2 §12) ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ─── Column 1: Field Personas (Left - 3 cols) ─── */}
        <section
          aria-label="Persona selector"
          className="lg:col-span-3 space-y-4"
        >
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Field Personas</h3>
                <p className="text-xs text-slate-500">
                  Select a person to simulate their USSD session:
                </p>
              </div>
            </div>

            {/* Persona cards list */}
            <div
              data-testid="persona-selector"
              role="radiogroup"
              aria-label="Select demo persona"
              className="space-y-2.5"
            >
              {config.personas.map((p) => {
                const isSelected = selectedPersona.id === p.id;
                const isAmina = p.role === 'primary';
                const isGirma = p.role === 'duplicate';
                const isKalinda = p.id === 'kalinda';

                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => handleSelectPersona(p)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all flex flex-col gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/40 shadow-sm ring-1 ring-blue-600'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {/* Avatar representation */}
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                            isSelected
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {p.label.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-xs text-slate-900 leading-tight">
                            {p.label}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {isKalinda ? 'Kebele 09' : 'Kebele 08'}
                          </p>
                        </div>
                      </div>

                      {/* Status indicator */}
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          isSelected
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {isSelected ? 'Active' : 'Ready'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-600 pt-1 border-t border-slate-100">
                      <span>{p.msisdn}</span>
                      {/* Explicit badge text for test contracts */}
                      {isAmina && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                          DEMO WITNESS
                        </span>
                      )}
                      {isGirma && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300">
                          DUPLICATE CLUSTER
                        </span>
                      )}
                      {isKalinda && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-300">
                          FEE VERIFIER
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Persona Section Footer showing active cluster key */}
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono text-slate-600">
              <span>Cluster key: <strong className="text-slate-900 font-bold">{selectedPersona.clusterKey}</strong></span>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded">Cell: et-aa-0917</span>
            </div>

            {/* Channel Toggle (USSD vs IVR) */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-600 font-medium">Channel Protocol:</span>
              <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                <button
                  type="button"
                  onClick={() => setChannelMode('USSD')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                    channelMode === 'USSD'
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  USSD (*890#)
                </button>
                <button
                  type="button"
                  onClick={() => setChannelMode('IVR')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                    channelMode === 'IVR'
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  IVR (Voice)
                </button>
              </div>
            </div>
          </div>

          {/* Key Scenario Collapsible Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
            <button
              type="button"
              onClick={() => setScenarioExpanded(!scenarioExpanded)}
              className="w-full flex items-center justify-between text-left focus:outline-none"
            >
              <div className="flex items-center gap-2">
                <span className="text-blue-600 text-sm">ⓘ</span>
                <span className="font-bold text-xs text-slate-900">Key Scenario</span>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {scenarioExpanded ? '▲' : '▼'}
              </span>
            </button>
            {scenarioExpanded ? (
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Amina submits an observation for generator #4412. Girma (sharing her telecom cell tower)
                is recognized by Sybil protection as a duplicate cluster report. Kalinda independently
                confirms statutory civil registration fee ceilings.
              </p>
            ) : (
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                Amina completes witness 3 of 3. Girma dials to show Sybil protection.
              </p>
            )}
          </div>
        </section>

        {/* ─── Column 2: The Physical Alcatel Handset Hero (Center - 4 cols) ─── */}
        <section
          aria-label="Interactive Feature Phone"
          className="lg:col-span-4 flex flex-col items-center"
        >
          <AlcatelHandset
            session={session}
            selectedPersona={selectedPersona}
            lcdLines={lcdLines}
            loading={loading}
            channelMode={channelMode}
            invalidInputNotice={invalidInputNotice}
            inputBuffer={inputBuffer}
            onInputChange={setInputBuffer}
            onInputKeyDown={(e) => {
              if (e.key === 'Enter') {
                sendDirectText(inputBuffer);
              }
            }}
            onClearInput={() => setInputBuffer('')}
            onDirectSend={() => sendDirectText(inputBuffer)}
            onKeypadPress={handleKeypadPress}
            onDial={startSession}
            onEnd={endSession}
            onBack={() => sendInput('0')}
            onHome={() => sendInput('00')}
            onDismissInvalid={() => setInvalidInputNotice(null)}
            onStartNew={startSession}
            inputRef={inputRef}
          />
        </section>

        {/* ─── Column 3: Human Proof First + Telemetry Stack (Right - 5 cols) ─── */}
        <section
          aria-label="Session Evidence and Telemetry"
          className="lg:col-span-5 space-y-4"
        >
          {/* Segmented Control Tabs */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveRightTab('live')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeRightTab === 'live'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Live Transaction
            </button>
            <button
              type="button"
              onClick={() => setActiveRightTab('walkthrough')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeRightTab === 'walkthrough'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Guided Walkthrough
            </button>
          </div>

          {/* Status Alert Badge */}
          <div className="bg-emerald-50 border border-emerald-200/80 rounded-xl p-3 flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <div className="text-xs text-emerald-900">
              <strong className="font-semibold">
                {session?.isAlive ? 'Session Active' : 'Waiting for user input'}
              </strong>
              <p className="text-[11px] text-emerald-700/90 mt-0.5">
                {session?.isAlive
                  ? 'Review prompt on screen and submit next answer.'
                  : 'The phone is ready. Press the DIAL button to begin verification.'}
              </p>
            </div>
          </div>

          {/* 1. Human Summary Card (Reference 2 §15) */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-blue-600 text-base">👥</span>
              <h4 className="font-bold text-sm text-slate-900">Human Summary</h4>
            </div>
            <div className="grid grid-cols-2 gap-y-2.5 gap-x-4 text-xs border-t border-slate-100 pt-3">
              <div>
                <span className="text-slate-500 block text-[11px]">Who</span>
                <span className="font-semibold text-slate-900">{selectedPersona.label}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">What</span>
                <span className="font-semibold text-slate-900">
                  {selectedPersona.id === 'kalinda'
                    ? 'Statutory fee audit'
                    : 'Submitting repair observation'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Project</span>
                <span className="font-semibold text-slate-900">
                  Health Post Generator (#4412)
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Location</span>
                <span className="font-semibold text-slate-900">
                  Woreda 09 · Kebele 08
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Cluster</span>
                <span className="font-mono text-[11px] text-slate-700">
                  {selectedPersona.clusterKey}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Status</span>
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  {session?.isAlive ? 'In Call' : 'Ready'}
                </span>
              </div>
            </div>
          </div>

          {/* 2. HTTP / API Trace Card (Live GSM Telemetry) */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-slate-600 text-sm">⚙</span>
                <h4 className="font-bold text-sm text-slate-900">HTTP / API Trace</h4>
              </div>
              <div className="flex items-center gap-2">
                {activeAudioKeys.length > 0 && (
                  <span className="text-[10px] font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                    Audio: {activeAudioKeys.length} clip(s)
                  </span>
                )}
                <span className="text-[10px] font-mono text-slate-500">
                  {channelMode === 'USSD' ? 'POST /api/ussd' : 'POST /api/ivr'}
                </span>
              </div>
            </div>

            {/* Verbatim raw backend response container (SACRED TEST CONTRACT) */}
            <div className="mb-3">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Latest Backend Response (Verbatim)
              </p>
              <pre
                data-testid="raw-response"
                className="text-[11px] font-mono bg-slate-50 text-slate-800 p-2.5 rounded-xl border border-slate-200 whitespace-pre-wrap break-words leading-relaxed max-h-24 overflow-y-auto"
              >
                {lastRawResponse || 'No response received yet. Dial to initiate session.'}
              </pre>
            </div>

            {/* Session Transcript Panel (SACRED TEST CONTRACT) */}
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Real-Time Session Log
              </p>
              <div
                ref={transcriptRef}
                data-testid="transcript-panel"
                className="bg-[#0F172A] text-slate-200 p-3 rounded-xl font-mono text-[11px] h-32 overflow-y-auto space-y-1.5 border border-slate-800"
              >
                {transcript.length === 0 ? (
                  <p className="text-slate-500 italic">Session idle. Logs will stream here.</p>
                ) : (
                  transcript.map((item) => (
                    <div
                      key={item.id}
                      data-direction={item.direction}
                      className={
                        item.direction === 'sent'
                          ? 'text-sky-300'
                          : item.direction === 'received'
                          ? 'text-emerald-300'
                          : 'text-slate-400'
                      }
                    >
                      <span className="opacity-50 mr-1.5">[{item.seq}]</span>
                      <span>{item.text}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 3. Evidence & Next Steps Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
            <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wider mb-3">
              Evidence &amp; Next Steps
            </h4>
            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex items-start gap-2">
                <span className="text-emerald-600 font-bold mt-0.5">✓</span>
                <span>Observation verified by geographic cluster protection.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-600 font-bold mt-0.5">ℹ</span>
                <span>Multi-witness confirmation enforces 2-of-3 independent quorum.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-amber-600 font-bold mt-0.5">⏳</span>
                <span>7-day probation period holds funds until sustained operation is verified.</span>
              </div>
            </div>

            {/* Technical Details toggle */}
            <div className="mt-4 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center justify-between w-full"
              >
                <span>Technical Details (k-anonymity &amp; hashing)</span>
                <span>{showTechnicalDetails ? '▲' : '▼'}</span>
              </button>
              {showTechnicalDetails && (
                <div className="mt-2.5 p-2.5 bg-slate-50 rounded-xl text-[11px] font-mono text-slate-600 space-y-1 border border-slate-200/60">
                  <div>Prefix Bucket: {selectedPersona.msisdn.slice(0, 7)}</div>
                  <div>Cluster ID: {selectedPersona.clusterKey}</div>
                  <div>Zero-PII Phone Hash: HMAC-SHA256</div>
                  <div>Session State: {session ? 'LIVE_GSM_CON' : 'IDLE'}</div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* ─── Bottom Banner: Why This Matters (Reference 2 §12) ─── */}
      <div className="bg-gradient-to-r from-blue-50/70 via-slate-50 to-indigo-50/70 border border-blue-100 rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5 max-w-2xl">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/20">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900 mb-1">Why This Matters</h4>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Independent witnesses, cluster detection, and probation periods prevent fraud and
                ensure public infrastructure repairs are verified by the community, not just the contractor.
              </p>
            </div>
          </div>
          <div className="shrink-0 text-right font-mono text-xs text-blue-700 italic hidden md:block">
            Real people · Real evidence · Better outcomes.
          </div>
        </div>
      </div>
    </div>
  );
}
