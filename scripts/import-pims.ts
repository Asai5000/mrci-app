/**
 * PIMSデータをDBにインポートするスクリプト
 * 使い方:
 *   ローカル: npx tsx scripts/import-pims.ts
 *   本番:    npx tsx scripts/import-pims.ts --prod
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@libsql/client";
import { readFileSync } from "fs";
import { resolve } from "path";

const PROD_URL = process.env.TURSO_AREMOTE_URL;
const AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;
const isProd = process.argv.includes("--prod");

const client = createClient({
  url: isProd && PROD_URL ? PROD_URL : (process.env.TURSO_DATABASE_URL ?? "file:./local.db"),
  authToken: AUTH_TOKEN,
});

function clean(s: string): string {
  return s.replace(/\s*\+\d+\s*/g, "").trim();
}

/** "Aなど、B" → ["A", "B"] */
function parseRepresentativeNames(raw: string): string[] {
  return clean(raw)
    .split(/[、,，]/)
    .map((s) => s.replace(/など.*$/, "").trim())
    .filter(Boolean);
}

/** 該当する一般名: スペース区切りまたは全角スペース区切りの単語リスト */
function parseApplicableNames(raw: string): string[] {
  return clean(raw)
    .split(/[\s　]+/)
    .map((s) => s.replace(/（再掲）$/, "").replace(/\(再掲\)$/, "").trim())
    .filter(Boolean);
}

async function main() {
  console.log(`📥 PIMSインポート先: ${isProd ? "本番Turso" : "ローカルDB"}`);

  // テーブル作成（なければ）
  await client.execute(`
    CREATE TABLE IF NOT EXISTS pims_drugs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      drug_class TEXT NOT NULL,
      generic_names TEXT NOT NULL,
      target_patients TEXT,
      recommendation TEXT NOT NULL,
      applicable_generic_names TEXT,
      drug_price_code TEXT,
      atc_code TEXT
    )
  `);

  // カラムが既存テーブルに存在しない場合は追加
  for (const sql of [
    "ALTER TABLE pims_drugs ADD COLUMN applicable_generic_names TEXT",
    "ALTER TABLE pims_drugs ADD COLUMN drug_price_code TEXT",
    "ALTER TABLE pims_drugs ADD COLUMN atc_code TEXT",
  ]) {
    try { await client.execute(sql); } catch { /* already exists */ }
  }

  // 既存データをクリア
  await client.execute("DELETE FROM pims_drugs");

  const raw = readFileSync(resolve(process.cwd(), "pims"), "utf-8");
  const lines = raw.trim().split("\n").slice(1); // ヘッダーをスキップ

  let count = 0;
  for (const line of lines) {
    // CSVパース（カンマ区切り、ただし各セルに読点が含まれるため列数で分割）
    const cols = line.split(",");
    if (cols.length < 5) continue;

    // 列: 分類,薬物クラス,代表的な一般名,対象患者群,推奨される使用法,該当する一般名,薬価コード,ATCコード
    const category          = clean(cols[0]);
    const drugClass         = clean(cols[1]);
    const genericNamesRaw   = clean(cols[2]);
    const targetPatients    = clean(cols[3]);
    const recommendation    = clean(cols[4]);
    const applicableRaw = cols[5] ? clean(cols[5]) : "";

    if (!category || !drugClass || !recommendation) continue;

    const genericNames = parseRepresentativeNames(genericNamesRaw);
    const applicableNames = parseApplicableNames(applicableRaw);

    await client.execute({
      sql: `INSERT INTO pims_drugs
              (category, drug_class, generic_names, target_patients, recommendation,
               applicable_generic_names)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        category,
        drugClass,
        JSON.stringify(genericNames),
        targetPatients || null,
        recommendation,
        applicableNames.length ? JSON.stringify(applicableNames) : null,
      ],
    });
    count++;
  }

  console.log(`✅ ${count}件インポート完了`);
  const { rows } = await client.execute("SELECT COUNT(*) as cnt FROM pims_drugs");
  console.log(`   DB件数: ${rows[0][0]}件`);
  process.exit(0);
}

main().catch((e) => {
  console.error("❌ エラー:", e);
  process.exit(1);
});
