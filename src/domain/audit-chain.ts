// Append-Only Audit Hash Chain Engine
// Authoritative sources: docs/specs/03-data-model.md §10, docs/specs/04-state-machine.md §7 (INV-03, INV-04),
// docs/specs/07-trust-and-security.md §8, docs/specs/10-skills.md S-14, docs/specs/05-api-contracts.md §10
// Rule: Deterministic cryptographic integrity. No external I/O, no DB imports, no framework imports.

import { createHash } from 'node:crypto';
import type { ActorRole } from './types';

/**
 * Genesis predecessor hash: exactly 64 hexadecimal zero characters.
 * Authoritative: docs/specs/03-data-model.md §10 line 408, docs/specs/07-trust-and-security.md §8 line 102
 */
export const GENESIS_PREV_HASH = '0'.repeat(64);

export interface AuditEventRecord {
  seq: number | bigint;
  ward_id?: string | null;
  actor_role: ActorRole | string;
  actor_ref?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  payload: unknown;
  payload_hash: string;
  prev_hash: string;
  hash: string;
  occurred_at: Date | string;
}

export interface EventHashParams {
  seq: number | bigint;
  prevHash: string;
  payloadHash: string;
  occurredAt: Date | string;
}

export type AuditChainVerificationResult =
  | {
      ok: true;
      eventsChecked: number;
      firstBreakSeq: null;
      headHash: string | null;
    }
  | {
      ok: false;
      eventsChecked: number;
      firstBreakSeq: number;
      expectedHash: string;
      foundHash: string;
      reason: string;
    };

/**
 * Normalizes a Date or timestamp string into canonical ISO-8601 UTC representation:
 * YYYY-MM-DDTHH:mm:ss.sssZ
 */
