/**
 * 腎機能投与量ガイドライン → Turso（本番DB）インポートスクリプト
 */

import { createClient } from "@libsql/client";
import { readFileSync } from "fs";
import { join, resolve } from "path";

const url = process.env.TURSO_DATABASE_URL!;
const authToken = process.env.TURSO_AUTH_TOKEN;
const client = createClient({ url, authToken });

interface RenalRow {
  category: string | null;
  generic_name: string;
  drug_number: number | null;
  brand_name: string | null;
  route_category: string;
  dialyzability: string | null;
  renal_damage: string | null;
  is_contraindicated: number;
  dose_normal: string | null;
  dose_mild: string | null;
  dose_moderate: string | null;
  dose_severe: string | null;
  dose_hd_pd: string | null;
}

async function main() {
  console.log(`🔗 接続先: ${url}`);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS renal_dosing_guidelines (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      category           TEXT,
      generic_name       TEXT NOT NULL,
      drug_number        INTEGER,
      brand_name         TEXT,
      route_category     TEXT NOT NULL DEFAULT 'oral',
      dialyzability      TEXT,
      renal_damage       TEXT,
      is_contraindicated INTEGER NOT NULL DEFAULT 0,
      dose_normal        TEXT,
      dose_mild          TEXT,
      dose_moderate      TEXT,
      dose_severe        TEXT,
      dose_hd_pd         TEXT
    )
  `);

  await client.execute("DELETE FROM renal_dosing_guidelines");
  console.log("🗑️  既存データをクリアしました");

  const dataPath = join(process.cwd(), "scripts", "renal-data.json");
  const rows: RenalRow[] = JSON.parse(readFileSync(dataPath, "utf-8"));
  console.log(`📂 ${rows.length} 件のデータを読み込みました`);

  const BATCH = 10;
  let imported = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const stmts = batch.map((r) => ({
      sql: `INSERT INTO renal_dosing_guidelines
              (category, generic_name, drug_number, brand_name, route_category,
               dialyzability, renal_damage, is_contraindicated,
               dose_normal, dose_mild, dose_moderate, dose_severe, dose_hd_pd)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        r.category, r.generic_name, r.drug_number ?? null, r.brand_name, r.route_category,
        r.dialyzability, r.renal_damage, r.is_contraindicated,
        r.dose_normal, r.dose_mild, r.dose_moderate, r.dose_severe, r.dose_hd_pd,
      ],
    }));
    await client.batch(stmts, "write");
    imported += batch.length;
    process.stdout.write(`\r  ${imported}/${rows.length} 件インポート中...`);
  }

  console.log(`\n✅ インポート完了: ${imported} 件登録`);
  const result = await client.execute("SELECT COUNT(*) as cnt FROM renal_dosing_guidelines");
  console.log(`   DB確認: ${result.rows[0].cnt} 件`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ エラー:", err.message ?? err);
  process.exit(1);
});
