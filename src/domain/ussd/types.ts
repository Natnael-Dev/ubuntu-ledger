// Pure Domain USSD Types & Interfaces
// Authoritative sources: docs/specs/06-voice-and-ussd.md §2, §4, docs/specs/05-api-contracts.md §1

import type { Locale } from '../content';

export interface ProjectLookup {
  projectCode: string;
  title: string;
  amount: string;
  currency: string;
  contractor: string;
  due: string;
  isOfficial: boolean;
  narrative?: string;
  taskId?: string;
  assetType?: 'borehole' | 'generator' | 'latrine_block' | string;
  provenance?: {
    count: number;
    weekday: string;
    yesCount: number;
    noCount: number;
    ago: string;
  };
  observationResult?: {
    counted: boolean;
    witnessCount: number;
    witnessTarget: number;
    narrative?: string;
  };
}

export interface ServiceLookup {
  serviceCode: string;
  name: string;
  fee: string;
  currency: string;
  documents: string;
  visits: number;
  source: string;
  divergence?: {
    kSatisfied: boolean;
    pct?: number;
    n?: number;
    median?: string;
  };
}

export interface UssdSessionContext {
  locale?: Locale;
  lookupProject?: (code: string) => ProjectLookup | null;
  lookupService?: (code: string) => ServiceLookup | null;
  projects?: Record<string, ProjectLookup>;
  services?: Record<string, ServiceLookup>;
}

export interface CompletedObservation {
  taskId: string;
  projectCode: string;
  answers: Record<string, boolean>;
}

export interface ReportedFault {
  assetCode: string;
  working: boolean;
}

export interface SelectedOutcome {
  serviceCode: string;
  outcomeCode: number;
}

export interface UssdResponse {
  action: 'CON' | 'END';
  text: string;
  rawMessage: string;
  nodeId: string;
  locale: Locale;
  completedObservation?: CompletedObservation;
  reportedFault?: ReportedFault;
  selectedOutcome?: SelectedOutcome;
  selectedLocale?: Locale;
}
