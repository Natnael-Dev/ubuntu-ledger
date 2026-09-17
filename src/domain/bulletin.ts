// Pure Domain Logic for Radio Bulletin Compilation (T-28)
// Authoritative sources:
// - docs/specs/03-data-model.md §8, §12
// - docs/specs/05-api-contracts.md §9
// - docs/specs/07-trust-and-security.md §6.4, §6.5
// - docs/specs/10-skills.md S-12
// - docs/specs/11-tasks.md T-28
//
// Invariants:
// INV-06: Bulletin export is blocked (409 E_NOT_APPROVED) unless state = APPROVED_FOR_BROADCAST.
// Approval re-validates every fact's k-status at approval time.
// Banned lexicon: corrupt*, bribe*, theft, stole*, fraud*, criminal*, illegal*
// Frame grammar: fixed sentence templates with numeric/code slots only; no free-form accusations.
// Unicode homoglyphs are normalised before banned-word check.

import { assertNoBannedWords, BANNED_TERMS } from './content';

// ============================================================================
// TYPES
// ============================================================================

export type BulletinState =
  | 'DRAFT'
  | 'APPROVED_FOR_BROADCAST'
  | 'REJECTED'
  | 'BROADCAST_CONFIRMED';

export interface BulletinFact {
  serviceCode: string;
  officeCode: string;
  windowDays: number;
  reportCount: number;
  distinctClusters: number;
  pctAdditionalFee: number;
  medianExtraMinor: number;
  currency: string;
  kSatisfied: boolean;
}

export interface BulletinDomain {
  id: string;
  wardId: string;
  wardCode: string;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;   // YYYY-MM-DD
  facts: BulletinFact[];
  scriptText: string;
  locale: string;
  state: BulletinState;
  moderatorInitials?: string;
  moderatedAt?: string;
  rejectionReason?: string;
  createdAt: string;
}

export interface CompileBulletinInput {
  wardId: string;
  wardCode: string;
  periodStart: string;
  periodEnd: string;
  facts: BulletinFact[];
  locale?: string;
}

export interface BulletinApproveInput {
  moderatorInitials: string;
  editedScript?: string;
}

export interface BulletinRejectInput {
  reason: string;
}

export interface BulletinExportDto {
  id: string;
  wardId: string;
  periodStart: string;
  periodEnd: string;
  scriptText: string;
  locale: string;
  moderatedAt?: string;
  moderatorInitials?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Fixed sentence frames per 07 §6.4. Moderators may only edit numeric/code SLOTS.
 * No free-form accusations are allowed.
 */
export const BULLETIN_FRAMES = {
  header: 'Ward {wardCode} Public Services Observation Report · Period: {periodStart} to {periodEnd}.',
  factWithFee: 'Service {serviceCode} at office {officeCode}: in the last {windowDays} days, {pct}% of {count} reports indicated a payment request above the statutory ceiling. Median additional amount: {currency} {medianMajor}.',
  factNoFee: 'Service {serviceCode} at office {officeCode}: {count} reports received in the last {windowDays} days. No significant divergence recorded.',
  footer: 'This bulletin is compiled from anonymised community observations. Reports do not constitute findings of wrongdoing.',
} as const;

export type BulletinFrameKey = keyof typeof BULLETIN_FRAMES;

// ============================================================================
// UNICODE HOMOGLYPH & LEETSPEAK NORMALISATION (SEC-06)
// ============================================================================

export const HOMOGLYPH_MAP: Record<string, string> = {
  // Cyrillic lowercase & uppercase
  'а': 'a', 'А': 'a', 'в': 'b', 'В': 'b', 'е': 'e', 'Е': 'e',
  'і': 'i', 'І': 'i', 'ј': 'j', 'Ј': 'j', 'к': 'k', 'К': 'k',
  'м': 'm', 'М': 'm', 'н': 'h', 'Н': 'h', 'о': 'o', 'О': 'o',
  'р': 'p', 'Р': 'p', 'с': 'c', 'С': 'c', 'т': 't', 'Т': 't',
  'у': 'y', 'У': 'y', 'х': 'x', 'Х': 'x',

  // Greek lowercase & uppercase
  'α': 'a', 'Α': 'a', 'β': 'b', 'Β': 'b', 'ε': 'e', 'Ε': 'e',
  'ι': 'i', 'Ι': 'i', 'κ': 'k', 'Κ': 'k', 'ν': 'v', 'Ν': 'v',
  'ο': 'o', 'Ο': 'o', 'ρ': 'p', 'Ρ': 'p', 'υ': 'u', 'Υ': 'u',
  'χ': 'x', 'Χ': 'x',
};

export const LEET_MAP: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '!': 'i',
  '|': 'i',
  '3': 'e',
  '4': 'a',
  '@': 'a',
  '5': 's',
  '$': 's',
  '7': 't',
  '+': 't',
  '8': 'b',
};

