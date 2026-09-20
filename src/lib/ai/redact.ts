// PII and Sensitive Information Redaction Boundary for AI Layer (T-AI-010 / T-AI-011)
// Authoritative sources:
// - docs/specs/07-trust-and-security.md §3, §5
// - docs/specs/03-data-model.md §4
// - docs/specs/10-skills.md S-15
// Rule: Full MSISDNs, exact GPS coordinates, and personal actor identities MUST NEVER
// cross the network boundary into external AI model providers (Gemini, OpenAI).

// Keys that are strictly sensitive and must be completely redacted
const SENSITIVE_KEY_REGEX =
  /(?:token|secret|pass(?:word|wd)|pwd|phone|msisdn|pepper|bearer|cookie|api_?key|credential|(?:^|[_\-])auth(?:entication|orization|Header|Code|Token|Secret|Key|Context|Credentials)?(?:[_\-]|$)|[a-z0-9]auth(?:entication|orization)?$)/i;

// Keys indicating personal actor or citizen identities
const ACTOR_IDENTITY_KEY_REGEX =
  /(?:^(?:name|full_?name|first_?name|last_?name|actor_?name|citizen_?name|reporter_?name|respondent_?name|author_?name|contact_?name|user_?name)$|citizen_?id|actor_?ref)/i;

// Keys representing exact GPS coordinates
const EXACT_GPS_KEY_REGEX =
  /(?:^(?:lat(?:itude)?|lng|long(?:itude)?|coords?|coordinates?|exact_?location|precise_?gps|gps_?coords?)$)/i;

// Matches E.164 numbers, East African mobile patterns (+251..., +254..., 07..., 09...), and phone formats
const PHONE_NUMBER_REGEX =
  /(?:\+?25[14]\s*\d{2,3}[\s-]*\d{3,4}[\s-]*\d{3,4})|(?:\+?[1-9]\d{8,14})|(?:\b0[79]\d{8}\b)/g;

// Matches exact GPS coordinate decimals (e.g. -1.292145, 36.821984 or lat/long pairs with 3+ decimal places)
const GPS_COORDINATE_REGEX =
  /[-+]?([1-8]?\d(\.\d{3,})|90(\.0{3,})?),\s*[-+]?(180(\.0{3,})?|((1[0-7]\d)|([1-9]?\d))(\.\d{3,}))/g;

// Matches single high-precision latitude/longitude floating point numbers with explicit coordinate tags
const SINGLE_COORD_DECIMAL_REGEX =
  /\b(?:lat|lng|latitude|longitude)[:=\s]+[-+]?\d{1,3}\.\d{3,}\b/gi;

// Matches citizen references and actor references in string logs
const CITIZEN_IDENTIFIER_REGEX =
  /\b(?:citizen[-_][a-z0-9_-]+|actor_ref[:=\s]+[^\s,;]+|respondent[:=\s]+[^\s,;]+)\b/gi;

// Matches Bearer tokens and JWTs
const BEARER_TOKEN_REGEX = /\bBearer\s+[A-Za-z0-9\-_.]+\b/gi;
const JWT_REGEX = /\beyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+(?:\.[A-Za-z0-9-_.+/=]*)?\b/g;

/**
 * Sanitizes a string value by removing phone numbers, exact GPS points, tokens, and citizen identifiers.
 */
export function redactPiiString(str: string): string {
  if (!str || typeof str !== 'string') {
    return str;
  }

  let result = str;

  // 1. Redact Bearer tokens & JWTs
  result = result.replace(BEARER_TOKEN_REGEX, 'Bearer [REDACTED_TOKEN]');
  result = result.replace(JWT_REGEX, '[REDACTED_JWT]');

  // 2. Redact MSISDNs / phone numbers
  result = result.replace(PHONE_NUMBER_REGEX, '[REDACTED_PHONE]');

  // 3. Redact exact GPS coordinates
  result = result.replace(GPS_COORDINATE_REGEX, '[REDACTED_GPS]');
  result = result.replace(SINGLE_COORD_DECIMAL_REGEX, '[REDACTED_GPS]');

  // 4. Redact citizen / actor references
  result = result.replace(CITIZEN_IDENTIFIER_REGEX, '[REDACTED_ACTOR]');

  return result;
}

/**
 * Recursively redacts a payload before passing to external AI services.
 * Strips:
 * 1. Full MSISDNs / phone numbers
 * 2. Exact GPS coordinates (keys and high-precision values)
 * 3. Citizen / actor names and identifying references
 *
 * Employs cycle detection via WeakSet to prevent stack overflows on circular structures.
 */
export function redactPiiPayload<T>(
  data: T,
  depth = 0,
  seen: WeakSet<object> = new WeakSet<object>()
): T {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    return redactPiiString(data) as unknown as T;
  }

  if (typeof data === 'number' || typeof data === 'boolean') {
    return data;
  }

  // Guard against pathological call stack depth
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
      return data.map((item) => redactPiiPayload(item, depth + 1, seen)) as unknown as T;
    }

    if (data instanceof Error) {
      const redactedError = new Error(redactPiiString(data.message));
      redactedError.name = data.name;
      if (data.stack) {
        redactedError.stack = redactPiiString(data.stack);
      }
      return redactedError as unknown as T;
    }

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      // 1. Check sensitive keys (phone, secret, token)
      if (SENSITIVE_KEY_REGEX.test(key)) {
        result[key] = '[REDACTED_SENSITIVE]';
      }
      // 2. Check actor/citizen identity keys
      else if (ACTOR_IDENTITY_KEY_REGEX.test(key)) {
        result[key] = '[REDACTED_ACTOR]';
      }
      // 3. Check exact GPS coordinate keys
      else if (EXACT_GPS_KEY_REGEX.test(key)) {
        result[key] = '[REDACTED_GPS]';
      }
      // 4. Recurse or sanitize string values
      else if (typeof value === 'string') {
        result[key] = redactPiiString(value);
      } else {
        result[key] = redactPiiPayload(value, depth + 1, seen);
      }
    }
    return result as T;
  }

  return data;
}
