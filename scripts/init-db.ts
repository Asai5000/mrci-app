import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL ?? "file:./local.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function initDb() {
  console.log("Initializing database...");

  await client.execute(`
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
      gemini_raw_response TEXT,
      pharmacist_note TEXT,
      clinical_summary TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS medications (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
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
      sort_order INTEGER DEFAULT 0
    )
  `);

  await client.execute(`
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
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS pims_drugs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      drug_class TEXT NOT NULL,
      generic_names TEXT NOT NULL,
      target_patients TEXT,
      recommendation TEXT NOT NULL
    )
  `);

  // Migration: add PIMS detail columns if they don't exist
  for (const sql of [
    "ALTER TABLE pims_drugs ADD COLUMN applicable_generic_names TEXT",
    "ALTER TABLE pims_drugs ADD COLUMN drug_price_code TEXT",
    "ALTER TABLE pims_drugs ADD COLUMN atc_code TEXT",
  ]) {
    try { await client.execute(sql); } catch { /* already exists */ }
  }

  // Migration: add renal function columns if they don't exist
  const renalColumns = [
    "ALTER TABLE cases ADD COLUMN serum_creatinine REAL",
    "ALTER TABLE cases ADD COLUMN body_weight REAL",
    "ALTER TABLE cases ADD COLUMN calculated_crcl REAL",
    "ALTER TABLE cases ADD COLUMN calculated_egfr REAL",
  ];
  for (const sql of renalColumns) {
    try {
      await client.execute(sql);
    } catch {
      // Column already exists — ignore
    }
  }

  // Migration: rename pmis_drugs → pims_drugs (safe: drop empty new table first)
  try {
    const check = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='pmis_drugs'");
    if (check.rows.length > 0) {
      await client.execute("DROP TABLE IF EXISTS pims_drugs");
      await client.execute("ALTER TABLE pmis_drugs RENAME TO pims_drugs");
    }
  } catch { /* already done */ }

  // Migration: add optimization change tracking columns
  const changeTrackingColumns = [
    "ALTER TABLE medications ADD COLUMN change_type TEXT DEFAULT 'continued'",
    "ALTER TABLE medications ADD COLUMN original_mrci_a REAL",
    "ALTER TABLE medications ADD COLUMN original_mrci_b REAL",
    "ALTER TABLE medications ADD COLUMN override_dosage_form TEXT",
    "ALTER TABLE medications ADD COLUMN override_frequency TEXT",
    "ALTER TABLE medications ADD COLUMN override_dose TEXT",
    "ALTER TABLE medications ADD COLUMN is_added INTEGER DEFAULT 0",
  ];
  for (const sql of changeTrackingColumns) {
    try {
      await client.execute(sql);
    } catch {
      // Column already exists — ignore
    }
  }

  console.log("✅ Database initialized successfully.");
  process.exit(0);
}

initDb().catch((err) => {
  console.error("❌ Failed to initialize database:", err);
  process.exit(1);
});
