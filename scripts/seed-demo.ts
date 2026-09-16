// Canonical Demo Database Seed Script (T-18)
// Authoritative sources: docs/specs/12-demo-script.md, docs/specs/15-deployment-and-run.md §5,
// docs/specs/11-tasks.md T-18

import { getPostgresPool, closePostgresPool } from '../src/infra/db/postgres/pool';
import {
  DEMO_COUNTRIES,
  DEMO_WARDS,
  DEMO_SOURCE_DOCUMENTS,
  DEMO_ASSET_TYPES,
  DEMO_PROJECTS,
  DEMO_ASSETS,
  DEMO_INSPECTION_TASKS,
  DEMO_RESPONDENTS,
  DEMO_OBSERVATIONS,
  DEMO_REPAIR_TICKETS,
  DEMO_SERVICES,
  DEMO_STATUTORY_RULES,
} from '../src/fixtures/demo-scenario';

async function seedDemoDatabase(): Promise<void> {
  console.log('--- Ubuntu Ledger Demo Scenario Seeder (T-18) ---');

  const pool = getPostgresPool();
  let client;

  try {
    client = await pool.connect();
    console.log('Connected to PostgreSQL database.');
  } catch {
    console.warn(
      'Notice: PostgreSQL is not currently running or reachable.\n' +
      'Ubuntu Ledger runtime automatically operates using the in-memory canonical demo container.\n' +
      'To seed a real PostgreSQL instance, ensure DATABASE_URL is set and the database service is running.'
    );
    return;
  }

  try {
    await client.query('BEGIN');

    // 1. Countries
    for (const c of DEMO_COUNTRIES) {
      await client.query(
        `INSERT INTO country (code, name, currency, admin_tier_labels, default_locale, locales)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (code) DO UPDATE SET
           name = EXCLUDED.name,
           currency = EXCLUDED.currency,
           admin_tier_labels = EXCLUDED.admin_tier_labels,
           default_locale = EXCLUDED.default_locale,
           locales = EXCLUDED.locales`,
        [c.code, c.name, c.currency, c.adminTierLabels, c.defaultLocale, c.locales]
      );
    }
    console.log(`✓ Seeded ${DEMO_COUNTRIES.length} countries`);

    // 2. Wards
    for (const w of DEMO_WARDS) {
      await client.query(
        `INSERT INTO ward (id, country_code, code, name, admin_path, locales, radio_partner)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
           country_code = EXCLUDED.country_code,
           code = EXCLUDED.code,
           name = EXCLUDED.name,
           admin_path = EXCLUDED.admin_path,
           locales = EXCLUDED.locales,
           radio_partner = EXCLUDED.radio_partner`,
        [w.id, w.countryCode, w.code, w.name, w.adminPath, w.locales, w.radioPartner ?? null]
      );
    }
    console.log(`✓ Seeded ${DEMO_WARDS.length} wards`);

    // 3. Asset Types
    for (const at of DEMO_ASSET_TYPES) {
      await client.query(
        `INSERT INTO asset_type (key, label_key, questions)
         VALUES ($1, $2, $3)
         ON CONFLICT (key) DO UPDATE SET
           label_key = EXCLUDED.label_key,
           questions = EXCLUDED.questions`,
        [at.key, at.labelKey, JSON.stringify(at.questions)]
      );
    }
    console.log(`✓ Seeded ${DEMO_ASSET_TYPES.length} asset types`);

    // 4. Source Documents
    for (const d of DEMO_SOURCE_DOCUMENTS) {
      await client.query(
        `INSERT INTO source_document (id, ward_id, title, issuer, published_on, archived_at, storage_path, sha256, page_count, ingest_reviewer, reviewed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           sha256 = EXCLUDED.sha256`,
        [
          d.id,
          d.wardId,
          d.title,
          d.issuer,
          d.publishedOn,
          d.archivedAt,
          d.storagePath,
          d.sha256,
          d.pageCount,
          d.ingestReviewer,
          d.reviewedAt,
        ]
      );
    }
    console.log(`✓ Seeded ${DEMO_SOURCE_DOCUMENTS.length} source documents`);

    // 5. Projects
    for (const p of DEMO_PROJECTS) {
      await client.query(
        `INSERT INTO project (id, ward_id, project_code, title, official_title, asset_type, contractor_name, amount_minor, currency, promised_completion, source_document_id, source_page, confidence, fiscal, audit)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         ON CONFLICT (id) DO UPDATE SET
           project_code = EXCLUDED.project_code,
           title = EXCLUDED.title,
           fiscal = EXCLUDED.fiscal,
           audit = EXCLUDED.audit`,
        [
          p.id,
          p.wardId,
          p.projectCode,
          p.title,
          p.officialTitle,
          p.assetType,
          p.contractorName,
          p.amountMinor,
          p.currency,
          p.promisedCompletion,
          p.sourceDocumentId,
          p.sourcePage,
          p.confidence,
          p.fiscal,
          p.audit,
        ]
      );
    }
    console.log(`✓ Seeded ${DEMO_PROJECTS.length} projects`);

    // 6. Assets
    for (const a of DEMO_ASSETS) {
      await client.query(
        `INSERT INTO asset (id, project_id, asset_type, label, landmark, geo_cell, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
           label = EXCLUDED.label,
           landmark = EXCLUDED.landmark,
           geo_cell = EXCLUDED.geo_cell`,
        [a.id, a.projectId, a.assetType, a.label, a.landmark, a.geoCell, a.createdAt]
      );
    }
    console.log(`✓ Seeded ${DEMO_ASSETS.length} assets`);

    // 7. Inspection Tasks
    for (const t of DEMO_INSPECTION_TASKS) {
      await client.query(
        `INSERT INTO inspection_task (id, project_id, asset_id, dispatched_at, expires_at, witness_target, witness_count, closed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET
           witness_target = EXCLUDED.witness_target,
           witness_count = EXCLUDED.witness_count,
           closed_at = EXCLUDED.closed_at`,
        [
          t.id,
          t.projectId,
          t.assetId,
          t.dispatchedAt,
          t.expiresAt,
          t.witnessTarget,
          t.witnessCount,
          t.closedAt,
        ]
      );
    }
    console.log(`✓ Seeded ${DEMO_INSPECTION_TASKS.length} inspection tasks`);

    // 8. Respondents
    for (const r of DEMO_RESPONDENTS) {
      await client.query(
        `INSERT INTO respondent (id, ward_id, phone_hash, phone_enc, msisdn_prefix, registered_at, locale)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
           phone_hash = EXCLUDED.phone_hash,
           msisdn_prefix = EXCLUDED.msisdn_prefix,
           locale = EXCLUDED.locale`,
        [
          r.id,
          '00000000-0000-4000-a000-000000000001',
          r.phoneHash,
          null,
          r.msisdnPrefix,
          r.registeredAt,
          r.locale,
        ]
      );
    }
    console.log(`✓ Seeded ${DEMO_RESPONDENTS.length} respondents`);

    // 9. Observations
    for (const o of DEMO_OBSERVATIONS) {
      await client.query(
        `INSERT INTO observation (id, task_id, respondent_id, channel, answers, cluster_key, weight, geo_cell, idempotency_key, submitted_at, received_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO UPDATE SET
           weight = EXCLUDED.weight,
           cluster_key = EXCLUDED.cluster_key`,
        [
          o.id,
          o.taskId,
          o.respondentId,
          o.channel,
          JSON.stringify(o.answers),
          o.clusterKey,
          o.weight,
          o.geoCell,
          o.idempotencyKey,
          o.submittedAt,
          o.receivedAt,
        ]
      );
    }
    console.log(`✓ Seeded ${DEMO_OBSERVATIONS.length} observations`);

    // 10. Repair Tickets
    for (const tk of DEMO_REPAIR_TICKETS) {
      await client.query(
        `INSERT INTO repair_ticket (id, asset_id, project_id, state, reported_broken_at, repair_claimed_at, claimed_by, probation_started_at, probation_ends_at, probation_days, resolved_at, failure_reason_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id) DO UPDATE SET
           state = EXCLUDED.state,
           repair_claimed_at = EXCLUDED.repair_claimed_at,
           probation_ends_at = EXCLUDED.probation_ends_at`,
        [
          tk.id,
          tk.assetId,
          tk.projectId,
          tk.state,
          tk.reportedBrokenAt,
          tk.repairClaimedAt,
          tk.claimedBy,
          tk.probationStartedAt,
          tk.probationEndsAt,
          tk.probationDays,
          tk.resolvedAt,
          tk.failureReasonKey,
        ]
      );
    }
    console.log(`✓ Seeded ${DEMO_REPAIR_TICKETS.length} repair tickets`);

    // 11. Services
    for (const s of DEMO_SERVICES) {
      await client.query(
        `INSERT INTO service (id, ward_id, code, office_code, label_key)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET
           code = EXCLUDED.code,
           office_code = EXCLUDED.office_code,
           label_key = EXCLUDED.label_key`,
        [s.id, s.wardId, s.code, s.officeCode, s.labelKey]
      );
    }
    console.log(`✓ Seeded ${DEMO_SERVICES.length} services`);

    // 12. Statutory Rules
    for (const sr of DEMO_STATUTORY_RULES) {
      await client.query(
        `INSERT INTO statutory_rule (id, service_id, fee_ceiling_minor, currency, required_documents, expected_visits, refusal_script_key, appeal_route_key, source_document_id, source_page, reviewer_initials, reviewed_at, valid_from, valid_to)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (id) DO UPDATE SET
           fee_ceiling_minor = EXCLUDED.fee_ceiling_minor,
           required_documents = EXCLUDED.required_documents`,
        [
          sr.id,
          sr.serviceId,
          sr.feeCeilingMinor,
          sr.currency,
          JSON.stringify(sr.requiredDocuments),
          sr.expectedVisits,
          sr.refusalScriptKey,
          sr.appealRouteKey,
          sr.sourceDocumentId,
          sr.sourcePage,
          sr.reviewerInitials,
          sr.reviewedAt,
          sr.validFrom,
          sr.validTo,
        ]
      );
    }
    console.log(`✓ Seeded ${DEMO_STATUTORY_RULES.length} statutory rules`);

    await client.query('COMMIT');
    console.log('--- Demo Scenario Seeded Successfully ---');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error during demo seeding, rolled back transaction:', err);
    throw err;
  } finally {
    client.release();
    await closePostgresPool();
  }
}

seedDemoDatabase().catch((e) => {
  console.error(e);
  process.exit(1);
});
