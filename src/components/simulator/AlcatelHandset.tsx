'use client';
// AlcatelHandset — High-Fidelity Feature Phone Simulator Component
// Authoritative sources: Picture 1 (Alcatel 1066 physical reference) & Picture 2 (Design North Star)
// DOM / behavioral contracts: Preserves 100% of simulator.spec.ts test contracts.

import React from 'react';

export interface AlcatelHandsetProps {
  session: {
    sessionId: string;
    phoneNumber: string;
    textAccumulator: string;
    isAlive: boolean;
  } | null;
  selectedPersona: {
    id: string;
    label: string;
    msisdn: string;
    clusterKey: string;
    role: string;
  };
  lcdLines: string[];
  loading: boolean;
  channelMode: 'USSD' | 'IVR';
  onChannelModeChange?: (mode: 'USSD' | 'IVR') => void;
  invalidInputNotice: string | null;
  inputBuffer: string;
  onInputChange: (value: string) => void;
  onInputKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onClearInput: () => void;
  onDirectSend: () => void;
  onKeypadPress: (key: string) => void;
  onDial: () => void;
  onEnd: () => void;
  onBack: () => void;
  onHome: () => void;
  onDismissInvalid: () => void;
  onStartNew?: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

const KEYPAD_KEYS: Array<{ key: string; letters: string; ariaLabel: string }> = [
  { key: '1', letters: 'oo', ariaLabel: 'Digit 1' },
  { key: '2', letters: 'ABC', ariaLabel: 'Digit 2' },
  { key: '3', letters: 'DEF', ariaLabel: 'Digit 3' },
  { key: '4', letters: 'GHI', ariaLabel: 'Digit 4' },
  { key: '5', letters: 'JKL', ariaLabel: 'Digit 5' },
  { key: '6', letters: 'MNO', ariaLabel: 'Digit 6' },
  { key: '7', letters: 'PQRS', ariaLabel: 'Digit 7' },
  { key: '8', letters: 'TUV', ariaLabel: 'Digit 8' },
  { key: '9', letters: 'WXYZ', ariaLabel: 'Digit 9' },
  { key: '*', letters: '+ 🔒', ariaLabel: 'Asterisk – Send' },
  { key: '0', letters: '🌐', ariaLabel: 'Digit 0' },
  { key: '#', letters: '⇧ 🔔', ariaLabel: 'Hash – End' },
];

export function AlcatelHandset({
  session,
  selectedPersona,
  lcdLines,
  loading,
  channelMode,
  onChannelModeChange,
  invalidInputNotice,
  inputBuffer,
  onInputChange,
  onInputKeyDown,
  onClearInput,
  onDirectSend,
  onKeypadPress,
  onDial,
  onEnd,
  onBack,
  onHome,
  onDismissInvalid,
  onStartNew,
  inputRef,
}: AlcatelHandsetProps) {
  const sessionActive = Boolean(session?.isAlive);

  return (
    <div className="flex flex-col items-center select-none w-full max-w-[340px] mx-auto space-y-4">
      {/* ─── Prominent Channel Protocol Selection ─── */}
      <div className="w-full bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-mono font-black uppercase tracking-wider text-slate-600">
            Channel Protocol
          </span>
          <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            GSM Carrier Layer
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl mb-3">
          <button
            type="button"
            onClick={() => onChannelModeChange?.('USSD')}
            className={`py-2.5 px-4 text-sm font-extrabold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 ${
              channelMode === 'USSD'
                ? 'bg-white text-blue-700 shadow-xs ring-1 ring-slate-200/80 font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>USSD (*890#)</span>
          </button>
          <button
            type="button"
            onClick={() => onChannelModeChange?.('IVR')}
            className={`py-2.5 px-4 text-sm font-extrabold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 ${
              channelMode === 'IVR'
                ? 'bg-white text-blue-700 shadow-xs ring-1 ring-slate-200/80 font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>IVR (Voice)</span>
          </button>
        </div>

        <p className="text-xs text-slate-600 leading-normal font-medium">
          {channelMode === 'USSD'
            ? 'Interactive GSM session via shortcode. Works on basic 2G feature phones without data.'
            : 'Interactive voice response audio prompts designed for low-literacy rural field verification.'}
        </p>
      </div>

      {/* ─── Redesigned High-Visibility "Current Action" Card ─── */}
      <div className="w-full bg-white border-2 border-blue-600/40 rounded-2xl p-5 shadow-sm flex flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span
              className={`w-3 h-3 rounded-full ${
                sessionActive ? 'bg-emerald-500 animate-pulse' : 'bg-blue-600'
              }`}
            />
            <span className="font-mono text-xs font-black uppercase tracking-wider text-blue-700">
              Current Action
            </span>
          </div>
          <span className="text-xs font-mono font-bold text-slate-500">
            {sessionActive ? 'Session Active' : 'Ready to Dial'}
          </span>
        </div>

        <p className="text-base sm:text-lg font-black text-slate-900 leading-snug">
          {sessionActive
            ? 'Follow instructions on phone LCD or enter digits in the buffer below.'
            : 'Dial *890# to open the Ubuntu Ledger menu.'}
        </p>

        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            data-testid="action-start-new-session"
            onClick={onStartNew || onDial}
            disabled={loading}
            className="flex-1 py-3 px-4 rounded-xl font-black text-sm bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <span className="text-base leading-none">📞</span>
            <span>{sessionActive ? 'Restart Session' : 'Dial *890#'}</span>
          </button>

          {sessionActive && (
            <button
              type="button"
              data-testid="action-end-session"
              onClick={onEnd}
              disabled={loading}
              className="py-3 px-4 rounded-xl font-bold text-sm bg-red-50 hover:bg-red-100 active:bg-red-200 text-red-700 border border-red-200 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <span>✕</span>
              <span>End</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── Physical Alcatel 1066 Feature Phone Chassis ─── */}
      <div
        data-testid="feature-phone"
        aria-label="Alcatel 1066 Feature Phone"
        className="w-full bg-[#182026] text-white rounded-[36px] p-4 sm:p-5 shadow-2xl border-4 border-[#2D3B45] flex flex-col items-center relative overflow-hidden"
        style={{
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.08) inset',
        }}
      >
        {/* Subtle physical texture gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.04] via-transparent to-black/30 pointer-events-none rounded-[32px]" />

        {/* Earpiece Speaker Slot */}
        <div className="w-14 h-1.5 bg-[#0C1014] rounded-full mb-3 border border-white/10 shadow-inner" />

        {/* ─── Screen Bezel & Olive LCD Screen ─── */}
        <div className="w-full bg-[#0D1317] rounded-xl p-3 mb-4 border border-white/10 shadow-inner flex flex-col">
          {/* Inset Retro Olive LCD Screen */}
          <div
            data-testid="lcd-display"
            aria-label="LCD display"
            className="w-full bg-[#C6D79E] text-[#12200E] rounded-md p-2.5 font-mono text-xs shadow-inner relative overflow-hidden flex flex-col justify-between border border-[#9FB07A]"
            style={{
              minHeight: '138px',
              boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.25)',
            }}
          >
            {/* Subtle retro LCD scanlines */}
            <div
              className="absolute inset-0 pointer-events-none opacity-15"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(18, 32, 14, 0.2) 3px)',
              }}
            />

