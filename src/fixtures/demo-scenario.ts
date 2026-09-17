// Canonical Demo Scenario Fixture (Single Source of Truth)
// Authoritative sources: docs/specs/12-demo-script.md, docs/specs/15-deployment-and-run.md §5,
// docs/specs/03-data-model.md §15, docs/specs/07-trust-and-security.md §3, §5, §7, §8,
// docs/specs/10-skills.md S-20, docs/specs/11-tasks.md T-18.
//
// Purity Rules:
// 1. Declarative scenario data ONLY. ZERO business logic.
// 2. ZERO dynamic clock reads — all timestamps are static ISO-8601 string literals.
// 3. ZERO infrastructure, DB, or Next.js imports. Pure domain types only.
// 4. Synthetic non-routable identities only. ZERO production PII.

import type {
  FiscalState,
  AuditState,
  ProbationState,
  BulletinState,
  SourceConfidence,
  Channel,
} from '@/domain/types';
import type { Locale } from '@/domain/content';
import { deriveClusterKey } from '@/domain/sybil';
import {
  createAuditEventRecord,
  type AuditEventRecord,
} from '@/domain/audit-chain';
import { computePhoneHash } from '@/lib/msisdn';

// ============================================================================
// 1. SYNTHETIC ENVIRONMENT & TIMELINE ANCHORS
// ============================================================================

export const DEMO_PEPPER = 'demo-dev-pepper-strictly-synthetic-32c';

export const DEMO_TIMELINE = {
  BASE_YEAR: 2026,
  SOURCE_ARCHIVED_AT: '2026-09-12T08:00:00.000Z',
  TASK_DISPATCHED_AT: '2026-09-14T06:00:00.000Z',
  REPAIR_CLAIMED_AT: '2026-09-15T08:00:00.000Z',
  DEMO_ANCHOR_TIME: '2026-09-17T09:00:00.000Z', // Baseline runtime time: exactly 5 days remaining in probation
  PROBATION_ENDS_AT: '2026-09-22T08:00:00.000Z', // exactly 7 days after claim
  TASK_EXPIRES_AT: '2026-09-21T06:00:00.000Z',
} as const;

// Deterministic UUID Constants
export const DEMO_IDS = {
  COUNTRY_ET: 'ET',
  COUNTRY_KE: 'KE',
  WARD_W09: '00000000-0000-4000-a000-000000000001',
  WARD_ROY: '00000000-0000-4000-a000-000000000002',

  DOC_CAPITAL_BUDGET: '00000000-0000-4000-a000-000000000010',
  DOC_CIRCULAR_14: '00000000-0000-4000-a000-000000000011',
  DOC_WATER_ANNUAL: '00000000-0000-4000-a000-000000000012',

  PROJECT_4412: '00000000-0000-4000-a000-000000000100',
  PROJECT_4413: '00000000-0000-4000-a000-000000000101',
  PROJECT_4414: '00000000-0000-4000-a000-000000000102',
  PROJECT_4415: '00000000-0000-4000-a000-000000000103',
  PROJECT_4416: '00000000-0000-4000-a000-000000000104',
  PROJECT_4417: '00000000-0000-4000-a000-000000000105',

  ASSET_4412_GENERATOR: '00000000-0000-4000-a000-000000000200',
  ASSET_4413_BOREHOLE: '00000000-0000-4000-a000-000000000201',
  ASSET_4414_LATRINE: '00000000-0000-4000-a000-000000000202',
  ASSET_4415_CULVERT: '00000000-0000-4000-a000-000000000203',
  ASSET_4416_SOLAR: '00000000-0000-4000-a000-000000000204',
  ASSET_4417_KIOSK: '00000000-0000-4000-a000-000000000205',

  TASK_4412: '00000000-0000-4000-a000-000000000300',
  TASK_4413: '00000000-0000-4000-a000-000000000301',
  TASK_4415: '00000000-0000-4000-a000-000000000302',

  TICKET_4412: '00000000-0000-4000-a000-000000000400',
  TICKET_4413: '00000000-0000-4000-a000-000000000401',

  SERVICE_ID_REPLACE: '00000000-0000-4000-a000-000000000500',
  SERVICE_CLINIC_INTAKE: '00000000-0000-4000-a000-000000000501',
  SERVICE_KE_BURIAL_PERMIT: '00000000-0000-4000-a000-000000000502',

  RULE_ID_REPLACE: '00000000-0000-4000-a000-000000000510',
  RULE_CLINIC_INTAKE: '00000000-0000-4000-a000-000000000511',
  RULE_KE_BURIAL_PERMIT: '00000000-0000-4000-a000-000000000512',

  DOC_NAIROBI_COUNTY_BUDGET: '00000000-0000-4000-a000-000000000013',

  PROJECT_7011: '00000000-0000-4000-a000-000000000106',
  PROJECT_7022: '00000000-0000-4000-a000-000000000107',

  ASSET_7011_SOLAR: '00000000-0000-4000-a000-000000000206',
  ASSET_7022_BOREHOLE: '00000000-0000-4000-a000-000000000207',

  TASK_7011: '00000000-0000-4000-a000-000000000303',
  TASK_7022: '00000000-0000-4000-a000-000000000304',

  BULLETIN_DRAFT: '00000000-0000-4000-a000-000000000600',
} as const;

// ============================================================================
// 2. TYPES & FIXTURE INTERFACES
// ============================================================================

export interface DemoCountryFixture {
  code: string;
  name: string;
  currency: string;
  adminTierLabels: string[];
  defaultLocale: string;
  locales: Locale[];
}

export interface DemoWardFixture {
  id: string;
  countryCode: string;
  code: string;
  name: string;
  adminPath: string[];
  locales: Locale[];
  radioPartner?: string;
}

export interface DemoSourceDocumentFixture {
  id: string;
  wardId: string;
  title: string;
  issuer: string;
  publishedOn: string;
  archivedAt: string;
  storagePath: string | null;
  sha256: string;
  pageCount: number;
  ingestReviewer: string;
  reviewedAt: string;
}

export interface DemoAssetTypeQuestion {
  id: string;
  labelKey: string;
  audioKey: string;
}

export interface DemoAssetTypeFixture {
  key: string;
  labelKey: string;
  questions: DemoAssetTypeQuestion[];
}

export interface DemoProjectFixture {
  id: string;
  wardId: string;
  projectCode: string;
  title: string;
  officialTitle?: string;
  assetType: string;
  contractorName: string;
  amountMinor: number;
  currency: string;
  promisedCompletion: string;
  sourceDocumentId: string | null;
  sourcePage: number | null;
  confidence: SourceConfidence;
  fiscal: FiscalState;
  audit: AuditState;
  createdAt: string;
  updatedAt: string;
}

export interface DemoAssetFixture {
  id: string;
  projectId: string;
  assetType: string;
  label: string;
  landmark: string;
  geoCell: string;
  createdAt: string;
}

export interface DemoInspectionTaskFixture {
  id: string;
  projectId: string;
  assetId: string;
  dispatchedAt: string;
  expiresAt: string;
  witnessTarget: number;
  witnessCount: number;
  closedAt: string | null;
}

