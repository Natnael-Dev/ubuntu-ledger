// Adversarial Log Redaction Verification Test (T-24 / S-15)
// Authoritative sources:
// - docs/specs/07-trust-and-security.md §5
// - docs/specs/10-skills.md S-15
// - docs/specs/11-tasks.md T-24
// - docs/specs/17-scope-control.md

import { describe, it, expect } from 'vitest';
import { redactPii, redactString } from '@/lib/redact';
import { StructuredLogger, type StructuredLogRecord } from '@/lib/logger';

describe('T-24: Adversarial Log Redaction & PII Scrubbing (Release Blocker)', () => {
  const SYNTHETIC_MSISDN_1 = '+251999000003';
  const SYNTHETIC_MSISDN_2 = '254712345678';
  const SYNTHETIC_MSISDN_LOCAL = '0911223344';
  const SYNTHETIC_PHONE_ENC = '0x8f3a9b1c7d2e4f5a6b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a';
  const SYNTHETIC_STORAGE_PATH = 'gazettes/et-aa-w09-fy2026-capital.pdf';
  const SYNTHETIC_TOKEN = 'Bearer ya29.a0AfH6SMBx_secret_token_value_here';
  const SYNTHETIC_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.do_not_leak_this_sig';
  const SYNTHETIC_DB_URL = 'postgresql://postgres:SuperSecretPassword123@db.internal:5432/ubuntu';

  it('redacts raw MSISDNs in various formats from text strings', () => {
    const rawText = `User ${SYNTHETIC_MSISDN_1} called from ${SYNTHETIC_MSISDN_2} or local ${SYNTHETIC_MSISDN_LOCAL}`;
    const cleaned = redactString(rawText);

    expect(cleaned).not.toContain(SYNTHETIC_MSISDN_1);
    expect(cleaned).not.toContain(SYNTHETIC_MSISDN_2);
    expect(cleaned).not.toContain(SYNTHETIC_MSISDN_LOCAL);
    expect(cleaned).toContain('[REDACTED_PHONE]');
  });

  it('redacts database credentials, tokens, and JWTs from strings', () => {
    const rawText = `Connecting to ${SYNTHETIC_DB_URL} with auth header ${SYNTHETIC_TOKEN} and session ${SYNTHETIC_JWT}`;
    const cleaned = redactString(rawText);

    expect(cleaned).not.toContain('SuperSecretPassword123');
    expect(cleaned).not.toContain('secret_token_value_here');
    expect(cleaned).not.toContain('do_not_leak_this_sig');
    expect(cleaned).toContain('[REDACTED_PASSWORD]');
    expect(cleaned).toContain('[REDACTED_TOKEN]');
    expect(cleaned).toContain('[REDACTED_JWT]');
  });

  it('deeply scrubs structured objects containing sensitive keys and nested PII', () => {
    const dirtyPayload = {
      sessionId: 'sess-12345',
      phoneNumber: SYNTHETIC_MSISDN_1,
      msisdn: SYNTHETIC_MSISDN_2,
      phone_enc: SYNTHETIC_PHONE_ENC,
      user: {
        actor_ref: 'citizen-secret-ref-999',
        contact: {
          phone: SYNTHETIC_MSISDN_LOCAL,
          token: 'top-secret-token',
        },
      },
      audit: {
        action: 'OBSERVATION_SUBMITTED',
        dbUri: SYNTHETIC_DB_URL,
        storagePath: SYNTHETIC_STORAGE_PATH,
      },
    };

    const cleaned = redactPii(dirtyPayload) as typeof dirtyPayload;

    expect(cleaned.phoneNumber).toBe('[REDACTED]');
    expect(cleaned.msisdn).toBe('[REDACTED]');
    expect(cleaned.phone_enc).toBe('[REDACTED]');
    expect(cleaned.user.actor_ref).toBe('[REDACTED]');
    expect(cleaned.user.contact.token).toBe('[REDACTED]');

    // Serialize to inspect final string output
    const serialized = JSON.stringify(cleaned);

    expect(serialized).not.toContain(SYNTHETIC_MSISDN_1);
    expect(serialized).not.toContain(SYNTHETIC_MSISDN_2);
    expect(serialized).not.toContain(SYNTHETIC_MSISDN_LOCAL);
    expect(serialized).not.toContain(SYNTHETIC_PHONE_ENC);
    expect(serialized).not.toContain('SuperSecretPassword123');
    expect(serialized).not.toContain('top-secret-token');
    expect(serialized).not.toContain('citizen-secret-ref-999');
    expect(serialized).not.toContain(SYNTHETIC_STORAGE_PATH);
  });

  it('handles circular references via WeakSet cycle tracking without crashing JSON.stringify in logger', () => {
    // Reproduction test for Checkpoint 3 defect 3:
    // Circular structures previously crashed JSON.stringify in the logger with:
    // "TypeError: Converting circular structure to JSON"
    const circularObj: Record<string, unknown> = {
      name: 'CircularAuditRecord',
      token: SYNTHETIC_TOKEN,
    };
    circularObj.self = circularObj;

    const circularArray: unknown[] = ['initial-item'];
    circularArray.push(circularArray);
    circularObj.nestedArray = circularArray;

    // Must not throw or recurse infinitely
    const redacted = redactPii(circularObj);

    expect((redacted as Record<string, unknown>).token).toBe('[REDACTED]');
    expect((redacted as Record<string, unknown>).self).toBe('[CIRCULAR]');
    expect(((redacted as Record<string, unknown>).nestedArray as unknown[])[1]).toBe('[CIRCULAR]');

    // Must serialize safely through JSON.stringify without throwing
    expect(() => JSON.stringify(redacted)).not.toThrow();

    // Verify StructuredLogger sink handles it safely
    const emittedLines: string[] = [];
    const testLogger = new StructuredLogger((record: StructuredLogRecord) => {
      emittedLines.push(JSON.stringify(record));
    });

    expect(() => {
      testLogger.warn('Testing circular object logging', { payload: circularObj });
    }).not.toThrow();

    expect(emittedLines.length).toBe(1);
    expect(emittedLines[0]).toContain('[CIRCULAR]');
    expect(emittedLines[0]).not.toContain(SYNTHETIC_TOKEN);
  });

  it('scrubs citizen references and actor_ref from object keys and free text strings', () => {
    // Reproduction test for Checkpoint 3 defect 4:
    // actor_ref and citizen identifiers leaked in logs and objects
    const citizenPayload = {
      actor_ref: 'citizen-secret-ref-001',
      actorRef: 'citizen-secret-ref-002',
      citizen_id: 'cit-998877',
      citizenId: 'cit-112233',
      citizenRef: 'ref-445566',
      message: 'Citizen citizen-secret-ref-999 reported outage with actor_ref=cit-12345',
    };

    const redacted = redactPii(citizenPayload);

    expect(redacted.actor_ref).toBe('[REDACTED]');
    expect(redacted.actorRef).toBe('[REDACTED]');
    expect(redacted.citizen_id).toBe('[REDACTED]');
    expect(redacted.citizenId).toBe('[REDACTED]');
    expect(redacted.citizenRef).toBe('[REDACTED]');
    expect(redacted.message).not.toContain('citizen-secret-ref-999');
    expect(redacted.message).toContain('[REDACTED_CITIZEN_REF]');

    const serialized = JSON.stringify(redacted);
    expect(serialized).not.toContain('citizen-secret-ref-001');
    expect(serialized).not.toContain('citizen-secret-ref-002');
    expect(serialized).not.toContain('cit-998877');
    expect(serialized).not.toContain('citizen-secret-ref-999');
  });

  it('scrubs compound sensitive keys in camelCase and snake_case without impacting non-sensitive keys', () => {
    // Reproduction test for Checkpoint 3 defect 5:
    // Compound keys like accessToken, clientSecret, dbPassword, rawPhone bypassed SENSITIVE_KEY_REGEX
    const compoundPayload = {
      // Compound sensitive keys (camelCase)
      accessToken: 'token-val-123',
      refreshToken: 'refresh-val-456',
      clientSecret: 'secret-val-789',
      dbPassword: 'password-val-abc',
      rawPhone: '+251911998877',
      clientApiKey: 'key-val-xyz',
      // Compound sensitive keys (snake_case)
      access_token: 'token-val-123-snake',
      refresh_token: 'refresh-val-456-snake',
      client_secret: 'secret-val-789-snake',
      db_password: 'password-val-abc-snake',
      raw_phone: '+251911998878',
      api_key: 'key-val-xyz-snake',
      // Legitimate non-sensitive keys that must NOT be redacted
      authority: 'Water Authority of Addis Ababa',
      author: 'Amina Mengistu',
      action: 'REPAIR_VERIFIED',
      state: 'VERIFIED_SUSTAINED',
      status: 'CONFIRMED',
      ticketId: '00000000-0000-4000-a000-000000000001',
    };

    const redacted = redactPii(compoundPayload);

    // Verify all compound sensitive keys were redacted
    expect(redacted.accessToken).toBe('[REDACTED]');
    expect(redacted.refreshToken).toBe('[REDACTED]');
    expect(redacted.clientSecret).toBe('[REDACTED]');
    expect(redacted.dbPassword).toBe('[REDACTED]');
    expect(redacted.rawPhone).toBe('[REDACTED]');
    expect(redacted.clientApiKey).toBe('[REDACTED]');

    expect(redacted.access_token).toBe('[REDACTED]');
    expect(redacted.refresh_token).toBe('[REDACTED]');
    expect(redacted.client_secret).toBe('[REDACTED]');
    expect(redacted.db_password).toBe('[REDACTED]');
    expect(redacted.raw_phone).toBe('[REDACTED]');
    expect(redacted.api_key).toBe('[REDACTED]');

    // Verify legitimate non-sensitive keys were preserved
    expect(redacted.authority).toBe('Water Authority of Addis Ababa');
    expect(redacted.author).toBe('Amina Mengistu');
    expect(redacted.action).toBe('REPAIR_VERIFIED');
    expect(redacted.state).toBe('VERIFIED_SUSTAINED');
    expect(redacted.status).toBe('CONFIRMED');
    expect(redacted.ticketId).toBe('00000000-0000-4000-a000-000000000001');
  });

  it('sanitizes deep nesting (> 10 levels) rather than returning raw data', () => {
    // Reproduction test for Checkpoint 3 defect 6:
    // When depth > 10, previous code returned data raw without sanitizing sensitive keys or PII
    const deepObject: Record<string, unknown> = {
      level1: {
        level2: {
          level3: {
            level4: {
              level5: {
                level6: {
                  level7: {
                    level8: {
                      level9: {
                        level10: {
                          level11: {
                            password: 'deepSecretPassword123',
                            rawPhone: '+251911223344',
                            deepMessage: 'Call citizen-secret-ref-999 at +251911223344',
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    const redacted = redactPii(deepObject);
    const serialized = JSON.stringify(redacted);

    // Assert that sensitive keys at level 11 (> 10 levels) are NOT leaked raw
    expect(serialized).not.toContain('deepSecretPassword123');
    expect(serialized).not.toContain('+251911223344');
    expect(serialized).not.toContain('citizen-secret-ref-999');

    // Assert that the deep structure was sanitized
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lvl11 = (redacted as any).level1.level2.level3.level4.level5.level6.level7.level8.level9.level10.level11;
    expect(lvl11.password).toBe('[REDACTED]');
    expect(lvl11.rawPhone).toBe('[REDACTED]');
    expect(lvl11.deepMessage).toContain('[REDACTED_PHONE]');
  });

  it('StructuredLogger intercepts all log calls and prevents PII leakage to sinks', () => {
    const emittedLines: string[] = [];
    const testLogger = new StructuredLogger((record: StructuredLogRecord) => {
      emittedLines.push(JSON.stringify(record));
    });

    testLogger.info(`Inbound session from ${SYNTHETIC_MSISDN_1}`, {
      msisdn: SYNTHETIC_MSISDN_1,
      token: SYNTHETIC_TOKEN,
      phone_enc: SYNTHETIC_PHONE_ENC,
      db: SYNTHETIC_DB_URL,
    });

    testLogger.error('Connection failed with exception', {
      error: new Error(`Failed to dial ${SYNTHETIC_MSISDN_2} at ${SYNTHETIC_DB_URL}`),
    });

    expect(emittedLines.length).toBe(2);

    for (const logLine of emittedLines) {
      expect(logLine).not.toContain(SYNTHETIC_MSISDN_1);
      expect(logLine).not.toContain(SYNTHETIC_MSISDN_2);
      expect(logLine).not.toContain(SYNTHETIC_PHONE_ENC);
      expect(logLine).not.toContain('SuperSecretPassword123');
      expect(logLine).not.toContain('secret_token_value_here');
    }
  });
});
