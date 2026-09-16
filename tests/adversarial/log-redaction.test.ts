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
    expect(cleaned.user.contact.token).toBe('[REDACTED]');

    // Serialize to inspect final string output
    const serialized = JSON.stringify(cleaned);

    expect(serialized).not.toContain(SYNTHETIC_MSISDN_1);
    expect(serialized).not.toContain(SYNTHETIC_MSISDN_2);
    expect(serialized).not.toContain(SYNTHETIC_MSISDN_LOCAL);
    expect(serialized).not.toContain(SYNTHETIC_PHONE_ENC);
    expect(serialized).not.toContain('SuperSecretPassword123');
    expect(serialized).not.toContain('top-secret-token');
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
