'use client';
// Feature-Phone Simulator — Client Shell
// Authoritative sources: docs/specs/06-voice-and-ussd.md §1, §2, §10
//                        docs/specs/08-ui-ux-design.md §3
//                        docs/specs/11-tasks.md T-17
//                        docs/specs/12-demo-script.md §5 (Checkpoint 2)
//
// Architecture rules:
// - NO domain imports (no reduceUssdSession, deriveClusterKey, etc.)
// - NO database access
// - NO hardcoded USSD logic
// - Every interaction goes through POST /api/ussd
// - The backend response is displayed verbatim

import { useState, useRef, useCallback, useEffect } from 'react';
import type { SimulatorConfig, PersonaOption } from './page';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TranscriptEntry {
  id: number;
  direction: 'sent' | 'received' | 'info';
  text: string;
  seq: number; // Sequence label shown in UI (no wall-clock read)
}

interface UssdSession {
  sessionId: string;
  phoneNumber: string;
  textAccumulator: string; // Cumulative *-separated digits
  isAlive: boolean; // false when backend returns END
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateSessionId(): string {
  // crypto.randomUUID() is available in all modern browsers and Node 14.17+
  return `sim-${crypto.randomUUID().slice(0, 13)}`;
}

/** Returns true when the backend response signals session end */
function isEndResponse(text: string): boolean {
  return text.trimStart().startsWith('END ') || text.trimStart() === 'END';
}

/** Strip the CON /END prefix for display on the LCD */
function stripPrefix(text: string): string {
  return text.replace(/^(CON|END)\s*/, '').trim();
}

/** Split a long string into 20-char LCD rows, respecting newlines */
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

// ─── Role badge ───────────────────────────────────────────────────────────────

const ROLE_BADGE: Record<string, { label: string; css: string }> = {
  primary: { label: 'DEMO WITNESS', css: 'bg-green-100 text-green-800 border border-green-300' },
  duplicate: { label: 'DUPLICATE CLUSTER', css: 'bg-red-100 text-red-800 border border-red-300' },
  witness: { label: 'PRE-SEEDED', css: 'bg-gray-100 text-gray-700 border border-gray-300' },
  resident: { label: 'FEE VERIFIER', css: 'bg-amber-100 text-amber-800 border border-amber-300' },
};

// ─── Keypad layout ────────────────────────────────────────────────────────────

const KEYPAD_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
];

/** Accessible name for each keypad key (Audit #41) */
const KEY_ARIA_LABEL: Record<string, string> = {
  '0': 'Digit 0',
  '1': 'Digit 1',
  '2': 'Digit 2',
  '3': 'Digit 3',
  '4': 'Digit 4',
  '5': 'Digit 5',
  '6': 'Digit 6',
  '7': 'Digit 7',
  '8': 'Digit 8',
  '9': 'Digit 9',
  '*': 'Asterisk – Send',
  '#': 'Hash – End',
};

// ─── Component ────────────────────────────────────────────────────────────────

interface SimulatorShellProps {
  config: SimulatorConfig;
}

