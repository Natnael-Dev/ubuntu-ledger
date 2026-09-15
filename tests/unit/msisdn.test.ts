import { describe, it, expect } from 'vitest';
import { extractMsisdnPrefix } from '@/lib/msisdn';

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