export interface DemoRespondentFixture {
  id: string;
  wardId: string;
  persona: 'AMINA' | 'COLLIDING_NEIGHBOR' | 'ORIGINAL_REPORTER_1' | 'ORIGINAL_REPORTER_2' | 'SERVICE_REPORTER';
  label: string;
  msisdn: string;
  phoneHash: string;
  msisdnPrefix: string;
  geoCell: string;
  registeredAt: string;
  registrationCohort: string;
  locale: string;
  clusterKey: string;
}

export interface DemoObservationFixture {
  id: string;
  taskId: string;
  respondentId: string;
  channel: Channel;
  answers: Record<string, boolean>;
  clusterKey: string;
  weight: 0 | 1;
  geoCell: string;
  idempotencyKey: string;
  submittedAt: string;
  receivedAt: string;
}

export interface DemoRepairTicketFixture {
  id: string;
  assetId: string;
  projectId: string;
  state: ProbationState;
  reportedBrokenAt: string;
  repairClaimedAt: string | null;
  claimedBy: string | null;
  probationStartedAt: string | null;
  probationEndsAt: string | null;
  probationDays: number;
  resolvedAt: string | null;
  failureReasonKey: string | null;
}

export interface DemoServiceFixture {
  id: string;
  wardId: string;
  code: string;
  officeCode: string;
  labelKey: string;
}

export interface DemoStatutoryRuleFixture {
  id: string;
  serviceId: string;
  feeCeilingMinor: number;
  currency: string;
  requiredDocuments: Array<{ labelKey: string; audioKey: string }>;
  expectedVisits: number;
  refusalScriptKey: string;
  appealRouteKey: string;
  sourceDocumentId: string | null;
  sourcePage: number | null;
  reviewerInitials: string;
  reviewedAt: string;
  validFrom: string;
  validTo: string | null;
}

export interface DemoVisitOutcomeFixture {
  id: string;
  serviceId: string;
  outcomeCode: 1 | 2 | 3 | 4 | 5;
  extraFeeMinor: number | null;
  visitsReported: number | null;
  respondentHash: string;
  clusterKey: string;
  channel: Channel;
  idempotencyKey: string;
  reportedAt: string;
}

export interface DemoDivergenceAggregateFixture {
  serviceId: string;
  windowDays: number;
  computedAt: string;
  reportCount: number;
  distinctClusters: number;
  pctAdditionalFee: number | null;
  medianExtraMinor: number | null;
  avgVisits: number | null;
  kSatisfied: boolean;
  alertActive: boolean;
}

export interface DemoRadioBulletinFixture {
  id: string;
  wardId: string;
  periodStart: string;
  periodEnd: string;
  facts: Array<Record<string, unknown>>;
  scriptText: string;
  locale: string;
  state: BulletinState;
  moderatorId: string | null;
  moderatedAt: string | null;
}

// ============================================================================
// 3. JURISDICTIONS (2 Countries, 2 Wards)
// ============================================================================

export const DEMO_COUNTRIES: DemoCountryFixture[] = [
  {
    code: DEMO_IDS.COUNTRY_ET,
    name: 'Ethiopia',
    currency: 'ETB',
    adminTierLabels: ['Region', 'Zone', 'Woreda', 'Kebele'],
    defaultLocale: 'am',
    locales: ['am', 'om', 'en'],
  },
  {
    code: DEMO_IDS.COUNTRY_KE,
    name: 'Kenya',
    currency: 'KES',
    adminTierLabels: ['National', 'County', 'Sub-County', 'Ward'],
    defaultLocale: 'en',
    locales: ['en', 'sw'],
  },
];

export const DEMO_WARDS: DemoWardFixture[] = [
  {
    id: DEMO_IDS.WARD_W09,
    countryCode: DEMO_IDS.COUNTRY_ET,
    code: 'ET-AA-W09',
    name: 'Woreda 9',
    adminPath: ['Addis Ababa', 'Kirkos', 'Woreda 09', 'Kebele 08'],
    locales: ['am', 'om', 'en'],
    radioPartner: 'Radio Fana Woreda Desk',
  },
  {
    id: DEMO_IDS.WARD_ROY,
    countryCode: DEMO_IDS.COUNTRY_KE,
    code: 'KE-NRB-ROY',
    name: 'Roysambu Ward',
    adminPath: ['Kenya', 'Nairobi County', 'Roysambu Sub-County', 'Roysambu Ward'],
    locales: ['en', 'sw'],
    radioPartner: 'Ghetto Radio 89.5 FM',
  },
];

// ============================================================================
// 4. SOURCE DOCUMENTS (Gazette & Circulars with Real SHA-256)
// ============================================================================

export const DEMO_SOURCE_DOCUMENTS: DemoSourceDocumentFixture[] = [
  {
    id: DEMO_IDS.DOC_CAPITAL_BUDGET,
    wardId: DEMO_IDS.WARD_W09,
    title: 'Woreda 9 Capital Budget FY2026',
    issuer: 'Woreda 9 Finance Office',
    publishedOn: '2026-09-01',
    archivedAt: DEMO_TIMELINE.SOURCE_ARCHIVED_AT,
    storagePath: 'gazettes/et-aa-w09-fy2026-capital.pdf',
    sha256: '3b1f9c87d4a2e5890123456789abcdef0123456789abcdef0123456789abcdef',
    pageCount: 84,
    ingestReviewer: 'H.T.',
    reviewedAt: '2026-09-12T10:00:00.000Z',
  },
  {
    id: DEMO_IDS.DOC_CIRCULAR_14,
    wardId: DEMO_IDS.WARD_W09,
    title: 'Civil Registration Statutory Fee Circular 14/2026',
    issuer: 'Federal Vital Events Agency',
    publishedOn: '2026-01-15',
    archivedAt: '2026-09-05T08:00:00.000Z',
    storagePath: 'circulars/circular-14-2026.pdf',
    sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    pageCount: 12,
    ingestReviewer: 'H.T.',
    reviewedAt: '2026-09-05T09:30:00.000Z',
  },
  {
    id: DEMO_IDS.DOC_WATER_ANNUAL,
    wardId: DEMO_IDS.WARD_W09,
    title: 'Kirkos Water Office Annual Maintenance Audit 2026',
    issuer: 'Kirkos Sub-City Water Bureau',
    publishedOn: '2026-08-15',
    archivedAt: '2026-09-08T11:00:00.000Z',
    storagePath: 'audits/kirkos-water-audit-2026.pdf',
    sha256: '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
    pageCount: 42,
    ingestReviewer: 'H.T.',
    reviewedAt: '2026-09-08T14:00:00.000Z',
  },
];

export const DEMO_KENYA_SOURCE_DOCUMENTS: DemoSourceDocumentFixture[] = [
  {
    id: DEMO_IDS.DOC_NAIROBI_COUNTY_BUDGET,
    wardId: DEMO_IDS.WARD_ROY,
    title: 'Nairobi City County CIDP FY2026/27 Roysambu Ward Estimates',
    issuer: 'Nairobi City County Finance Bureau',
    publishedOn: '2026-07-01',
    archivedAt: '2026-09-01T08:00:00.000Z',
    storagePath: 'budgets/nairobi-roysambu-2026.pdf',
    sha256: '9a2f1c8e4b7d30129e4719b62a3f8901cd45b230198afe761234bc567890def1',
    pageCount: 38,
    ingestReviewer: 'M.K.',
    reviewedAt: '2026-09-02T10:00:00.000Z',
  },
];

