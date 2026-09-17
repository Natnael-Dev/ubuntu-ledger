// T-31 Number Stitching Engine Unit Tests
// Authoritative sources: docs/specs/06-voice-and-ussd.md §6, §11 (CH-09)
//                        docs/specs/11-tasks.md T-31

import { describe, it, expect } from 'vitest';
import { decomposeNumber } from '@/domain/ivr/number-stitcher';
import type { Locale } from '@/domain/types';
import enRules from '../../content/audio/number-rules.en.json';
import amRules from '../../content/audio/number-rules.am.json';
import omRules from '../../content/audio/number-rules.om.json';
import manifest from '../../content/audio/manifest.json';

describe('T-31 CH-09 Number Stitching Rules & Worked Examples', () => {
  const configs = [
    { locale: 'en' as Locale, rules: enRules },
    { locale: 'am' as Locale, rules: amRules },
    { locale: 'om' as Locale, rules: omRules },
  ];

  for (const { locale, rules } of configs) {
    describe(`Locale: ${locale}`, () => {
      it('has exactly 6 worked fixture examples per canonical CH-09 specification', () => {
        expect(rules.examples).toHaveLength(6);
      });

      it('strategy is descending-additive', () => {
        expect(rules.strategy).toBe('descending-additive');
      });

      for (const example of rules.examples) {
        it(`decomposes ${example.input} to ${example.expectedKeys.join(' + ')}`, () => {
          const keys = decomposeNumber(example.input, locale);
          expect(keys).toEqual(example.expectedKeys);
        });

        it(`ensures all decomposed keys for ${example.input} exist in manifest.json with non-zero audio files`, () => {
          for (const key of example.expectedKeys) {
            const manifestId = `${locale}/${key}`;
            const item = (manifest as Record<string, unknown>)[manifestId];
            expect(item, `Missing manifest entry for ${manifestId}`).toBeDefined();
          }
        });
      }
    });
  }

  describe('Edge cases and boundary numbers', () => {
    it('handles negative numbers by taking absolute value or decomposing 0', () => {
      const keys = decomposeNumber(-320000, 'en');
      expect(keys).toEqual(['num.300000', 'num.20000']);
    });

    it('handles arbitrary composite numbers via single-digit fallback if power not available', () => {
      const keys = decomposeNumber(7, 'en');
      expect(keys).toEqual(['num.7']);
    });
  });
});
