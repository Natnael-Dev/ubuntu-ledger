// T-31 Number Decomposition & Audio Clip Stitcher
// Authoritative sources: docs/specs/06-voice-and-ussd.md §6, docs/specs/16-i18n-and-content.md §3

import type { Locale } from '@/domain/types';

// Standard available number clips in the phrase bank
const BANK_CLIPS = new Set([
  'num.0', 'num.1', 'num.2', 'num.3', 'num.4', 'num.5', 'num.6', 'num.7', 'num.8', 'num.9',
  'num.10', 'num.11', 'num.12', 'num.13', 'num.14', 'num.15', 'num.16', 'num.17', 'num.18', 'num.19',
  'num.20', 'num.30', 'num.40', 'num.50', 'num.60', 'num.70', 'num.80', 'num.90',
  'num.100', 'num.200', 'num.300', 'num.400', 'num.500', 'num.600', 'num.700', 'num.800', 'num.900',
  'num.1000', 'num.2000', 'num.3000', 'num.4000', 'num.5000', 'num.6000', 'num.7000', 'num.8000', 'num.9000',
  'num.10000', 'num.20000', 'num.30000', 'num.40000', 'num.50000', 'num.60000', 'num.70000', 'num.80000', 'num.90000',
  'num.100000', 'num.200000', 'num.300000', 'num.400000', 'num.500000', 'num.600000', 'num.700000', 'num.800000', 'num.900000',
  'num.1000000',
]);

// Discrete chunk values in descending order for additive breakdown
const ADDITIVE_BREAKDOWN_VALUES = [
  1000000,
  900000, 800000, 700000, 600000, 500000, 400000, 300000, 200000, 100000,
  90000, 80000, 70000, 60000, 50000, 40000, 30000, 20000, 10000,
  9000, 8000, 7000, 6000, 5000, 4000, 3000, 2000, 1000,
  900, 800, 700, 600, 500, 400, 300, 200, 100,
  90, 80, 70, 60, 50, 40, 30, 20,
  19, 18, 17, 16, 15, 14, 13, 12, 11, 10,
  9, 8, 7, 6, 5, 4, 3, 2, 1,
];

/**
 * Decomposes an integer amount into an ordered sequence of audio phrase keys.
 * Implements "descending-additive" phrase bank assembly with individual-digit fallback.
 */
export function decomposeNumber(amount: number, locale: Locale = 'en'): string[] {
  void locale;
  if (amount === 0) {
    return ['num.0'];
  }

  const directKey = `num.${amount}`;
  if (BANK_CLIPS.has(directKey)) {
    return [directKey];
  }

  let remaining = Math.floor(Math.abs(amount));
  const keys: string[] = [];

  for (const val of ADDITIVE_BREAKDOWN_VALUES) {
    if (remaining >= val) {
      const key = `num.${val}`;
      if (BANK_CLIPS.has(key)) {
        keys.push(key);
        remaining -= val;
      }
    }
    if (remaining === 0) break;
  }

  // Fallback: If any remainder cannot be matched additively, append individual digits
  if (remaining > 0) {
    const digits = remaining.toString().split('');
    for (const d of digits) {
      keys.push(`num.${d}`);
    }
  }

  return keys;
}