// ============================================================================
// 5. ASSET TYPES (3 Types with 2-3 Strictly Observable Yes/No Questions)
// ============================================================================

export const DEMO_ASSET_TYPES: DemoAssetTypeFixture[] = [
  {
    key: 'generator',
    labelKey: 'asset.generator',
    questions: [
      {
        id: 'runs_on_outage',
        labelKey: 'question.generator.runs_on_outage',
        audioKey: 'prompt.q1_generator_runs',
      },
      {
        id: 'fridge_green',
        labelKey: 'question.generator.fridge_green',
        audioKey: 'prompt.q2_fridge_green',
      },
      {
        id: 'board_posted',
        labelKey: 'question.generator.board_posted',
        audioKey: 'prompt.q3_board_posted',
      },
    ],
  },
  {
    key: 'borehole',
    labelKey: 'asset.borehole',
    questions: [
      {
        id: 'head_fitted',
        labelKey: 'question.borehole.head_fitted',
        audioKey: 'prompt.q1_head_fitted',
      },
      {
        id: 'water_flows',
        labelKey: 'question.borehole.water_flows',
        audioKey: 'prompt.q2_water_flows',
      },
      {
        id: 'board_posted',
        labelKey: 'question.borehole.board_posted',
        audioKey: 'prompt.q3_board_posted',
      },
    ],
  },
  {
    key: 'latrine_block',
    labelKey: 'asset.latrine_block',
    questions: [
      {
        id: 'doors_fitted',
        labelKey: 'question.latrine.doors_fitted',
        audioKey: 'prompt.q1_doors_fitted',
      },
      {
        id: 'water_present',
        labelKey: 'question.latrine.water_present',
        audioKey: 'prompt.q2_water_present',
      },
    ],
  },
];

// ============================================================================
// 6. PROJECTS (6 Projects in Woreda 9)
// ============================================================================

export const DEMO_PROJECTS: DemoProjectFixture[] = [
  {
    id: DEMO_IDS.PROJECT_4412,
    wardId: DEMO_IDS.WARD_W09,
    projectCode: '4412',
    title: 'Health post generator overhaul',
    officialTitle: 'Standby diesel generator overhaul and commissioning at Kebele 08 Health Post',
    assetType: 'generator',
    contractorName: 'AfroTech Infra',
    amountMinor: 32000000, // ETB 320,000.00
    currency: 'ETB',
    promisedCompletion: '2026-08-30',
    sourceDocumentId: DEMO_IDS.DOC_CAPITAL_BUDGET,
    sourcePage: 41,
    confidence: 'OFFICIAL_CITED',
    fiscal: 'COMMITTED',
    audit: 'AWAITING_THRESHOLD', // Primed at 2 of 3 witnesses
    createdAt: '2026-09-12T08:30:00.000Z',
    updatedAt: DEMO_TIMELINE.REPAIR_CLAIMED_AT,
  },
  {
    id: DEMO_IDS.PROJECT_4413,
    wardId: DEMO_IDS.WARD_W09,
    projectCode: '4413',
    title: 'Borehole #3 solar pump rehabilitation',
    officialTitle: 'Solar hybrid conversion of Kebele 08 deep community borehole',
    assetType: 'borehole',
    contractorName: 'Abyssinia Water Works',
    amountMinor: 48000000, // ETB 480,000.00
    currency: 'ETB',
    promisedCompletion: '2026-07-31',
    sourceDocumentId: DEMO_IDS.DOC_WATER_ANNUAL,
    sourcePage: 14,
    confidence: 'OFFICIAL_CITED',
    fiscal: 'AUDITED',
    audit: 'PHYSICALLY_CONFIRMED', // Positive control: complete lifecycle
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-20T12:00:00.000Z',
  },
  {
    id: DEMO_IDS.PROJECT_4414,
    wardId: DEMO_IDS.WARD_W09,
    projectCode: '4414',
    title: 'Primary school latrine block roof',
    officialTitle: 'Sanitation block roof repair at Woreda 09 Primary School',
    assetType: 'latrine_block',
    contractorName: 'Community Volunteer Committee',
    amountMinor: 15000000, // ETB 150,000.00
    currency: 'ETB',
    promisedCompletion: '2026-10-15',
    sourceDocumentId: null, // Honest absence: NO source document archived
    sourcePage: null,
    confidence: 'UNOFFICIAL_ESTIMATE',
    fiscal: 'PROMISED', // Pinned per INV-07; cannot advance to COMMITTED
    audit: 'NOT_DISPATCHED',
    createdAt: '2026-09-10T10:00:00.000Z',
    updatedAt: '2026-09-10T10:00:00.000Z',
  },
  {
    id: DEMO_IDS.PROJECT_4415,
    wardId: DEMO_IDS.WARD_W09,
    projectCode: '4415',
    title: 'Market square drainage culvert',
    officialTitle: 'Concrete culvert channel behind Kirkos open market',
    assetType: 'latrine_block',
    contractorName: 'Bole Civil Engineering LLC',
    amountMinor: 28000000, // ETB 280,000.00
    currency: 'ETB',
    promisedCompletion: '2026-08-15',
    sourceDocumentId: DEMO_IDS.DOC_CAPITAL_BUDGET,
    sourcePage: 52,
    confidence: 'OFFICIAL_CITED',
    fiscal: 'DISBURSED',
    audit: 'DISCREPANCY_FLAGGED', // Community report disagreement (50% agreement < 2/3)
    createdAt: '2026-09-02T09:00:00.000Z',
    updatedAt: '2026-09-14T15:00:00.000Z',
  },
  {
    id: DEMO_IDS.PROJECT_4416,
    wardId: DEMO_IDS.WARD_W09,
    projectCode: '4416',
    title: 'Maternity clinic solar lighting',
    officialTitle: 'Solar backup install at Woreda 09 Maternal Care Unit',
    assetType: 'generator',
    contractorName: 'SolarTech East Africa',
    amountMinor: 21000000, // ETB 210,000.00
    currency: 'ETB',
    promisedCompletion: '2026-11-01',
    sourceDocumentId: DEMO_IDS.DOC_CAPITAL_BUDGET,
    sourcePage: 60,
    confidence: 'OFFICIAL_CITED',
    fiscal: 'COMMITTED',
    audit: 'NOT_DISPATCHED',
    createdAt: '2026-09-03T11:00:00.000Z',
    updatedAt: '2026-09-03T11:00:00.000Z',
  },
  {
    id: DEMO_IDS.PROJECT_4417,
    wardId: DEMO_IDS.WARD_W09,
    projectCode: '4417',
    title: 'Market potable water kiosk',
    officialTitle: 'Gravity-fed potable water kiosk at Kirkos south gate',
    assetType: 'borehole',
    contractorName: 'Kirkos Public Works',
    amountMinor: 17500000, // ETB 175,000.00
    currency: 'ETB',
    promisedCompletion: '2026-09-30',
    sourceDocumentId: DEMO_IDS.DOC_WATER_ANNUAL,
    sourcePage: 28,
    confidence: 'OFFICIAL_CITED',
    fiscal: 'DISBURSED',
    audit: 'AWAITING_THRESHOLD',
    createdAt: '2026-09-04T14:00:00.000Z',
    updatedAt: '2026-09-10T16:00:00.000Z',
  },
];

