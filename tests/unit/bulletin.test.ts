// Unit tests for Bulletin Domain — T-28 (S-12)
// Authoritative sources:
// - docs/specs/05-api-contracts.md §9
// - docs/specs/07-trust-and-security.md §6.4, §6.5
// - docs/specs/10-skills.md S-12
// - docs/specs/11-tasks.md T-28

import { describe, it, expect } from 'vitest';
import {
  compileBulletinScript,
  validateBulletinScript,
  validateFrameGrammar,
  normalizeForBannedWordCheck,
  revalidateFactsKStatus,
  BULLETIN_FRAMES,
  type BulletinFact,
} from '@/domain/bulletin';
import {
  BulletinService,
  InMemoryBulletinRepository,
} from '@/app-services/bulletin.service';
import { ServiceError } from '@/app-services/errors';

const WARD_CODE = 'ET-AA-W09';
const PERIOD_START = '2026-08-17';
const PERIOD_END = '2026-09-17';

function makeFact(overrides: Partial<BulletinFact> = {}): BulletinFact {
  return {
    serviceCode: 'ET-ID-REPLACE',
    officeCode: 'ET-AA-W09-OFFICE',
    windowDays: 30,
    reportCount: 14,
    distinctClusters: 6,
    pctAdditionalFee: 78.6,
    medianExtraMinor: 20000,
    currency: 'ETB',
    kSatisfied: true,
    ...overrides,
  };
}

