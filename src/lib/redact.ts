// PII and Secret Redaction Engine (T-24 / S-15)
// Authoritative sources:
// - docs/specs/07-trust-and-security.md §5
// - docs/specs/10-skills.md S-15
// - docs/specs/11-tasks.md T-24
// - docs/specs/17-scope-control.md

const SENSITIVE_KEY_REGEX =
  /^(phone_?number|msisdn|phone_?enc|password|secret|pepper|token|bearer|auth|authorization|cookie|api_?key)$/i;

// Matches E.164 numbers, common African mobile numbers (+251..., +254..., 09..., 07...), and formatted numbers
const PHONE_NUMBER_REGEX =
  /(?:\+?25[14]\s*\d{2,3}[\s-]*\d{3,4}[\s-]*\d{3,4})|(?:\+?[1-9]\d{8,14})|(?:\b0[79]\d{8}\b)/g;

// Matches Bearer tokens and JWTs
const BEARER_TOKEN_REGEX = /\bBearer\s+[A-Za-z0-9\-_.]+\b/gi;
const JWT_REGEX = /\beyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+(?:\.[A-Za-z0-9-_.+/=]*)?\b/g;

// Matches connection URIs with credentials
const DB_CREDENTIAL_URI_REGEX = /postgres(?:ql)?:\/\/[^:]+:[^@]+@[^\s/'"]+/gi;

/**
 * Redacts phone numbers, secrets, tokens, and storage paths from a string.
 */
export function redactString(str: string): string {
  if (!str || typeof str !== 'string') {
    return str;
  }

  let result = str;

  // 1. Redact DB credentials
  result = result.replace(DB_CREDENTIAL_URI_REGEX, 'postgresql://[REDACTED_USER]:[REDACTED_PASSWORD]@[REDACTED_HOST]');

  // 2. Redact Bearer tokens and JWTs
  result = result.replace(BEARER_TOKEN_REGEX, 'Bearer [REDACTED_TOKEN]');
  result = result.replace(JWT_REGEX, '[REDACTED_JWT]');

  // 3. Redact phone numbers / MSISDNs
  result = result.replace(PHONE_NUMBER_REGEX, '[REDACTED_PHONE]');

  return result;
}

/**
 * Deeply redacts an object, array, or primitive structure.
 */
export function redactPii<T>(data: T, depth = 0): T {
  if (depth > 10 || data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    return redactString(data) as unknown as T;
  }

  if (typeof data === 'number' || typeof data === 'boolean') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => redactPii(item, depth + 1)) as unknown as T;
  }

  if (data instanceof Error) {
    const redactedError = new Error(redactString(data.message));
    redactedError.name = data.name;
    if (data.stack) {
      redactedError.stack = redactString(data.stack);
    }
    return redactedError as unknown as T;
  }

  if (typeof data === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (SENSITIVE_KEY_REGEX.test(key)) {
        result[key] = '[REDACTED]';
      } else if (typeof value === 'string') {
        result[key] = redactString(value);
      } else {
        result[key] = redactPii(value, depth + 1);
      }
    }
    return result as T;
  }

  return data;
}
