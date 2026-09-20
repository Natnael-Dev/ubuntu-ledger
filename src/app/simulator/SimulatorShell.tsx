'use client';
// Feature-Phone Simulator — Modern Civic Rebuild
// Authoritative sources:
// - Design Reference (media_1789758661416.png): Light canvas, 3-column Bento layout, Alcatel Handset, Human Summary first
// - specs/06-voice-and-ussd.md, specs/12-demo-script.md Checkpoint 2
// - 100% test contract preservation for tests/e2e/simulator.spec.ts

import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { SimulatorConfig, PersonaOption } from './page';
import { AlcatelHandset } from '@/components/AlcatelHandset';
import { VoiceEvidenceRecorder } from '@/components/ai/VoiceEvidenceRecorder';

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
  const [viewMode, setViewMode] = useState<'ussd' | 'voice'>('ussd');
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
  const sessionActive = Boolean(session?.isAlive);

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
      {/* ─── Mode Switcher: USSD Simulation vs Voice AI Evidence ─── */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b border-slate-200">
        <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200/80 shadow-inner">
          <button
            type="button"
            data-testid="mode-tab-ussd"
            onClick={() => setViewMode('ussd')}
            className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              viewMode === 'ussd'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${viewMode === 'ussd' ? 'bg-blue-600' : 'bg-slate-400'}`} />
            USSD Simulation
          </button>
          <button
            type="button"
            data-testid="mode-tab-voice"
            onClick={() => setViewMode('voice')}
            className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              viewMode === 'voice'
                ? 'bg-white text-blue-900 shadow-sm border border-blue-200/60'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${viewMode === 'voice' ? 'bg-blue-600 animate-pulse' : 'bg-slate-400'}`} />
            Voice AI Evidence
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-semibold uppercase">
              AI Assist
            </span>
          </button>
        </div>

        <div className="text-xs font-mono text-slate-500">
          {viewMode === 'ussd' ? (
            <span>Dialer &amp; GSM Protocol · Deterministic Quorum</span>
          ) : (
            <span>Multilingual Voice Intake · Assistive Intelligence</span>
          )}
        </div>
      </div>

      {viewMode === 'voice' ? (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-sm">
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-blue-600">
                    Proof-Line Intake // Voice AI Evidence
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                    Human-in-the-loop Invariant
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                  Citizen Voice Inspection Recorder
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 mt-1">
                  Field monitors and community residents can record spoken observations in Kiswahili, Amharic, Oromo, or English. Assistive intelligence extracts structured answers for human verification before ledger commit.
                </p>
              </div>

              <VoiceEvidenceRecorder taskId="00000000-0000-4000-a000-000000000300" />
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* ─── Compact Stepper (Reference 2 §14) ─── */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 flex-1">
            {/* Step 1: Amina */}
            <div
              onClick={() => {
                const p = config.personas.find((x) => x.role === 'primary');
                if (p) handleSelectPersona(p);
              }}
              className={`text-left p-3.5 sm:p-4 rounded-xl transition-all cursor-pointer border-2 flex items-center gap-3.5 select-none ${
                currentStep === 1
                  ? 'bg-blue-50/90 text-blue-900 border-blue-600 shadow-xs'
                  : currentStep > 1
                  ? 'bg-emerald-50/50 text-emerald-900 border-emerald-300'
                  : 'bg-slate-50/60 text-slate-700 border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="relative shrink-0">
                <img
                  src="/personas/amina.jpg"
                  alt="Amina"
                  className="w-9 h-9 rounded-full object-cover border border-slate-300 shadow-2xs"
                />
                <div
                  className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shadow-2xs ${
                    currentStep === 1
                      ? 'bg-blue-600 text-white animate-pulse'
                      : currentStep > 1
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {currentStep > 1 ? '✓' : '1'}
                </div>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-bold leading-tight truncate">1. Amina</p>
                  {currentStep === 1 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white uppercase">
                      Active
                    </span>
                  )}
                  {currentStep > 1 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      Confirmed
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
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
              className={`text-left p-3.5 sm:p-4 rounded-xl transition-all cursor-pointer border-2 flex items-center gap-3.5 select-none ${
                currentStep === 2
                  ? 'bg-amber-50/90 text-amber-950 border-amber-500 shadow-xs'
                  : currentStep > 2
                  ? 'bg-emerald-50/50 text-emerald-900 border-emerald-300'
                  : 'bg-slate-50/60 text-slate-700 border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="relative shrink-0">
                <img
                  src="/personas/girma.jpg"
                  alt="Girma"
                  className="w-9 h-9 rounded-full object-cover border border-slate-300 shadow-2xs"
                />
                <div
                  className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shadow-2xs ${
                    currentStep === 2
                      ? 'bg-amber-500 text-white animate-pulse'
                      : currentStep > 2
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {currentStep > 2 ? '✓' : '2'}
                </div>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-bold leading-tight truncate">2. Girma</p>
                  {currentStep === 2 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-600 text-white uppercase">
                      Active
                    </span>
                  )}
                  {currentStep > 2 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      Suppressed
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  Duplicate cluster rejected
                </p>
              </div>
            </div>

            {/* Step 3: Kalinda */}
            <div
              onClick={() => {
                const p = config.personas.find((x) => x.id === 'kalinda');
                if (p) handleSelectPersona(p);
              }}
              className={`text-left p-3.5 sm:p-4 rounded-xl transition-all cursor-pointer border-2 flex items-center gap-3.5 select-none ${
                currentStep === 3
                  ? 'bg-emerald-50/90 text-emerald-950 border-emerald-600 shadow-xs'
                  : 'bg-slate-50/60 text-slate-700 border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="relative shrink-0">
                <img
                  src="/personas/kalinda.jpg"
                  alt="Kalinda"
                  className="w-9 h-9 rounded-full object-cover border border-slate-300 shadow-2xs"
                />
                <div
                  className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shadow-2xs ${
                    currentStep === 3
                      ? 'bg-emerald-600 text-white animate-pulse'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  3
                </div>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-bold leading-tight truncate">3. Kalinda</p>
                  {currentStep === 3 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white uppercase">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  Independent confirmation
                </p>
              </div>
            </div>
          </div>

          {/* Stepper Progress bar & indicator */}
          <div className="md:w-44 flex flex-col justify-center border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-6">
            <div className="flex justify-between items-center text-xs font-bold text-slate-700 mb-1.5">
              <span>Step {currentStep} of 3</span>
              <span className="text-blue-600 font-mono">{Math.round((currentStep / 3) * 100)}%</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-300"
                style={{ width: `${(currentStep / 3) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ─── 3-Column Bento Architecture (Reference 2 §12) ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* ─── Column 1: Field Personas (Left - 4 cols) ─── */}
        <section
          aria-label="Persona selector"
          className="lg:col-span-4 space-y-4"
        >
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-base text-slate-900">Field Personas</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select a citizen to simulate their feature phone session:
                </p>
              </div>
            </div>

            {/* Persona cards list */}
            <div
              data-testid="persona-selector"
              role="radiogroup"
              aria-label="Select demo persona"
              className="space-y-3.5"
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
                    className={`w-full text-left p-5 rounded-2xl border-2 transition-all flex flex-col gap-3.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 cursor-pointer ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/40 shadow-sm ring-1 ring-blue-600'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70'
                    }`}
                  >
                    <div className="flex items-start justify-between w-full">
                      <div className="flex items-center gap-4">
                        {/* High-Resolution Circular Persona Photo Avatar */}
                        <div
                          className={`w-14 h-14 rounded-full overflow-hidden shrink-0 border-2 shadow-xs relative flex items-center justify-center font-extrabold text-base ${
                            isSelected
                              ? 'border-blue-600 ring-2 ring-blue-400'
                              : 'border-slate-300'
                          } ${
                            isAmina
                              ? 'bg-[#E07A5F] text-white'
                              : isGirma
                              ? 'bg-[#3D405B] text-white'
                              : 'bg-[#2A4365] text-white'
                          }`}
                        >
                          <img
                            src={
                              isAmina
                                ? '/personas/amina.jpg'
                                : isGirma
                                ? '/personas/girma.jpg'
                                : '/personas/kalinda.jpg'
                            }
                            alt={isAmina ? 'Amina' : isGirma ? 'Girma' : 'Kalinda'}
                            className="w-full h-full object-cover object-center"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                          <span className="absolute -z-10 font-bold text-sm">
                            {isAmina ? 'AM' : isGirma ? 'GI' : 'KA'}
                          </span>
                        </div>

                        <div>
                          <div className="font-bold text-lg text-[#0F172A] leading-tight flex items-center gap-1.5">
                            <span>{isAmina ? 'Amina' : isGirma ? 'Girma' : 'Kalinda'}</span>
                            {/* Hidden/accessible full persona label for strict test contracts */}
                            <span className="sr-only"> {p.label}</span>
                          </div>
                          <p className="text-xs text-slate-500 font-medium mt-1">
                            {isKalinda ? 'Woreda 09 · Kebele 09' : 'Woreda 09 · Kebele 08'}
                          </p>
                          <p className="text-xs font-mono text-slate-700 font-semibold mt-1 flex items-center gap-1.5 bg-slate-100 px-2 py-0.5 rounded-md inline-flex">
                            <span>📞</span>
                            <span>{p.msisdn}</span>
                          </p>
                        </div>
                      </div>

                      {/* Prominent Selection Indicator Radio/Check */}
                      {isSelected ? (
                        <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold shadow-xs shrink-0 mt-0.5">
                          ✓
                        </div>
                      ) : (
                        <div className="w-7 h-7 rounded-full border-2 border-slate-300 shrink-0 mt-0.5 hover:border-slate-400" />
                      )}
                    </div>

                    {/* Badge Pills Row */}
                    <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                      {isAmina && (
                        <>
                          <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300">
                            DEMO WITNESS
                          </span>
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900">
                            Active
                          </span>
                        </>
                      )}
                      {isGirma && (
                        <>
                          <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-300">
                            DUPLICATE CLUSTER
                          </span>
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                            Ready
                          </span>
                        </>
                      )}
                      {isKalinda && (
                        <>
                          <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-300">
                            Independent Witness
                          </span>
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                            Ready
                          </span>
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Persona Section Footer showing active cluster key */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-mono text-slate-600">
              <span>Cluster key: <strong className="text-slate-900 font-bold">{selectedPersona.clusterKey}</strong></span>
              <span className="text-[11px] bg-slate-100 text-slate-700 font-semibold px-2.5 py-0.5 rounded">Cell: et-aa-0917</span>
            </div>
          </div>

          {/* Key Scenario Collapsible Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
            <button
              type="button"
              onClick={() => setScenarioExpanded(!scenarioExpanded)}
              className="w-full flex items-center justify-between text-left focus:outline-none cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-blue-600 font-bold text-base">ⓘ</span>
                <span className="font-bold text-sm text-slate-900">Key Scenario Walkthrough</span>
              </div>
              <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">
                {scenarioExpanded ? 'Hide ▲' : 'Open ▼'}
              </span>
            </button>
            {scenarioExpanded ? (
              <div className="text-xs text-slate-600 mt-3 pt-3 border-t border-slate-100 space-y-2.5 leading-relaxed">
                <p>
                  <strong>1. Amina (Demo Witness):</strong> Submits inspection observation for Generator #4412.
                  Independent confirmation recorded (quorum 1/3).
                </p>
                <p>
                  <strong>2. Girma (Duplicate Cluster):</strong> Dials from the same telecom tower.
                  Sybil protection recognizes the duplicate cluster key and suppresses inflation.
                </p>
                <p>
                  <strong>3. Kalinda (Independent Witness):</strong> Dials from Kebele 09 to complete multi-witness quorum.
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                Amina submits verification. Girma attempts duplicate report. Kalinda provides independent confirmation.
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
            onChannelModeChange={setChannelMode}
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

        {/* ─── Column 3: Human Proof First + Telemetry Stack (Right - 4 cols) ─── */}
        <section
          aria-label="Session Evidence and Telemetry"
          className="lg:col-span-4 space-y-4"
        >
          {/* Segmented Control Tabs */}
          <div className="bg-slate-100 p-1.5 rounded-2xl flex items-center border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveRightTab('live')}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                activeRightTab === 'live'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Live Transaction &amp; Trace
            </button>
            <button
              type="button"
              onClick={() => setActiveRightTab('walkthrough')}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                activeRightTab === 'walkthrough'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Guided Walkthrough
            </button>
          </div>

          {/* Status Alert Badge */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <div className="text-xs text-emerald-950">
              <strong className="font-bold text-sm block text-emerald-900">
                {session?.isAlive ? 'Session Active (Connected)' : 'Waiting for user input'}
              </strong>
              <p className="text-xs text-emerald-800 mt-0.5">
                {session?.isAlive
                  ? 'Review prompt on phone LCD screen and press corresponding number.'
                  : 'Handset ready. Click "Dial *890#" or press the green DIAL key to begin.'}
              </p>
            </div>
          </div>

          {/* 1. Human Summary Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between gap-2 mb-3.5 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-blue-600 text-lg">👥</span>
                <h4 className="font-bold text-base text-slate-900">Human Summary</h4>
              </div>
              <div className="flex items-center gap-2.5">
                <img
                  src={
                    selectedPersona.role === 'primary'
                      ? '/personas/amina.jpg'
                      : selectedPersona.role === 'duplicate'
                      ? '/personas/girma.jpg'
                      : '/personas/kalinda.jpg'
                  }
                  alt={selectedPersona.label}
                  className="w-8 h-8 rounded-full object-cover border border-slate-300 shadow-2xs"
                />
                <span className="text-xs font-bold text-slate-900">{selectedPersona.label.split(' ')[0]}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs pt-1">
              <div>
                <span className="text-slate-500 block text-xs font-medium">Who</span>
                <span className="font-bold text-sm text-slate-900">{selectedPersona.label}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-xs font-medium">What</span>
                <span className="font-bold text-sm text-slate-900">
                  {selectedPersona.id === 'kalinda'
                    ? 'Statutory fee audit'
                    : 'Submitting repair observation'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-xs font-medium">Project</span>
                <span className="font-semibold text-slate-900">
                  Health Post Generator (#4412)
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-xs font-medium">Location</span>
                <span className="font-semibold text-slate-900">
                  Woreda 09 · Kebele 08
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-xs font-medium">Cluster</span>
                <span className="font-mono text-xs text-slate-700 font-semibold">
                  {selectedPersona.clusterKey}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-xs font-medium">Status</span>
                <span className="inline-flex items-center gap-1.5 font-bold text-xs text-emerald-700">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  {session?.isAlive ? 'In Call' : 'Ready'}
                </span>
              </div>
            </div>
          </div>

          {/* Render Mode: GUIDED WALKTHROUGH vs LIVE TELEMETRY TRACE */}
          {activeRightTab === 'walkthrough' ? (
            /* ─── Guided Walkthrough Panel (Agent 5) ─── */
            <div className="bg-white border border-blue-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-blue-600 font-bold">📋</span>
                  <h4 className="font-bold text-base text-slate-900">Step-by-Step Walkthrough</h4>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  Interactive Guide
                </span>
              </div>

              <div className="space-y-3.5">
                {/* Step 1 */}
                <div className={`p-4 rounded-xl border transition-all ${
                  selectedPersona.role === 'primary'
                    ? 'border-blue-500 bg-blue-50/70 shadow-xs'
                    : 'border-slate-200 bg-slate-50/40'
                }`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shadow-2xs">1</span>
                      <span className="text-sm font-bold text-slate-900">Select Primary Witness (Amina)</span>
                    </div>
                    {selectedPersona.role === 'primary' ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Selected ✓</span>
                    ) : (
                      <span
                        onClick={() => {
                          const p = config.personas.find((x) => x.role === 'primary');
                          if (p) handleSelectPersona(p);
                        }}
                        className="text-[11px] font-bold text-blue-700 bg-blue-100 hover:bg-blue-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                      >
                        Select Amina
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 pl-8 leading-relaxed">
                    Select Amina on the left. She represents a genuine community monitor in Kebele 08 verifying Generator #4412.
                  </p>
                </div>

                {/* Step 2 */}
                <div className={`p-4 rounded-xl border transition-all ${
                  !sessionActive && selectedPersona.role === 'primary'
                    ? 'border-blue-500 bg-blue-50/70 shadow-xs'
                    : 'border-slate-200 bg-slate-50/40'
                }`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shadow-2xs">2</span>
                      <span className="text-sm font-bold text-slate-900">Dial *890# on Handset</span>
                    </div>
                    <button
                      type="button"
                      onClick={startSession}
                      disabled={loading || sessionActive}
                      className="text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                    >
                      {sessionActive ? 'Dialed ✓' : 'Dial *890#'}
                    </button>
                  </div>
                  <p className="text-xs text-slate-600 pl-8 leading-relaxed">
                    Click the <strong>Dial *890#</strong> button or press the green call key to open the live USSD session.
                  </p>
                </div>

                {/* Step 3 */}
                <div className={`p-4 rounded-xl border transition-all ${
                  sessionActive
                    ? 'border-emerald-500 bg-emerald-50/70 shadow-xs'
                    : 'border-slate-200 bg-slate-50/40'
                }`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shadow-2xs">3</span>
                      <span className="text-sm font-bold text-slate-900">Answer 3-Step Verification Checklist</span>
                    </div>
                    {sessionActive && (
                      <button
                        type="button"
                        onClick={() => handleKeypadPress('1')}
                        className="text-[11px] font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                      >
                        Press 1
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 pl-8 leading-relaxed">
                    Use keypad numbers to verify: 1 = Generator operating, 1 = Operating within hours, 1 = Confirm submission.
                  </p>
                </div>

                {/* Step 4 */}
                <div className={`p-4 rounded-xl border transition-all ${
                  selectedPersona.role === 'duplicate'
                    ? 'border-amber-500 bg-amber-50/70 shadow-xs'
                    : 'border-slate-200 bg-slate-50/40'
                }`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold shadow-2xs">4</span>
                      <span className="text-sm font-bold text-slate-900">Test Sybil Deduplication (Girma)</span>
                    </div>
                    {selectedPersona.role === 'duplicate' ? (
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">Selected ✓</span>
                    ) : (
                      <span
                        onClick={() => {
                          const p = config.personas.find((x) => x.role === 'duplicate');
                          if (p) handleSelectPersona(p);
                        }}
                        className="text-[11px] font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                      >
                        Select Girma
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 pl-8 leading-relaxed">
                    Switch to Girma on the left and dial *890#. Because Girma shares Amina's cell tower, the system recognizes the duplicate cluster key and refuses duplicate inflation.
                  </p>
                </div>

                {/* Step 5 */}
                <div className={`p-4 rounded-xl border transition-all ${
                  selectedPersona.id === 'kalinda'
                    ? 'border-indigo-500 bg-indigo-50/70 shadow-xs'
                    : 'border-slate-200 bg-slate-50/40'
                }`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shadow-2xs">5</span>
                      <span className="text-sm font-bold text-slate-900">Confirm Independent Quorum (Kalinda)</span>
                    </div>
                    {selectedPersona.id === 'kalinda' ? (
                      <span className="text-[10px] font-bold text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded-full">Selected ✓</span>
                    ) : (
                      <span
                        onClick={() => {
                          const p = config.personas.find((x) => x.id === 'kalinda');
                          if (p) handleSelectPersona(p);
                        }}
                        className="text-[11px] font-bold text-indigo-800 bg-indigo-100 hover:bg-indigo-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                      >
                        Select Kalinda
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 pl-8 leading-relaxed">
                    Switch to Kalinda (Kebele 09). Independent location quorum is satisfied, progressing the audit towards verified receipt.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* ─── Live Transaction & Charcoal Telemetry Trace ─── */
            <>
              {/* 2. HTTP / API Trace Card (Restrained Charcoal Styling) */}
              <div className="bg-[#0B0F17] text-white border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <span className="text-emerald-400 text-sm">⚙</span>
                    <h4 className="font-bold text-sm text-white">HTTP / API Trace</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    {activeAudioKeys.length > 0 && (
                      <span className="text-xs font-mono text-blue-400 bg-blue-950 px-2 py-0.5 rounded border border-blue-800">
                        Audio: {activeAudioKeys.length} clip(s)
                      </span>
                    )}
                    <span className="text-xs font-mono text-slate-400 font-semibold">
                      {channelMode === 'USSD' ? 'POST /api/ussd' : 'POST /api/ivr'}
                    </span>
                  </div>
                </div>

                {/* Verbatim raw backend response container (SACRED TEST CONTRACT) */}
                <div className="mb-4">
                  <p className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Latest Backend Response (Verbatim)
                  </p>
                  <pre
                    data-testid="raw-response"
                    className="text-xs font-mono bg-[#141B27] text-slate-200 p-3 rounded-xl border border-slate-800 whitespace-pre-wrap break-words leading-relaxed max-h-28 overflow-y-auto"
                  >
                    {lastRawResponse || 'No response received yet. Dial to initiate session.'}
                  </pre>
                </div>

                {/* Session Transcript Panel (SACRED TEST CONTRACT) */}
                <div>
                  <p className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Real-Time Session Log
                  </p>
                  <div
                    ref={transcriptRef}
                    data-testid="transcript-panel"
                    className="bg-[#080B11] text-slate-200 p-3.5 rounded-xl font-mono text-xs h-36 overflow-y-auto space-y-2 border border-slate-800/80"
                  >
                    {transcript.length === 0 ? (
                      <p className="text-slate-500 italic">Session idle. GSM frames will stream here.</p>
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
                          <span className="opacity-50 mr-2">[{item.seq}]</span>
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
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center justify-between w-full cursor-pointer"
                  >
                    <span>Technical Details (k-anonymity &amp; hashing)</span>
                    <span>{showTechnicalDetails ? '▲' : '▼'}</span>
                  </button>
                  {showTechnicalDetails && (
                    <div className="mt-2.5 p-3 bg-slate-50 rounded-xl text-xs font-mono text-slate-700 space-y-1.5 border border-slate-200">
                      <div>Prefix Bucket: {selectedPersona.msisdn.slice(0, 7)}</div>
                      <div>Cluster ID: {selectedPersona.clusterKey}</div>
                      <div>Zero-PII Phone Hash: HMAC-SHA256</div>
                      <div>Session State: {session ? 'LIVE_GSM_CON' : 'IDLE'}</div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </section>
      </div>
      </>
      )}

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
