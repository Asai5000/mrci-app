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

  console.log("✅ Database initialized successfully.");
  process.exit(0);
}

initDb().catch((err) => {
  console.error("❌ Failed to initialize database:", err);
  process.exit(1);
});
