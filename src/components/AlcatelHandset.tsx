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
  { key: '0', letters: '—', ariaLabel: 'Digit 0' },
  { key: '#', letters: '⇧ 🔔', ariaLabel: 'Hash – End' },
];

export function AlcatelHandset({
  session,
  selectedPersona,
  lcdLines,
  loading,
  channelMode,
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
    <div className="flex flex-col items-center select-none w-full max-w-[310px] mx-auto">
      {/* ─── Outer Physical Chassis (Authentic Alcatel 1066 Matte Slate-Teal) ─── */}
      <div
        data-testid="feature-phone"
        className="w-full bg-[#22333A] rounded-[38px] p-3.5 pt-3 pb-5 shadow-2xl shadow-slate-900/40 border border-[#2D424B] relative flex flex-col items-center transition-transform"
      >
        {/* Subtle molded plastic chamfer highlight */}
        <div className="absolute inset-x-8 top-1 h-[1.5px] bg-white/10 rounded-full pointer-events-none" />

        {/* Earpiece slit */}
        <div className="w-12 h-1.5 rounded-full bg-[#111A1D] mb-2.5 border-b border-white/5 flex items-center justify-center">
          <div className="w-7 h-0.5 rounded-full bg-[#202E34]" />
        </div>

        {/* ─── Screen Bezel & LCD Display Frame ─── */}
        <div className="w-full bg-[#0E1619] rounded-2xl p-2.5 border border-[#162227] shadow-inner mb-2.5">
          {/* Inset Retro Olive LCD Screen */}
          <div
            data-testid="lcd-display"
            aria-label="LCD display"
            className="w-full bg-[#C8D9A2] text-[#142010] rounded-md p-2.5 font-mono text-xs shadow-inner relative overflow-hidden flex flex-col justify-between border border-[#A4B57D]"
            style={{ minHeight: '135px' }}
          >
            {/* Subtle retro LCD scanlines */}
            <div
              className="absolute inset-0 pointer-events-none opacity-10"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.2) 3px)',
              }}
            />

            {/* Top LCD Status Bar */}
            <div className="flex items-center justify-between text-[9px] font-bold tracking-tight opacity-80 border-b border-[#142010]/20 pb-1 mb-1">
              <div className="flex items-center gap-1">
                {/* Signal bars */}
                <span className="flex items-end gap-0.5 h-2.5" title="Signal">
                  <span className="w-0.5 h-1 bg-[#142010]" />
                  <span className="w-0.5 h-1.5 bg-[#142010]" />
                  <span className="w-0.5 h-2 bg-[#142010]" />
                  <span className="w-0.5 h-2.5 bg-[#142010]" />
                </span>
                <span>Safaricom {channelMode === 'IVR' ? '• IVR' : ''}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span data-testid="phone-number">
                  {selectedPersona.msisdn.replace('+', '')}
                </span>
                <span>10:24</span>
                {/* Battery icon */}
                <div className="w-3.5 h-2 border border-[#142010] rounded-xs p-0.5 flex items-center">
                  <div className="w-full h-full bg-[#142010]" />
                </div>
              </div>
            </div>

            {/* 4 × 20 USSD Text Lines */}
            <div className="flex-1 flex flex-col justify-center space-y-0.5 py-0.5 font-mono">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  data-testid={`lcd-line-${i}`}
                  className="leading-snug truncate whitespace-pre text-[12px] font-medium tracking-tight"
                >
                  {lcdLines[i] ?? ''}
                </div>
              ))}
            </div>

            {/* Bottom LCD Softkey Labels */}
            <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider opacity-75 pt-1 border-t border-[#142010]/20 mt-1">
              <span>Select</span>
              <span>Back</span>
            </div>
          </div>

          {/* Alcatel Logo Chin (White, signature lowercase wordmark) */}
          <div className="text-center mt-1.5">
            <span className="font-sans font-extrabold text-[10px] tracking-[0.25em] text-white/90 lowercase">
              alcatel
            </span>
          </div>
        </div>

        {/* ─── Control Key Cluster: Softkeys, D-Pad, Call & End ─── */}
        <div className="w-full px-0.5 mb-2.5">
          {/* Row 1: Softkeys & Circular 5-Way D-Pad */}
          <div className="grid grid-cols-3 gap-1.5 items-center mb-2">
            {/* Left Softkey */}
            <button
              type="button"
              aria-label="Left softkey - Select"
              onClick={() => {
                if (sessionActive) onKeypadPress('1');
              }}
              className="h-7 bg-[#202E34] hover:bg-[#2A3C43] active:bg-[#152024] active:translate-y-0.5 text-slate-300 text-[11px] font-bold rounded-lg border-t border-white/10 shadow-xs flex items-center justify-center transition-all"
            >
              —
            </button>

            {/* 5-Way Circular D-Pad */}
            <div className="w-16 h-14 mx-auto relative bg-[#172327] rounded-full border border-slate-600/50 shadow flex items-center justify-center p-1">
              {/* Up arrow */}
              <button
                type="button"
                aria-label="D-Pad Up"
                onClick={() => {}}
                className="absolute top-0.5 left-1/2 -translate-x-1/2 text-slate-400 text-[8px] hover:text-white"
              >
                ▲
              </button>
              {/* Down arrow */}
              <button
                type="button"
                aria-label="D-Pad Down"
                onClick={() => {}}
                className="absolute bottom-0.5 left-1/2 -translate-x-1/2 text-slate-400 text-[8px] hover:text-white"
              >
                ▼
              </button>
              {/* Left arrow */}
              <button
                type="button"
                aria-label="D-Pad Left"
                onClick={() => {}}
                className="absolute left-1 top-1/2 -translate-y-1/2 text-slate-400 text-[8px] hover:text-white"
              >
                ◀
              </button>
              {/* Right arrow */}
              <button
                type="button"
                aria-label="D-Pad Right"
                onClick={() => {}}
                className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 text-[8px] hover:text-white"
              >
                ▶
              </button>
              {/* Center OK Button */}
              <button
                type="button"
                aria-label="D-Pad Center OK"
                onClick={() => {
                  if (!sessionActive) onDial();
                }}
                className="w-7 h-7 bg-[#2A3C43] hover:bg-[#344B53] active:bg-[#182327] active:scale-95 rounded-full border border-slate-500/40 flex items-center justify-center text-[9px] font-bold text-white shadow-inner"
              >
                OK
              </button>
            </div>

            {/* Right Softkey (Back) */}
            <button
              type="button"
              data-testid="btn-back"
              aria-label="Back button"
              onClick={onBack}
              className="h-7 bg-[#202E34] hover:bg-[#2A3C43] active:bg-[#152024] active:translate-y-0.5 text-slate-300 text-[11px] font-bold rounded-lg border-t border-white/10 shadow-xs flex items-center justify-center transition-all"
            >
              —
            </button>
          </div>

          {/* Row 2: Call Key (Green) & End Key (Red) */}
          <div className="grid grid-cols-2 gap-2.5 px-0.5">
            {/* Green Call / Dial Key */}
            <button
              type="button"
              data-testid="btn-dial"
              aria-label={sessionActive ? 'Redial session' : 'Dial star 890 hash'}
              onClick={onDial}
              disabled={loading}
              className="h-8 rounded-xl bg-[#1A2E2A] hover:bg-[#223D38] active:translate-y-0.5 text-emerald-400 font-bold flex items-center justify-center border border-emerald-500/40 shadow-xs transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-50"
            >
              <svg className="w-3.5 h-3.5 mr-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2a1 1 0 011.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 011 1v3.5a1 1 0 01-1 1C10.61 21 3 13.39 3 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.45.57 3.57a1 1 0 01-.25 1.02l-2.2 2.2z" />
              </svg>
              <span className="text-[11px] tracking-tight">{sessionActive ? 'REDIAL' : 'DIAL'}</span>
            </button>

            {/* Red End Key */}
            <button
              type="button"
              data-testid="btn-end"
              aria-label="End call session"
              onClick={onEnd}
              disabled={loading || !sessionActive}
              className="h-8 rounded-xl bg-[#331D22] hover:bg-[#42252B] active:translate-y-0.5 text-rose-400 font-bold flex items-center justify-center border border-rose-500/40 shadow-xs transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 disabled:opacity-40"
            >
              <svg className="w-3.5 h-3.5 mr-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 9c-1.6 0-3.15.25-4.6.72a1 1 0 00-.73.97v3.2a1 1 0 00.6.92 11.96 11.96 0 007.46 0 1 1 0 00.6-.92v-3.2a1 1 0 00-.73-.97A14.86 14.86 0 0012 9z" />
              </svg>
              <span className="text-[11px] tracking-tight">END</span>
            </button>
          </div>
        </div>

        {/* ─── Tactile 3-Column 12-Key Numeric Keypad ─── */}
        <div
          data-testid="keypad"
          role="group"
          aria-label="Phone keypad"
          className="w-full grid grid-cols-3 gap-1.5 px-0.5 mb-2"
        >
          {KEYPAD_KEYS.map(({ key, letters, ariaLabel }) => (
            <button
              key={key}
              type="button"
              data-testid={`key-${key}`}
              aria-label={ariaLabel}
              onClick={() => {
                if (sessionActive) onKeypadPress(key);
              }}
              disabled={!sessionActive || loading}
              className={`h-10 rounded-xl flex flex-col items-center justify-center transition-all border-t border-white/10 shadow-2xs ${
                sessionActive && !loading
                  ? 'bg-[#2A3C43] hover:bg-[#344B53] active:bg-[#1A252A] active:translate-y-0.5 text-white cursor-pointer'
                  : 'bg-[#1E2B30] text-slate-500 cursor-not-allowed border-transparent'
              }`}
            >
              <span className="text-xs font-bold leading-none">{key}</span>
              <span className="text-[7.5px] text-slate-400 font-medium leading-none mt-0.5 tracking-wider">
                {letters}
              </span>
            </button>
          ))}
        </div>

        {/* ─── Direct Text Input Row ─── */}
        <div className="w-full px-0.5 flex gap-1 mb-2">
          <input
            ref={inputRef}
            type="text"
            value={inputBuffer}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={onInputKeyDown}
            disabled={!sessionActive || loading}
            placeholder={sessionActive ? 'Type code & Enter' : 'Inactive'}
            maxLength={10}
            aria-label="Direct keypad input"
            data-testid="text-input"
            className="flex-1 bg-[#141E22] border border-slate-700 rounded-lg text-white text-xs px-2 py-1 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-40 font-mono"
          />
          <button
            type="button"
            data-testid="btn-clear"
            aria-label="Clear direct text input"
            onClick={onClearInput}
            disabled={!sessionActive || loading || !inputBuffer}
            className="px-2 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-white text-[10px] font-semibold rounded-lg transition-colors"
          >
            Clear
          </button>
          <button
            type="button"
            data-testid="btn-direct-send"
            aria-label="Send direct input"
            onClick={onDirectSend}
            disabled={!sessionActive || loading || !inputBuffer}
            className="px-2 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white text-[10px] font-semibold rounded-lg transition-colors"
          >
            Send
          </button>
          <button
            type="button"
            data-testid="btn-home"
            aria-label="Home button"
            onClick={onHome}
            disabled={!sessionActive || loading}
            className="px-2 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-white text-[10px] font-semibold rounded-lg transition-colors"
          >
            Home
          </button>
        </div>

        {/* Session Telemetry Status */}
        <div className="w-full px-1 flex items-center justify-between text-[9px] font-mono text-slate-400">
          <span data-testid="session-state">
            {session ? (session.isAlive ? '● ACTIVE' : '◉ ENDED') : '○ IDLE'}
          </span>
          <span data-testid="session-accumulator" className="truncate max-w-[140px]">
            [{session?.textAccumulator || '—'}]
          </span>
        </div>

        {/* Invalid Input Banner */}
        {invalidInputNotice && (
          <div
            role="alert"
            data-testid="invalid-input-banner"
            className="w-full mt-2 p-2 bg-amber-400/90 text-amber-950 text-xs font-semibold rounded-lg flex items-center justify-between"
          >
            <span className="truncate">{invalidInputNotice}</span>
            <button
              type="button"
              onClick={onDismissInvalid}
              className="ml-2 font-bold hover:opacity-75"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* ─── Current Action Card below Handset (Matches Reference 2) ─── */}
      <div className="w-full mt-3 bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-sm flex flex-col gap-2">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-blue-600 font-bold">📲</span>
          <span className="font-bold text-slate-900">Current Action</span>
        </div>
        <p className="text-xs text-slate-600">
          {sessionActive
            ? 'Follow prompt on LCD or press numbers on keypad.'
            : 'Dial *890# to open the USSD menu'}
        </p>
        <div className="flex gap-2 mt-1">
          <button
            type="button"
            onClick={onDial}
            disabled={loading}
            className="flex-1 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 active:scale-95 text-white flex items-center justify-center gap-1 transition-all shadow-sm"
          >
            <span>Dial *890#</span>
            <span>›</span>
          </button>
          <button
            type="button"
            data-testid="btn-new"
            aria-label="Start new session"
            onClick={onStartNew || onDial}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition-colors"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
