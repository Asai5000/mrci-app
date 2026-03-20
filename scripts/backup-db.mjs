/**
 * 本番 Turso DB → ローカル SQLite バックアップスクリプト
 * 使い方: node scripts/backup-db.mjs
 * 出力: backups/backup-YYYY-MM-DD.db
 */
import { createClient } from "@libsql/client";
import { mkdirSync } from "fs";

const PROD_URL = "libsql://mrci-app-asai5000.aws-ap-northeast-1.turso.io";
const PROD_TOKEN =
  "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzIxOTQwNTgsImlkIjoiMDE5YzllZmYtMmUwMS03ZmM2LWIzNWItZTUxODhmM2JjNmQzIiwicmlkIjoiNGI0YzZhOGItYzNkOC00NjYzLWI5MDUtMjI0OGEwMzk4MWE5In0.OmR7ID4_lxcHCC2E9TKCQ-_dDBWbXE-8sERvmKMQ4lAeTzxsRe10AQ6AHg5yp8uYm8wVzc78tg9eN_CkWG8RCA";

const date = new Date().toISOString().slice(0, 10);
mkdirSync("backups", { recursive: true });
const LOCAL_PATH = `file:./backups/backup-${date}.db`;

const prod = createClient({ url: PROD_URL, authToken: PROD_TOKEN });
const local = createClient({ url: LOCAL_PATH });

async function backup() {
  console.log(`📦 バックアップ開始: ${PROD_URL} → ${LOCAL_PATH}`);

  // ── スキーマ作成 ──────────────────────────────────────────────
  await local.executeMultiple(`
    CREATE TABLE IF NOT EXISTS cases (
      id TEXT PRIMARY KEY,
      patient_age_group TEXT NOT NULL,
      patient_gender TEXT,
      renal_function TEXT,
      raw_input_type TEXT NOT NULL DEFAULT 'text',
      raw_input_text TEXT,
      image_path TEXT,
      mrci_section_a REAL,
      mrci_section_b REAL,
      mrci_section_c REAL,
      mrci_total REAL,
      mrci_total_optimized REAL,
      serum_creatinine REAL,
      body_weight REAL,
      calculated_crcl REAL,
      calculated_egfr REAL,
      gemini_raw_response TEXT,
      pharmacist_note TEXT,
      clinical_summary TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS medications (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      drug_name TEXT NOT NULL,
      brand_name TEXT,
      dosage_form TEXT,
      route TEXT,
      dose TEXT,
      frequency TEXT,
      special_instructions TEXT,
      mrci_a REAL DEFAULT 0,
      mrci_b REAL DEFAULT 0,
      mrci_c REAL DEFAULT 0,
      is_continued INTEGER DEFAULT 1,
      optimization_note TEXT,
      pharmacist_approved INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      change_type TEXT DEFAULT 'continued',
      original_mrci_a REAL,
      original_mrci_b REAL,
      override_dosage_form TEXT,
      override_frequency TEXT,
      is_added INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS renal_dosing_guidelines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT,
      generic_name TEXT NOT NULL,
      drug_number INTEGER,
      brand_name TEXT,
      route_category TEXT NOT NULL DEFAULT 'oral',
      dialyzability TEXT,
      renal_damage TEXT,
      is_contraindicated INTEGER NOT NULL DEFAULT 0,
      dose_normal TEXT,
      dose_mild TEXT,
      dose_moderate TEXT,
      dose_severe TEXT,
      dose_hd_pd TEXT
    );
  `);

  // ── データコピー ──────────────────────────────────────────────
  const tables = ["cases", "medications", "renal_dosing_guidelines"];

  for (const table of tables) {
    const { rows } = await prod.execute(`SELECT * FROM ${table}`);
    if (rows.length === 0) {
      console.log(`  ⬜ ${table}: 0件`);
      continue;
    }

    // INSERT（既存行は REPLACE でスキップせず上書き）
    const cols = Object.keys(rows[0]).join(", ");
    const placeholders = Object.keys(rows[0]).map(() => "?").join(", ");

    for (const row of rows) {
      await local.execute({
        sql: `INSERT OR REPLACE INTO ${table} (${cols}) VALUES (${placeholders})`,
        args: Object.values(row),
      });
    }
    console.log(`  ✅ ${table}: ${rows.length}件`);
  }

  console.log(`\n✅ バックアップ完了: backups/backup-${date}.db`);
  process.exit(0);
}

backup().catch((e) => {
  console.error("❌ エラー:", e);
  process.exit(1);
});