/**
 * Normalises common Unicode homoglyphs, invisible characters, diacritical marks,
 * and leetspeak substitutions used to evade banned-word detection.
 * Strictly preserves Ethiopic (Amharic) and Oromo orthography.
 */
export function normalizeForBannedWordCheck(text: string): string {
  // 1. NFKD decomposition
  let t = text.normalize('NFKD');

  // 2. Strip all zero-width, formatting, and invisible characters
  t = t.replace(/[\u00AD\u180E\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, '');

  // 3. Strip Latin combining diacritical marks (U+0300 - U+036F)
  // Ethiopic marks (U+135D-U+135F) are untouched.
  t = t.replace(/[\u0300-\u036F]/g, '');

  // 4. Map Homoglyphs (Cyrillic & Greek lookalikes)
  t = t.replace(/[\u0400-\u04FF\u0370-\u03FF]/g, (ch) => HOMOGLYPH_MAP[ch] || ch);

  // 5. Lowercase
  t = t.toLowerCase();

  // 6. Map Leetspeak
  let leetProjected = '';
  for (const char of t) {
    leetProjected += LEET_MAP[char] || char;
  }

  return leetProjected;
}

// ============================================================================
// BANNED-WORD VALIDATION (07 §6.5)
// ============================================================================

/**
 * Validates bulletin script text against the banned lexicon with homoglyph normalisation
 * and collapsed Latin projection to prevent delimiter evasion.
 */
export function validateBulletinScript(scriptText: string): void {
  const normalized = normalizeForBannedWordCheck(scriptText);
  // Check 1: direct normalized text
  assertNoBannedWords(normalized);

  // Check 2: Collapsed Latin projection check (catches c.o.r.r.u.p.t, b_r_i_b_e, etc.)
  const projectedLatin = normalized.replace(/[^a-z]/g, '');
  const projectedWithL = projectedLatin.replace(/i/g, 'l');
  for (const term of BANNED_TERMS) {
    if (projectedLatin.includes(term) || projectedWithL.includes(term)) {
      throw new Error(`Content integrity violation: text contains obfuscated banned term '${term}'`);
    }
  }
}

// ============================================================================
// FRAME GRAMMAR VALIDATOR (SEC-05)
// ============================================================================

/**
 * Validates that the script conforms strictly to the bulletin frame grammar.
 * Rejects any arbitrary text, unapproved sentences, defaming prose, HTML,
 * or corrupted slots inserted between or around frames.
 */
export function validateFrameGrammar(
  scriptText: string,
  wardCode: string,
  periodStart: string,
  periodEnd: string
): { valid: boolean; reason?: string } {
  if (!scriptText || !scriptText.trim()) {
    return { valid: false, reason: 'Script text is empty' };
  }

  // Normalize all whitespaces/newlines to single space
  const normalized = scriptText.trim().replace(/\s+/g, ' ');

  const footerLiteral = BULLETIN_FRAMES.footer;
  if (!normalized.endsWith(footerLiteral)) {
    return {
      valid: false,
      reason: 'Script must end with the canonical footer',
    };
  }

  const withoutFooter = normalized.slice(0, normalized.length - footerLiteral.length).trim();

  const expectedHeader = `Ward ${wardCode} Public Services Observation Report · Period: ${periodStart} to ${periodEnd}.`;
  if (!withoutFooter.startsWith(expectedHeader)) {
    if (!withoutFooter.includes('Public Services Observation Report')) {
      return {
        valid: false,
        reason: 'Script must include the canonical header',
      };
    }
    return {
      valid: false,
      reason: `Script header does not match expected canonical header: "${expectedHeader}"`,
    };
  }

  const bodyText = withoutFooter.slice(expectedHeader.length).trim();
  if (!bodyText) {
    return {
      valid: false,
      reason: 'Script must contain at least one fact frame',
    };
  }

  // Parse fact frames strictly
  let remaining = bodyText;
  const parsedFacts: string[] = [];

  while (remaining.length > 0) {
    remaining = remaining.trim();
    if (!remaining.startsWith('Service ')) {
      return {
        valid: false,
        reason: `Script contains unauthorized tokens or invalid sentence frame: "${remaining.slice(0, 40)}"`,
      };
    }

    // Match FACT_WITH_FEE
    const feeMatch = remaining.match(
      /^(Service [A-Za-z0-9_-]+ at office [A-Za-z0-9_-]+: in the last \d+ days, \d+(?:\.\d+)?% of \d+ reports indicated a payment request above the statutory ceiling\. Median additional amount: [A-Z]{3} \d+\.\d{2}\.)(?:\s+|$)/
    );
    if (feeMatch) {
      parsedFacts.push(feeMatch[1]);
      remaining = remaining.slice(feeMatch[0].length);
      continue;
    }

    // Match FACT_NO_FEE
    const noFeeMatch = remaining.match(
      /^(Service [A-Za-z0-9_-]+ at office [A-Za-z0-9_-]+: \d+ reports received in the last \d+ days\. No significant divergence recorded\.)(?:\s+|$)/
    );
    if (noFeeMatch) {
      parsedFacts.push(noFeeMatch[1]);
      remaining = remaining.slice(noFeeMatch[0].length);
      continue;
    }

    return {
      valid: false,
      reason: `Fact frame does not match any valid template: "${remaining.slice(0, 50)}"`,
    };
  }

  // Exact structural match
  const reconstructed = [expectedHeader, ...parsedFacts, footerLiteral].join(' ');
  if (reconstructed !== normalized) {
    return {
      valid: false,
      reason: 'Script contains extraneous tokens or unapproved formatting',
    };
  }

  return { valid: true };
}

// ============================================================================
// SLOT INTERPOLATION
// ============================================================================

function interpolate(template: string, slots: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const value = slots[key];
    return value !== undefined ? String(value) : `{${key}}`;
  });
}

