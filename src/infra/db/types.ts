// Database Entity and Persistence Types
// Authoritative sources: docs/specs/03-data-model.md §3, §4, §10, §11
// Note: Pure infrastructure data transfer types.

import type { AuditState, Channel, FiscalState, SourceConfidence } from '@/domain/types';

export interface ProjectRecord {
  id: string;
  wardId: string;
  projectCode: string;
  fiscal: FiscalState;
  audit: AuditState;
  confidence: SourceConfidence;
  confirmedAt?: Date | null;
}

export interface InspectionTaskRecord {
  id: string;
  projectId: string;
  assetId: string;
  dispatchedAt: Date;
  expiresAt: Date;
  witnessTarget: number;
  witnessCount: number;
  closedAt?: Date | null;
}

export interface ObservationRecord {
  id: string;
  taskId: string;
  respondentId: string;
  channel: Channel;
  answers: Record<string, boolean>;
  clusterKey: string;
  weight: 0 | 1;
  geoCell?: string | null;
  idempotencyKey: string;
  submittedAt: Date;
  receivedAt: Date;
}

export interface NewObservationRecord {
  id?: string;
  taskId: string;
  respondentId: string;
  channel: Channel;
  answers: Record<string, boolean>;
  clusterKey: string;
  weight: 0 | 1;
  geoCell?: string | null;
  idempotencyKey: string;
  submittedAt: Date;
  receivedAt: Date;
}

export interface IdempotencyRecord {
  key: string;
  endpoint: string;
  requestHash: string;
  response: Record<string, unknown>;
  createdAt: Date;
}

export interface NewIdempotencyRecord {
  key: string;
  endpoint: string;
  requestHash: string;
  response: Record<string, unknown>;
  createdAt?: Date;
}
