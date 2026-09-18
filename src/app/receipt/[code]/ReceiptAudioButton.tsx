'use client';

import React, { useState, useEffect } from 'react';

export interface ReceiptAudioButtonProps {
  sentence: string;
  claim?: string;
}

export function ReceiptAudioButton({ sentence, claim }: ReceiptAudioButtonProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Audit #80: Ensure spoken text includes the actual claim text
  const cleanClaim = claim?.trim();
  const spokenText =
    cleanClaim && !sentence.toLowerCase().includes(cleanClaim.toLowerCase())
      ? `${cleanClaim}. ${sentence}`
      : sentence;

  const handleHearThis = () => {
    if (typeof window === 'undefined') return;

    if (isPlaying) {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsPlaying(false);
      return;
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(spokenText);
      utterance.rate = 0.92;
      utterance.pitch = 1.0;
      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = () => setIsPlaying(false);
      setIsPlaying(true);
      window.speechSynthesis.speak(utterance);
    } else {
      // speechSynthesis unavailable — show browser hint, do not fake playback
      alert('Audio read-aloud requires a browser with Web Speech API support (Chrome or Firefox recommended).');
    }
  };

  return (
    <button
      type="button"
      onClick={handleHearThis}
      data-testid="receipt-audio-btn"
      data-spoken-text={spokenText}
      data-claim={cleanClaim || ''}
      aria-label={isPlaying ? 'Stop hearing receipt claim and provenance' : 'Hear receipt claim and provenance'}
      className={`text-[10px] font-mono tracking-wider px-2 py-0.5 border rounded-none transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--ink)] focus:ring-offset-1 print:hidden print-hide ${
        isPlaying
          ? 'border-[var(--state-open)] text-[var(--state-open)] bg-emerald-50'
          : 'border-[var(--rule)] text-[var(--ink-soft)] hover:border-[var(--ink)] hover:text-[var(--ink)] bg-transparent'
      }`}
    >
      {isPlaying ? '■ stop' : '▶ hear this'}
    </button>
  );
}