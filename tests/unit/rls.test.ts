import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const MIGRATIONS_DIR = path.resolve(__dirname, "../../supabase/migrations");

// Read all migration files
function getMigrationFiles(): { filename: string; content: string }[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return [];
  }
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((filename) => ({
      filename,
      content: fs.readFileSync(path.join(MIGRATIONS_DIR, filename), "utf-8"),
    }));
}

// All tables specified in docs/specs/03-data-model.md §2-11
const ALL_EXPECTED_TABLES = [
  "country",
  "ward",
  "asset_type",
  "source_document",
  "project",
  "asset",
  "inspection_task",
  "respondent",
  "observation",
  "service",
  "statutory_rule",
  "visit_outcome",
  "divergence_aggregate",
  "repair_ticket",
  "probation_ping",
  "voice_note",
  "radio_bulletin",
  "outbox_message",
  "audit_event",
  "idempotency_record",
];

// Helper to check live database availability
const hasLiveDatabase = Boolean(
  process.env.DATABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.TEST_POSTGRES_HOST
);

describe("T-06: RLS Security Invariant Verification", () => {
  const migrations = getMigrationFiles();
  const fullSql = migrations.map((m) => m.content).join("\n");

  describe("Level 1: RLS Enablement Coverage", () => {
    it("has migrations 001 through 013 present", () => {
      expect(migrations.length).toBe(13);
      const prefixes = migrations.map((m) => m.filename.slice(0, 3));
      expect(prefixes).toEqual([
        "001",
        "002",
        "003",
        "004",
        "005",
        "006",
        "007",
        "008",
        "009",
        "010",
        "011",
        "012",
        "013",
      ]);
    });

    it("creates all 20 canonical tables across migrations", () => {
      for (const table of ALL_EXPECTED_TABLES) {
        const createRegex = new RegExp(
          `create\\s+table\\s+(if\\s+not\\s+exists\\s+)?${table}\\b`,
          "i"
        );
        expect(
          createRegex.test(fullSql),
          `Missing CREATE TABLE statement for '${table}'`
        ).toBe(true);
      }
    });

    it("enables Row Level Security on every table without exception", () => {
      for (const table of ALL_EXPECTED_TABLES) {
        const rlsRegex = new RegExp(
          `alter\\s+table\\s+${table}\\s+enable\\s+row\\s+level\\s+security\\s*;`,
          "i"
        );
        expect(
          rlsRegex.test(fullSql),
          `Table '${table}' lacks 'alter table ${table} enable row level security;'`
        ).toBe(true);
      }
    });

    it("enables RLS in the same migration file that creates each table", () => {
      for (const { filename, content } of migrations) {
        // Extract tables created in this migration
        const createdTables: string[] = [];
        const tableMatches = content.matchAll(/create\s+table\s+([a-z0-9_]+)\b/gi);
        for (const match of tableMatches) {
          createdTables.push(match[1].toLowerCase());
        }

        for (const table of createdTables) {
          const rlsRegex = new RegExp(
            `alter\\s+table\\s+${table}\\s+enable\\s+row\\s+level\\s+security\\s*;`,
            "i"
          );
          expect(
            rlsRegex.test(content),
            `Table '${table}' created in ${filename} must have RLS enabled in the same migration`
          ).toBe(true);
        }
      }
    });
  });

  describe("Level 2: Policy Existence and Syntactic Invariants", () => {
    it("enforces public read on receipts (project table) per 03-data-model.md §12", () => {
      const projectPolicyRegex = /create\s+policy\s+project_public_read\s+on\s+project\s+for\s+select\s+using\s*\(\s*true\s*\)\s*;/i;
      expect(projectPolicyRegex.test(fullSql)).toBe(true);
    });

    it("denies direct client access to observations per 03-data-model.md §12", () => {
      const obsPolicyRegex = /create\s+policy\s+observation_no_public\s+on\s+observation\s+for\s+select\s+using\s*\(\s*false\s*\)\s*;/i;
      expect(obsPolicyRegex.test(fullSql)).toBe(true);
    });

    it("denies client access to respondent PII per 03-data-model.md §12", () => {
      const respondentPolicyRegex = /create\s+policy\s+respondent_no_client\s+on\s+respondent\s+for\s+select\s+using\s*\(\s*false\s*\)\s*;/i;
      expect(respondentPolicyRegex.test(fullSql)).toBe(true);
    });

    it("gates divergence aggregate reads on k_satisfied per 03-data-model.md §12", () => {
      const divergencePolicyRegex = /create\s+policy\s+divergence_k_gated\s+on\s+divergence_aggregate\s+for\s+select\s+using\s*\(\s*k_satisfied\s*=\s*true\s*\)\s*;/i;
      expect(divergencePolicyRegex.test(fullSql)).toBe(true);
    });

    it("denies direct client access to voice notes per 03-data-model.md §12", () => {
      const voicePolicyRegex = /create\s+policy\s+voice_no_client\s+on\s+voice_note\s+for\s+select\s+using\s*\(\s*false\s*\)\s*;/i;
      expect(voicePolicyRegex.test(fullSql)).toBe(true);
    });

    it("restricts radio bulletin authoring to moderators and admins per 03-data-model.md §12", () => {
      const bulletinPolicyRegex = /create\s+policy\s+bulletin_moderator_rw\s+on\s+radio_bulletin\s+for\s+all\s+using\s*\(\s*auth\.jwt\(\)\s*->>\s*'role'\s+in\s*\('moderator',\s*'admin'\)\s*\)\s+with\s+check\s*\(\s*auth\.jwt\(\)\s*->>\s*'role'\s+in\s*\('moderator',\s*'admin'\)\s*\)\s*;/i;
      expect(bulletinPolicyRegex.test(fullSql)).toBe(true);
    });

    it("preserves default-deny by avoiding unspecified permissive policies on internal tables", () => {
      const internalTables = [
        "country",
        "ward",
        "asset_type",
        "source_document",
        "asset",
        "inspection_task",
        "service",
        "statutory_rule",
        "visit_outcome",
        "repair_ticket",
        "probation_ping",
        "outbox_message",
        "audit_event",
        "idempotency_record",
      ];

      for (const table of internalTables) {
        // Must NOT have any permissive policy (e.g. using (true))
        const permissiveRegex = new RegExp(
          `create\\s+policy\\s+[a-z0-9_]+\\s+on\\s+${table}\\s+for\\s+[a-z]+\\s+using\\s*\\(\\s*true\\s*\\)`,
          "i"
        );
        expect(
          permissiveRegex.test(fullSql),
          `Table '${table}' must not have an unspecified permissive policy`
        ).toBe(false);
      }
    });

    it("enforces append-only immutability rules on audit_event per 03-data-model.md §10", () => {
      const noUpdateRegex = /create\s+rule\s+audit_no_update\s+as\s+on\s+update\s+to\s+audit_event\s+do\s+instead\s+nothing\s*;/i;
      const noDeleteRegex = /create\s+rule\s+audit_no_delete\s+as\s+on\s+delete\s+to\s+audit_event\s+do\s+instead\s+nothing\s*;/i;
      expect(noUpdateRegex.test(fullSql)).toBe(true);
      expect(noDeleteRegex.test(fullSql)).toBe(true);
    });

    it("enforces TRUNCATE immutability seal trigger on audit_event per 012_audit_truncate_seal.sql", () => {
      const triggerRegex = /create\s+trigger\s+audit_no_truncate\s+before\s+truncate\s+on\s+audit_event\s+for\s+each\s+statement\s+execute\s+function\s+seal_truncate_immutability\(\)\s*;/i;
      expect(triggerRegex.test(fullSql)).toBe(true);
      expect(/alter\s+table\s+audit_event\s+enable\s+always\s+trigger\s+audit_no_truncate\s*;/i.test(fullSql)).toBe(true);
    });

    it("enforces privacy invariants: no coordinates and no voice transcripts", () => {
      expect(/latitude|longitude/i.test(fullSql)).toBe(false);
      expect(/\btranscript\b/i.test(fullSql)).toBe(false);
    });
  });

  describe.skipIf(!hasLiveDatabase)(
    "Level 3: Behavioral Database RLS Tests (Requires Live PostgreSQL/Supabase)",
    () => {
      it("asserts every table has rowsecurity = true via pg_tables query", async () => {
        const { getPostgresPool } = await import("@/infra/db/postgres/pool");
        const pool = getPostgresPool();
        const res = await pool.query(
          `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public'`
        );
        expect(res.rows.length).toBeGreaterThan(0);
        for (const expectedTable of ALL_EXPECTED_TABLES) {
          const row = res.rows.find((r: { tablename: string }) => r.tablename === expectedTable);
          expect(row, `Table ${expectedTable} must exist`).toBeDefined();
          expect(row.rowsecurity, `Table ${expectedTable} must have rowsecurity = true`).toBe(true);
        }
      });

      it("anon client returns zero rows from respondent", async () => {
        const { getPostgresPool } = await import("@/infra/db/postgres/pool");
        const pool = getPostgresPool();
        const client = await pool.connect();
        try {
          await client.query("SET ROLE anon");
          const res = await client.query("SELECT * FROM respondent");
          expect(res.rows.length).toBe(0);
        } finally {
          await client.query("RESET ROLE");
          client.release();
        }
      });

      it("anon client returns zero rows from voice_note", async () => {
        const { getPostgresPool } = await import("@/infra/db/postgres/pool");
        const pool = getPostgresPool();
        const client = await pool.connect();
        try {
          await client.query("SET ROLE anon");
          const res = await client.query("SELECT * FROM voice_note");
          expect(res.rows.length).toBe(0);
        } finally {
          await client.query("RESET ROLE");
          client.release();
        }
      });

      it("anon client returns zero rows from observation", async () => {
        const { getPostgresPool } = await import("@/infra/db/postgres/pool");
        const pool = getPostgresPool();
        const client = await pool.connect();
        try {
          await client.query("SET ROLE anon");
          const res = await client.query("SELECT * FROM observation");
          expect(res.rows.length).toBe(0);
        } finally {
          await client.query("RESET ROLE");
          client.release();
        }
      });

      it("anon client returns zero rows from audit_event", async () => {
        const { getPostgresPool } = await import("@/infra/db/postgres/pool");
        const pool = getPostgresPool();
        const client = await pool.connect();
        try {
          await client.query("SET ROLE anon");
          const res = await client.query("SELECT * FROM audit_event");
          expect(res.rows.length).toBe(0);
        } finally {
          await client.query("RESET ROLE");
          client.release();
        }
      });

      it("anon client returns zero rows from divergence_aggregate while k_satisfied = false", async () => {
        const { getPostgresPool } = await import("@/infra/db/postgres/pool");
        const pool = getPostgresPool();
        const client = await pool.connect();
        try {
          await client.query("SET ROLE anon");
          const res = await client.query("SELECT * FROM divergence_aggregate WHERE k_satisfied = false");
          expect(res.rows.length).toBe(0);
        } finally {
          await client.query("RESET ROLE");
          client.release();
        }
      });

      it("anon client can read project rows (public read permitted)", async () => {
        const { getPostgresPool } = await import("@/infra/db/postgres/pool");
        const pool = getPostgresPool();
        const client = await pool.connect();
        try {
          await client.query("SET ROLE anon");
          const res = await client.query("SELECT * FROM project");
          expect(Array.isArray(res.rows)).toBe(true);
        } finally {
          await client.query("RESET ROLE");
          client.release();
        }
      });

      it("runtime proof: rejects TRUNCATE on audit_event with IMMUTABILITY VIOLATION", async () => {
        const { getPostgresPool } = await import("@/infra/db/postgres/pool");
        const pool = getPostgresPool();
        const client = await pool.connect();
        try {
          await expect(client.query("TRUNCATE TABLE audit_event")).rejects.toThrow(
            /IMMUTABILITY VIOLATION/i
          );
        } finally {
          client.release();
        }
      });

      it("runtime proof: UPDATE on audit_event affects 0 rows due to audit_no_update rule", async () => {
        const { getPostgresPool } = await import("@/infra/db/postgres/pool");
        const pool = getPostgresPool();
        const client = await pool.connect();
        try {
          const res = await client.query(
            "UPDATE audit_event SET entity_type = 'tampered' WHERE seq = 1"
          );
          expect(res.rowCount).toBe(0);
        } finally {
          client.release();
        }
      });

      it("runtime proof: DELETE on audit_event affects 0 rows due to audit_no_delete rule", async () => {
        const { getPostgresPool } = await import("@/infra/db/postgres/pool");
        const pool = getPostgresPool();
        const client = await pool.connect();
        try {
          const res = await client.query("DELETE FROM audit_event WHERE seq = 1");
          expect(res.rowCount).toBe(0);
        } finally {
          client.release();
        }
      });
    }
  );
});
