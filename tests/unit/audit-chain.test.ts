import { describe, it, expect } from 'vitest';
import {
  GENESIS_PREV_HASH,
  canonicalJson,
  computePayloadHash,
  computeEventHash,
  createAuditEventRecord,
  verifyAuditChain,
  type AuditEventRecord,
} from '@/domain/audit-chain';

describe('T-10: Audit Hash Chain Engine (03 §10, 04 §7 INV-04, 07 §8, 14 ADV-26)', () => {
  const BASE_DATE = new Date('2026-09-15T12:00:00.000Z');

  describe('1. Canonical JSON (RFC 8785 subset)', () => {
    it('sorts object keys lexicographically', () => {
      const obj1 = { z: 1, a: 2, m: 3 };
      const canonical = canonicalJson(obj1);
      expect(canonical).toBe('{"a":2,"m":3,"z":1}');
    });

    it('produces identical strings for differently ordered keys', () => {
      const objA = { project: 'P-101', amount: 50000, active: true };
      const objB = { active: true, amount: 50000, project: 'P-101' };
      expect(canonicalJson(objA)).toBe(canonicalJson(objB));
    });

    it('sorts nested object keys recursively', () => {
      const nested = {
        payload: {
          to: 'COMMITTED',
          from: 'PROMISED',
          details: { zulu: true, alpha: 100 },
        },
        action: 'PROJECT_STATE_CHANGED',
      };
      const expected =
        '{"action":"PROJECT_STATE_CHANGED","payload":{"details":{"alpha":100,"zulu":true},"from":"PROMISED","to":"COMMITTED"}}';
      expect(canonicalJson(nested)).toBe(expected);
    });

    it('preserves array element ordering', () => {
      const withArray = {
        clusters: ['cluster-b', 'cluster-a', 'cluster-c'],
        count: 3,
      };
      const expected = '{"clusters":["cluster-b","cluster-a","cluster-c"],"count":3}';
      expect(canonicalJson(withArray)).toBe(expected);
    });

    it('serializes primitives and null without extraneous whitespace', () => {
      expect(canonicalJson(null)).toBe('null');
      expect(canonicalJson('hello')).toBe('"hello"');
      expect(canonicalJson(12345.67)).toBe('12345.67');
      expect(canonicalJson(false)).toBe('false');
      expect(canonicalJson(true)).toBe('true');
    });
  });

  describe('2. Payload Hashing', () => {
    it('computes expected lowercase 64-character SHA-256 hex string', () => {
      const payload = { action: 'AUDIT_STATE_CHANGED', from: 'NOT_DISPATCHED', to: 'TASK_DISPATCHED' };
      const hash = computePayloadHash(payload);

      expect(hash).toMatch(/^[0-9a-f]{64}$/);
      // Verify determinism
      expect(computePayloadHash(payload)).toBe(hash);
      // Key order independence
      expect(computePayloadHash({ to: 'TASK_DISPATCHED', from: 'NOT_DISPATCHED', action: 'AUDIT_STATE_CHANGED' })).toBe(hash);
    });
  });

  describe('3. Event Block Hashing', () => {
    it('computes block hash from seq, prev_hash, payload_hash, and normalized timestamp', () => {
      const eventHash = computeEventHash({
        seq: 1,
        prevHash: GENESIS_PREV_HASH,
        payloadHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        occurredAt: BASE_DATE,
      });

      expect(eventHash).toMatch(/^[0-9a-f]{64}$/);
      expect(eventHash).toBe(
        computeEventHash({
          seq: 1,
          prevHash: GENESIS_PREV_HASH,
          payloadHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          occurredAt: '2026-09-15T12:00:00.000Z',
        })
      );
    });
  });

  describe('4. Genesis Predecessor Hash', () => {
    it('is exactly 64 hexadecimal zero characters', () => {
      expect(GENESIS_PREV_HASH).toBe('0000000000000000000000000000000000000000000000000000000000000000');
      expect(GENESIS_PREV_HASH).toHaveLength(64);
    });
  });

  describe('5. Empty Chain Verification', () => {
    it('returns ok: true with 0 events checked and null headHash for empty list', () => {
      const res = verifyAuditChain([]);
      expect(res).toEqual({
        ok: true,
        eventsChecked: 0,
        firstBreakSeq: null,
        headHash: null,
      });
    });
  });

  describe('6. Valid Chain Verification', () => {
    it('verifies a valid multi-event hash chain end-to-end', () => {
      const e1 = createAuditEventRecord({
        seq: 1,
        prevEvent: null,
        actorRole: 'SYSTEM',
        action: 'PROJECT_INITIALIZED',
        entityType: 'project',
        entityId: 'proj-001',
        payload: { state: 'PROMISED', amount: 100000 },
        occurredAt: new Date('2026-09-15T12:00:00.000Z'),
      });

      const e2 = createAuditEventRecord({
        seq: 2,
        prevEvent: e1,
        actorRole: 'ADMIN',
        action: 'PROJECT_COMMITTED',
        entityType: 'project',
        entityId: 'proj-001',
        payload: { state: 'COMMITTED', sourceDocHash: 'a1b2c3d4' },
        occurredAt: new Date('2026-09-15T12:05:00.000Z'),
      });

      const e3 = createAuditEventRecord({
        seq: 3,
        prevEvent: e2,
        actorRole: 'MONITOR',
        action: 'AUDIT_TASK_DISPATCHED',
        entityType: 'inspection_task',
        entityId: 'task-001',
        payload: { targetClusters: 3 },
        occurredAt: new Date('2026-09-15T12:10:00.000Z'),
      });

      const chain = [e1, e2, e3];
      const res = verifyAuditChain(chain);

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.eventsChecked).toBe(3);
        expect(res.firstBreakSeq).toBeNull();
        expect(res.headHash).toBe(e3.hash);
      }
    });
  });

  describe('7. Tampered Payload — ADV-26 / INV-04', () => {
    it('detects tampering with an audit_event.payload at the exact seq', () => {
      const e1 = createAuditEventRecord({
        seq: 1,
        prevEvent: null,
        actorRole: 'SYSTEM',
        action: 'PROJECT_INITIALIZED',
        entityType: 'project',
        payload: { state: 'PROMISED' },
        occurredAt: new Date('2026-09-15T10:00:00Z'),
      });

      const e2 = createAuditEventRecord({
        seq: 2,
        prevEvent: e1,
        actorRole: 'ADMIN',
        action: 'REPAIR_CLAIMED',
        entityType: 'repair_ticket',
        payload: { claimedBy: 'Honest Contractor Co' },
        occurredAt: new Date('2026-09-15T11:00:00Z'),
      });

      const e3 = createAuditEventRecord({
        seq: 3,
        prevEvent: e2,
        actorRole: 'MONITOR',
        action: 'PROBATION_STARTED',
        entityType: 'repair_ticket',
        payload: { probationDays: 7 },
        occurredAt: new Date('2026-09-15T12:00:00Z'),
      });

      // Tamper with payload in event 2 (ADV-26: modify payload in fixture)
      const tamperedChain: AuditEventRecord[] = [
        e1,
        {
          ...e2,
          payload: { claimedBy: 'Malicious Contractor LLC' }, // Tampered field!
        },
        e3,
      ];

      const res = verifyAuditChain(tamperedChain);

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.firstBreakSeq).toBe(2);
        expect(res.eventsChecked).toBe(1); // event 1 passed, failed on event 2
        expect(res.reason).toContain('Payload hash mismatch at seq 2');
      }
    });
  });

  describe('8. Broken prev_hash Linkage', () => {
    it('detects altered prev_hash at sequence K', () => {
      const e1 = createAuditEventRecord({
        seq: 1,
        prevEvent: null,
        actorRole: 'SYSTEM',
        action: 'INIT',
        entityType: 'project',
        payload: { id: 1 },
        occurredAt: BASE_DATE,
      });

      const e2 = createAuditEventRecord({
        seq: 2,
        prevEvent: e1,
        actorRole: 'ADMIN',
        action: 'STEP_2',
        entityType: 'project',
        payload: { id: 2 },
        occurredAt: BASE_DATE,
      });

      // Modify prev_hash of event 2
      const brokenChain: AuditEventRecord[] = [
        e1,
        {
          ...e2,
          prev_hash: 'f'.repeat(64),
        },
      ];

      const res = verifyAuditChain(brokenChain);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.firstBreakSeq).toBe(2);
        expect(res.foundHash).toBe('f'.repeat(64));
        expect(res.expectedHash).toBe(e1.hash);
      }
    });
  });

  describe('9. Broken occurred_at Timestamp', () => {
    it('detects altered timestamp at sequence K', () => {
      const e1 = createAuditEventRecord({
        seq: 1,
        prevEvent: null,
        actorRole: 'SYSTEM',
        action: 'INIT',
        entityType: 'project',
        payload: { id: 1 },
        occurredAt: new Date('2026-09-15T10:00:00Z'),
      });

      const e2 = createAuditEventRecord({
        seq: 2,
        prevEvent: e1,
        actorRole: 'ADMIN',
        action: 'STEP_2',
        entityType: 'project',
        payload: { id: 2 },
        occurredAt: new Date('2026-09-15T11:00:00Z'),
      });

      // Tamper occurred_at of event 2
      const brokenChain: AuditEventRecord[] = [
        e1,
        {
          ...e2,
          occurred_at: new Date('2026-09-15T11:00:01Z'), // Altered by 1 second!
        },
      ];

      const res = verifyAuditChain(brokenChain);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.firstBreakSeq).toBe(2);
        expect(res.reason).toContain('Block hash mismatch at seq 2');
      }
    });
  });

  describe('10. Sequence Number Integrity', () => {
    it('detects sequence gaps (e.g. 1 -> 3)', () => {
      const e1 = createAuditEventRecord({
        seq: 1,
        prevEvent: null,
        actorRole: 'SYSTEM',
        action: 'INIT',
        entityType: 'project',
        payload: {},
        occurredAt: BASE_DATE,
      });

      const e3 = createAuditEventRecord({
        seq: 3, // Skipped seq 2
        prevEvent: e1,
        actorRole: 'ADMIN',
        action: 'STEP_3',
        entityType: 'project',
        payload: {},
        occurredAt: BASE_DATE,
      });

      const res = verifyAuditChain([e1, e3]);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.firstBreakSeq).toBe(3);
        expect(res.reason).toContain('Sequence broken at index 1: expected seq 2, found 3');
      }
    });

    it('detects duplicate sequence numbers (e.g. 1 -> 1)', () => {
      const e1 = createAuditEventRecord({
        seq: 1,
        prevEvent: null,
        actorRole: 'SYSTEM',
        action: 'INIT',
        entityType: 'project',
        payload: {},
        occurredAt: BASE_DATE,
      });

      const e1Dup = {
        ...e1,
      };

      const res = verifyAuditChain([e1, e1Dup]);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.firstBreakSeq).toBe(1);
      }
    });
  });

  describe('11. Tampered payload_hash or block hash', () => {
    it('detects manually tampered payload_hash', () => {
      const e1 = createAuditEventRecord({
        seq: 1,
        prevEvent: null,
        actorRole: 'SYSTEM',
        action: 'INIT',
        entityType: 'project',
        payload: { ok: true },
        occurredAt: BASE_DATE,
      });

      const tampered = {
        ...e1,
        payload_hash: '0'.repeat(64),
      };

      const res = verifyAuditChain([tampered]);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.firstBreakSeq).toBe(1);
        expect(res.reason).toContain('Payload hash mismatch');
      }
    });

    it('detects manually tampered event hash', () => {
      const e1 = createAuditEventRecord({
        seq: 1,
        prevEvent: null,
        actorRole: 'SYSTEM',
        action: 'INIT',
        entityType: 'project',
        payload: { ok: true },
        occurredAt: BASE_DATE,
      });

      const tampered = {
        ...e1,
        hash: 'e'.repeat(64),
      };

      const res = verifyAuditChain([tampered]);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.firstBreakSeq).toBe(1);
        expect(res.reason).toContain('Block hash mismatch');
      }
    });
  });

  describe('12. Genesis Corruption', () => {
    it('rejects genesis event with non-zero prev_hash', () => {
      const e1 = createAuditEventRecord({
        seq: 1,
        prevEvent: null,
        actorRole: 'SYSTEM',
        action: 'INIT',
        entityType: 'project',
        payload: {},
        occurredAt: BASE_DATE,
      });

      const corruptGenesis = {
        ...e1,
        prev_hash: '1'.repeat(64),
      };

      const res = verifyAuditChain([corruptGenesis]);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.firstBreakSeq).toBe(1);
        expect(res.reason).toContain('Genesis event prev_hash must be 64 zeros');
      }
    });

    it('rejects genesis event with seq !== 1', () => {
      const e1 = createAuditEventRecord({
        seq: 2, // starts at 2 instead of 1
        prevEvent: null,
        actorRole: 'SYSTEM',
        action: 'INIT',
        entityType: 'project',
        payload: {},
        occurredAt: BASE_DATE,
      });

      const res = verifyAuditChain([e1]);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.firstBreakSeq).toBe(2);
        expect(res.reason).toContain('Genesis event must have seq = 1');
      }
    });
  });
});