export const DEMO_KENYA_PROJECTS: DemoProjectFixture[] = [
  {
    id: DEMO_IDS.PROJECT_7011,
    wardId: DEMO_IDS.WARD_ROY,
    projectCode: '7011',
    title: 'Roysambu dispensary solar backup',
    officialTitle: 'Roysambu Health Centre rooftop solar backup system and battery bank',
    assetType: 'generator',
    contractorName: 'Kenya Solar Solutions Ltd',
    amountMinor: 85000000, // KES 850,000.00
    currency: 'KES',
    promisedCompletion: '2026-09-30',
    sourceDocumentId: DEMO_IDS.DOC_NAIROBI_COUNTY_BUDGET,
    sourcePage: 19,
    confidence: 'OFFICIAL_CITED',
    fiscal: 'COMMITTED',
    audit: 'AWAITING_THRESHOLD',
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-09-10T12:00:00.000Z',
  },
  {
    id: DEMO_IDS.PROJECT_7022,
    wardId: DEMO_IDS.WARD_ROY,
    projectCode: '7022',
    title: 'Kasarani community borehole solarization',
    officialTitle: 'Roysambu Ward Kasarani primary school borehole submersible pump',
    assetType: 'borehole',
    contractorName: 'Nairobi Water Works',
    amountMinor: 120000000, // KES 1,200,000.00
    currency: 'KES',
    promisedCompletion: '2026-10-15',
    sourceDocumentId: DEMO_IDS.DOC_NAIROBI_COUNTY_BUDGET,
    sourcePage: 24,
    confidence: 'OFFICIAL_CITED',
    fiscal: 'COMMITTED',
    audit: 'TASK_DISPATCHED',
    createdAt: '2026-08-15T09:00:00.000Z',
    updatedAt: '2026-09-12T14:00:00.000Z',
  },
];

// ============================================================================
// 7. ASSETS (Coarse Geo-Cell, Landmarks, Zero GPS Coordinates)
// ============================================================================

export const DEMO_ASSETS: DemoAssetFixture[] = [
  {
    id: DEMO_IDS.ASSET_4412_GENERATOR,
    projectId: DEMO_IDS.PROJECT_4412,
    assetType: 'generator',
    label: 'Health post backup generator',
    landmark: 'Behind vaccine cold-chain storage room, Kebele 08 Health Post',
    geoCell: 'et-aa-0917',
    createdAt: '2026-09-12T08:30:00.000Z',
  },
  {
    id: DEMO_IDS.ASSET_4413_BOREHOLE,
    projectId: DEMO_IDS.PROJECT_4413,
    assetType: 'borehole',
    label: 'Kebele 08 community borehole',
    landmark: '50m south of market square behind primary school',
    geoCell: 'et-aa-0918',
    createdAt: '2026-08-01T08:00:00.000Z',
  },
  {
    id: DEMO_IDS.ASSET_4414_LATRINE,
    projectId: DEMO_IDS.PROJECT_4414,
    assetType: 'latrine_block',
    label: 'Primary school sanitation block',
    landmark: 'West wing of Woreda 09 Primary School compound',
    geoCell: 'et-aa-0917',
    createdAt: '2026-09-10T10:00:00.000Z',
  },
  {
    id: DEMO_IDS.ASSET_4415_CULVERT,
    projectId: DEMO_IDS.PROJECT_4415,
    assetType: 'latrine_block',
    label: 'Kirkos market drainage channel',
    landmark: 'Eastern gate of open market along gravel roadway',
    geoCell: 'et-aa-0919',
    createdAt: '2026-09-02T09:00:00.000Z',
  },
  {
    id: DEMO_IDS.ASSET_4416_SOLAR,
    projectId: DEMO_IDS.PROJECT_4416,
    assetType: 'generator',
    label: 'Maternal care solar panels',
    landmark: 'Rooftop of maternity clinic ward B',
    geoCell: 'et-aa-0917',
    createdAt: '2026-09-03T11:00:00.000Z',
  },
  {
    id: DEMO_IDS.ASSET_4417_KIOSK,
    projectId: DEMO_IDS.PROJECT_4417,
    assetType: 'borehole',
    label: 'South gate water distribution kiosk',
    landmark: 'Beside bus stop at Kirkos south perimeter',
    geoCell: 'et-aa-0918',
    createdAt: '2026-09-04T14:00:00.000Z',
  },
];

export const DEMO_KENYA_ASSETS: DemoAssetFixture[] = [
  {
    id: DEMO_IDS.ASSET_7011_SOLAR,
    projectId: DEMO_IDS.PROJECT_7011,
    assetType: 'generator',
    label: 'Dispensary Solar Backup Inverter',
    landmark: 'Roysambu Health Centre Main Building',
    geoCell: 'ke-nrb-roy01',
    createdAt: '2026-08-01T08:00:00.000Z',
  },
  {
    id: DEMO_IDS.ASSET_7022_BOREHOLE,
    projectId: DEMO_IDS.PROJECT_7022,
    assetType: 'borehole',
    label: 'Kasarani Borehole Submersible Pump',
    landmark: 'Kasarani Primary School Gate',
    geoCell: 'ke-nrb-roy02',
    createdAt: '2026-08-15T09:00:00.000Z',
  },
];

// ============================================================================
// 8. INSPECTION TASKS (Task 4412 Primed with 2 of 3 Witnesses)
// ============================================================================

export const DEMO_INSPECTION_TASKS: DemoInspectionTaskFixture[] = [
  {
    id: DEMO_IDS.TASK_4412,
    projectId: DEMO_IDS.PROJECT_4412,
    assetId: DEMO_IDS.ASSET_4412_GENERATOR,
    dispatchedAt: DEMO_TIMELINE.TASK_DISPATCHED_AT,
    expiresAt: DEMO_TIMELINE.TASK_EXPIRES_AT,
    witnessTarget: 3,
    witnessCount: 2, // Exactly 2 distinct witnesses pre-recorded in seed
    closedAt: null,
  },
  {
    id: DEMO_IDS.TASK_4413,
    projectId: DEMO_IDS.PROJECT_4413,
    assetId: DEMO_IDS.ASSET_4413_BOREHOLE,
    dispatchedAt: '2026-08-05T06:00:00.000Z',
    expiresAt: '2026-08-12T06:00:00.000Z',
    witnessTarget: 3,
    witnessCount: 3,
    closedAt: '2026-08-10T14:00:00.000Z',
  },
  {
    id: DEMO_IDS.TASK_4415,
    projectId: DEMO_IDS.PROJECT_4415,
    assetId: DEMO_IDS.ASSET_4415_CULVERT,
    dispatchedAt: '2026-09-05T08:00:00.000Z',
    expiresAt: '2026-09-12T08:00:00.000Z',
    witnessTarget: 4,
    witnessCount: 4,
    closedAt: '2026-09-11T16:00:00.000Z',
  },
];

