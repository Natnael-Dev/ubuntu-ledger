// Respondent Aggregate Repository
// Authoritative sources: docs/specs/03-data-model.md §4, §10, docs/specs/05-api-contracts.md §5, docs/specs/11-tasks.md T-16

import type { RespondentRecord } from '../types';

export interface RespondentRepository {
  /**
   * Retrieves a respondent record by their HMAC-SHA256 phone hash.
   */
  findByPhoneHash(phoneHash: string): Promise<RespondentRecord | null>;

  /**
   * Retrieves a respondent record by their UUID primary key.
   */
  findById(id: string): Promise<RespondentRecord | null>;
}

/**
 * In-memory mock implementation for unit and service-level testing.
 */
export class InMemoryRespondentRepository implements RespondentRepository {
  constructor(private respondents: Map<string, RespondentRecord> = new Map()) {}

  async findByPhoneHash(phoneHash: string): Promise<RespondentRecord | null> {
    for (const respondent of this.respondents.values()) {
      if (respondent.phoneHash === phoneHash) {
        return { ...respondent };
      }
    }
    return null;
  }

  async findById(id: string): Promise<RespondentRecord | null> {
    const respondent = this.respondents.get(id);
    return respondent ? { ...respondent } : null;
  }

  // Test helper
  seed(respondent: RespondentRecord): void {
    this.respondents.set(respondent.id, { ...respondent });
  }

  get(id: string): RespondentRecord | undefined {
    return this.respondents.get(id);
  }
}
