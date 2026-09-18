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

/** Split a long string into 20-char LCD rows */
function toRows(text: string, width = 20): string[] {
  const words = text.split(' ');
  const rows: string[] = [];
  let current = '';
  for (const word of words) {
    if (current.length === 0) {
      // word itself may be too long - hard-break it
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
        current = remaining;
      } else {
        current = word;
      }
    }
  }
  if (current.length > 0) rows.push(current);
  return rows;
}

// ─── Role badge ───────────────────────────────────────────────────────────────

const ROLE_BADGE: Record<string, { label: string; css: string }> = {
  primary: { label: 'DEMO WITNESS', css: 'bg-green-100 text-green-800 border border-green-300' },
  duplicate: { label: 'DUPLICATE CLUSTER', css: 'bg-red-100 text-red-800 border border-red-300' },
  witness: { label: 'PRE-SEEDED', css: 'bg-gray-100 text-gray-700 border border-gray-300' },
};

// ─── Keypad layout ────────────────────────────────────────────────────────────

const KEYPAD_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
];

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
          setSession((s) => s ? { ...s, isAlive: false } : null);
          return;
        }

        const isEnd = isEndResponse(rawText);
        const rows = toRows(stripPrefix(rawText));
        setLcdLines(rows);
        setShowMore(false);
        if (isEnd) {
          setSession((s) => s ? { ...s, isAlive: false } : null);
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
          setSession((s) => s ? { ...s, isAlive: false } : null);
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
          setSession((s) => s ? { ...s, isAlive: false } : null);
        } else {
          setSession(newSession);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setLcdLines(['Network error', msg.slice(0, 60)]);
      setSession((s) => s ? { ...s, isAlive: false } : null);
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
            setSession((s) => s ? { ...s, isAlive: false } : null);
            return;
          }

          const isEnd = isEndResponse(rawText);
          const rows = toRows(stripPrefix(rawText));
          setLcdLines(rows);
          setShowMore(false);
          if (isEnd) {
            setSession((s) => s ? { ...s, isAlive: false } : null);
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
            setSession((s) => s ? { ...s, isAlive: false } : null);
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
            setSession((s) => s ? { ...s, isAlive: false } : null);
          } else {
            setSession(updatedSession);
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setLcdLines(['Network error', msg.slice(0, 60)]);
        setSession((s) => s ? { ...s, isAlive: false } : null);
        addTranscriptEntry('info', `[ERROR] ${msg}`);
      } finally {
        setLoading(false);
      }
    },
    [session, loading, channelMode, addTranscriptEntry]
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
      setLcdLines(['Ward Proof-Line', 'Feature-Phone Sim', '', 'Select persona']);
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
          <div className="flex gap-2 p-1 bg-gray-100 rounded-lg border border-[var(--rule)] w-full">
            <button
              type="button"
              data-testid="mode-ussd"
              onClick={() => {
                setChannelMode('USSD');
                setSession(null);
                setActiveAudioKeys([]);
                setLcdLines(['Ward Proof-Line', 'Feature-Phone Sim', '', 'Select persona']);
                setLastRawResponse('');
                addTranscriptEntry('info', '[MODE] Switched to USSD text transport (*890#)');
              }}
              className={[
                'flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors',
                channelMode === 'USSD'
                  ? 'bg-white text-[var(--ink)] shadow-sm border border-gray-200'
                  : 'text-gray-500 hover:text-gray-900',
              ].join(' ')}
            >
              USSD (Text)
            </button>
            <button
              type="button"
              data-testid="mode-ivr"
              onClick={() => {
                setChannelMode('IVR');
                setSession(null);
                setActiveAudioKeys([]);
                setLcdLines(['Ward Proof-Line', 'IVR Voice Engine', '', 'Press DIAL to call']);
                setLastRawResponse('');
                addTranscriptEntry('info', '[MODE] Switched to IVR voice audio transport (/api/ivr)');
              }}
              className={[
                'flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors',
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
                    onClick={() => switchPersona(p)}
                    aria-pressed={isActive}
                    className={[
                      'flex flex-col text-left rounded-lg border px-3 py-2 transition-all text-sm',
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
        <div className="w-full lg:w-80 flex flex-col items-center shrink-0">
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

            {/* Scroll Button (if overflow) */}
            {lcdLines.length > 4 && (
              <div className="mx-3 mt-1 flex justify-center">
                <button
                  onClick={() => setShowMore(!showMore)}
                  className="text-[10px] font-bold text-gray-400 hover:text-gray-200 uppercase tracking-widest bg-gray-700 px-3 py-0.5 rounded-full"
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
                onClick={startSession}
                disabled={loading}
                data-testid="btn-dial"
                className={[
                  'flex-1 rounded-lg py-1.5 text-xs font-semibold transition-colors',
                  loading
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-[var(--state-open)] text-white hover:opacity-90 active:opacity-75',
                ].join(' ')}
              >
                {session?.isAlive ? '↺ REDIAL' : channelMode === 'USSD' ? 'DIAL *890#' : 'CALL IVR'}
              </button>
              {session && !session.isAlive && (
                <button
                  onClick={startSession}
                  disabled={loading}
                  className="flex-1 rounded-lg py-1.5 text-xs font-semibold bg-[var(--shell)] text-white hover:opacity-90"
                >
                  NEW
                </button>
              )}
            </div>

            {/* ── Keypad ── */}
            <div
              data-testid="keypad"
              className="mx-3 mt-3 mb-4 grid grid-cols-3 gap-2"
            >
              {KEYPAD_ROWS.map((row) =>
                row.map((key) => (
                  <button
                    key={key}
                    onClick={() => {
                      if (sessionActive) sendInput(key);
                    }}
                    disabled={!sessionActive || loading}
                    data-testid={`key-${key}`}
                    className={[
                      'rounded-lg py-2 text-sm font-bold transition-all border',
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
                data-testid="text-input"
                className="flex-1 rounded-lg border border-gray-600 bg-gray-700 text-white text-xs px-2 py-1 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-white disabled:opacity-40"
              />
              <button
                onClick={() => {
                  const trimmed = inputBuffer.trim();
                  if (!trimmed) return;
                  sendInput(trimmed);
                }}
                disabled={!sessionActive || loading || !inputBuffer.trim()}
                data-testid="btn-send"
                className="rounded-lg bg-gray-600 text-white text-xs px-2 py-1 hover:bg-gray-500 disabled:opacity-30"
              >
                ✓
              </button>
            </div>

            {/* Phone navigation pill */}
            <div className="mx-3 mb-4 flex gap-2 text-center">
              <button
                onClick={() => sendInput('0')}
                disabled={!sessionActive || loading}
                data-testid="btn-back"
                className="flex-1 rounded-lg py-1 text-[10px] font-semibold bg-gray-600 text-gray-200 hover:bg-gray-500 disabled:opacity-30"
              >
                ◀ Back (0)
              </button>
              <button
                onClick={() => sendInput('00')}
                disabled={!sessionActive || loading}
                data-testid="btn-home"
                className="flex-1 rounded-lg py-1 text-[10px] font-semibold bg-gray-600 text-gray-200 hover:bg-gray-500 disabled:opacity-30"
              >
                ⌂ Home (00)
              </button>
            </div>
          </div>
        </div>

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
                onClick={clearTranscript}
                className="text-xs text-[var(--ink-soft)] hover:text-[var(--ink)] underline"
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