// ============================================================================
// 9. RESPONDENTS (12 Synthetic Fictional Non-Routable Personas)
// ============================================================================
// Fictional non-routable range: +251 999 000 001 through +251 999 000 012.
// Phone 3 (Amina) and Phone 4 (Colliding Neighbor) share cell, prefix, and cohort,
// producing the EXACT SAME Sybil cluster key (Cluster Gamma)!

const RESPONDENT_DEFINITIONS = [
  {
    id: '00000000-0000-4000-a000-000000000801',
    persona: 'ORIGINAL_REPORTER_1' as const,
    label: 'Abebe (Cluster Alpha - Witness 1)',
    msisdn: '+251999000001',
    msisdnPrefix: '251991',
    geoCell: 'et-aa-0917',
    registeredAt: '2026-08-15T09:00:00.000Z', // 2026-W33
    locale: 'am',
  },
  {
    id: '00000000-0000-4000-a000-000000000802',
    persona: 'ORIGINAL_REPORTER_2' as const,
    label: 'Dawit (Cluster Beta - Witness 2)',
    msisdn: '+251999000002',
    msisdnPrefix: '251992',
    geoCell: 'et-aa-0918',
    registeredAt: '2026-08-20T10:00:00.000Z', // 2026-W34
    locale: 'am',
  },
  {
    id: '00000000-0000-4000-a000-000000000803',
    persona: 'AMINA' as const,
    label: 'Amina (Cluster Gamma - Demo Phone 1)',
    msisdn: '+251999000003',
    msisdnPrefix: '251993',
    geoCell: 'et-aa-0919',
    registeredAt: '2026-09-01T08:00:00.000Z', // 2026-W36
    locale: 'am',
  },
  {
    id: '00000000-0000-4000-a000-000000000804',
    persona: 'COLLIDING_NEIGHBOR' as const,
    label: 'Girma (Cluster Gamma - Second Phone, Same Area)',
    msisdn: '+251999000004',
    msisdnPrefix: '251993', // Same 6-digit prefix bucket as Amina!
    geoCell: 'et-aa-0919',  // Same ~1km cell as Amina!
    registeredAt: '2026-09-02T11:00:00.000Z', // Same 2026-W36 cohort as Amina!
    locale: 'am',
  },
  {
    id: '00000000-0000-4000-a000-000000000805',
    persona: 'SERVICE_REPORTER' as const,
    label: 'Fatuma (Cluster Gamma - 3rd Colliding Phone)',
    msisdn: '+251999000005',
    msisdnPrefix: '251993',
    geoCell: 'et-aa-0919',
    registeredAt: '2026-09-03T14:00:00.000Z', // 2026-W36
    locale: 'om',
  },
  {
    id: '00000000-0000-4000-a000-000000000806',
    persona: 'SERVICE_REPORTER' as const,
    label: 'Chaltu (Cluster Delta)',
    msisdn: '+251999000006',
    msisdnPrefix: '251994',
    geoCell: 'et-aa-0920',
    registeredAt: '2026-08-10T12:00:00.000Z',
    locale: 'om',
  },
  {
    id: '00000000-0000-4000-a000-000000000807',
    persona: 'SERVICE_REPORTER' as const,
    label: 'Bekele (Cluster Epsilon)',
    msisdn: '+251999000007',
    msisdnPrefix: '251995',
    geoCell: 'et-aa-0917',
    registeredAt: '2026-08-12T09:00:00.000Z',
    locale: 'am',
  },
  {
    id: '00000000-0000-4000-a000-000000000808',
    persona: 'SERVICE_REPORTER' as const,
    label: 'Taye (Cluster Zeta)',
    msisdn: '+251999000008',
    msisdnPrefix: '251996',
    geoCell: 'et-aa-0918',
    registeredAt: '2026-08-14T11:00:00.000Z',
    locale: 'am',
  },
  {
    id: '00000000-0000-4000-a000-000000000809',
    persona: 'SERVICE_REPORTER' as const,
    label: 'Helen (Cluster Eta)',
    msisdn: '+251999000009',
    msisdnPrefix: '251997',
    geoCell: 'et-aa-0919',
    registeredAt: '2026-08-16T15:00:00.000Z',
    locale: 'en',
  },
  {
    id: '00000000-0000-4000-a000-000000000810',
    persona: 'SERVICE_REPORTER' as const,
    label: 'Yonas (Cluster Theta)',
    msisdn: '+251999000010',
    msisdnPrefix: '251998',
    geoCell: 'et-aa-0920',
    registeredAt: '2026-08-18T10:00:00.000Z',
    locale: 'am',
  },
  {
    id: '00000000-0000-4000-a000-000000000811',
    persona: 'SERVICE_REPORTER' as const,
    label: 'Marta (Cluster Iota)',
    msisdn: '+251999000011',
    msisdnPrefix: '251991',
    geoCell: 'et-aa-0919',
    registeredAt: '2026-08-22T13:00:00.000Z',
    locale: 'am',
  },
  {
    id: '00000000-0000-4000-a000-000000000812',
    persona: 'SERVICE_REPORTER' as const,
    label: 'Kenenisa (Cluster Kappa)',
    msisdn: '+251999000012',
    msisdnPrefix: '251992',
    geoCell: 'et-aa-0920',
    registeredAt: '2026-08-25T16:00:00.000Z',
    locale: 'om',
  },
];

export const DEMO_RESPONDENTS: DemoRespondentFixture[] = RESPONDENT_DEFINITIONS.map((r) => {
  const phoneHash = computePhoneHash(r.msisdn, DEMO_PEPPER);
  const clusterKey = deriveClusterKey({
    taskId: DEMO_IDS.TASK_4412,
    geoCell: r.geoCell,
    wardId: DEMO_IDS.WARD_W09,
    msisdnPrefixBucket: r.msisdnPrefix,
    registeredAt: r.registeredAt,
  });

  return {
    id: r.id,
    wardId: DEMO_IDS.WARD_W09,
    persona: r.persona,
    label: r.label,
    msisdn: r.msisdn,
    phoneHash,
    msisdnPrefix: r.msisdnPrefix,
    geoCell: r.geoCell,
    registeredAt: r.registeredAt,
    registrationCohort: r.registeredAt.slice(0, 7),
    locale: r.locale,
    clusterKey,
  };
});

// Convenient Persona Lookup Maps
export const DEMO_PERSONAS = {
  ORIGINAL_REPORTER_1: DEMO_RESPONDENTS[0],
  ORIGINAL_REPORTER_2: DEMO_RESPONDENTS[1],
  AMINA: DEMO_RESPONDENTS[2],
  COLLIDING_NEIGHBOR: DEMO_RESPONDENTS[3],
} as const;

