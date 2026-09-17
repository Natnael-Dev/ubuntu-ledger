// T-31 IVR Telephony Types & Contracts
// Authoritative sources: docs/specs/05-api-contracts.md §3, §10; docs/specs/06-voice-and-ussd.md §6

import type { Locale } from '@/domain/types';

export type IvrAction = 'PROMPT' | 'END';

export interface IvrRequest {
  /** Gateway or simulator session ID */
  sessionId: string;
  /** Inbound caller E.164 phone number (never logged or passed raw to domain) */
  phoneNumber: string;
  /** Accumulated DTMF digits (* separated) */
  digits: string;
  /** Target language locale */
  locale: Locale;
}

export interface IvrResponse {
  /** PROMPT (continue call) or END (hang up) */
  action: IvrAction;
  /** Ordered audio keys to play */
  audioKeys: string[];
  /** Named slot values (amounts, currency, counts) */
  slots: Record<string, string>;
  /** Expected number of digits (1 for single choice, variable for codes ending in #) */
  expectDigits: number;
  /** Timeout before repeating prompt, in milliseconds (always 8000 per 06 §6) */
  timeoutMs: number;
  /** Audio key played if caller inputs nothing */
  repeatKey: string;
}

export interface AudioManifestItem {
  locale: Locale;
  file: string;
  durationMs: number;
  sha256: string;
}

export type AudioManifest = Record<string, AudioManifestItem>;

export interface NumberRuleDecomposition {
  input: number;
  expectedKeys: string[];
}

export interface NumberRulesConfig {
  locale: Locale;
  strategy: 'descending-additive';
  units: Record<string, string>;
  tens: Record<string, string>;
  powers: Record<string, string>;
  examples: NumberRuleDecomposition[];
}
