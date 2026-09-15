// Sybil and Collusion Resistance: Cluster Key Derivation
// Authoritative sources: docs/specs/07-trust-and-security.md §3, docs/specs/10-skills.md S-04,
// docs/specs/03-data-model.md §4, docs/specs/04-state-machine.md §2 (INV-02), docs/specs/09-agent.md §9
// Rule: Pure function. Zero external I/O, no DB imports, no Next.js imports, no real clock reads.
// Trust boundary: Full phone numbers (MSISDN) are NEVER permitted in the domain layer (07 §5).

import { createHash } from 'node:crypto';

/**
 * Fallback ward token used when geo_cell is absent and no wardId is provided.
 * Authoritative: 07 §3 + 09 §9 line 158 ("missing geo_cell -> falls back to ward-level cell, still deterministic").
 */
export const DEFAULT_WARD_FALLBACK_TOKEN = 'ward:UNSPECIFIED';

export interface ClusterKeyParams {
  taskId: string;
  geoCell?: string | null;
  wardId?: string | null;
  msisdnPrefixBucket: string;
  registeredAt: Date | string;
}

/**
 * Validates that the MSISDN prefix bucket is strictly a 6-digit string.
 * Authoritative: 07 §3 ("msisdn_prefix_bucket // first 6 digits -> bucket"), 03 §4 line 166.
 *
 * Trust boundary: Full MSISDNs (>6 digits) are rejected loudly to prevent PII leakage into domain.
 */
export function validateMsisdnPrefixBucket(bucket: string): string {
  if (!bucket || typeof bucket !== 'string') {
    throw new Error('msisdnPrefixBucket must be a non-empty string');
  }

  const trimmed = bucket.trim();
  if (!/^\d{6}$/.test(trimmed)) {
    throw new Error(
      `msisdnPrefixBucket must be exactly 6 digits; got '${bucket}'. Full MSISDN is strictly forbidden in the domain layer (07 §5).`
    );
  }

  return trimmed;
}

/**
 * Derives the week-of-registration bucket (ISO 8601 week: YYYY-Www).
 * Authoritative: 07 §3 line 47 ("registration_cohort // week-of-registration bucket"),
 * 13 §template line 75 ("Cohort bucket width is one week").
 *
 * Deterministic UTC-based arithmetic prevents timezone shifts from altering cohorts.
 */
export function getRegistrationCohort(registeredAt: Date | string): string {
  const date = registeredAt instanceof Date ? registeredAt : new Date(registeredAt);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid registration date: ${String(registeredAt)}`);
  }

  // Calculate ISO week in UTC
  const target = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  // Monday is 0, Sunday is 6
  const dayNr = (target.getUTCDay() + 6) % 7;
  // Nearest Thursday determines the ISO year
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = target.getTime();

  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7);
  }

  const weekNumber =
    1 + Math.ceil((firstThursday - target.getTime()) / (7 * 24 * 3600 * 1000));
  const year = new Date(firstThursday).getUTCFullYear();
  const padWeek = weekNumber < 10 ? `0${weekNumber}` : `${weekNumber}`;

  return `${year}-W${padWeek}`;
}

/**
 * Resolves the effective geo cell, falling back deterministically to ward-level cell if geo_cell is absent.
 * Authoritative: 07 §3, 09 §9 line 158 ("missing geo_cell -> falls back to ward-level cell, still deterministic").
 */
export function resolveEffectiveGeoCell(
  geoCell?: string | null,
  wardId?: string | null
): string {
  if (geoCell && geoCell.trim() !== '') {
    return geoCell.trim();
  }

  if (wardId && wardId.trim() !== '') {
    return `ward:${wardId.trim()}`;
  }

  return DEFAULT_WARD_FALLBACK_TOKEN;
}

/**
 * Derives the Sybil cluster key.
 *
 * Authoritative formula from 07-trust-and-security.md §3 lines 43-49:
 * ```text
 * cluster_key = sha256(
 *     task_id
 *   + geo_cell                        // ~1 km grid; coarse on purpose
 *   + msisdn_prefix_bucket            // first 6 digits -> bucket
 *   + registration_cohort             // week-of-registration bucket
 * )[0..15]
 * ```
 *
 * Security guarantees:
 * 1. Exactly 16 lowercase hex characters (/^[0-9a-f]{16}$/).
 * 2. CRITICAL: respondent.id is NEVER included. Confirmed by 13-ai-build-log-template.md.
 * 3. CRITICAL: Full phone numbers are NEVER accepted; only the 6-digit prefix bucket is allowed.
 * 4. Deterministic across process restarts.
 */
export function deriveClusterKey(params: ClusterKeyParams): string {
  const taskId = params.taskId ? params.taskId.trim() : '';
  if (!taskId) {
    throw new Error('taskId must not be empty for cluster key derivation');
  }

  const effectiveGeoCell = resolveEffectiveGeoCell(params.geoCell, params.wardId);
  const msisdnPrefixBucket = validateMsisdnPrefixBucket(params.msisdnPrefixBucket);
  const registrationCohort = getRegistrationCohort(params.registeredAt);

  // Preimage concatenation: task_id + geo_cell + msisdn_prefix_bucket + registration_cohort
  const preimage = `${taskId}${effectiveGeoCell}${msisdnPrefixBucket}${registrationCohort}`;

  return createHash('sha256')
    .update(preimage, 'utf8')
    .digest('hex')
    .slice(0, 16);
}