// ============================================================================
// 10. PRE-SEEDED OBSERVATIONS (Task 4412 has 2 of 3 Witnesses)
// ============================================================================

export const DEMO_OBSERVATIONS: DemoObservationFixture[] = [
  {
    id: '00000000-0000-4000-a000-000000000701',
    taskId: DEMO_IDS.TASK_4412,
    respondentId: DEMO_PERSONAS.ORIGINAL_REPORTER_1.id,
    channel: 'USSD',
    answers: { runs_on_outage: false, fridge_green: false, board_posted: true },
    clusterKey: DEMO_PERSONAS.ORIGINAL_REPORTER_1.clusterKey,
    weight: 1,
    geoCell: DEMO_PERSONAS.ORIGINAL_REPORTER_1.geoCell,
    idempotencyKey: 'seed-obs-4412-rep1',
    submittedAt: '2026-09-14T09:12:00.000Z',
    receivedAt: '2026-09-14T09:12:00.000Z',
  },
  {
    id: '00000000-0000-4000-a000-000000000702',
    taskId: DEMO_IDS.TASK_4412,
    respondentId: DEMO_PERSONAS.ORIGINAL_REPORTER_2.id,
    channel: 'SMS',
    answers: { runs_on_outage: false, fridge_green: false, board_posted: true },
    clusterKey: DEMO_PERSONAS.ORIGINAL_REPORTER_2.clusterKey,
    weight: 1,
    geoCell: DEMO_PERSONAS.ORIGINAL_REPORTER_2.geoCell,
    idempotencyKey: 'seed-obs-4412-rep2',
    submittedAt: '2026-09-14T11:45:00.000Z',
    receivedAt: '2026-09-14T11:45:00.000Z',
  },
];

// ============================================================================
// 11. REPAIR TICKETS (Frame B: Exactly 5 Days Remain in Probation)
// ============================================================================

export const DEMO_REPAIR_TICKETS: DemoRepairTicketFixture[] = [
  {
    id: DEMO_IDS.TICKET_4412,
    assetId: DEMO_IDS.ASSET_4412_GENERATOR,
    projectId: DEMO_IDS.PROJECT_4412,
    state: 'REPAIR_CLAIMED', // Under 7-day probation lock
    reportedBrokenAt: '2026-09-10T14:00:00.000Z',
    repairClaimedAt: DEMO_TIMELINE.REPAIR_CLAIMED_AT, // 2026-09-15
    claimedBy: 'AfroTech Infra',
    probationStartedAt: DEMO_TIMELINE.REPAIR_CLAIMED_AT,
    probationEndsAt: DEMO_TIMELINE.PROBATION_ENDS_AT, // 2026-09-22
    probationDays: 7,
    resolvedAt: null,
    failureReasonKey: null,
  },
  {
    id: DEMO_IDS.TICKET_4413,
    assetId: DEMO_IDS.ASSET_4413_BOREHOLE,
    projectId: DEMO_IDS.PROJECT_4413,
    state: 'VERIFIED_SUSTAINED', // Sustained probation complete
    reportedBrokenAt: '2026-07-15T09:00:00.000Z',
    repairClaimedAt: '2026-08-01T08:00:00.000Z',
    claimedBy: 'Abyssinia Water Works',
    probationStartedAt: '2026-08-01T08:00:00.000Z',
    probationEndsAt: '2026-08-08T08:00:00.000Z',
    probationDays: 7,
    resolvedAt: '2026-08-09T10:00:00.000Z', // Satisfies: resolved_at >= probation_ends_at
    failureReasonKey: null,
  },
];

// ============================================================================
// 12. SERVICES & STATUTORY RULES (2 Services)
// ============================================================================

export const DEMO_SERVICES: DemoServiceFixture[] = [
  {
    id: DEMO_IDS.SERVICE_ID_REPLACE,
    wardId: DEMO_IDS.WARD_W09,
    code: 'ET-ID-REPLACE',
    officeCode: 'W09-CIVIL-01',
    labelKey: 'service.id_replacement',
  },
  {
    id: DEMO_IDS.SERVICE_CLINIC_INTAKE,
    wardId: DEMO_IDS.WARD_W09,
    code: 'ET-CLINIC-INTAKE',
    officeCode: 'W09-HLTH-01',
    labelKey: 'service.clinic_intake',
  },
];

export const DEMO_STATUTORY_RULES: DemoStatutoryRuleFixture[] = [
  {
    id: DEMO_IDS.RULE_ID_REPLACE,
    serviceId: DEMO_IDS.SERVICE_ID_REPLACE,
    feeCeilingMinor: 5000, // 50.00 ETB
    currency: 'ETB',
    requiredDocuments: [
      { labelKey: 'doc.birth_certificate_copy', audioKey: 'prompt.doc_birth_cert' },
      { labelKey: 'doc.two_witnesses_id', audioKey: 'prompt.doc_witness_id' },
    ],
    expectedVisits: 1,
    refusalScriptKey: 'script.request_official_receipt',
    appealRouteKey: 'appeal.woreda_ombudsman',
    sourceDocumentId: DEMO_IDS.DOC_CIRCULAR_14,
    sourcePage: 3,
    reviewerInitials: 'H.T.',
    reviewedAt: '2026-09-05T09:30:00.000Z',
    validFrom: '2026-01-15T00:00:00.000Z',
    validTo: null,
  },
  {
    id: DEMO_IDS.RULE_CLINIC_INTAKE,
    serviceId: DEMO_IDS.SERVICE_CLINIC_INTAKE,
    feeCeilingMinor: 0, // Free service
    currency: 'ETB',
    requiredDocuments: [
      { labelKey: 'doc.kebele_resident_id', audioKey: 'prompt.doc_kebele_id' },
    ],
    expectedVisits: 1,
    refusalScriptKey: 'script.free_health_intake',
    appealRouteKey: 'appeal.health_bureau',
    sourceDocumentId: DEMO_IDS.DOC_CIRCULAR_14,
    sourcePage: 7,
    reviewerInitials: 'H.T.',
    reviewedAt: '2026-09-05T09:30:00.000Z',
    validFrom: '2026-01-15T00:00:00.000Z',
    validTo: null,
  },
];

export const DEMO_KENYA_SERVICES: DemoServiceFixture[] = [
  {
    id: DEMO_IDS.SERVICE_KE_BURIAL_PERMIT,
    wardId: DEMO_IDS.WARD_ROY,
    code: 'KE-BURIAL-PERMIT',
    officeCode: 'ROY-CIVIL-01',
    labelKey: 'service.burial_permit',
  },
];

export const DEMO_KENYA_STATUTORY_RULES: DemoStatutoryRuleFixture[] = [
  {
    id: DEMO_IDS.RULE_KE_BURIAL_PERMIT,
    serviceId: DEMO_IDS.SERVICE_KE_BURIAL_PERMIT,
    feeCeilingMinor: 20000, // 200.00 KES
    currency: 'KES',
    requiredDocuments: [
      { labelKey: 'doc.death_notification_hospital', audioKey: 'prompt.doc_hospital_notification' },
      { labelKey: 'doc.applicant_national_id', audioKey: 'prompt.doc_applicant_id' },
    ],
    expectedVisits: 1,
    refusalScriptKey: 'script.request_official_receipt',
    appealRouteKey: 'appeal.county_ombuds',
    sourceDocumentId: DEMO_IDS.DOC_NAIROBI_COUNTY_BUDGET,
    sourcePage: 12,
    reviewerInitials: 'M.K.',
    reviewedAt: '2026-09-02T11:00:00.000Z',
    validFrom: '2026-07-01T00:00:00.000Z',
    validTo: null,
  },
];