function formatMinorToMajor(minor: number): string {
  return (minor / 100).toFixed(2);
}

// ============================================================================
// BULLETIN SCRIPT COMPILER (07 §6.4, S-12)
// ============================================================================

/**
 * Compiles a bulletin script from k-gated facts using the fixed frame grammar.
 * Only facts where kSatisfied === true are included in the script.
 * Facts where kSatisfied === false at compile time are silently omitted.
 * Returns null if no k-satisfied facts are available.
 */
export function compileBulletinScript(
  wardCode: string,
  periodStart: string,
  periodEnd: string,
  facts: BulletinFact[]
): string | null {
  const kSatisfiedFacts = facts.filter((f) => f.kSatisfied);
  if (kSatisfiedFacts.length === 0) {
    return null;
  }

  const lines: string[] = [];

  // Header
  lines.push(
    interpolate(BULLETIN_FRAMES.header, {
      wardCode,
      periodStart,
      periodEnd,
    })
  );

  // One sentence per fact
  for (const fact of kSatisfiedFacts) {
    if (fact.pctAdditionalFee > 0 && fact.medianExtraMinor > 0) {
      lines.push(
        interpolate(BULLETIN_FRAMES.factWithFee, {
          serviceCode: fact.serviceCode,
          officeCode: fact.officeCode,
          windowDays: fact.windowDays,
          pct: fact.pctAdditionalFee,
          count: fact.reportCount,
          currency: fact.currency,
          medianMajor: formatMinorToMajor(fact.medianExtraMinor),
        })
      );
    } else {
      lines.push(
        interpolate(BULLETIN_FRAMES.factNoFee, {
          serviceCode: fact.serviceCode,
          officeCode: fact.officeCode,
          windowDays: fact.windowDays,
          count: fact.reportCount,
        })
      );
    }
  }

  // Footer
  lines.push(BULLETIN_FRAMES.footer);

  return lines.join(' ');
}

// ============================================================================
// K-STATUS REVALIDATION (approval-time k-recheck per 05 §9)
// ============================================================================

export interface KRecheckResult {
  allValid: boolean;
  failingFactIndex?: number;
  failingServiceCode?: string;
}

/**
 * Re-validates every fact's k-status against live data at approval time.
 * Per 05 §9: if any fact has dropped below k=5 since compile time, approval is blocked.
 */
export function revalidateFactsKStatus(
  facts: BulletinFact[],
  liveKSatisfied: (serviceCode: string) => boolean
): KRecheckResult {
  for (let i = 0; i < facts.length; i++) {
    const fact = facts[i];
    if (fact.kSatisfied && !liveKSatisfied(fact.serviceCode)) {
      return {
        allValid: false,
        failingFactIndex: i,
        failingServiceCode: fact.serviceCode,
      };
    }
  }
  return { allValid: true };
}
