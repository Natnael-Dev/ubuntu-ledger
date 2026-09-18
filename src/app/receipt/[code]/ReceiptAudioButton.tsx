'use client';

import React, { useState, useEffect } from 'react';

interface ReceiptAudioButtonProps {
  sentence: string;
}

export function ReceiptAudioButton({ sentence }: ReceiptAudioButtonProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

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
      const utterance = new SpeechSynthesisUtterance(sentence);
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
      aria-label={isPlaying ? 'Stop hearing provenance statement' : 'Hear provenance statement'}
      className={`text-[10px] font-mono tracking-wider px-2 py-0.5 border rounded-none transition-colors print:hidden print-hide ${
        isPlaying
          ? 'border-[var(--state-open)] text-[var(--state-open)] bg-emerald-50'
          : 'border-[var(--rule)] text-[var(--ink-soft)] hover:border-[var(--ink)] hover:text-[var(--ink)] bg-transparent'
      }`}
    >
      {isPlaying ? '■ stop' : '▶ hear this'}
    </button>
  );
}