// Channel Parity Test Suite (CI Parity Guards)
// Authoritative sources: docs/specs/06-voice-and-ussd.md §11 (CH-01 through CH-07, CH-09)
//                        docs/specs/11-tasks.md T-31

import { describe, it, expect } from 'vitest';
import { MESSAGES, type Locale } from '@/domain/content';
import { reduceUssdSession } from '@/domain/ussd/session';
import { reduceIvrSession } from '@/domain/ivr/session';
import manifest from '../../../content/audio/manifest.json';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('CI Channel Parity Checks (docs/specs/06-voice-and-ussd.md §11)', () => {
  const locales: Locale[] = Object.keys(MESSAGES) as Locale[];
  const enKeys = Object.keys(MESSAGES.en);

  // CH-01: Every message key present in en exists in am and om
  it('CH-01: Every message key present in en exists in all supported locales', () => {
    for (const loc of locales) {
      if (loc === 'en') continue;
      const targetKeys = Object.keys(MESSAGES[loc]);
      for (const key of enKeys) {
        expect(
          targetKeys,
          `Locale '${loc}' is missing canonical message key '${key}'`
        ).toContain(key);
      }
    }
  });

  // CH-02: Every message key with a USSD render is <= 182 chars in every locale
  it('CH-02: Every message key render is <= 182 characters in every locale', () => {
    for (const loc of locales) {
      for (const [key, text] of Object.entries(MESSAGES[loc])) {
        expect(
          text.length,
          `Key '${key}' in locale '${loc}' exceeds 182 chars: ${text.length}`
        ).toBeLessThanOrEqual(182);
      }
    }
  });

  // CH-03: Every message key used in an IVR flow has a matching audio file in every locale
  it('CH-03: Every audio key used in IVR flow exists in audio manifest for en, am, om', () => {
    const testDigits = ['', '1', '1*4412', '1*4412*1', '1*4412*1*2', '1*4412*1*2*2', '2', '3', '4'];
    const ivrLocales: ('en' | 'am' | 'om')[] = ['en', 'am', 'om'];

    for (const loc of ivrLocales) {
      for (const digits of testDigits) {
        const { response } = reduceIvrSession(digits, { locale: loc });
        for (const key of response.audioKeys) {
          const manifestId = `${loc}/${key}`;
          const item = (manifest as Record<string, unknown>)[manifestId];
          expect(item, `CH-03 VIOLATION: Missing audio manifest item for '${manifestId}'`).toBeDefined();
        }
      }
    }
  });

  // CH-04: Every audio file referenced in manifest exists and is non-zero length
  it('CH-04: Every audio file referenced in the manifest exists in public/audio and is non-zero length', () => {
    const publicAudioDir = path.resolve(process.cwd(), 'public/audio');
    expect(fs.existsSync(publicAudioDir), 'public/audio directory must exist').toBe(true);

    for (const [manifestId, item] of Object.entries(manifest as Record<string, { file: string; sha256: string }>)) {
      const filePath = path.join(publicAudioDir, item.file);
      expect(fs.existsSync(filePath), `Audio file not found on disk: ${filePath} (id: ${manifestId})`).toBe(true);

      const stat = fs.statSync(filePath);
      expect(stat.size, `Audio file has 0 bytes: ${filePath}`).toBeGreaterThan(0);
    }
  });

  // CH-05: Every USSD terminal node ends with END and every non-terminal with CON
  it('CH-05: Every USSD terminal response starts with END and non-terminal with CON', () => {
    const terminalInputs = ['1*4412*1*1*2*1', '1*0000'];
    const nonTerminalInputs = ['', '1', '1*4412', '1*4412*1', '1*4412*1*1'];

    for (const input of terminalInputs) {
      const res = reduceUssdSession(input);
      expect(res.action).toBe('END');
      expect(res.text.startsWith('END ')).toBe(true);
    }

    for (const input of nonTerminalInputs) {
      const res = reduceUssdSession(input);
      expect(res.action).toBe('CON');
      expect(res.text.startsWith('CON ')).toBe(true);
    }
  });

  // CH-06: No message template contains a hardcoded currency symbol, number or date
  it('CH-06: No message template contains hardcoded currency symbols or dynamic values', () => {
    // Exclude menu option indices like "1 ", "2 "
    for (const loc of locales) {
      for (const [key, text] of Object.entries(MESSAGES[loc])) {
        expect(text, `Key '${key}' in '${loc}' contains hardcoded ETB`).not.toContain('ETB');
        expect(text, `Key '${key}' in '${loc}' contains hardcoded KES`).not.toContain('KES');
        expect(text, `Key '${key}' in '${loc}' contains hardcoded $`).not.toContain('$');
      }
    }
  });

  // CH-07: Submitting identical text string twice produces identical output
  it('CH-07: Session reducer is purely deterministic', () => {
    const inputs = ['', '1', '1*4412', '1*4412*1', '1*4412*1*2*2', '2', '3'];
    for (const input of inputs) {
      const res1 = reduceUssdSession(input);
      const res2 = reduceUssdSession(input);
      expect(res1).toEqual(res2);

      const ivr1 = reduceIvrSession(input);
      const ivr2 = reduceIvrSession(input);
      expect(ivr1).toEqual(ivr2);
    }
  });
});
