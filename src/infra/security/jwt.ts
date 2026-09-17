// Zero-dependency HS256 JWT Verification Helper
// Authoritative sources: docs/specs/07-trust-and-security.md §9, docs/specs/02-architecture.md §10

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { ActorRole } from '@/domain/types';
import { SystemClock } from '@/infra/clock';

export interface VerifiedActorClaim {
  role: ActorRole;
  actorRef: string;
  sub?: string;
  email?: string;
  aud?: string;
}

export interface JwtVerificationResult {
  valid: boolean;
  claims?: VerifiedActorClaim;
  error?: string;
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * Creates a deterministic HS256 signature for a token segment.
 */
function createSignature(headerAndPayload: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(headerAndPayload)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Verifies an HS256 JWT using native Node.js crypto.
 * Fails closed if secret is missing or token is forged/expired.
 */
export function verifyJwtToken(
  token: string,
  secretOverride?: string
): JwtVerificationResult {
  const secret =
    secretOverride ||
    process.env.SUPABASE_JWT_SECRET ||
    process.env.AUTH_JWT_SECRET;

  if (!secret) {
    return { valid: false, error: 'JWT secret not configured on server' };
  }

  const parts = token.trim().split('.');
  if (parts.length !== 3) {
    return { valid: false, error: 'Malformed JWT structure' };
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  // 1. Verify header algorithm
  try {
    const header = JSON.parse(base64UrlDecode(headerB64));
    if (header.alg !== 'HS256') {
      return { valid: false, error: `Unsupported algorithm: ${header.alg}` };
    }
  } catch {
    return { valid: false, error: 'Invalid JWT header encoding' };
  }

  // 2. Timing-safe signature check
  const expectedSig = createSignature(`${headerB64}.${payloadB64}`, secret);
  const expectedBuf = Buffer.from(expectedSig);
  const actualBuf = Buffer.from(signatureB64);

  if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
    return { valid: false, error: 'Invalid JWT signature' };
  }

  // 3. Verify payload and expiration
  try {
    const payload = JSON.parse(base64UrlDecode(payloadB64));
    const clock = new SystemClock();
    const nowSec = Math.floor(clock.nowMs() / 1000);

    if (payload.exp && typeof payload.exp === 'number' && nowSec > payload.exp) {
      return { valid: false, error: 'JWT token expired' };
    }
    if (payload.nbf && typeof payload.nbf === 'number' && nowSec < payload.nbf) {
      return { valid: false, error: 'JWT token not yet valid' };
    }

    // Extract role from standard claims or app_metadata
    const rawRole =
      payload.app_metadata?.role ||
      payload.user_metadata?.role ||
      payload.role;

    if (!rawRole) {
      return { valid: false, error: 'Missing actor role in JWT claims' };
    }

    const role = String(rawRole).toUpperCase() as ActorRole;
    const actorRef =
      payload.email ||
      payload.sub ||
      payload.actor_ref ||
      `user-${role.toLowerCase()}`;

    return {
      valid: true,
      claims: {
        role,
        actorRef,
        sub: payload.sub,
        email: payload.email,
        aud: payload.aud,
      },
    };
  } catch {
    return { valid: false, error: 'Invalid JWT payload encoding' };
  }
}

/**
 * Helper to generate signed JWTs for testing or local simulation.
 */
export function signJwtToken(
  payload: Record<string, unknown>,
  secret: string
): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = Buffer.from(JSON.stringify(header))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const payloadB64 = Buffer.from(JSON.stringify(payload))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const sig = createSignature(`${headerB64}.${payloadB64}`, secret);
  return `${headerB64}.${payloadB64}.${sig}`;
}