            {/* Top LCD Status Bar */}
            <div className="flex items-center justify-between text-[10px] font-bold tracking-tight opacity-85 border-b border-[#12200E]/25 pb-1 mb-1 relative z-10">
              <div className="flex items-center gap-1.5">
                {/* 4 Signal bars */}
                <span className="flex items-end gap-0.5 h-3" title="Signal strength">
                  <span className="w-0.5 h-1 bg-[#12200E]" />
                  <span className="w-0.5 h-1.5 bg-[#12200E]" />
                  <span className="w-0.5 h-2 bg-[#12200E]" />
                  <span className="w-0.5 h-2.5 bg-[#12200E]" />
                </span>
                <span className="font-sans font-extrabold text-[9px] uppercase tracking-wider">
                  Safaricom {channelMode === 'IVR' ? '• Voice' : ''}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {inputBuffer ? (
                  <span className="font-mono font-black text-[9.5px] bg-[#12200E]/15 px-1 rounded">
                    [{inputBuffer}]
                  </span>
                ) : null}
                <span data-testid="phone-number" className="font-mono text-[9.5px]">
                  {selectedPersona.msisdn.replace('+', '')}
                </span>
                <span className="font-sans text-[9px]">10:24</span>
                {/* Battery icon with charging bar */}
                <div className="w-4 h-2.5 border border-[#12200E] rounded-xs p-0.5 flex items-center">
                  <div className="w-full h-full bg-[#12200E]" />
                </div>
              </div>
            </div>

