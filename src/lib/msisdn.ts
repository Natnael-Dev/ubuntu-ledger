// Channel Ingress Phone Number Normalization
// Authoritative sources: docs/specs/07-trust-and-security.md §5, docs/specs/03-data-model.md §4
// Note: This module lives at the ingress/application boundary. The domain core NEVER receives raw MSISDN.

import { createHmac } from 'node:crypto';

/**
 * Extracts a 6-digit MSISDN prefix bucket from an inbound phone number string.
 *
 * Supported formats:
 * - "+254712345678" -> "254712"
 * - "254712345678"  -> "254712"
 * - "0712345678"    -> "254712" (when defaultCountryCode is "254")
 * - "254712"        -> "254712"
 */
export function extractMsisdnPrefix(
  input: string,
  defaultCountryCode?: string
): string {
  if (!input) {
    throw new Error('Inbound MSISDN or prefix must not be empty');
  }

  // Strip all non-digit characters
  let digits = input.replace(/\D/g, '');

  // Handle local leading '0' if default country code is supplied
  if (defaultCountryCode && digits.startsWith('0') && digits.length > 6) {
    digits = defaultCountryCode.replace(/\D/g, '') + digits.slice(1);
  }

  if (digits.length < 6) {
    throw new Error(
      `Inbound MSISDN must contain at least 6 digits; got '${input}' (${digits.length} digits)`
    );
  }

  return digits.slice(0, 6);
}

/**
 * Computes the canonical HMAC-SHA256 phone hash from an MSISDN and pepper.
 * Authoritative: docs/specs/07-trust-and-security.md §5 ("phone_hash = HMAC-SHA256(msisdn, PEPPER)"),
 * docs/specs/03-data-model.md §4 line 164.
 *
 * Trust boundary: Lives strictly in src/lib (boundary helper), never inside src/domain.
 */
export function computePhoneHash(msisdn: string, pepper: string): string {
  if (!msisdn || typeof msisdn !== 'string') {
    throw new Error('msisdn must be a non-empty string');
  }
  if (!pepper || typeof pepper !== 'string') {
    throw new Error('pepper must be a non-empty string');
  }

  // Normalize: remove non-digits, ensure E.164 leading plus
  const digits = msisdn.replace(/\D/g, '');
  if (!digits) {
    throw new Error('msisdn must contain digit characters');
  }
  const normalized = `+${digits}`;

  return createHmac('sha256', pepper)
    .update(normalized, 'utf8')
    .digest('hex');
}
