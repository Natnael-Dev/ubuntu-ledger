// Cron Secret Authentication Helper
// Authoritative sources: docs/specs/05-api-contracts.md §11, docs/specs/07-trust-and-security.md §9

import { timingSafeEqual } from 'node:crypto';

/**
 * Constant-time string comparison to prevent timing side-channel attacks.
 */
function timingSafeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/**
 * Validates that the cron request is authorized.
 * FAIL-CLOSED: Rejects immediately if CRON_SECRET is not configured or empty.
 * Never falls back to a development secret in production.
 */
export function isCronAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || !cronSecret.trim()) {
    // FAIL CLOSED: If no secret is configured, no caller is authorized.
    return false;
  }

  const trimmedSecret = cronSecret.trim();

  // 1. Check Authorization: Bearer <secret>
  const authHeader =
    request.headers.get('authorization') ||
    request.headers.get('Authorization');

  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      if (timingSafeCompare(parts[1].trim(), trimmedSecret)) {
        return true;
      }
    }
  }

  // 2. Check x-cron-secret header
  const xCronSecret = request.headers.get('x-cron-secret');
  if (xCronSecret && timingSafeCompare(xCronSecret.trim(), trimmedSecret)) {
    return true;
  }

  return false;
}