export function normalizeTimestamp(at: Date | string): string {
  const d = at instanceof Date ? at : new Date(at);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid timestamp for audit event: ${String(at)}`);
  }
  return d.toISOString();
}

/**
 * Deterministic canonical JSON serialization (RFC 8785-compliant subset).
 * - Object keys sorted lexicographically at all levels
 * - Arrays preserve order
 * - Primitives serialized without whitespace
 * - Different object key insertion orders produce identical canonical strings
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    const items = value.map((elem) => canonicalJson(elem));
    return `[${items.join(',')}]`;
  }

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const pairs: string[] = [];

  for (const key of keys) {
    const val = obj[key];
    if (val !== undefined && typeof val !== 'symbol' && typeof val !== 'function') {
      pairs.push(`${JSON.stringify(key)}:${canonicalJson(val)}`);
    }
  }

  return `{${pairs.join(',')}}`;
}

/**
 * Computes payload_hash = sha256(canonical_json(payload))
 * Returns 64-character lowercase hex string.
 */
export function computePayloadHash(payload: unknown): string {
  const canonical = canonicalJson(payload);
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/**
 * Computes event block hash:
 * hash = sha256(seq || prev_hash || payload_hash || occurred_at)
 * Authoritative: docs/specs/03-data-model.md §10 line 408, docs/specs/07-trust-and-security.md §8 line 101
 */
export function computeEventHash(params: EventHashParams): string {
  const seqStr = params.seq.toString();
  const prevHash = params.prevHash.toLowerCase();
  const payloadHash = params.payloadHash.toLowerCase();
  const occurredAtStr = normalizeTimestamp(params.occurredAt);

  const preimage = `${seqStr}${prevHash}${payloadHash}${occurredAtStr}`;
  return createHash('sha256').update(preimage, 'utf8').digest('hex');
}

/**
 * Helper to construct a cryptographically linked AuditEventRecord.
 */
export function createAuditEventRecord(params: {
  seq: number | bigint;
  prevEvent: AuditEventRecord | null;
  wardId?: string | null;
  actorRole: ActorRole | string;
  actorRef?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  payload: unknown;
  occurredAt: Date | string;
}): AuditEventRecord {
  const prevHash = params.prevEvent ? params.prevEvent.hash : GENESIS_PREV_HASH;
  const payloadHash = computePayloadHash(params.payload);
  const hash = computeEventHash({
    seq: params.seq,
    prevHash,
    payloadHash,
    occurredAt: params.occurredAt,
  });

  return {
    seq: params.seq,
    ward_id: params.wardId,
    actor_role: params.actorRole,
    actor_ref: params.actorRef,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId,
    payload: params.payload,
    payload_hash: payloadHash,
    prev_hash: prevHash,
    hash,
    occurred_at: params.occurredAt,
  };
}

/**
 * Verifies the integrity of an audit event hash chain (INV-04, ADV-26).
 *
 * Verifies:
 * 1. Empty chain returns ok: true, eventsChecked: 0, headHash: null
 * 2. Genesis event has seq === 1 and prev_hash === GENESIS_PREV_HASH
 * 3. Sequence numbers are strictly monotonic (seq[i] === seq[i-1] + 1)
 * 4. prev_hash[i] matches hash[i-1]
 * 5. payload_hash matches sha256(canonical_json(payload))
 * 6. hash matches sha256(seq || prev_hash || payload_hash || occurred_at)
 *
 * Returns exact firstBreakSeq on failure.
 */
export function verifyAuditChain(
  events: AuditEventRecord[]
): AuditChainVerificationResult {
  if (!events || events.length === 0) {
    return {
      ok: true,
      eventsChecked: 0,
      firstBreakSeq: null,
      headHash: null,
    };
  }

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const seqNum = Number(event.seq);

    // 1. Strict sequence numbering
    if (i === 0) {
      if (seqNum !== 1) {
        return {
          ok: false,
          eventsChecked: i,
          firstBreakSeq: seqNum,
          expectedHash: GENESIS_PREV_HASH,
          foundHash: event.hash,
          reason: `Genesis event must have seq = 1; found ${seqNum}`,
        };
      }
    } else {
      const expectedSeq = Number(events[i - 1].seq) + 1;
      if (seqNum !== expectedSeq) {
        return {
          ok: false,
          eventsChecked: i,
          firstBreakSeq: seqNum,
          expectedHash: events[i - 1].hash,
          foundHash: event.prev_hash,
          reason: `Sequence broken at index ${i}: expected seq ${expectedSeq}, found ${seqNum}`,
        };
      }
    }

    // 2. Previous hash link
    if (i === 0) {
      if (event.prev_hash.toLowerCase() !== GENESIS_PREV_HASH) {
        return {
          ok: false,
          eventsChecked: i,
          firstBreakSeq: seqNum,
          expectedHash: GENESIS_PREV_HASH,
          foundHash: event.prev_hash,
          reason: `Genesis event prev_hash must be 64 zeros; found ${event.prev_hash}`,
        };
      }
    } else {
      const prevExpectedHash = events[i - 1].hash.toLowerCase();
      if (event.prev_hash.toLowerCase() !== prevExpectedHash) {
        return {
          ok: false,
          eventsChecked: i,
          firstBreakSeq: seqNum,
          expectedHash: prevExpectedHash,
          foundHash: event.prev_hash,
          reason: `Previous hash mismatch at seq ${seqNum}: link to seq ${events[i - 1].seq} is broken`,
        };
      }
    }

    // 3. Payload hash integrity
    const expectedPayloadHash = computePayloadHash(event.payload);
    if (event.payload_hash.toLowerCase() !== expectedPayloadHash) {
      return {
        ok: false,
        eventsChecked: i,
        firstBreakSeq: seqNum,
        expectedHash: expectedPayloadHash,
        foundHash: event.payload_hash,
        reason: `Payload hash mismatch at seq ${seqNum}: payload was tampered`,
      };
    }

    // 4. Block hash integrity
    let expectedBlockHash: string;
    try {
      expectedBlockHash = computeEventHash({
        seq: event.seq,
        prevHash: event.prev_hash,
        payloadHash: event.payload_hash,
        occurredAt: event.occurred_at,
      });
    } catch (err) {
      return {
        ok: false,
        eventsChecked: i,
        firstBreakSeq: seqNum,
        expectedHash: '',
        foundHash: event.hash,
        reason: `Failed to compute event hash at seq ${seqNum}: ${(err as Error).message}`,
      };
    }

    if (event.hash.toLowerCase() !== expectedBlockHash) {
      return {
        ok: false,
        eventsChecked: i,
        firstBreakSeq: seqNum,
        expectedHash: expectedBlockHash,
        foundHash: event.hash,
        reason: `Block hash mismatch at seq ${seqNum}`,
      };
    }
  }

  return {
    ok: true,
    eventsChecked: events.length,
    firstBreakSeq: null,
    headHash: events[events.length - 1].hash,
  };
}
