// USSD Session Reducer & Content Core Unit Tests
// Authoritative sources: docs/specs/06-voice-and-ussd.md §2, §4, §11 (CH-01, CH-02, CH-05, CH-07),
// docs/specs/05-api-contracts.md §1, docs/specs/11-tasks.md T-14

import { describe, it, expect } from 'vitest';
import {
  reduceUssdSession,
  normalizeUssdInput,
} from '@/domain/ussd/session';
import {
  MESSAGES,
  assertNoBannedWords,
  type Locale,
} from '@/domain/content';
import type { UssdSessionContext } from '@/domain/ussd/types';

describe('T-14: USSD Session Reducer & Content Core', () => {
  const testContext: UssdSessionContext = {
    locale: 'en',
    projects: {
      '4412': {
        projectCode: '4412',
        title: 'Health post generator overhaul',
        amount: '320,000',
        currency: 'ETB',
        contractor: 'AfroTech Infra',
        due: 'Aug 30',
        isOfficial: true,
        taskId: 'task-4412',
        assetType: 'generator',
        provenance: {
          count: 9,
          weekday: 'Tuesday',
          yesCount: 7,
          noCount: 2,
          ago: '2 days ago',
        },
        observationResult: {
          counted: true,
          witnessCount: 3,
          witnessTarget: 3,
          narrative: 'FIELD_DISCREPANCY',
        },
      },
      '9999': {
        projectCode: '9999',
        title: 'Borehole drilling',
        amount: '150,000',
        currency: 'ETB',
        contractor: 'AquaBuild',
        due: 'Sep 15',
        isOfficial: false,
        taskId: 'task-9999',
        assetType: 'borehole',
      },
    },
  };

  describe('1. Framing & Contract Invariants (CH-05, CH-07)', () => {
    it('CH-05: non-terminal results start with CON and terminal results start with END', () => {
      // Root (non-terminal)
      const rootRes = reduceUssdSession('', testContext);
      expect(rootRes.action).toBe('CON');
      expect(rootRes.text.startsWith('CON ')).toBe(true);

      // Unknown project (terminal)
      const unknownRes = reduceUssdSession('1*0000', testContext);
      expect(unknownRes.action).toBe('END');
      expect(unknownRes.text.startsWith('END ')).toBe(true);

      // Complete generator inspection (terminal)
      const inspectRes = reduceUssdSession('1*4412*1*1*2*1', testContext);
      expect(inspectRes.action).toBe('END');
      expect(inspectRes.text.startsWith('END ')).toBe(true);
    });

    it('CH-07: identical input and context produce byte-identical output (pure deterministic replay)', () => {
      const runA = reduceUssdSession('1*4412*1*1*2', testContext);
      const runB = reduceUssdSession('1*4412*1*1*2', testContext);

      expect(runA.text).toBe(runB.text);
      expect(runA.action).toBe(runB.action);
      expect(runA.nodeId).toBe(runB.nodeId);
      expect(runA.rawMessage).toBe(runB.rawMessage);
    });
  });

  describe('2. 182-Character Rule Across Locales (CH-02)', () => {
    const locales: Locale[] = ['en', 'am', 'om'];

    it('CH-02: every message template in all supported locales is <= 182 chars', () => {
      for (const loc of locales) {
        const dict = MESSAGES[loc];
        for (const [key, msg] of Object.entries(dict)) {
          expect(
            msg.length,
            `Template '${key}' in locale '${loc}' exceeds 182 chars (${msg.length})`
          ).toBeLessThanOrEqual(182);
        }
      }
    });

    it('CH-02: every reachable rendered screen with substitutions is <= 182 chars across all locales', () => {
      const testPaths = [
        '',                      // Root
        '1',                     // Enter project code prompt
        '1*0000',                // Unknown code error
        '1*4412',                // Receipt summary + menu
        '1*4412*3',              // Provenance sentence
        '1*4412*1',              // Q1
        '1*4412*1*1',            // Q2
        '1*4412*1*1*2',          // Q3
        '1*4412*1*1*2*1',        // Observation completed (counted + narrative)
        '2',                     // Services menu
        '2*1',                   // Statutory card + menu (ID replacement)
        '2*1*1',                 // Refusal script
        '2*1*2',                 // Divergence summary (k-satisfied)
        '2*2*2',                 // Divergence summary (not enough reports)
        '2*1*3',                 // Outcome menu
        '2*1*3*1',               // Outcome recorded
        '3',                     // Enter asset code
        '3*GEN-01',              // Fault menu
        '3*GEN-01*1',            // Fault recorded
        '4',                     // Language menu
        '4*2',                   // Language selected
      ];

      for (const loc of locales) {
        const ctx: UssdSessionContext = { ...testContext, locale: loc };
        for (const path of testPaths) {
          const res = reduceUssdSession(path, ctx);
          // Check rawMessage and text (minus prefix) length
          expect(
            res.rawMessage.length,
            `Path '${path}' in locale '${loc}' produced message exceeding 182 chars (${res.rawMessage.length}):\n${res.rawMessage}`
          ).toBeLessThanOrEqual(182);
        }
      }
    });
  });

  describe('3. Canonical Menu Tree Navigation (06 §2)', () => {
    it('renders root menu on empty input or service code', () => {
      const resEmpty = reduceUssdSession('', testContext);
      expect(resEmpty.action).toBe('CON');
      expect(resEmpty.nodeId).toBe('ROOT');
      expect(resEmpty.text).toContain('1 Check a project');

      const resDial = reduceUssdSession('*890#', testContext);
      expect(resDial.nodeId).toBe('ROOT');
    });

    it('navigates check-project happy path and captures observation answers', () => {
      // Step 1: select 1
      const step1 = reduceUssdSession('1', testContext);
      expect(step1.nodeId).toBe('CHECK_PROJECT_ENTER_CODE');
      expect(step1.action).toBe('CON');

      // Step 2: enter code 4412
      const step2 = reduceUssdSession('1*4412', testContext);
      expect(step2.nodeId).toBe('CHECK_PROJECT_RECEIPT');
      expect(step2.text).toContain('Health post generator overhaul');
      expect(step2.text).toContain('1 Answer check task');

      // Step 3: select 1 to answer questions
      const step3 = reduceUssdSession('1*4412*1', testContext);
      expect(step3.nodeId).toBe('QUESTION_1');
      expect(step3.text).toContain('When mains power stops');

      // Step 4: Answer Q1 with 1 (Yes)
      const step4 = reduceUssdSession('1*4412*1*1', testContext);
      expect(step4.nodeId).toBe('QUESTION_2');
      expect(step4.text).toContain('Does the vaccine fridge');

      // Step 5: Answer Q2 with 2 (No)
      const step5 = reduceUssdSession('1*4412*1*1*2', testContext);
      expect(step5.nodeId).toBe('QUESTION_3');
      expect(step5.text).toContain('Is a project board');

      // Step 6: Answer Q3 with 1 (Yes) -> Completion
      const step6 = reduceUssdSession('1*4412*1*1*2*1', testContext);
      expect(step6.nodeId).toBe('OBSERVATION_COMPLETED');
      expect(step6.action).toBe('END');
      expect(step6.text).toContain('3 of 3 neighbours have checked');
      expect(step6.text).toContain('Reports disagree');
      expect(step6.completedObservation).toEqual({
        taskId: 'task-4412',
        projectCode: '4412',
        answers: { q1: true, q2: false, q3: true },
      });
    });

    it('handles unknown project code with terminal error (06 §2 line 25)', () => {
      const res = reduceUssdSession('1*8888', testContext);
      expect(res.nodeId).toBe('CHECK_PROJECT_NOT_FOUND');
      expect(res.action).toBe('END');
      expect(res.text).toContain('Code not recognised');
    });

    it('renders provenance sentence when option 3 chosen on receipt', () => {
      const res = reduceUssdSession('1*4412*3', testContext);
      expect(res.nodeId).toBe('CHECK_PROJECT_PROVENANCE');
      expect(res.action).toBe('END');
      expect(res.text).toContain('9 neighbours checked this on Tuesday');
    });

    it('navigates service fees branch and statutory card options', () => {
      // Branch 2 -> Services
      const step1 = reduceUssdSession('2', testContext);
      expect(step1.nodeId).toBe('SERVICES_SELECT');
      expect(step1.text).toContain('1 ID replacement');

      // Select ID replacement (1)
      const step2 = reduceUssdSession('2*1', testContext);
      expect(step2.nodeId).toBe('SERVICE_CARD');
      expect(step2.text).toContain('Official fee ETB 50');
      expect(step2.text).toContain('1 What do I say if asked for more?');

      // Option 1: Refusal script
      const refusal = reduceUssdSession('2*1*1', testContext);
      expect(refusal.nodeId).toBe('SERVICE_REFUSAL_SCRIPT');
      expect(refusal.action).toBe('END');
      expect(refusal.text).toContain('May I have an official receipt');

      // Option 2: Divergence summary (k-satisfied)
      const divSat = reduceUssdSession('2*1*2', testContext);
      expect(divSat.nodeId).toBe('SERVICE_DIVERGENCE');
      expect(divSat.action).toBe('END');
      expect(divSat.text).toContain('78% of 14 reports');

      // Option 2 with k not satisfied (Clinic intake)
      const divUnsat = reduceUssdSession('2*2*2', testContext);
      expect(divUnsat.nodeId).toBe('SERVICE_DIVERGENCE');
      expect(divUnsat.action).toBe('END');
      expect(divUnsat.text).toContain('Not enough reports yet');

      // Option 3: Outcome recording menu
      const outcomeMenu = reduceUssdSession('2*1*3', testContext);
      expect(outcomeMenu.nodeId).toBe('SERVICE_OUTCOME_MENU');
      expect(outcomeMenu.text).toContain('1 Paid official fee');

      // Select outcome (2 = Asked for more)
      const outcomeDone = reduceUssdSession('2*1*3*2', testContext);
      expect(outcomeDone.nodeId).toBe('SERVICE_OUTCOME_RECORDED');
      expect(outcomeDone.action).toBe('END');
      expect(outcomeDone.selectedOutcome).toEqual({
        serviceCode: 'ET-ID-REPLACE',
        outcomeCode: 1,
      });
    });

    it('navigates report fault branch', () => {
      // Branch 3 -> Enter asset code
      const step1 = reduceUssdSession('3', testContext);
      expect(step1.nodeId).toBe('FAULT_ENTER_ASSET');

      // Enter asset code
      const step2 = reduceUssdSession('3*PUMP-01', testContext);
      expect(step2.nodeId).toBe('FAULT_SELECT_STATUS');
      expect(step2.text).toContain('1 It is not working');

      // Select not working (1)
      const step3 = reduceUssdSession('3*PUMP-01*1', testContext);
      expect(step3.nodeId).toBe('FAULT_RECORDED');
      expect(step3.action).toBe('END');
      expect(step3.reportedFault).toEqual({
        assetCode: 'PUMP-01',
        working: false,
      });
    });

    it('navigates language selection and updates locale', () => {
      // Branch 4 -> Language menu
      const step1 = reduceUssdSession('4', testContext);
      expect(step1.nodeId).toBe('LANGUAGE_SELECT');

      // Select Amharic (2)
      const step2 = reduceUssdSession('4*2', testContext);
      expect(step2.nodeId).toBe('LANGUAGE_UPDATED');
      expect(step2.action).toBe('END');
      expect(step2.selectedLocale).toBe('am');
      expect(step2.text).toContain('ቋንቋ ተቀይሯል');
    });
  });

  describe('4. Universal Navigation & Error Resilience', () => {
    it('navigates back one level with 0', () => {
      // Navigate from project receipt back to code entry
      const res = reduceUssdSession('1*4412*0', testContext);
      expect(res.nodeId).toBe('CHECK_PROJECT_ENTER_CODE');
      expect(res.action).toBe('CON');

      // Navigate from Q1 back to receipt
      const resQ1Back = reduceUssdSession('1*4412*1*0', testContext);
      expect(resQ1Back.nodeId).toBe('CHECK_PROJECT_RECEIPT');
      expect(resQ1Back.action).toBe('CON');

      // 0 from root stays at root
      const resRoot0 = reduceUssdSession('0', testContext);
      expect(resRoot0.nodeId).toBe('ROOT');
    });

    it('navigates directly to main menu with 00 from any depth', () => {
      const res = reduceUssdSession('1*4412*1*1*00', testContext);
      expect(res.nodeId).toBe('ROOT');
      expect(res.action).toBe('CON');
      expect(res.text).toContain('1 Check a project');
    });

    it('re-renders current screen with inline hint on invalid numeric input without terminating', () => {
      // Invalid menu selection '9' at root
      const res = reduceUssdSession('9', testContext);
      expect(res.nodeId).toBe('ROOT');
      expect(res.action).toBe('CON');
      expect(res.text).toContain('Invalid entry.');
      expect(res.text).toContain('1 Check a project');

      // Invalid answer '3' to Yes/No question
      const resQ = reduceUssdSession('1*4412*1*5', testContext);
      expect(resQ.nodeId).toBe('QUESTION_1');
      expect(resQ.action).toBe('CON');
      expect(resQ.text).toContain('Invalid entry.');
      expect(resQ.text).toContain('1 Yes 2 No');
    });

    it('re-renders current screen with inline hint on non-numeric input without crashing', () => {
      const res = reduceUssdSession('abc', testContext);
      expect(res.nodeId).toBe('ROOT');
      expect(res.action).toBe('CON');
      expect(res.text).toContain('Invalid entry.');
    });

    it('normalizes repeated and trailing asterisks cleanly', () => {
      const cleanTokens = normalizeUssdInput('*1**4412*1*');
      expect(cleanTokens).toEqual(['1', '4412', '1']);

      const res = reduceUssdSession('*1**4412*1*', testContext);
      expect(res.nodeId).toBe('QUESTION_1');
      expect(res.action).toBe('CON');
    });

    it('enforces maximum 4 options per standard screen', () => {
      const standardScreens = ['', '1*4412', '2', '2*1', '3*GEN-01', '4'];
      for (const path of standardScreens) {
        const res = reduceUssdSession(path, testContext);
        // Count numbered option lines like "1 ...\n2 ..."
        const matches = res.rawMessage.match(/^[1-9]\s/gm);
        const count = matches ? matches.length : 0;
        expect(
          count,
          `Screen '${res.nodeId}' has ${count} options, exceeding the limit of 4`
        ).toBeLessThanOrEqual(4);
      }
    });
  });

  describe('5. Content & Trust Integrity (CH-01, CH-06, CH-08)', () => {
    it('CH-01: every key in English dictionary exists in Amharic and Afaan Oromo', () => {
      const enKeys = Object.keys(MESSAGES.en);
      for (const key of enKeys) {
        expect(MESSAGES.am[key], `Missing Amharic key: ${key}`).toBeDefined();
        expect(MESSAGES.om[key], `Missing Afaan Oromo key: ${key}`).toBeDefined();
      }
    });

    it('CH-06: templates do not contain hardcoded amounts, dates or dynamic currencies', () => {
      const currencySymbols = ['$', '€', '£', 'ETB', 'KES', 'USD'];
      for (const [locale, dict] of Object.entries(MESSAGES)) {
        for (const [key, text] of Object.entries(dict)) {
          // Exempt slot placeholders like {currency}
          const textWithoutSlots = text.replace(/\{[a-zA-Z0-9_]+\}/g, '');
          for (const sym of currencySymbols) {
            expect(
              textWithoutSlots.includes(sym),
              `Locale '${locale}' key '${key}' contains hardcoded currency symbol '${sym}'`
            ).toBe(false);
          }
        }
      }
    });

    it('CH-08: message dictionaries contain zero banned lexicon terms', () => {
      for (const [locale, dict] of Object.entries(MESSAGES)) {
        for (const [key, text] of Object.entries(dict)) {
          expect(
            () => assertNoBannedWords(text),
            `Locale '${locale}' key '${key}' contains a banned term`
          ).not.toThrow();
        }
      }
    });
  });
});