describe('T-28: Radio Bulletin Domain & Service (S-12)', () => {
  // ============================================================================
  // 1. BANNED WORD VALIDATION (07 §6.5)
  // ============================================================================
  describe('1. Banned Word Validation (07 §6.5)', () => {
    it('throws when script contains "corrupt"', () => {
      expect(() => validateBulletinScript('The office is corrupt and takes bribes.')).toThrow();
    });

    it('throws when script contains "bribe"', () => {
      expect(() => validateBulletinScript('The official asked for a bribe.')).toThrow();
    });

    it('throws when script contains "fraud"', () => {
      expect(() => validateBulletinScript('This is a fraud operation.')).toThrow();
    });

    it('throws when script contains "illegal"', () => {
      expect(() => validateBulletinScript('These illegal payments must stop.')).toThrow();
    });

    it('accepts valid frame-based script with no banned words', () => {
      const script = compileBulletinScript(WARD_CODE, PERIOD_START, PERIOD_END, [makeFact()]);
      expect(script).not.toBeNull();
      expect(() => validateBulletinScript(script!)).not.toThrow();
    });
  });

  // ============================================================================
  // 2. UNICODE HOMOGLYPH NORMALISATION
  // ============================================================================
  describe('2. Unicode Homoglyph Normalisation', () => {
    it('normalises Cyrillic lookalike "с" before banned-word check', () => {
      // Cyrillic с (\u0441) looks identical to Latin c
      const homoglyphText = 'соrrupt'; // Cyrillic с + Latin orrupt
      const normalized = normalizeForBannedWordCheck(homoglyphText);
      expect(normalized).toContain('corrupt');
    });

    it('strips zero-width characters before banned-word check', () => {
      const zwText = 'cor\u200Brupt'; // zero-width space inside word
      const normalized = normalizeForBannedWordCheck(zwText);
      expect(normalized).toContain('corrupt');
    });

    it('SEC-06: detects Greek homoglyphs (omicron, iota, alpha, epsilon)', () => {
      expect(() => validateBulletinScript('c\u03BFrrupt public official')).toThrow(
        /Content integrity violation/
      );
      expect(() => validateBulletinScript('taking a br\u03B9be')).toThrow(
        /Content integrity violation/
      );
      expect(() => validateBulletinScript('election fr\u03B1ud detected')).toThrow(
        /Content integrity violation/
      );
      expect(() => validateBulletinScript('grand th\u03B5ft recorded')).toThrow(
        /Content integrity violation/
      );
    });

    it('SEC-06: detects Cyrillic lookalikes (і, В)', () => {
      expect(() => validateBulletinScript('taking a br\u0456be')).toThrow(
        /Content integrity violation/
      );
      expect(() => validateBulletinScript('giving a \u0412ribe')).toThrow(
        /Content integrity violation/
      );
    });

    it('SEC-06: strips invisible word-joiner and soft hyphen', () => {
      expect(() => validateBulletinScript('cor\u2060rupt system')).toThrow(
        /Content integrity violation/
      );
      expect(() => validateBulletinScript('cor\u00ADrupt administration')).toThrow(
        /Content integrity violation/
      );
    });

    it('SEC-06: strips combining accents and diacritical marks', () => {
      expect(() => validateBulletinScript('c\u0300o\u0301r\u0302r\u0303u\u0304p\u0305t')).toThrow(
        /Content integrity violation/
      );
      expect(() => validateBulletinScript('b\u0300r\u0301i\u0302b\u0303e')).toThrow(
        /Content integrity violation/
      );
    });

    it('SEC-06: detects leetspeak substitutions (0, 1, 3, 4, @, $, 7)', () => {
      expect(() => validateBulletinScript('c0rrupt')).toThrow(/Content integrity violation/);
      expect(() => validateBulletinScript('br1be')).toThrow(/Content integrity violation/);
      expect(() => validateBulletinScript('fr@ud')).toThrow(/Content integrity violation/);
      expect(() => validateBulletinScript('$tole money')).toThrow(/Content integrity violation/);
      expect(() => validateBulletinScript('cr1m1nal')).toThrow(/Content integrity violation/);
    });

    it('SEC-06: detects delimiter insertion (c.o.r.r.u.p.t, b_r_i_b_e, b r i b e)', () => {
      expect(() => validateBulletinScript('c.o.r.r.u.p.t')).toThrow(/Content integrity violation/);
      expect(() => validateBulletinScript('b_r_i_b_e')).toThrow(/Content integrity violation/);
      expect(() => validateBulletinScript('b r i b e')).toThrow(/Content integrity violation/);
      expect(() => validateBulletinScript('f-r-a-u-d')).toThrow(/Content integrity violation/);
    });

    it('SEC-06: strictly preserves legitimate Amharic text without false positives', () => {
      const amharicText = 'ይህ ፕሮጀክት የተሳካ ነው፡ የህዝብ አገልግሎት መስጫ ማዕከል፤';
      expect(() => validateBulletinScript(amharicText)).not.toThrow();
    });

    it('SEC-06: strictly preserves legitimate Afaan Oromoo text without false positives', () => {
      const oromoText = "sakatta'aa fi qorannoo bu'uura godhatee hojjatamaa jira.";
      expect(() => validateBulletinScript(oromoText)).not.toThrow();
    });
  });

  // ============================================================================
  // 3. SCRIPT COMPILER (07 §6.4, S-12)
  // ============================================================================
  describe('3. Bulletin Script Compiler (07 §6.4)', () => {
    it('compiles a script with header + fact + footer for a k-satisfied fact', () => {
      const fact = makeFact();
      const script = compileBulletinScript(WARD_CODE, PERIOD_START, PERIOD_END, [fact]);

      expect(script).not.toBeNull();
      expect(script).toContain(WARD_CODE);
      expect(script).toContain(PERIOD_START);
      expect(script).toContain(PERIOD_END);
      expect(script).toContain('ET-ID-REPLACE');
      expect(script).toContain('78.6');
      expect(script).toContain(BULLETIN_FRAMES.footer);
    });

    it('returns null when all facts are below k', () => {
      const belowKFact = makeFact({ kSatisfied: false });
      const script = compileBulletinScript(WARD_CODE, PERIOD_START, PERIOD_END, [belowKFact]);
      expect(script).toBeNull();
    });

    it('only includes k-satisfied facts in the compiled script', () => {
      const facts = [
        makeFact({ serviceCode: 'ET-ID-REPLACE', kSatisfied: true }),
        makeFact({ serviceCode: 'ET-CLINIC-INTAKE', kSatisfied: false }),
      ];
      const script = compileBulletinScript(WARD_CODE, PERIOD_START, PERIOD_END, facts);
      expect(script).not.toBeNull();
      expect(script).toContain('ET-ID-REPLACE');
      expect(script).not.toContain('ET-CLINIC-INTAKE');
    });

    it('compiled script does not contain any banned words', () => {
      const script = compileBulletinScript(WARD_CODE, PERIOD_START, PERIOD_END, [makeFact()])!;
      expect(() => validateBulletinScript(script)).not.toThrow();
    });
  });

  // ============================================================================
  // 4. FRAME GRAMMAR VALIDATION
  // ============================================================================
  describe('4. Frame Grammar Validation', () => {
    it('accepts a script that follows the frame grammar', () => {
      const script = compileBulletinScript(WARD_CODE, PERIOD_START, PERIOD_END, [makeFact()])!;
      const result = validateFrameGrammar(script, WARD_CODE, PERIOD_START, PERIOD_END);
      expect(result.valid).toBe(true);
    });

    it('rejects a script missing the canonical header', () => {
      const result = validateFrameGrammar(
        'Some free-form accusation text. ' + BULLETIN_FRAMES.footer,
        WARD_CODE,
        PERIOD_START,
        PERIOD_END
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('canonical header');
    });

    it('rejects a script missing the canonical footer', () => {
      const result = validateFrameGrammar(
        `Ward ${WARD_CODE} Public Services Observation Report · Period: ${PERIOD_START} to ${PERIOD_END}. Some content.`,
        WARD_CODE,
        PERIOD_START,
        PERIOD_END
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('canonical footer');
    });

    it('SEC-05: rejects defamatory prose naming individuals inserted between frames', () => {
      const header = `Ward ${WARD_CODE} Public Services Observation Report · Period: ${PERIOD_START} to ${PERIOD_END}.`;
      const attackScript = `${header} Head Administrator Ato Girma at Desk 4 is demanding money. ${BULLETIN_FRAMES.footer}`;
      const result = validateFrameGrammar(attackScript, WARD_CODE, PERIOD_START, PERIOD_END);
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/unauthorized tokens|invalid sentence frame/);
    });

    it('SEC-05: rejects pre-header arbitrary text injection', () => {
      const canonicalScript = compileBulletinScript(WARD_CODE, PERIOD_START, PERIOD_END, [makeFact()])!;
      const attackScript = `CRITICAL ALERT: REVOLT NOW! ${canonicalScript}`;
      const result = validateFrameGrammar(attackScript, WARD_CODE, PERIOD_START, PERIOD_END);
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/canonical header/);
    });

    it('SEC-05: rejects post-footer arbitrary URL / text injection', () => {
      const canonicalScript = compileBulletinScript(WARD_CODE, PERIOD_START, PERIOD_END, [makeFact()])!;
      const attackScript = `${canonicalScript} VISIT HTTP://MALICIOUS-SITE.ORG FOR REVENGE.`;
      const result = validateFrameGrammar(attackScript, WARD_CODE, PERIOD_START, PERIOD_END);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('canonical footer');
    });

    it('SEC-05: rejects HTML / XSS injection into script', () => {
      const header = `Ward ${WARD_CODE} Public Services Observation Report · Period: ${PERIOD_START} to ${PERIOD_END}.`;
      const attackScript = `${header} <script>alert("xss")</script> ${BULLETIN_FRAMES.footer}`;
      const result = validateFrameGrammar(attackScript, WARD_CODE, PERIOD_START, PERIOD_END);
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/unauthorized tokens|invalid sentence frame/);
    });

    it('SEC-05: rejects delimiter / divider injection', () => {
      const canonicalScript = compileBulletinScript(WARD_CODE, PERIOD_START, PERIOD_END, [makeFact()])!;
      const attackScript = canonicalScript.replace(
        BULLETIN_FRAMES.footer,
        `==================== ${BULLETIN_FRAMES.footer}`
      );
      const result = validateFrameGrammar(attackScript, WARD_CODE, PERIOD_START, PERIOD_END);
      expect(result.valid).toBe(false);
    });
  });

  // ============================================================================
  // 5. k-RECHECK AT APPROVAL TIME (05 §9)
  // ============================================================================
  describe('5. k-Recheck at Approval Time (05 §9)', () => {
    it('allows approval when all facts still satisfy k', () => {
      const facts = [makeFact()];
      const result = revalidateFactsKStatus(facts, () => true);
      expect(result.allValid).toBe(true);
    });

    it('blocks approval when a fact has dropped below k at approval time', () => {
      const facts = [
        makeFact({ serviceCode: 'ET-ID-REPLACE', kSatisfied: true }),
        makeFact({ serviceCode: 'ET-CLINIC-INTAKE', kSatisfied: true }),
      ];
      const result = revalidateFactsKStatus(facts, (code) => code !== 'ET-CLINIC-INTAKE');
      expect(result.allValid).toBe(false);
      expect(result.failingServiceCode).toBe('ET-CLINIC-INTAKE');
      expect(result.failingFactIndex).toBe(1);
    });
  });

  // ============================================================================
  // 6. BULLETIN SERVICE WORKFLOW (INV-06)
  // ============================================================================
  describe('6. Bulletin Service Workflow (INV-06)', () => {
    function makeService() {
      return new BulletinService(new InMemoryBulletinRepository());
    }

    async function compileDraft(service: BulletinService) {
      const facts = [makeFact()];
      return service.compileBulletins({
        wardId: 'ward-test-01',
        wardCode: WARD_CODE,
        periodStart: PERIOD_START,
        periodEnd: PERIOD_END,
        facts,
      });
    }

    it('compiles a DRAFT bulletin and returns it', async () => {
      const service = makeService();
      const bulletin = await compileDraft(service);
      expect(bulletin).not.toBeNull();
      expect(bulletin!.state).toBe('DRAFT');
      expect(bulletin!.scriptText).toContain(WARD_CODE);
    });

    it('INV-06: export of unapproved bulletin returns 409 E_NOT_APPROVED', async () => {
      const service = makeService();
      const bulletin = await compileDraft(service);

      try {
        await service.exportBulletin(bulletin!.id);
        expect.fail('Should have thrown E_NOT_APPROVED');
      } catch (err) {
        expect(err).toBeInstanceOf(ServiceError);
        const svcErr = err as ServiceError;
        expect(svcErr.code).toBe('E_NOT_APPROVED');
        expect(svcErr.statusCode).toBe(409);
      }
    });

    it('approve changes state to APPROVED_FOR_BROADCAST and export succeeds', async () => {
      const service = makeService();
      const bulletin = await compileDraft(service);

      const approved = await service.approveWithLiveKCheck(bulletin!.id, {
        moderatorInitials: 'S.A.',
      });
      expect(approved.state).toBe('APPROVED_FOR_BROADCAST');
      expect(approved.moderatorInitials).toBe('S.A.');

      // Now export must succeed
      const exportDto = await service.exportBulletin(bulletin!.id);
      expect(exportDto.scriptText).toContain(WARD_CODE);
      expect(exportDto.moderatorInitials).toBe('S.A.');
    });

    it('reject changes state to REJECTED', async () => {
      const service = makeService();
      const bulletin = await compileDraft(service);

      const rejected = await service.rejectBulletin(bulletin!.id, {
        reason: 'Script needs revision',
      });
      expect(rejected.state).toBe('REJECTED');
      expect(rejected.rejectionReason).toBe('Script needs revision');
    });

    it('cannot approve an already-rejected bulletin', async () => {
      const service = makeService();
      const bulletin = await compileDraft(service);
      await service.rejectBulletin(bulletin!.id, { reason: 'Reject first' });

      try {
        await service.approveWithLiveKCheck(bulletin!.id, { moderatorInitials: 'T.M.' });
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ServiceError);
        const svcErr = err as ServiceError;
        expect(svcErr.code).toBe('E_INVALID_STATE');
        expect(svcErr.statusCode).toBe(409);
      }
    });
  });
});
