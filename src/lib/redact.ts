// PII and Secret Redaction Engine (T-24 / S-15)
// Authoritative sources:
// - docs/specs/07-trust-and-security.md §5
// - docs/specs/10-skills.md S-15
// - docs/specs/11-tasks.md T-24
// - docs/specs/17-scope-control.md

export const SENSITIVE_KEY_REGEX =
  /(?:token|secret|pass(?:word|wd)|pwd|phone|msisdn|pepper|bearer|cookie|api_?key|actor_?ref|citizen|credential|(?:^|[_\-])auth(?:entication|orization|Header|Code|Token|Secret|Key|Context|Credentials)?(?:[_\-]|$)|[a-z0-9]auth(?:entication|orization)?$)/i;

// Matches E.164 numbers, common African mobile numbers (+251..., +254..., 09..., 07...), and formatted numbers
const PHONE_NUMBER_REGEX =
  /(?:\+?25[14]\s*\d{2,3}[\s-]*\d{3,4}[\s-]*\d{3,4})|(?:\+?[1-9]\d{8,14})|(?:\b0[79]\d{8}\b)/g;

// Matches Bearer tokens and JWTs
const BEARER_TOKEN_REGEX = /\bBearer\s+[A-Za-z0-9\-_.]+\b/gi;
const JWT_REGEX = /\beyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+(?:\.[A-Za-z0-9-_.+/=]*)?\b/g;

// Matches connection URIs with credentials
const DB_CREDENTIAL_URI_REGEX = /postgres(?:ql)?:\/\/[^:]+:[^@]+@[^\s/'"]+/gi;

// Matches citizen references and actor references in string logs
const CITIZEN_IDENTIFIER_REGEX = /\b(?:citizen[-_][a-z0-9_-]+|actor_ref[:=\s]+[^\s,;]+)\b/gi;

// Matches sensitive storage paths (gazettes, voice recordings)
const STORAGE_PATH_REGEX = /\b(?:gazettes|voice|recordings)\/[^\s'",;]+\b/gi;

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

  // 4. Redact citizen references and actor_ref in strings
  result = result.replace(CITIZEN_IDENTIFIER_REGEX, '[REDACTED_CITIZEN_REF]');

  // 5. Redact storage paths in strings
  result = result.replace(STORAGE_PATH_REGEX, '[REDACTED_PATH]');

  return result;
}

/**
 * Deeply redacts an object, array, or primitive structure.
 * Tracks visited objects via WeakSet to prevent circular reference crashes in JSON serialization.
 * Deep nesting is sanitized rather than returned raw.
 */
export function redactPii<T>(
  data: T,
  depth = 0,
  seen: WeakSet<object> = new WeakSet<object>()
): T {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    return redactString(data) as unknown as T;
  }

  if (typeof data === 'number' || typeof data === 'boolean') {
    return data;
  }

  // Guard against pathological call stack depth while never returning raw unsanitized objects
  if (depth > 20) {
    if (typeof data === 'object') {
      return '[TRUNCATED]' as unknown as T;
    }
    return data;
  }

  if (typeof data === 'object') {
    if (seen.has(data as object)) {
      return '[CIRCULAR]' as unknown as T;
    }
    seen.add(data as object);

    if (Array.isArray(data)) {
      return data.map((item) => redactPii(item, depth + 1, seen)) as unknown as T;
    }

    if (data instanceof Error) {
      const redactedError = new Error(redactString(data.message));
      redactedError.name = data.name;
      if (data.stack) {
        redactedError.stack = redactString(data.stack);
      }
      return redactedError as unknown as T;
    }

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (SENSITIVE_KEY_REGEX.test(key)) {
        result[key] = '[REDACTED]';
      } else if (typeof value === 'string') {
        result[key] = redactString(value);
      } else {
        result[key] = redactPii(value, depth + 1, seen);
      }
    }
    return result as T;
  }

  return data;
}
