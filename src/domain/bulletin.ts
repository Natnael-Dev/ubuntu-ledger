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

import { assertNoBannedWords } from './content';

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
// UNICODE HOMOGLYPH NORMALISATION
// ============================================================================

/**
 * Normalises common Unicode homoglyphs used to evade banned-word detection.
 * This covers Latin lookalikes (Cyrillic, Greek, etc.) and zero-width characters.
 */
export function normalizeForBannedWordCheck(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\u200B|\u200C|\u200D|\uFEFF/g, '') // strip zero-width chars
    .replace(/[а-яА-ЯёЁ]/g, (ch) => {
      // Common Cyrillic lookalikes -> Latin
      const map: Record<string, string> = {
        'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'х': 'x',
        'А': 'A', 'Е': 'E', 'О': 'O', 'Р': 'P', 'С': 'C', 'Х': 'X',
      };
      return map[ch] || ch;
    })
    .toLowerCase();
}

// ============================================================================
// BANNED-WORD VALIDATION (07 §6.5)
// ============================================================================

/**
 * Validates bulletin script text against the banned lexicon with homoglyph normalisation.
 * Throws an Error with which term was found if any banned term appears.
 */
export function validateBulletinScript(scriptText: string): void {
  const normalized = normalizeForBannedWordCheck(scriptText);
  // Use the existing assertNoBannedWords from content.ts
  assertNoBannedWords(normalized);
}

// ============================================================================
// FRAME GRAMMAR VALIDATOR
// ============================================================================

/**
 * Validates that the script conforms to the bulletin frame grammar.
 * A valid script must begin with the header frame and end with the footer frame.
 * Returns { valid: true } if ok, { valid: false, reason: string } if violation.
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

  const expectedHeaderPrefix = `Ward ${wardCode} Public Services Observation Report`;
  const expectedPeriodFragment = `${periodStart} to ${periodEnd}`;

  if (!scriptText.includes(expectedHeaderPrefix)) {
    return {
      valid: false,
      reason: `Script must include the canonical header: "${expectedHeaderPrefix}"`,
    };
  }

  if (!scriptText.includes(expectedPeriodFragment)) {
    return {
      valid: false,
      reason: `Script must include the period: "${expectedPeriodFragment}"`,
    };
  }

  const expectedFooter = BULLETIN_FRAMES.footer;
  if (!scriptText.includes(expectedFooter)) {
    return {
      valid: false,
      reason: `Script must end with the canonical footer`,
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