            {/* 4 × 20 USSD Text Lines (Sacred DOM Contract) */}
            <div className="flex-1 flex flex-col justify-center space-y-0.5 py-1 font-mono relative z-10">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  data-testid={`lcd-line-${i}`}
                  className="leading-snug truncate whitespace-pre text-[12.5px] font-bold tracking-tight"
                >
                  {lcdLines[i] ?? ''}
                </div>
              ))}
            </div>

            {/* LCD Input Buffer Mirror Status Line */}
            <div
              data-testid="lcd-buffer-status"
              className="text-[10px] font-mono font-bold tracking-tight text-[#12200E] bg-[#12200E]/10 px-1.5 py-0.5 rounded flex items-center justify-between relative z-10 my-0.5 border border-[#12200E]/20"
            >
              <span className="opacity-75">BUFFER:</span>
              <span className="font-mono font-black">
                {inputBuffer ? `${inputBuffer} █` : '—'}
              </span>
            </div>

            {/* Bottom LCD Softkey Labels */}
            <div className="flex items-center justify-between text-[9.5px] font-extrabold uppercase tracking-wider opacity-80 pt-1 border-t border-[#12200E]/20 mt-0.5 relative z-10">
              <span>Select</span>
              <span>Back</span>
            </div>
          </div>

          {/* Feature Phone Brand Chin */}
          <div className="text-center mt-2.5">
            <span className="font-sans font-extrabold text-[10px] tracking-[0.24em] text-slate-300 uppercase">
              UBUNTU LEDGER
            </span>
          </div>
        </div>

        {/* ─── Control Key Cluster: Softkeys, D-Pad, Call & End ─── */}
        <div className="w-full px-0.5 mb-3">
          {/* Row 1: Softkeys & Circular 5-Way D-Pad */}
          <div className="grid grid-cols-3 gap-2 items-center mb-2.5">
            {/* Left Softkey */}
            <button
              type="button"
              aria-label="Left softkey - Select"
              onClick={() => {
                if (sessionActive) onKeypadPress('1');
              }}
              className="h-8 bg-[#23333B] hover:bg-[#2C3F48] active:bg-[#182328] active:translate-y-0.5 text-slate-200 text-sm font-bold rounded-xl border-t border-white/15 shadow-sm flex items-center justify-center transition-all cursor-pointer"
            >
              —
            </button>

            {/* 5-Way Squircle D-Pad */}
            <div className="w-20 h-16 mx-auto relative bg-[#10161A] rounded-[22px] border-2 border-slate-600/70 shadow-lg flex items-center justify-center p-1">
              <button
                type="button"
                aria-label="D-Pad Up"
                onClick={() => {}}
                className="absolute top-1 left-1/2 -translate-x-1/2 text-slate-400 text-[10px] hover:text-white"
              >
                ▲
              </button>
              <button
                type="button"
                aria-label="D-Pad Down"
                onClick={() => {}}
                className="absolute bottom-1 left-1/2 -translate-x-1/2 text-slate-400 text-[10px] hover:text-white"
              >
                ▼
              </button>
              <button
                type="button"
                aria-label="D-Pad Left"
                onClick={() => {}}
                className="absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] hover:text-white"
              >
                ◀
              </button>
              <button
                type="button"
                aria-label="D-Pad Right"
                onClick={() => {}}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] hover:text-white"
              >
                ▶
              </button>
              <button
                type="button"
                aria-label="D-Pad Center OK"
                onClick={() => {
                  if (!sessionActive) onDial();
                }}
                className="w-9 h-8 bg-[#27363D] hover:bg-[#34464F] active:bg-[#1A252A] active:scale-95 rounded-[12px] border border-slate-400/40 flex items-center justify-center text-[10px] font-extrabold text-white shadow-inner"
              >
                OK
              </button>
            </div>

            {/* Right Softkey */}
            <button
              type="button"
              data-testid="btn-back"
              aria-label="Back button"
              onClick={onBack}
              className="h-8 bg-[#23333B] hover:bg-[#2C3F48] active:bg-[#182328] active:translate-y-0.5 text-slate-200 text-xs font-bold rounded-xl border-t border-white/15 shadow-sm flex items-center justify-center transition-all cursor-pointer"
            >
              — / 💬
            </button>
          </div>

          {/* Row 2: Call Key (Green) & End Key (Red) */}
          <div className="grid grid-cols-2 gap-3 px-0.5">
            <button
              type="button"
              data-testid="btn-dial"
              aria-label={sessionActive ? 'Redial session' : 'Dial star 890 hash'}
              onClick={onDial}
              disabled={loading}
              className="h-9 bg-[#235836] hover:bg-[#2D6C43] active:bg-[#1A4228] active:translate-y-0.5 text-white text-xs font-black rounded-xl border-t border-emerald-400/30 shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <span className="text-sm">📞</span>
              <span>DIAL</span>
            </button>

            <button
              type="button"
              data-testid="btn-end"
              aria-label="End session"
              onClick={onEnd}
              disabled={!sessionActive || loading}
              className={`h-9 rounded-xl flex items-center justify-center gap-1.5 text-xs font-black transition-all border-t ${
                sessionActive && !loading
                  ? 'bg-[#7A2828] hover:bg-[#963232] active:bg-[#5C1E1E] text-white border-rose-400/30 shadow-md active:translate-y-0.5 cursor-pointer'
                  : 'bg-[#332222] text-slate-500 cursor-not-allowed border-transparent'
              }`}
            >
              <span className="text-sm">✕</span>
              <span>END</span>
            </button>
          </div>
        </div>

        {/* ─── 3 × 4 Numeric Keypad Grid ─── */}
        <div
          data-testid="keypad"
          role="grid"
          aria-label="Alcatel numeric phone keypad"
          className="grid grid-cols-3 gap-2 w-full px-0.5 mb-3"
        >
          {KEYPAD_KEYS.map(({ key, letters, ariaLabel }) => {
            const isKey5 = key === '5';
            return (
              <button
                key={key}
                type="button"
                data-testid={`key-${key}`}
                aria-label={ariaLabel}
                onClick={() => {
                  if (sessionActive) onKeypadPress(key);
                }}
                disabled={!sessionActive || loading}
                className={`h-11 rounded-xl flex flex-col items-center justify-center relative transition-all border-t border-white/15 shadow-sm ${
                  sessionActive && !loading
                    ? 'bg-[#2A3C44] hover:bg-[#354C57] active:bg-[#1A252A] active:translate-y-0.5 text-white cursor-pointer'
                    : 'bg-[#1D292F] text-slate-500 cursor-not-allowed border-transparent'
                }`}
              >
                {isKey5 && (
                  <>
                    <span className="absolute left-1.5 top-1/2 -translate-y-1/2 w-0.5 h-3 bg-slate-400/40 rounded-full" />
                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 w-0.5 h-3 bg-slate-400/40 rounded-full" />
                  </>
                )}
                <span className="text-sm font-bold leading-none">{key}</span>
                <span className="text-[8px] text-slate-300 font-semibold leading-none mt-1 tracking-wider">
                  {letters}
                </span>
              </button>
            );
          })}
        </div>

        {/* ─── Enforced Large Handset Input Buffer (D-001 Specifications) ─── */}
        <div className="w-full px-0.5 mb-3">
          <label
            htmlFor="ussd-input-buffer"
            className="block text-[11px] font-mono font-bold text-slate-300 uppercase tracking-wider mb-1.5"
          >
            Handset Input Buffer
          </label>
          <div className="flex gap-1.5">
            <input
              id="ussd-input-buffer"
              ref={inputRef}
              type="text"
              value={inputBuffer}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={onInputKeyDown}
              disabled={!sessionActive || loading}
              placeholder="Type digits here, then press Send"
              maxLength={10}
              aria-label="USSD input buffer"
              data-testid="text-input"
              className="flex-1 min-h-[48px] h-12 bg-[#121A1E] border-2 border-slate-400 rounded-xl text-white text-lg font-mono px-3.5 placeholder:text-slate-400 placeholder:text-xs sm:placeholder:text-sm focus:outline-none focus:border-blue-400 focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-40"
            />
            <button
              type="button"
              data-testid="btn-clear"
              aria-label="Clear direct text input"
              onClick={onClearInput}
              disabled={!sessionActive || loading || !inputBuffer}
              className="min-h-[48px] h-12 px-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center"
            >
              Clear
            </button>
            <button
              type="button"
              data-testid="btn-direct-send"
              aria-label="Send direct input"
              onClick={onDirectSend}
              disabled={!sessionActive || loading || !inputBuffer}
              className="min-h-[48px] h-12 px-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white text-xs font-black rounded-xl transition-colors cursor-pointer flex items-center justify-center"
            >
              Send
            </button>
            <button
              type="button"
              data-testid="btn-home"
              aria-label="Home button"
              onClick={onHome}
              disabled={!sessionActive || loading}
              className="min-h-[48px] h-12 px-2.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center"
            >
              Home
            </button>
          </div>
        </div>

        {/* Session Telemetry Status */}
        <div className="w-full px-1 flex items-center justify-between text-[10px] font-mono text-slate-400 border-t border-slate-800/80 pt-1.5">
          <span data-testid="session-state" className="font-bold">
            {session ? (session.isAlive ? '● ACTIVE' : '◉ ENDED') : '○ IDLE'}
          </span>
          <span data-testid="session-accumulator" className="truncate max-w-[150px]">
            [{session?.textAccumulator || '—'}]
          </span>
        </div>

        {/* Invalid Input Banner */}
        {invalidInputNotice && (
          <div
            role="alert"
            data-testid="invalid-input-banner"
            className="w-full mt-2.5 p-2.5 bg-amber-400 text-amber-950 text-xs font-bold rounded-xl flex items-center justify-between shadow-sm"
          >
            <span className="truncate">{invalidInputNotice}</span>
            <button
              type="button"
              onClick={onDismissInvalid}
              className="ml-2 font-extrabold hover:opacity-75"
            >
              ×
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
