import { describe, it, expect } from 'vitest';
import {
  deriveClusterKey,
  getRegistrationCohort,
  normalizeMsisdnPrefix,
  resolveEffectiveGeoCell,
  DEFAULT_WARD_FALLBACK_TOKEN,
  type ClusterKeyParams,
} from '@/domain/sybil';

describe('T-11: Sybil Cluster Key Derivation (07-trust-and-security.md §3, 10-skills.md S-04)', () => {
  const FIXED_TASK_ID = 'task-uuid-kibera-borehole-01';
  const FIXED_CELL = 'geo-cell-kbr-04';
  const FIXED_PREFIX = '254712';
  const FIXED_DATE = new Date('2026-09-15T12:00:00.000Z');

  describe('1. Determinism and Exact Output Format', () => {
    it('produces identical cluster key for identical inputs', () => {
      const params: ClusterKeyParams = {
        taskId: FIXED_TASK_ID,
        geoCell: FIXED_CELL,
        msisdnPrefix: FIXED_PREFIX,
        registeredAt: FIXED_DATE,
      };

      const key1 = deriveClusterKey(params);
      const key2 = deriveClusterKey(params);

      expect(key1).toBe(key2);
    });

    it('matches exact 16-character lowercase hex format /^[0-9a-f]{16}$/', () => {
      const key = deriveClusterKey({
        taskId: FIXED_TASK_ID,
        geoCell: FIXED_CELL,
        msisdnPrefix: FIXED_PREFIX,
        registeredAt: FIXED_DATE,
      });

      expect(key).toHaveLength(16);
      expect(key).toMatch(/^[0-9a-f]{16}$/);
    });

    it('reproduces exact hardcoded hash across process restarts (fixture test)', () => {
      // Deterministic SHA-256 slice for:
      // task_id: 'task-uuid-kibera-borehole-01'
      // geo_cell: 'geo-cell-kbr-04'
      // msisdn_prefix_bucket: '254712'
      // registration_cohort: '2026-W38' (2026-09-15 is in week 38)
      // Preimage: 'task-uuid-kibera-borehole-01geo-cell-kbr-042547122026-W38'
      const key = deriveClusterKey({
        taskId: FIXED_TASK_ID,
        geoCell: FIXED_CELL,
        msisdnPrefix: FIXED_PREFIX,
        registeredAt: FIXED_DATE,
      });

      // Hardcoded stability assertion
      expect(key).toBe('ccf0dcfdad4e6cc8');
    });
  });

  describe('2. Sybil Collusion Collision (Same Cluster -> Same Key)', () => {
    it('collapses multiple submissions with same prefix, cell, and cohort into the identical cluster key', () => {
      // 10 SIMs from the same shop (+254712...), registered the same week, in the same cell
      const sim1 = deriveClusterKey({
        taskId: FIXED_TASK_ID,
        geoCell: FIXED_CELL,
        msisdn: '+254712000001',
        registeredAt: new Date('2026-09-14T08:00:00Z'), // Monday
      });

      const sim2 = deriveClusterKey({
        taskId: FIXED_TASK_ID,
        geoCell: FIXED_CELL,
        msisdn: '+254712999999',
        registeredAt: new Date('2026-09-17T18:00:00Z'), // Thursday same week
      });

      const sim3 = deriveClusterKey({
        taskId: FIXED_TASK_ID,
        geoCell: FIXED_CELL,
        msisdnPrefix: '254712',
        registeredAt: new Date('2026-09-20T23:59:00Z'), // Sunday same week
      });

      expect(sim1).toBe(sim2);
      expect(sim2).toBe(sim3);
    });
  });

  describe('3. Sensitivity Checks (Trait Alterations Produce Different Keys)', () => {
    it('produces different cluster keys when geo_cell differs (location sensitivity)', () => {
      const keyCellA = deriveClusterKey({
        taskId: FIXED_TASK_ID,
        geoCell: 'geo-cell-kbr-04',
        msisdnPrefix: FIXED_PREFIX,
        registeredAt: FIXED_DATE,
      });

      const keyCellB = deriveClusterKey({
        taskId: FIXED_TASK_ID,
        geoCell: 'geo-cell-kbr-05',
        msisdnPrefix: FIXED_PREFIX,
        registeredAt: FIXED_DATE,
      });

      expect(keyCellA).not.toBe(keyCellB);
    });

    it('produces different cluster keys when MSISDN prefix differs (telecom cohort sensitivity)', () => {
      const keyPrefixA = deriveClusterKey({
        taskId: FIXED_TASK_ID,
        geoCell: FIXED_CELL,
        msisdnPrefix: '254712',
        registeredAt: FIXED_DATE,
      });

      const keyPrefixB = deriveClusterKey({
        taskId: FIXED_TASK_ID,
        geoCell: FIXED_CELL,
        msisdnPrefix: '254722',
        registeredAt: FIXED_DATE,
      });

      expect(keyPrefixA).not.toBe(keyPrefixB);
    });

    it('produces different cluster keys when registration cohort differs (registration time sensitivity)', () => {
      // Week 38 vs Week 39
      const keyWeek38 = deriveClusterKey({
        taskId: FIXED_TASK_ID,
        geoCell: FIXED_CELL,
        msisdnPrefix: FIXED_PREFIX,
        registeredAt: new Date('2026-09-15T12:00:00Z'), // Week 38
      });

      const keyWeek39 = deriveClusterKey({
        taskId: FIXED_TASK_ID,
        geoCell: FIXED_CELL,
        msisdnPrefix: FIXED_PREFIX,
        registeredAt: new Date('2026-09-22T12:00:00Z'), // Week 39
      });

      expect(keyWeek38).not.toBe(keyWeek39);
    });

    it('isolates cluster keys across different tasks (task isolation)', () => {
      const keyTask1 = deriveClusterKey({
        taskId: 'task-001',
        geoCell: FIXED_CELL,
        msisdnPrefix: FIXED_PREFIX,
        registeredAt: FIXED_DATE,
      });

      const keyTask2 = deriveClusterKey({
        taskId: 'task-002',
        geoCell: FIXED_CELL,
        msisdnPrefix: FIXED_PREFIX,
        registeredAt: FIXED_DATE,
      });

      expect(keyTask1).not.toBe(keyTask2);
    });
  });

  describe('4. Missing geo_cell Fallback Handling', () => {
    it('directly tests resolveEffectiveGeoCell logic', () => {
      expect(resolveEffectiveGeoCell('geo-cell-01', 'ward-01')).toBe('geo-cell-01');
      expect(resolveEffectiveGeoCell('', 'ward-01')).toBe('ward:ward-01');
      expect(resolveEffectiveGeoCell(null, 'ward-01')).toBe('ward:ward-01');
      expect(resolveEffectiveGeoCell(undefined, undefined)).toBe(DEFAULT_WARD_FALLBACK_TOKEN);
      expect(resolveEffectiveGeoCell('', '')).toBe('ward:UNSPECIFIED');
    });

    it('falls back to ward-level cell when geo_cell is absent', () => {
      const keyWithWard = deriveClusterKey({
        taskId: FIXED_TASK_ID,
        geoCell: null,
        wardId: 'ward-nairobi-south',
        msisdnPrefix: FIXED_PREFIX,
        registeredAt: FIXED_DATE,
      });

      const keyWithExplicitWardCell = deriveClusterKey({
        taskId: FIXED_TASK_ID,
        geoCell: 'ward:ward-nairobi-south',
        msisdnPrefix: FIXED_PREFIX,
        registeredAt: FIXED_DATE,
      });

      expect(keyWithWard).toBe(keyWithExplicitWardCell);
    });

    it('falls back to ward:UNSPECIFIED when both geo_cell and wardId are absent', () => {
      expect(DEFAULT_WARD_FALLBACK_TOKEN).toBe('ward:UNSPECIFIED');

      const keyFallback = deriveClusterKey({
        taskId: FIXED_TASK_ID,
        geoCell: undefined,
        wardId: undefined,
        msisdnPrefix: FIXED_PREFIX,
        registeredAt: FIXED_DATE,
      });

      const keyExplicitUnspecified = deriveClusterKey({
        taskId: FIXED_TASK_ID,
        geoCell: 'ward:UNSPECIFIED',
        msisdnPrefix: FIXED_PREFIX,
        registeredAt: FIXED_DATE,
      });

      expect(keyFallback).toBe(keyExplicitUnspecified);
    });

    it('distinguishes different wards when geo_cell is absent', () => {
      const keyWardA = deriveClusterKey({
        taskId: FIXED_TASK_ID,
        geoCell: null,
        wardId: 'ward-01',
        msisdnPrefix: FIXED_PREFIX,
        registeredAt: FIXED_DATE,
      });

      const keyWardB = deriveClusterKey({
        taskId: FIXED_TASK_ID,
        geoCell: null,
        wardId: 'ward-02',
        msisdnPrefix: FIXED_PREFIX,
        registeredAt: FIXED_DATE,
      });

      expect(keyWardA).not.toBe(keyWardB);
    });
  });

  describe('5. MSISDN Prefix Normalization', () => {
    it('normalizes international format with plus (+254712...) to 6 digits', () => {
      expect(normalizeMsisdnPrefix('+254712345678')).toBe('254712');
    });

    it('normalizes international format without plus (254712...) to 6 digits', () => {
      expect(normalizeMsisdnPrefix('254712345678')).toBe('254712');
    });

    it('normalizes raw 6-digit prefix directly', () => {
      expect(normalizeMsisdnPrefix('254712')).toBe('254712');
    });

    it('normalizes local 10-digit format (0712345678) with defaultCountryCode', () => {
      expect(normalizeMsisdnPrefix('0712345678', '254')).toBe('254712');
    });

    it('normalizes local format (0712345678) without defaultCountryCode to first 6 digits', () => {
      expect(normalizeMsisdnPrefix('0712345678')).toBe('071234');
    });

    it('yields identical cluster key for +254712... and 254712...', () => {
      const keyWithPlus = deriveClusterKey({
        taskId: FIXED_TASK_ID,
        geoCell: FIXED_CELL,
        msisdn: '+254712345678',
        registeredAt: FIXED_DATE,
      });

      const keyNoPlus = deriveClusterKey({
        taskId: FIXED_TASK_ID,
        geoCell: FIXED_CELL,
        msisdn: '254712345678',
        registeredAt: FIXED_DATE,
      });

      expect(keyWithPlus).toBe(keyNoPlus);
    });

    it('throws error if input has fewer than 6 digits', () => {
      expect(() => normalizeMsisdnPrefix('12345')).toThrow(
        /must contain at least 6 digits/
      );
    });
  });

  describe('6. Registration Cohort Derivation', () => {
    it('determines ISO week cohort deterministically in UTC', () => {
      // 2026-09-15 is a Tuesday in Week 38 of 2026
      expect(getRegistrationCohort('2026-09-15T12:00:00Z')).toBe('2026-W38');
      expect(getRegistrationCohort(new Date('2026-09-15T12:00:00Z'))).toBe('2026-W38');

      // Year transition: 2026-01-01 is Thursday in Week 01 of 2026
      expect(getRegistrationCohort('2026-01-01T00:00:00Z')).toBe('2026-W01');
    });

    it('groups all days within the same Monday-Sunday week into the same cohort', () => {
      // 2026-W38 spans from Monday 2026-09-14 to Sunday 2026-09-20
      const monday = getRegistrationCohort('2026-09-14T00:00:00Z');
      const wednesday = getRegistrationCohort('2026-09-16T15:30:00Z');
      const sunday = getRegistrationCohort('2026-09-20T23:59:59Z');

      expect(monday).toBe('2026-W38');
      expect(wednesday).toBe('2026-W38');
      expect(sunday).toBe('2026-W38');
    });
  });

  describe('7. Respondent ID Anti-Regression (INV-02 Protection)', () => {
    it('CRITICAL: proves respondent identity does not influence cluster key derivation', () => {
      // Two distinct respondents sharing the same cohort traits
      const respondentA = {
        id: 'respondent-uuid-alice',
        taskId: FIXED_TASK_ID,
        geoCell: FIXED_CELL,
        msisdnPrefix: FIXED_PREFIX,
        registeredAt: FIXED_DATE,
      };

      const respondentB = {
        id: 'respondent-uuid-bob',
        taskId: FIXED_TASK_ID,
        geoCell: FIXED_CELL,
        msisdnPrefix: FIXED_PREFIX,
        registeredAt: FIXED_DATE,
      };

      const keyA = deriveClusterKey(respondentA);
      const keyB = deriveClusterKey(respondentB);

      // Must be strictly identical: respondent.id must never split a cluster!
      expect(keyA).toBe(keyB);
    });
  });
});
