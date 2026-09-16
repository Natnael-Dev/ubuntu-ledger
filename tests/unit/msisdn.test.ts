import { describe, it, expect } from 'vitest';
import { extractMsisdnPrefix, computePhoneHash } from '@/lib/msisdn';

describe('extractMsisdnPrefix (ingress boundary)', () => {
  it('extracts 6-digit prefix bucket from international E.164 with plus', () => {
    expect(extractMsisdnPrefix('+254712345678')).toBe('254712');
  });

  it('extracts 6-digit prefix bucket from international format without plus', () => {
    expect(extractMsisdnPrefix('254712345678')).toBe('254712');
  });

  it('extracts 6-digit prefix bucket from local format with default country code', () => {
    expect(extractMsisdnPrefix('0712345678', '254')).toBe('254712');
  });

  it('preserves already truncated 6-digit prefix bucket', () => {
    expect(extractMsisdnPrefix('254712')).toBe('254712');
  });

  it('throws on empty string', () => {
    expect(() => extractMsisdnPrefix('')).toThrow(/must not be empty/);
  });

  it('throws on string with fewer than 6 digits', () => {
    expect(() => extractMsisdnPrefix('123')).toThrow(/at least 6 digits/);
  });
});

describe('computePhoneHash (zero-PII HMAC boundary)', () => {
  const TEST_PEPPER = 'test-pepper-32-chars-long-strictly-synthetic';

  it('computes deterministic 64-char hex HMAC-SHA256 hash', () => {
    const hash1 = computePhoneHash('+251999000001', TEST_PEPPER);
    const hash2 = computePhoneHash('+251999000001', TEST_PEPPER);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(hash1)).toBe(true);
  });

  it('normalizes spaces, dashes, and format variations to same hash', () => {
    const hash1 = computePhoneHash('+251 999 000 001', TEST_PEPPER);
    const hash2 = computePhoneHash('+251-999-000-001', TEST_PEPPER);
    const hash3 = computePhoneHash('251999000001', TEST_PEPPER);
    expect(hash1).toBe(hash2);
    expect(hash1).toBe(hash3);
  });

  it('produces different hashes for different numbers', () => {
    const hash1 = computePhoneHash('+251999000001', TEST_PEPPER);
    const hash2 = computePhoneHash('+251999000002', TEST_PEPPER);
    expect(hash1).not.toBe(hash2);
  });

  it('produces different hashes for different peppers', () => {
    const hash1 = computePhoneHash('+251999000001', TEST_PEPPER);
    const hash2 = computePhoneHash('+251999000001', 'different-pepper-value-for-testing-only');
    expect(hash1).not.toBe(hash2);
  });

  it('throws on empty phone number or pepper', () => {
    expect(() => computePhoneHash('', TEST_PEPPER)).toThrow(/non-empty string/);
    expect(() => computePhoneHash('+251999000001', '')).toThrow(/non-empty string/);
  });
});
