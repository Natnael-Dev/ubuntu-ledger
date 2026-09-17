// T-31 IVR Session Reducer Unit Tests
// Authoritative sources: docs/specs/06-voice-and-ussd.md §6, docs/specs/05-api-contracts.md §3, docs/specs/11-tasks.md T-31

import { describe, it, expect } from 'vitest';
import { reduceIvrSession } from '@/domain/ivr/session';

describe('T-31 IVR Session Reducer', () => {
  it('returns root prompt with 8000ms timeout on empty digits', () => {
    const { response, completedObservation } = reduceIvrSession('');
    expect(response.action).toBe('PROMPT');
    expect(response.audioKeys).toEqual(['menu.root']);
    expect(response.timeoutMs).toBe(8000);
    expect(response.repeatKey).toBe('prompt.repeat_hint');
    expect(response.expectDigits).toBe(1);
    expect(completedObservation).toBeUndefined();
  });

  it('navigates to project code prompt when digit "1" is sent', () => {
    const { response } = reduceIvrSession('1');
    expect(response.action).toBe('PROMPT');
    expect(response.audioKeys).toEqual(['prompt.enter_project_code']);
    expect(response.expectDigits).toBe(4); // expects 4-digit project code
  });

  it('navigates to project summary and stitches numbers when "1*4412" is sent', () => {
    const { response } = reduceIvrSession('1*4412', { locale: 'en' });
    expect(response.action).toBe('PROMPT');
    expect(response.audioKeys).toEqual([
      'receipt.summary',
      'num.300000',
      'num.20000',
      'receipt.menu',
    ]);
    expect(response.slots.amount).toBe('320000');
    expect(response.slots.currency).toBe('ETB');
    expect(response.expectDigits).toBe(1);
  });

  it('navigates to question 1 when "1*4412*1" is sent', () => {
    const { response } = reduceIvrSession('1*4412*1');
    expect(response.action).toBe('PROMPT');
    expect(response.audioKeys).toEqual(['q.generator.runs_on_outage']);
    expect(response.expectDigits).toBe(1);
  });

  it('navigates to question 2 when "1*4412*1*2" is sent', () => {
    const { response } = reduceIvrSession('1*4412*1*2');
    expect(response.action).toBe('PROMPT');
    expect(response.audioKeys).toEqual(['q.generator.fridge_green']);
    expect(response.expectDigits).toBe(1);
  });

  it('terminates call with END and completedObservation when all questions answered', () => {
    const { response, completedObservation } = reduceIvrSession('1*4412*1*1*2*1');
    expect(response.action).toBe('END');
    expect(response.audioKeys).toEqual(['observation.counted']);
    expect(response.slots.count).toBe('3');
    expect(response.slots.target).toBe('3');
    expect(response.expectDigits).toBe(0);
    expect(completedObservation).toBeDefined();
    expect(completedObservation?.projectCode).toBe('4412');
  });

  it('re-prompts gracefully on invalid root selection', () => {
    const { response } = reduceIvrSession('9');
    expect(response.action).toBe('PROMPT');
    expect(response.audioKeys).toEqual(['prompt.invalid_hint', 'menu.root']);
  });
});