export const ALL_DEMO_PROJECTS: DemoProjectFixture[] = [...DEMO_PROJECTS, ...DEMO_KENYA_PROJECTS];
export const ALL_DEMO_SOURCE_DOCUMENTS: DemoSourceDocumentFixture[] = [...DEMO_SOURCE_DOCUMENTS, ...DEMO_KENYA_SOURCE_DOCUMENTS];
export const ALL_DEMO_ASSETS: DemoAssetFixture[] = [...DEMO_ASSETS, ...DEMO_KENYA_ASSETS];
export const ALL_DEMO_SERVICES: DemoServiceFixture[] = [...DEMO_SERVICES, ...DEMO_KENYA_SERVICES];
export const ALL_DEMO_STATUTORY_RULES: DemoStatutoryRuleFixture[] = [...DEMO_STATUTORY_RULES, ...DEMO_KENYA_STATUTORY_RULES];

// ============================================================================
// 13. VISIT OUTCOMES & PRE-COMPUTED DIVERGENCE (k-Anonymity Test Scenarios)
// ============================================================================

// 14 outcome reports for ET-ID-REPLACE across 6 distinct clusters (k >= 5)
// 11 report code 2 (extra payment requested) -> 78.6% divergence!
export const DEMO_VISIT_OUTCOMES_ID_REPLACE: DemoVisitOutcomeFixture[] = Array.from(
  { length: 14 },
  (_, i) => {
    const isOvercharge = i < 11;
    const clusterIndex = i % 6; // 6 distinct clusters (satisfies k >= 5)
    return {
      id: `00000000-0000-4000-b000-${(i + 1).toString().padStart(12, '0')}`,
      serviceId: DEMO_IDS.SERVICE_ID_REPLACE,
      outcomeCode: (isOvercharge ? 2 : 1) as 1 | 2,
      extraFeeMinor: isOvercharge ? 20000 : null, // 200.00 ETB
      visitsReported: 2,
      respondentHash: computePhoneHash(`+2519990000${(i + 10).toString().padStart(2, '0')}`, DEMO_PEPPER),
      clusterKey: `cl-svc-id-${clusterIndex}`,
      channel: 'USSD',
      idempotencyKey: `seed-visit-id-${i + 1}`,
      reportedAt: `2026-09-${(10 + (i % 5)).toString().padStart(2, '0')}T10:00:00.000Z`,
    };
  }
);

// 3 outcome reports for ET-CLINIC-INTAKE across 2 distinct clusters (k < 5)
export const DEMO_VISIT_OUTCOMES_CLINIC: DemoVisitOutcomeFixture[] = Array.from(
  { length: 3 },
  (_, i) => ({
    id: `00000000-0000-4000-c000-${(i + 1).toString().padStart(12, '0')}`,
    serviceId: DEMO_IDS.SERVICE_CLINIC_INTAKE,
    outcomeCode: 1 as const,
    extraFeeMinor: null,
    visitsReported: 1,
    respondentHash: computePhoneHash(`+2519990000${(i + 30).toString().padStart(2, '0')}`, DEMO_PEPPER),
    clusterKey: `cl-svc-cln-${i % 2}`, // 2 distinct clusters (< 5)
    channel: 'SMS',
    idempotencyKey: `seed-visit-cln-${i + 1}`,
    reportedAt: `2026-09-12T11:00:00.000Z`,
  })
);

export const DEMO_DIVERGENCE_AGGREGATES: DemoDivergenceAggregateFixture[] = [
  {
    serviceId: DEMO_IDS.SERVICE_ID_REPLACE,
    windowDays: 30,
    computedAt: DEMO_TIMELINE.DEMO_ANCHOR_TIME,
    reportCount: 14,
    distinctClusters: 6, // k >= 5 satisfied
    pctAdditionalFee: 78.6,
    medianExtraMinor: 20000,
    avgVisits: 2.1,
    kSatisfied: true,
    alertActive: true,
  },
  {
    serviceId: DEMO_IDS.SERVICE_CLINIC_INTAKE,
    windowDays: 30,
    computedAt: DEMO_TIMELINE.DEMO_ANCHOR_TIME,
    reportCount: 3,
    distinctClusters: 2, // k < 5 not satisfied: suppression active!
    pctAdditionalFee: null,
    medianExtraMinor: null,
    avgVisits: null,
    kSatisfied: false,
    alertActive: false,
  },
];

// ============================================================================
// 14. RADIO BULLETIN (Ward 9 Draft Bulletin)
// ============================================================================

export const DEMO_RADIO_BULLETIN: DemoRadioBulletinFixture = {
  id: DEMO_IDS.BULLETIN_DRAFT,
  wardId: DEMO_IDS.WARD_W09,
  periodStart: '2026-09-08T00:00:00.000Z',
  periodEnd: '2026-09-15T00:00:00.000Z',
  facts: [
    {
      factType: 'PROJECT_DISCREPANCY',
      projectCode: '4412',
      title: 'Health post generator overhaul',
      amountBirr: 320000,
      witnessCount: 3,
      faultCount: 3,
      contractor: 'AfroTech Infra',
    },
    {
      factType: 'SERVICE_DIVERGENCE',
      serviceCode: 'ET-ID-REPLACE',
      name: 'ID replacement',
      statutoryFeeBirr: 50,
      medianReportedBirr: 250,
      pctReportedExtraFee: 78.6,
      distinctClusters: 6,
    },
  ],
  scriptText:
    'In Ward 9, the health post generator was funded for 320,000 birr. Three distinct neighbourhood groups checked it; all three report it is not running when mains power cuts. Contract 4412. The ward council meets Friday at 9.',
  locale: 'am',
  state: 'DRAFT', // Export locked pending moderator approval
  moderatorId: null,
  moderatedAt: null,
};

// ============================================================================
// 15. CRYPTOGRAPHIC AUDIT EVENTS (7-Event Deterministic Chain)
// ============================================================================

