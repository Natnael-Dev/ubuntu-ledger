import { describe, it, expect } from 'vitest';
import {
  DEMO_PEPPER,
  DEMO_TIMELINE,
  DEMO_IDS,
  DEMO_COUNTRIES,
  DEMO_WARDS,
  DEMO_SOURCE_DOCUMENTS,
  DEMO_ASSET_TYPES,
  DEMO_PROJECTS,
  DEMO_ASSETS,
  DEMO_INSPECTION_TASKS,
  DEMO_RESPONDENTS,
  DEMO_PERSONAS,
  DEMO_OBSERVATIONS,
  DEMO_REPAIR_TICKETS,
  DEMO_SERVICES,
  DEMO_STATUTORY_RULES,
  DEMO_DIVERGENCE_AGGREGATES,
  DEMO_RADIO_BULLETIN,
  DEMO_AUDIT_EVENTS,
  DEMO_SIMULATOR_SCENARIOS,
} from '@/fixtures/demo-scenario';
import { deriveClusterKey } from '@/domain/sybil';
import { verifyAuditChain } from '@/domain/audit-chain';
import { computePhoneHash } from '@/lib/msisdn';
import fs from 'node:fs';
import path from 'node:path';

describe('T-18A: Canonical Demo Scenario Fixture & Invariant Suite', () => {
  // 1. Entity Counts
  describe('Entity Inventory Counts', () => {
    it('contains exactly 2 countries and 2 wards', () => {
      expect(DEMO_COUNTRIES).toHaveLength(2);
      expect(DEMO_WARDS).toHaveLength(2);
      expect(DEMO_COUNTRIES.map((c) => c.code)).toEqual(['ET', 'KE']);
    });

    it('contains exactly 3 source documents with valid 64-char lowercase SHA-256', () => {
      expect(DEMO_SOURCE_DOCUMENTS).toHaveLength(3);
      for (const doc of DEMO_SOURCE_DOCUMENTS) {
        expect(doc.sha256).toHaveLength(64);
        expect(/^[0-9a-f]{64}$/.test(doc.sha256)).toBe(true);
        expect(doc.pageCount).toBeGreaterThan(0);
      }
    });

    it('contains exactly 3 asset types with 2 to 3 questions each', () => {
      expect(DEMO_ASSET_TYPES).toHaveLength(3);
      for (const assetType of DEMO_ASSET_TYPES) {
        expect(assetType.questions.length).toBeGreaterThanOrEqual(2);
        expect(assetType.questions.length).toBeLessThanOrEqual(3);
      }
    });

    it('contains exactly 6 projects in Woreda 9', () => {
      expect(DEMO_PROJECTS).toHaveLength(6);
      expect(DEMO_PROJECTS.every((p) => p.wardId === DEMO_IDS.WARD_W09)).toBe(true);
    });

    it('contains exactly 6 assets matching the 6 projects', () => {
      expect(DEMO_ASSETS).toHaveLength(6);
      const projectIds = new Set(DEMO_PROJECTS.map((p) => p.id));
      for (const asset of DEMO_ASSETS) {
        expect(projectIds.has(asset.projectId)).toBe(true);
      }
    });

    it('contains exactly 12 synthetic respondents across cohorts', () => {
      expect(DEMO_RESPONDENTS).toHaveLength(12);
      const uniqueIds = new Set(DEMO_RESPONDENTS.map((r) => r.id));
      expect(uniqueIds.size).toBe(12);
    });

    it('contains exactly 2 pre-seeded observations on Task 4412 with weight = 1', () => {
      expect(DEMO_OBSERVATIONS).toHaveLength(2);
      expect(DEMO_OBSERVATIONS.every((o) => o.taskId === DEMO_IDS.TASK_4412)).toBe(true);
      expect(DEMO_OBSERVATIONS.every((o) => o.weight === 1)).toBe(true);
      // Ensure the 2 pre-seeded observations come from distinct clusters
      expect(DEMO_OBSERVATIONS[0].clusterKey).not.toBe(DEMO_OBSERVATIONS[1].clusterKey);
    });

    it('contains exactly 2 repair tickets (Hero in PROBATION, Positive Control SUSTAINED)', () => {
      expect(DEMO_REPAIR_TICKETS).toHaveLength(2);
      const hero = DEMO_REPAIR_TICKETS.find((t) => t.id === DEMO_IDS.TICKET_4412);
      const sustained = DEMO_REPAIR_TICKETS.find((t) => t.id === DEMO_IDS.TICKET_4413);

      expect(hero).toBeDefined();
      expect(hero?.state).toBe('REPAIR_CLAIMED');
      expect(hero?.probationDays).toBe(7);

      expect(sustained).toBeDefined();
      expect(sustained?.state).toBe('VERIFIED_SUSTAINED');
      // DB constraint sustained_requires_probation_end: resolved_at >= probation_ends_at
      expect(new Date(sustained!.resolvedAt!).getTime()).toBeGreaterThanOrEqual(
        new Date(sustained!.probationEndsAt!).getTime()
      );
    });

    it('contains exactly 2 services and statutory rules', () => {
      expect(DEMO_SERVICES).toHaveLength(2);
      expect(DEMO_STATUTORY_RULES).toHaveLength(2);
    });
  });

  // 2. Domain Type Conformance & Constraints
  describe('Domain Type Conformance & Schema Constraints', () => {
    it('Project 4412 adheres to official cited requirements', () => {
      const p4412 = DEMO_PROJECTS.find((p) => p.projectCode === '4412')!;
      expect(p4412.confidence).toBe('OFFICIAL_CITED');
      expect(p4412.sourceDocumentId).toBe(DEMO_IDS.DOC_CAPITAL_BUDGET);
      expect(p4412.sourcePage).toBe(41);
      expect(p4412.fiscal).toBe('COMMITTED');
      expect(p4412.audit).toBe('AWAITING_THRESHOLD');
      expect(p4412.amountMinor).toBe(32000000); // 320,000 ETB
    });

    it('Project 4414 adheres to unverified estimate constraints (INV-07)', () => {
      const p4414 = DEMO_PROJECTS.find((p) => p.projectCode === '4414')!;
      expect(p4414.confidence).toBe('UNOFFICIAL_ESTIMATE');
      expect(p4414.sourceDocumentId).toBeNull();
      expect(p4414.sourcePage).toBeNull();
      expect(p4414.fiscal).toBe('PROMISED'); // Cannot commit without source
    });

    it('Task 4412 has witness_count = 2 and witness_target = 3 (Primed for live demo)', () => {
      const task = DEMO_INSPECTION_TASKS.find((t) => t.id === DEMO_IDS.TASK_4412)!;
      expect(task.witnessTarget).toBe(3);
      expect(task.witnessCount).toBe(2);
      expect(task.closedAt).toBeNull();
      expect(new Date(task.expiresAt).getTime()).toBeGreaterThan(
        new Date(task.dispatchedAt).getTime()
      );
    });
  });

  // 3. Sybil Cluster Key Invariants & Duplicate Rejection (Frame A)
  describe('Sybil Resistance & Duplicate Cluster Derivation (Frame A)', () => {
    it('derives identical 16-hex cluster keys for Amina and Colliding Neighbor', () => {
      const amina = DEMO_PERSONAS.AMINA;
      const neighbor = DEMO_PERSONAS.COLLIDING_NEIGHBOR;

      // Both personas share: cell ('et-aa-0917' or 'et-aa-0919'), 6-digit prefix ('251993'), and week cohort
      expect(amina.geoCell).toBe(neighbor.geoCell);
      expect(amina.msisdnPrefix).toBe(neighbor.msisdnPrefix);

      const aminaCluster = deriveClusterKey({
        taskId: DEMO_IDS.TASK_4412,
        geoCell: amina.geoCell,
        wardId: amina.wardId,
        msisdnPrefixBucket: amina.msisdnPrefix,
        registeredAt: amina.registeredAt,
      });

      const neighborCluster = deriveClusterKey({
        taskId: DEMO_IDS.TASK_4412,
        geoCell: neighbor.geoCell,
        wardId: neighbor.wardId,
        msisdnPrefixBucket: neighbor.msisdnPrefix,
        registeredAt: neighbor.registeredAt,
      });

      // Frame A Hero Invariant: Two different phones produce the EXACT SAME cluster key!
      expect(amina.msisdn).not.toBe(neighbor.msisdn);
      expect(aminaCluster).toHaveLength(16);
      expect(neighborCluster).toHaveLength(16);
      expect(aminaCluster).toBe(neighborCluster);
      expect(amina.clusterKey).toBe(neighbor.clusterKey);
      expect(amina.clusterKey).toBe(aminaCluster);
    });

    it('pre-seeded witnesses 1 and 2 produce distinct cluster keys different from Amina', () => {
      const rep1 = DEMO_PERSONAS.ORIGINAL_REPORTER_1;
      const rep2 = DEMO_PERSONAS.ORIGINAL_REPORTER_2;
      const amina = DEMO_PERSONAS.AMINA;

      const cluster1 = deriveClusterKey({
        taskId: DEMO_IDS.TASK_4412,
        geoCell: rep1.geoCell,
        wardId: rep1.wardId,
        msisdnPrefixBucket: rep1.msisdnPrefix,
        registeredAt: rep1.registeredAt,
      });

      const cluster2 = deriveClusterKey({
        taskId: DEMO_IDS.TASK_4412,
        geoCell: rep2.geoCell,
        wardId: rep2.wardId,
        msisdnPrefixBucket: rep2.msisdnPrefix,
        registeredAt: rep2.registeredAt,
      });

      const clusterAmina = amina.clusterKey;

      const clusterSet = new Set([cluster1, cluster2, clusterAmina]);
      // All 3 must be completely distinct clusters
      expect(clusterSet.size).toBe(3);
    });
  });

  // 4. Frame B: 5 Days Remain in Probation Window
  describe('Probation Window & Refusal Invariant (Frame B)', () => {
    it('Ticket 4412 has exactly 5 days remaining relative to demo anchor time', () => {
      const ticket = DEMO_REPAIR_TICKETS.find((t) => t.id === DEMO_IDS.TICKET_4412)!;
      const anchorMs = new Date(DEMO_TIMELINE.DEMO_ANCHOR_TIME).getTime();
      const endsMs = new Date(ticket.probationEndsAt!).getTime();

      const diffDays = Math.round((endsMs - anchorMs) / (24 * 60 * 60 * 1000));
      expect(diffDays).toBe(5);
      expect(DEMO_SIMULATOR_SCENARIOS.heroScenario.probationRefusal.expectedRemainingDays).toBe(5);
      expect(DEMO_SIMULATOR_SCENARIOS.heroScenario.probationRefusal.expectedErrorCode).toBe(
        'E_PROBATION_LOCKED'
      );
    });
  });

  // 5. Cryptographic Audit Hash Chain Integrity
  describe('Cryptographic Audit Hash Chain (INV-04)', () => {
    it('passes verifyAuditChain with ok: true on all 7 chained events', () => {
      expect(DEMO_AUDIT_EVENTS).toHaveLength(7);

      const verification = verifyAuditChain(DEMO_AUDIT_EVENTS);
      expect(verification.ok).toBe(true);

      if (verification.ok) {
        expect(verification.eventsChecked).toBe(7);
        expect(verification.firstBreakSeq).toBeNull();
        expect(verification.headHash).toHaveLength(64);
      }
    });

    it('begins at seq: 1 with 64 zero characters as prev_hash', () => {
      const genesis = DEMO_AUDIT_EVENTS[0];
      expect(genesis.seq).toBe(1);
      expect(genesis.prev_hash).toBe('0'.repeat(64));
      expect(genesis.action).toBe('SOURCE_DOCUMENT_INGESTED');
    });
  });

  // 6. k-Anonymity Gating
  describe('Service Divergence & k-Anonymity Gates', () => {
    it('ET-ID-REPLACE satisfies k >= 5 with alert_active = true', () => {
      const aggregate = DEMO_DIVERGENCE_AGGREGATES.find(
        (a) => a.serviceId === DEMO_IDS.SERVICE_ID_REPLACE
      )!;
      expect(aggregate.reportCount).toBe(14);
      expect(aggregate.distinctClusters).toBe(6);
      expect(aggregate.distinctClusters).toBeGreaterThanOrEqual(5);
      expect(aggregate.kSatisfied).toBe(true);
      expect(aggregate.alertActive).toBe(true);
      expect(aggregate.pctAdditionalFee).toBe(78.6);
      expect(aggregate.medianExtraMinor).toBe(20000); // 200 ETB
    });

    it('ET-CLINIC-INTAKE fails k >= 5 with suppression active (zero count/amount leak)', () => {
      const aggregate = DEMO_DIVERGENCE_AGGREGATES.find(
        (a) => a.serviceId === DEMO_IDS.SERVICE_CLINIC_INTAKE
      )!;
      expect(aggregate.reportCount).toBe(3);
      expect(aggregate.distinctClusters).toBe(2);
      expect(aggregate.distinctClusters).toBeLessThan(5);
      expect(aggregate.kSatisfied).toBe(false);
      expect(aggregate.alertActive).toBe(false);
      // Suppressed metrics must be null
      expect(aggregate.pctAdditionalFee).toBeNull();
      expect(aggregate.medianExtraMinor).toBeNull();
      expect(aggregate.avgVisits).toBeNull();
    });
  });

  // 7. Security, Privacy & Zero PII
  describe('Zero PII & Non-Routable Phone Identity Invariants', () => {
    it('all phone numbers are within designated non-routable fictional ranges', () => {
      for (const r of DEMO_RESPONDENTS) {
        expect(r.msisdn).toMatch(/^\+2519990000\d{2}$/);
      }
    });

    it('no GPS coordinate fields (latitude, longitude) exist on any entity', () => {
      const serialized = JSON.stringify({
        DEMO_ASSETS,
        DEMO_PROJECTS,
        DEMO_OBSERVATIONS,
        DEMO_RESPONDENTS,
      });
      expect(serialized).not.toMatch(/latitude/i);
      expect(serialized).not.toMatch(/longitude/i);
      expect(serialized).not.toMatch(/\bcoords\b/i);
    });

    it('no voice transcripts exist in any fixture records', () => {
      const serialized = JSON.stringify({
        DEMO_OBSERVATIONS,
        DEMO_REPAIR_TICKETS,
        DEMO_RADIO_BULLETIN,
      });
      expect(serialized).not.toMatch(/\btranscript\b/i);
    });

    it('phone hashes are 64 lowercase hex characters matching computePhoneHash', () => {
      for (const r of DEMO_RESPONDENTS) {
        expect(r.phoneHash).toHaveLength(64);
        expect(/^[0-9a-f]{64}$/.test(r.phoneHash)).toBe(true);
        expect(r.phoneHash).toBe(computePhoneHash(r.msisdn, DEMO_PEPPER));
      }
    });
  });

  // 8. Determinism & Clock Policy
  describe('Determinism & Clock Ban Invariants', () => {
    it('contains only static ISO-8601 timestamps without dynamic clock reads', () => {
      const fixtureCode = fs.readFileSync(
        path.resolve(__dirname, '../../../src/fixtures/demo-scenario.ts'),
        'utf-8'
      );

      // Verify no dynamic clock reads exist in fixture code
      expect(fixtureCode).not.toMatch(/Date\.now\(\)/);
      expect(fixtureCode).not.toMatch(/new Date\(\)/);
    });
  });

  // 9. Architecture Boundary Verification
  describe('Architecture Boundary Protection', () => {
    it('verifies that /src/domain does NOT import /src/fixtures', () => {
      const domainDir = path.resolve(__dirname, '../../../src/domain');
      const domainFiles = fs.readdirSync(domainDir).filter((f) => f.endsWith('.ts'));

      for (const file of domainFiles) {
        const content = fs.readFileSync(path.join(domainDir, file), 'utf-8');
        expect(content).not.toMatch(/fixtures/i);
        expect(content).not.toMatch(/demo-scenario/i);
      }
    });
  });
});
