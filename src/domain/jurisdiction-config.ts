// Pure Jurisdiction Configuration Loader & Contracts
// Authoritative sources: docs/specs/02-architecture.md §8, docs/specs/11-tasks.md T-33, docs/specs/09-agent.md §6

import type { Locale } from './content';

export interface AdminTier {
  level: number;
  name: string;
  label: string;
}

export interface CountryConfig {
  countryCode: string;
  name: string;
  dialCode: string;
  currency: string;
  defaultLocale: Locale;
  locales: Locale[];
  adminTiers: AdminTier[];
  appealBodies: Record<string, string>;
  statutorySourceTypes: string[];
}

export interface WardConfig {
  wardCode: string;
  name: string;
  countryCode: string;
  adminHierarchy: Record<string, string>;
  defaultLocale: Locale;
  locales: Locale[];
  radioPartner: {
    name: string;
    broadcastDay: string;
    timeSlot: string;
  };
  monitorRoster: {
    targetActiveMonitors: number;
    clusterThresholdK: number;
  };
}

const ETHIOPIA_CONFIG: CountryConfig = {
  countryCode: 'ET',
  name: 'Ethiopia',
  dialCode: '251',
  currency: 'ETB',
  defaultLocale: 'am',
  locales: ['am', 'om', 'en'],
  adminTiers: [
    { level: 0, name: 'National', label: 'Federal' },
    { level: 1, name: 'Region', label: 'Charter City / Region' },
    { level: 2, name: 'Zone', label: 'Sub-city / Zone' },
    { level: 3, name: 'Woreda', label: 'Woreda' },
    { level: 4, name: 'Kebele', label: 'Kebele' },
  ],
  appealBodies: {
    administrative: 'Woreda Grievance Redress Committee',
    ombudsman: 'Ethiopian Institution of the Ombudsman',
    anticorruption: 'Federal Ethics and Anti-Corruption Commission',
  },
  statutorySourceTypes: [
    'DIRECTIVE',
    'CIRCULAR',
    'PROCLAMATION',
    'REGULATION',
    'CHARTER',
  ],
};

const KENYA_CONFIG: CountryConfig = {
  countryCode: 'KE',
  name: 'Kenya',
  dialCode: '254',
  currency: 'KES',
  defaultLocale: 'sw',
  locales: ['sw', 'en'],
  adminTiers: [
    { level: 0, name: 'National', label: 'National Government' },
    { level: 1, name: 'County', label: 'County Government' },
    { level: 2, name: 'SubCounty', label: 'Sub-County' },
    { level: 3, name: 'Ward', label: 'Ward' },
    { level: 4, name: 'Village', label: 'Village Unit' },
  ],
  appealBodies: {
    administrative: 'County Public Service Board / Ward Administrator',
    ombudsman: 'Commission on Administrative Justice (Office of the Ombudsman)',
    anticorruption: 'Ethics and Anti-Corruption Commission (EACC)',
  },
  statutorySourceTypes: [
    'COUNTY_ACT',
    'GAZETTE_NOTICE',
    'CIRCULAR',
    'NATIONAL_ACT',
    'REGULATION',
  ],
};

const WOREDA_09_CONFIG: WardConfig = {
  wardCode: 'ET-AA-W09',
  name: 'Woreda 9',
  countryCode: 'ET',
  adminHierarchy: {
    national: 'Ethiopia',
    region: 'Addis Ababa',
    zone: 'Arada Sub-City',
    woreda: 'Woreda 9',
  },
  defaultLocale: 'am',
  locales: ['am', 'om', 'en'],
  radioPartner: {
    name: 'Sheger FM 102.1',
    broadcastDay: 'Thursday',
    timeSlot: '19:30',
  },
  monitorRoster: {
    targetActiveMonitors: 15,
    clusterThresholdK: 3,
  },
};

const ROYSAMBU_CONFIG: WardConfig = {
  wardCode: 'KE-NRB-ROY',
  name: 'Roysambu Ward',
  countryCode: 'KE',
  adminHierarchy: {
    national: 'Kenya',
    county: 'Nairobi County',
    subCounty: 'Roysambu Sub-County',
    ward: 'Roysambu Ward',
  },
  defaultLocale: 'sw',
  locales: ['sw', 'en'],
  radioPartner: {
    name: 'Ghetto Radio 89.5 FM',
    broadcastDay: 'Wednesday',
    timeSlot: '20:00',
  },
  monitorRoster: {
    targetActiveMonitors: 20,
    clusterThresholdK: 3,
  },
};

const COUNTRIES: Record<string, CountryConfig> = {
  ET: ETHIOPIA_CONFIG,
  KE: KENYA_CONFIG,
};

const WARDS: Record<string, WardConfig> = {
  'ET-AA-W09': WOREDA_09_CONFIG,
  'KE-NRB-ROY': ROYSAMBU_CONFIG,
};

/**
 * Returns the country configuration by ISO 3166-1 alpha-2 code.
 */
export function getCountryConfig(countryCode: string): CountryConfig | null {
  const normalized = countryCode.trim().toUpperCase();
  return COUNTRIES[normalized] || null;
}

/**
 * Returns the ward configuration by canonical ward code (e.g. 'ET-AA-W09', 'KE-NRB-ROY').
 */
export function getWardConfig(wardCode: string): WardConfig | null {
  const normalized = wardCode.trim().toUpperCase();
  return WARDS[normalized] || null;
}

/**
 * Resolves the currency for a given ward.
 */
export function getWardCurrency(wardCode: string): string {
  const ward = getWardConfig(wardCode);
  if (ward) {
    const country = getCountryConfig(ward.countryCode);
    if (country) {
      return country.currency;
    }
  }
  return 'ETB';
}

/**
 * Lists all registered countries.
 */
export function listCountries(): CountryConfig[] {
  return Object.values(COUNTRIES);
}

/**
 * Lists all registered wards.
 */
export function listWards(): WardConfig[] {
  return Object.values(WARDS);
}