export function buildDemoAuditEvents(): AuditEventRecord[] {
  const events: AuditEventRecord[] = [];

  // Seq 1: Source Document Ingestion
  const e1 = createAuditEventRecord({
    seq: 1,
    prevEvent: null,
    wardId: DEMO_IDS.WARD_W09,
    actorRole: 'INGEST_REVIEWER',
    actorRef: 'reviewer:H.T.',
    action: 'SOURCE_DOCUMENT_INGESTED',
    entityType: 'source_document',
    entityId: DEMO_IDS.DOC_CAPITAL_BUDGET,
    payload: {
      title: 'Woreda 9 Capital Budget FY2026',
      sha256: '3b1f9c87d4a2e5890123456789abcdef0123456789abcdef0123456789abcdef',
      pages: 84,
    },
    occurredAt: '2026-09-12T08:00:00.000Z',
  });
  events.push(e1);

  // Seq 2: Project Created & Linked to Source
  const e2 = createAuditEventRecord({
    seq: 2,
    prevEvent: e1,
    wardId: DEMO_IDS.WARD_W09,
    actorRole: 'INGEST_REVIEWER',
    actorRef: 'reviewer:H.T.',
    action: 'PROJECT_CREATED',
    entityType: 'project',
    entityId: DEMO_IDS.PROJECT_4412,
    payload: {
      projectCode: '4412',
      amountMinor: 32000000,
      sourceDocumentId: DEMO_IDS.DOC_CAPITAL_BUDGET,
      sourcePage: 41,
    },
    occurredAt: '2026-09-12T08:30:00.000Z',
  });
  events.push(e2);

  // Seq 3: Budget Line Committed
  const e3 = createAuditEventRecord({
    seq: 3,
    prevEvent: e2,
    wardId: DEMO_IDS.WARD_W09,
    actorRole: 'ADMIN',
    actorRef: 'admin:finance_office',
    action: 'BUDGET_LINE_COMMITTED',
    entityType: 'project',
    entityId: DEMO_IDS.PROJECT_4412,
    payload: {
      fiscalState: 'COMMITTED',
      contractor: 'AfroTech Infra',
    },
    occurredAt: '2026-09-13T10:00:00.000Z',
  });
  events.push(e3);

  // Seq 4: Task Dispatched
  const e4 = createAuditEventRecord({
    seq: 4,
    prevEvent: e3,
    wardId: DEMO_IDS.WARD_W09,
    actorRole: 'SYSTEM',
    actorRef: 'scheduler:dispatch',
    action: 'INSPECTION_TASK_DISPATCHED',
    entityType: 'inspection_task',
    entityId: DEMO_IDS.TASK_4412,
    payload: {
      witnessTarget: 3,
      assetId: DEMO_IDS.ASSET_4412_GENERATOR,
      expiresAt: DEMO_TIMELINE.TASK_EXPIRES_AT,
    },
    occurredAt: DEMO_TIMELINE.TASK_DISPATCHED_AT,
  });
  events.push(e4);

  // Seq 5: Observation 1 Recorded
  const e5 = createAuditEventRecord({
    seq: 5,
    prevEvent: e4,
    wardId: DEMO_IDS.WARD_W09,
    actorRole: 'CITIZEN',
    actorRef: 'channel:USSD',
    action: 'OBSERVATION_RECORDED',
    entityType: 'observation',
    entityId: DEMO_OBSERVATIONS[0].id,
    payload: {
      taskId: DEMO_IDS.TASK_4412,
      clusterKey: DEMO_OBSERVATIONS[0].clusterKey,
      weight: 1,
      witnessCount: 1,
    },
    occurredAt: '2026-09-14T09:12:00.000Z',
  });
  events.push(e5);

  // Seq 6: Observation 2 Recorded
  const e6 = createAuditEventRecord({
    seq: 6,
    prevEvent: e5,
    wardId: DEMO_IDS.WARD_W09,
    actorRole: 'CITIZEN',
    actorRef: 'channel:SMS',
    action: 'OBSERVATION_RECORDED',
    entityType: 'observation',
    entityId: DEMO_OBSERVATIONS[1].id,
    payload: {
      taskId: DEMO_IDS.TASK_4412,
      clusterKey: DEMO_OBSERVATIONS[1].clusterKey,
      weight: 1,
      witnessCount: 2,
    },
    occurredAt: '2026-09-14T11:45:00.000Z',
  });
  events.push(e6);

  // Seq 7: Repair Claim Recorded (Starts 7-day Probation)
  const e7 = createAuditEventRecord({
    seq: 7,
    prevEvent: e6,
    wardId: DEMO_IDS.WARD_W09,
    actorRole: 'ADMIN',
    actorRef: 'contractor:AfroTech Infra',
    action: 'REPAIR_CLAIMED',
    entityType: 'repair_ticket',
    entityId: DEMO_IDS.TICKET_4412,
    payload: {
      ticketId: DEMO_IDS.TICKET_4412,
      probationDays: 7,
      probationEndsAt: DEMO_TIMELINE.PROBATION_ENDS_AT,
    },
    occurredAt: DEMO_TIMELINE.REPAIR_CLAIMED_AT,
  });
  events.push(e7);

  return events;
}

export const DEMO_AUDIT_EVENTS: AuditEventRecord[] = buildDemoAuditEvents();

// ============================================================================
// 16. SIMULATOR DEMO SCENARIO SPECIFICATION (Frame A & Frame B Presets)
// ============================================================================

export const DEMO_SIMULATOR_SCENARIOS = {
  heroScenario: {
    targetProjectCode: '4412',
    targetTaskId: DEMO_IDS.TASK_4412,
    startingWitnessCount: 2,
    targetWitnessCount: 3,

    // Phone 1: Amina (Unique Cluster Gamma -> moves counter 2 -> 3)
    primaryPhone: {
      respondentId: DEMO_PERSONAS.AMINA.id,
      label: DEMO_PERSONAS.AMINA.label,
      msisdn: DEMO_PERSONAS.AMINA.msisdn,
      msisdnPrefix: DEMO_PERSONAS.AMINA.msisdnPrefix,
      geoCell: DEMO_PERSONAS.AMINA.geoCell,
      clusterKey: DEMO_PERSONAS.AMINA.clusterKey,
      answers: { runs_on_outage: false, fridge_green: false, board_posted: true },
      expectedCounted: true,
      expectedWitnessAfter: 3,
    },

    // Phone 2: Girma ("Second phone, same area" -> duplicate cluster -> suppressed!)
    secondPhoneSameArea: {
      respondentId: DEMO_PERSONAS.COLLIDING_NEIGHBOR.id,
      label: DEMO_PERSONAS.COLLIDING_NEIGHBOR.label,
      msisdn: DEMO_PERSONAS.COLLIDING_NEIGHBOR.msisdn,
      msisdnPrefix: DEMO_PERSONAS.COLLIDING_NEIGHBOR.msisdnPrefix,
      geoCell: DEMO_PERSONAS.COLLIDING_NEIGHBOR.geoCell,
      clusterKey: DEMO_PERSONAS.COLLIDING_NEIGHBOR.clusterKey, // MUST equal primaryPhone.clusterKey
      answers: { runs_on_outage: false, fridge_green: false, board_posted: true },
      expectedCounted: false,
      expectedReasonKey: 'observation.cluster_already_counted',
      expectedWitnessAfter: 3, // Counter remains at 3!
    },

    // Frame B: Attempting to close ticket early triggers refusal
    probationRefusal: {
      ticketId: DEMO_IDS.TICKET_4412,
      expectedStatus: 409,
      expectedErrorCode: 'E_PROBATION_LOCKED',
      expectedRemainingDays: 5,
      rejectionReason: 'Probation window is still open. 5 days remain.',
    },
  },
} as const;
