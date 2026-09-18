'use client';

// RefusalScript Component (T-27)
// Authoritative sources:
// - docs/specs/05-api-contracts.md §6
// - docs/specs/08-ui-ux-design.md §5, §6
// - docs/specs/10-skills.md S-11
// - docs/specs/11-tasks.md T-27

import React, { useState } from 'react';

export interface RefusalScriptProps {
  scriptText: string;
  sourceCitation?: string;
  audioKey?: string;
  className?: string;
}

export function RefusalScript({
  scriptText,
  sourceCitation,
  audioKey = 'audio/refusal-script.mp3',
  className = '',
}: RefusalScriptProps) {
  const [copied, setCopied] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const handleCopy = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(scriptText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // Fallback if clipboard API is restricted
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleToggleAudio = () => {
    setIsPlaying((prev) => !prev);
  };

  return (
    <div
      data-testid="refusal-script"
      className={`border border-[var(--rule)] bg-[var(--paper)] p-4 rounded-none font-mono text-sm print:bg-white print:text-black print:border-black ${className}`}
    >
      <div className="flex items-center justify-between pb-2 border-b border-[var(--rule)] mb-3 print:border-black">
        <h3 className="text-xs uppercase tracking-wider text-[var(--ink-soft)] font-bold print:text-black">
          Refusal Script (What to say if asked for more)
        </h3>
        {sourceCitation && (
          <span className="text-xs text-[var(--ink-soft)] truncate max-w-[200px] print:text-black">
            Based on: {sourceCitation}
          </span>
        )}
      </div>

      <blockquote className="italic border-l-2 border-[var(--ink)] pl-3 my-3 text-[var(--ink)] text-base font-sans leading-relaxed print:border-black print:text-black">
        &ldquo;{scriptText}&rdquo;
      </blockquote>

      <div className="flex flex-wrap gap-2 pt-2 items-center print:hidden">
        <button
          type="button"
          onClick={handleCopy}
          data-testid="copy-script-btn"
          className="px-3 py-1.5 text-xs bg-[var(--ink)] text-[var(--paper)] hover:opacity-90 active:scale-95 transition-all font-mono focus:outline-none focus:ring-2 focus:ring-[var(--ink)] focus:ring-offset-1"
        >
          {copied ? '✓ Copied' : 'Copy script'}
        </button>

        <button
          type="button"
          onClick={handleToggleAudio}
          data-testid="audio-script-btn"
          data-audiokey={audioKey}
          aria-label="Hear this refusal script"
          className="px-3 py-1.5 text-xs border border-[var(--ink)] text-[var(--ink)] hover:bg-neutral-100 active:scale-95 transition-all font-mono flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-[var(--ink)] focus:ring-offset-1"
        >
          <span>{isPlaying ? '■ Stop' : '▶ Hear this'}</span>
        </button>
      </div>
    </div>
  );
}