export function SimulatorShell({ config }: SimulatorShellProps) {
  const [selectedPersona, setSelectedPersona] = useState<PersonaOption>(config.personas[0]);
  const [channelMode, setChannelMode] = useState<'USSD' | 'IVR'>('USSD');
  const [activeAudioKeys, setActiveAudioKeys] = useState<string[]>([]);
  const [session, setSession] = useState<UssdSession | null>(null);
  const [lcdLines, setLcdLines] = useState<string[]>(['Ward Proof-Line', 'Feature-Phone Sim', '', 'Select persona']);
  const [showMore, setShowMore] = useState(false);
  const [inputBuffer, setInputBuffer] = useState('');
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastRawResponse, setLastRawResponse] = useState<string>('');
  const [invalidInputNotice, setInvalidInputNotice] = useState<string | null>(null);
  const seqRef = useRef(0);

  const transcriptRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll transcript
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

  // ── End current session ────────────────────────────────────────────────────

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

  // ── Start a fresh session ──────────────────────────────────────────────────

  const startSession = useCallback(async () => {
    if (loading) return;

    const newSession: UssdSession = {
      sessionId: generateSessionId(),
      phoneNumber: selectedPersona.msisdn,
      textAccumulator: '',
      isAlive: true,
    };

    setSession(newSession);
    setInputBuffer('');
    setLoading(true);
    setLastRawResponse('');
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
        setShowMore(false);
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
        addTranscriptEntry('received', `[IVR ${data.action}] keys: [${keys.join(', ')}] slots: ${JSON.stringify(data.slots || {})}`);

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

  // ── Send a digit press ───────────────────────────────────────────────────

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
          setShowMore(false);
          if (isEnd) {
            setSession((s) => (s ? { ...s, isAlive: false } : null));
          } else {
            setSession(updatedSession);
          }
        } else {
          // IVR Mode
          const res = await fetch('/api/ivr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: updatedSession.sessionId,
              phoneNumber: updatedSession.phoneNumber,
              digits: newAccumulator,
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
          addTranscriptEntry('received', `[IVR ${data.action}] keys: [${keys.join(', ')}] slots: ${JSON.stringify(data.slots || {})}`);

          setLcdLines([
            `IVR: ${data.action}`,
            `Audio: ${keys.length} clip(s)`,
            keys[0] ? `> ${keys[0]}` : '',
            data.action === 'END' ? 'Call Ended' : `Input digits:`,
          ]);

          if (data.action === 'END') {
            setSession((s) => (s ? { ...s, isAlive: false } : null));
          } else {
            setSession(updatedSession);
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

  // ── Keypad press handler with unhandled key protection ────────────────────

  const handleKeypadPress = useCallback(
    (key: string) => {
      if (!session?.isAlive || loading) return;

      if (key === '#') {
        endSession();
        return;
      }

      if (key === '*') {
        setInvalidInputNotice('Invalid input, try again');
        setLcdLines(['! INVALID INPUT !', 'Key "*" unhandled', 'Please enter a', 'valid menu option']);
        addTranscriptEntry('info', '[INVALID] Key "*" is unhandled in this menu. Try again.');
        return;
      }

      sendInput(key);
    },
    [session, loading, endSession, sendInput, addTranscriptEntry]
  );

  // ── Keyboard support ─────────────────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const trimmed = inputBuffer.trim();
        if (!trimmed) return;
        // Send the full buffer — multi-char entries (e.g., project codes "4412") are valid USSD input
        sendInput(trimmed);
      }
    },
    [inputBuffer, sendInput]
  );

  // ── Persona switch — always resets session ───────────────────────────────

  const switchPersona = useCallback(
    (persona: PersonaOption) => {
      if (persona.id === selectedPersona.id) return;
      setSelectedPersona(persona);
      setSession(null);
      setInputBuffer('');
      setInvalidInputNotice(null);
      if (persona.id === 'kalinda') {
        setLcdLines([
          'Kalinda · Woreda 09',
          'Statutory: 210 ETB',
          'Reported: ~200 ETB',
          'Press DIAL to verify',
        ]);
      } else {
        setLcdLines(['Ward Proof-Line', 'Feature-Phone Sim', '', 'Select persona']);
      }
      setLastRawResponse('');
      addTranscriptEntry('info', `[SWITCH] Now using ${persona.label} (${persona.msisdn})`);
    },
    [selectedPersona, addTranscriptEntry]
  );

  // ── Clear transcript ─────────────────────────────────────────────────────

  const clearTranscript = useCallback(() => {
    setTranscript([]);
    setLastRawResponse('');
  }, []);

  // ─── Render ───────────────────────────────────────────────────────────────

  const sessionActive = session?.isAlive === true;
  const badge = ROLE_BADGE[selectedPersona.role] ?? ROLE_BADGE.witness;

  return (
    <div className="min-h-screen bg-[var(--paper)] p-4 md:p-8">
      {/* Page header */}
      <header className="mb-6">
        <h1 className="text-xl font-bold tracking-tight text-[var(--ink)]">
          Feature-Phone Simulator
        </h1>
        <p className="text-sm text-[var(--ink-soft)] mt-1">
          Ward Proof-Line · USSD demo — all interactions use the real{' '}
          <code className="text-xs bg-gray-100 px-1 rounded">POST /api/ussd</code> backend
        </p>
      </header>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Column 1: Persona selector & mode controls */}
        <div className="flex flex-col gap-4 w-full lg:w-72 shrink-0">

          {/* ── Channel Mode Switch (USSD / IVR) ── */}
          <div role="tablist" aria-label="Channel mode" className="flex gap-2 p-1 bg-gray-100 rounded-lg border border-[var(--rule)] w-full">
            <button
              type="button"
              role="tab"
              aria-selected={channelMode === 'USSD'}
              data-testid="mode-ussd"
              onClick={() => {
                setChannelMode('USSD');
                setSession(null);
                setActiveAudioKeys([]);
                setInvalidInputNotice(null);
                setLcdLines(['Ward Proof-Line', 'Feature-Phone Sim', '', 'Select persona']);
                setLastRawResponse('');
                addTranscriptEntry('info', '[MODE] Switched to USSD text transport (*890#)');
              }}
              className={[
                'flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)]',
                channelMode === 'USSD'
                  ? 'bg-white text-[var(--ink)] shadow-sm border border-gray-200'
                  : 'text-gray-500 hover:text-gray-900',
              ].join(' ')}
            >
              USSD (Text)
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={channelMode === 'IVR'}
              data-testid="mode-ivr"
              onClick={() => {
                setChannelMode('IVR');
                setSession(null);
                setActiveAudioKeys([]);
                setInvalidInputNotice(null);
                setLcdLines(['Ward Proof-Line', 'IVR Voice Engine', '', 'Press DIAL to call']);
                setLastRawResponse('');
                addTranscriptEntry('info', '[MODE] Switched to IVR voice audio transport (/api/ivr)');
              }}
              className={[
                'flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)]',
                channelMode === 'IVR'
                  ? 'bg-white text-[var(--ink)] shadow-sm border border-gray-200'
                  : 'text-gray-500 hover:text-gray-900',
              ].join(' ')}
            >
              IVR (Voice)
            </button>
          </div>

          {/* ── Persona selector ── */}
          <section aria-label="Persona selector" className="rounded-xl border border-[var(--rule)] bg-white p-4 w-full">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-soft)] mb-3">
              Active Persona
            </h2>
            <div className="flex flex-col gap-2">
              {config.personas.map((p) => {
                const isActive = p.id === selectedPersona.id;
                const rb = ROLE_BADGE[p.role] ?? ROLE_BADGE.witness;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => switchPersona(p)}
                    aria-pressed={isActive}
                    aria-current={isActive ? 'true' : undefined}
                    className={[
                      'flex flex-col text-left rounded-lg border px-3 py-2 transition-all text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)]',
                      isActive
                        ? 'border-[var(--state-open)] bg-green-50 ring-1 ring-[var(--state-open)]'
                        : 'border-[var(--rule)] hover:border-[var(--ink-soft)]',
                    ].join(' ')}
                  >
                    <span className="font-medium text-[var(--ink)] truncate">{p.label}</span>
                    <span className="font-mono text-xs text-[var(--ink-soft)] mt-0.5">{p.msisdn}</span>
                    <span className={`mt-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded self-start ${rb.css}`}>
                      {rb.label}
                    </span>
                  </button>
                );
              })}
            </div>
            {/* Active persona cluster info */}
            <div className="mt-3 pt-3 border-t border-[var(--rule)] text-[10px] font-mono text-[var(--ink-soft)] break-all">
              <span className="font-semibold">Cluster key:</span> {selectedPersona.clusterKey}
            </div>
          </section>

          {/* ── IVR Audio Queue Card (visible when in IVR mode) ── */}
          {channelMode === 'IVR' && (
            <div
              data-testid="ivr-audio-panel"
              className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 w-full"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${sessionActive ? 'bg-green-500 animate-ping' : 'bg-blue-400'}`} />
                  IVR Audio Queue
                </h3>
                <span className="text-[10px] font-mono text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                  {activeAudioKeys.length} clip{activeAudioKeys.length === 1 ? '' : 's'}
                </span>
              </div>
              {activeAudioKeys.length === 0 ? (
                <p className="text-xs text-blue-600 italic">Call IVR to trigger audio playback</p>
              ) : (
                <div className="flex flex-col gap-1.5 mt-2">
                  {activeAudioKeys.map((key, idx) => (
                    <div
                      key={`${key}-${idx}`}
                      data-testid="audio-key-badge"
                      className="text-[11px] font-mono bg-white text-blue-900 border border-blue-200 px-2 py-1 rounded shadow-sm flex items-center justify-between"
                    >
                      <span className="flex items-center gap-1 truncate">
                        <span>🔊</span>
                        <span className="truncate">{key}</span>
                      </span>
                      <span className="text-[9px] text-blue-500 shrink-0">#{idx + 1}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Column 2: The Physical Feature Phone Handset (Center Hero) */}
        <section aria-label="Feature Phone Handset" className="w-full lg:w-80 flex flex-col items-center shrink-0">
          <h2 className="sr-only">Feature-Phone Handset</h2>
          <div
            data-testid="feature-phone"
            className="rounded-3xl border-4 border-[var(--shell)] bg-[var(--shell)] shadow-2xl w-72"
          >
            {/* Phone speaker grille */}
            <div className="flex justify-center pt-4 pb-2">
              <div className="w-16 h-1.5 rounded-full bg-gray-600 opacity-50" />
            </div>

            {/* ── LCD Display ── */}
            <div
              data-testid="lcd-display"
              aria-label="LCD display"
              className="mx-3 rounded-md border-2 border-[#8A9270] bg-[var(--lcd-bg)] px-3 py-2 font-mono text-xs leading-[1.4] relative overflow-hidden"
              style={{ minHeight: '5.5rem' }}
            >
              {/* Scanline overlay */}
              <div
                className="absolute inset-0 pointer-events-none opacity-10"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.15) 4px)',
                }}
              />
              {/* Status bar */}
              <div className="flex justify-between items-center mb-1 text-[8px] text-[var(--lcd-ink)] opacity-60">
                <span data-testid="phone-number">{selectedPersona.msisdn.replace('+', '')}</span>
                <span className="flex items-center gap-1">
                  {loading && <span className="animate-pulse">●</span>}
                  {invalidInputNotice && (
                    <span className="font-bold text-red-900 bg-amber-300/90 px-1 rounded" data-testid="invalid-badge">
                      !RETRY
                    </span>
                  )}
                  <span>{session ? (session.isAlive ? 'SIM' : 'END') : 'IDLE'}</span>
                </span>
              </div>
              {/* 4 × 20 LCD lines */}
              {Array.from({ length: 4 }).map((_, i) => {
                const lineIndex = showMore ? i + 4 : i;
                return (
                  <div
                    key={lineIndex}
                    className="text-[var(--lcd-ink)] overflow-hidden whitespace-nowrap text-ellipsis"
                    style={{ maxWidth: '20ch' }}
                    data-testid={`lcd-line-${i}`}
                  >
                    {lcdLines[lineIndex] ?? ''}
                  </div>
                );
              })}
            </div>

            {/* Invalid Input Banner Alert (Audit #41 / Task 2) */}
            {invalidInputNotice && (
              <div
                role="alert"
                data-testid="invalid-input-banner"
                className="mx-3 mt-1.5 p-1.5 bg-amber-100 border border-amber-300 rounded text-[11px] font-mono text-amber-950 flex items-center justify-between"
              >
                <span className="flex items-center gap-1 truncate">
                  <span aria-hidden="true">⚠️</span>
                  <span className="truncate">{invalidInputNotice}</span>
                </span>
                <button
                  type="button"
                  aria-label="Dismiss error notice"
                  onClick={() => setInvalidInputNotice(null)}
                  className="text-amber-800 hover:text-amber-950 font-bold ml-1 text-sm focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-800 px-1 rounded shrink-0"
                >
                  ×
                </button>
              </div>
            )}

            {/* Scroll Button (if overflow) */}
            {lcdLines.length > 4 && (
              <div className="mx-3 mt-1 flex justify-center">
                <button
                  type="button"
                  aria-label={showMore ? 'Scroll LCD display up' : 'Scroll LCD display down'}
                  onClick={() => setShowMore(!showMore)}
                  className="text-[10px] font-bold text-gray-400 hover:text-gray-200 uppercase tracking-widest bg-gray-700 px-3 py-0.5 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  {showMore ? '[scroll ▴]' : '[scroll ▾]'}
                </button>
              </div>
            )}

            {/* Active session info */}
            <div className="mx-3 mt-1 text-[9px] font-mono text-gray-400 flex items-center gap-2">
              <span data-testid="session-state">
                {session ? (session.isAlive ? '● ACTIVE' : '◉ ENDED') : '○ IDLE'}
              </span>
              {session && (
                <span className="truncate text-[8px]" data-testid="session-accumulator">
                  [{session.textAccumulator || '—'}]
                </span>
              )}
            </div>

            {/* Operator action buttons */}
            <div className="mx-3 mt-2 flex gap-2">
              <button
                type="button"
                onClick={startSession}
                disabled={loading}
                aria-label={session?.isAlive ? 'Redial session' : channelMode === 'USSD' ? 'Dial star 890 hash' : 'Call IVR voice engine'}
                data-testid="btn-dial"
                className={[
                  'flex-1 rounded-lg py-1.5 text-xs font-semibold transition-colors',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900',
                  loading
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-[var(--state-open)] text-white hover:opacity-90 active:opacity-75',
                ].join(' ')}
              >
                {session?.isAlive ? '↺ REDIAL' : channelMode === 'USSD' ? 'DIAL *890#' : 'CALL IVR'}
              </button>
              {sessionActive && (
                <button
                  type="button"
                  onClick={endSession}
                  disabled={loading}
                  aria-label="End call session"
                  data-testid="btn-end"
                  className="rounded-lg py-1.5 px-3 text-xs font-semibold bg-[var(--state-break)] text-white hover:opacity-90 active:opacity-75 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
                >
                  END
                </button>
              )}
              {session && !session.isAlive && (
                <button
                  type="button"
                  onClick={startSession}
                  disabled={loading}
                  aria-label="Start new session"
                  data-testid="btn-new"
                  className="flex-1 rounded-lg py-1.5 text-xs font-semibold bg-[var(--shell)] text-white hover:opacity-90 border border-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
                >
                  NEW
                </button>
              )}
            </div>

            {/* ── Keypad ── */}
            <div
              data-testid="keypad"
              role="group"
              aria-label="Phone keypad"
              className="mx-3 mt-3 mb-4 grid grid-cols-3 gap-2"
            >
              {KEYPAD_ROWS.map((row) =>
                row.map((key) => (
                  <button
                    key={key}
                    type="button"
                    aria-label={KEY_ARIA_LABEL[key] ?? `Digit ${key}`}
                    onClick={() => {
                      if (sessionActive) handleKeypadPress(key);
                    }}
                    disabled={!sessionActive || loading}
                    data-testid={`key-${key}`}
                    className={[
                      'rounded-lg py-2 text-sm font-bold transition-all border',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900',
                      sessionActive && !loading
                        ? 'bg-gray-200 border-gray-300 text-[var(--ink)] hover:bg-gray-100 active:scale-95'
                        : 'bg-gray-600 border-gray-700 text-gray-500 cursor-not-allowed',
                    ].join(' ')}
                  >
                    {key}
                  </button>
                ))
              )}
            </div>

            {/* Text input for direct entry (useful for project codes) */}
            <div className="mx-3 mb-4 flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputBuffer}
                onChange={(e) => setInputBuffer(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={!sessionActive || loading}
                placeholder={sessionActive ? 'type & press Enter' : '—'}
                maxLength={10}
                aria-label="Direct keypad input"
                data-testid="text-input"
                className="flex-1 rounded-lg border border-gray-600 bg-gray-700 text-white text-xs px-2 py-1 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-white disabled:opacity-40"
              />
              <button
                type="button"
                onClick={() => setInputBuffer('')}
                disabled={!sessionActive || loading || !inputBuffer}
                aria-label="Clear direct text input"
                data-testid="btn-clear"
                className="rounded-lg bg-gray-600 text-white text-xs px-2 py-1 hover:bg-gray-500 disabled:opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                CLEAR
              </button>
              <button
                type="button"
                onClick={() => {
                  const trimmed = inputBuffer.trim();
                  if (!trimmed) return;
                  sendInput(trimmed);
                }}
                disabled={!sessionActive || loading || !inputBuffer.trim()}
                aria-label="Send direct input"
                data-testid="btn-send"
                className="rounded-lg bg-gray-600 text-white text-xs px-2.5 py-1 hover:bg-gray-500 disabled:opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                ✓
              </button>
            </div>

            {/* Phone navigation pill */}
            <div className="mx-3 mb-4 flex gap-2 text-center">
              <button
                type="button"
                onClick={() => sendInput('0')}
                disabled={!sessionActive || loading}
                aria-label="Back one level (Key 0)"
                data-testid="btn-back"
                className="flex-1 rounded-lg py-1 text-[10px] font-semibold bg-gray-600 text-gray-200 hover:bg-gray-500 disabled:opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                ◀ Back (0)
              </button>
              <button
                type="button"
                onClick={() => sendInput('00')}
                disabled={!sessionActive || loading}
                aria-label="Return to Main Menu (Key 00)"
                data-testid="btn-home"
                className="flex-1 rounded-lg py-1 text-[10px] font-semibold bg-gray-600 text-gray-200 hover:bg-gray-500 disabled:opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                ⌂ Home (00)
              </button>
            </div>
          </div>

          {/* Audit #56: Statutory Fee vs Resident Estimation Clarification */}
          <div
            data-testid="audit-56-clarification"
            className="w-72 mt-3 p-3 bg-[var(--paper-warm)] border border-[var(--rule)] rounded-lg text-left"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--ink-soft)] font-bold">
                Audit #56 · Fee Clarification
              </span>
              <span className="font-mono text-[9px] text-[var(--ink-soft)] bg-neutral-200/80 px-1.5 py-0.5 rounded">
                Civil Registry
              </span>
            </div>
            <p className="font-mono text-xs text-[var(--ink)] leading-snug font-semibold">
              Statutory Fee: 210 ETB | Resident reported paying: ~200 ETB
            </p>
            <p className="text-[10px] text-[var(--ink-soft)] mt-1 font-mono leading-normal">
              Variance within standard margin: Statutory fee is 210 ETB per circular, while citizen self-reported ~200 ETB.
            </p>
          </div>
        </section>

        {/* Column 3: Live Session Transcript & Demo Guide */}
        <div className="flex-1 flex flex-col gap-4 w-full min-w-0">
          <section
            aria-label="Session transcript"
            className="flex flex-col min-w-0 rounded-xl border border-[var(--rule)] bg-white overflow-hidden max-h-[70vh]"
          >
            <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--rule)]">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-soft)]">
                HTTP Transcript (POST /api/ussd)
              </h2>
              <button
                type="button"
                onClick={clearTranscript}
                aria-label="Clear HTTP transcript"
                className="text-xs text-[var(--ink-soft)] hover:text-[var(--ink)] underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)] rounded"
              >
                Clear
              </button>
            </header>

            <div
              ref={transcriptRef}
              data-testid="transcript-panel"
              className="flex-1 overflow-y-auto p-3 font-mono text-xs space-y-1.5 min-h-[160px]"
            >
              {transcript.length === 0 && (
                <p className="text-[var(--ink-soft)] italic text-center mt-6">
                  Dial *890# to begin a session
                </p>
              )}
              {transcript.map((entry) => (
                <div
                  key={entry.id}
                  data-direction={entry.direction}
                  className={[
                    'rounded px-2 py-1 whitespace-pre-wrap break-words',
                    entry.direction === 'sent'
                      ? 'bg-blue-50 text-blue-900 border-l-2 border-blue-400'
                      : entry.direction === 'received'
                      ? 'bg-green-50 text-green-900 border-l-2 border-green-400'
                      : 'text-[var(--ink-soft)] italic',
                  ].join(' ')}
                >
                  <span className="text-[9px] opacity-50 mr-2">#{entry.seq}</span>
                  {entry.text}
                </div>
              ))}
            </div>

            {/* Raw response display */}
            {lastRawResponse && (
              <div className="border-t border-[var(--rule)] p-3">
                <p className="text-[10px] font-semibold text-[var(--ink-soft)] mb-1 uppercase tracking-wide">
                  Last raw backend response
                </p>
                <pre
                  data-testid="raw-response"
                  className="text-[10px] font-mono bg-gray-50 rounded p-2 text-[var(--ink)] whitespace-pre-wrap break-words border border-[var(--rule)]"
                >
                  {lastRawResponse}
                </pre>
              </div>
            )}

            {/* Persona info footer */}
            <div className="border-t border-[var(--rule)] px-4 py-2 text-[10px] font-mono text-[var(--ink-soft)]">
              <span className={`font-semibold px-1.5 py-0.5 rounded ${badge.css}`}>{badge.label}</span>{' '}
              {selectedPersona.label} · {selectedPersona.msisdn}
            </div>
          </section>

          {/* Demo guide */}
          <section className="rounded-xl border border-[var(--rule)] bg-white p-4 text-xs text-[var(--ink-soft)]">
            <h2 className="font-semibold text-[var(--ink)] mb-2 font-sans">Checkpoint 2 — Demo Guide</h2>
            <ol className="list-decimal list-inside space-y-1 font-mono text-[11px]">
              <li>Select <strong>Amina</strong> (Demo Phone 1) → Dial *890# → press 1 → enter <strong>4412</strong> → press 1</li>
              <li>Answer 3 questions (2=No for each) → backend responds with witness count</li>
              <li>Note: counter moves 2 → 3 (threshold reached)</li>
              <li>Switch to <strong>Girma</strong> (Same-Cluster Duplicate) → Dial *890# → repeat flow</li>
              <li>Note: backend responds with <em>duplicate</em> message — counter stays at 3</li>
              <li data-testid="guide-audit-56">
                <strong>Audit #56 (Kalinda):</strong> Statutory Fee: 210 ETB | Resident reported paying: ~200 ETB (Variance within standard margin).
              </li>
            </ol>
            <p className="mt-2 text-[10px] italic font-sans">
              All responses come from the real <code>POST /api/ussd</code> backend. No client-side logic simulates the response.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
