/**
 * PMISデータをDBにインポートするスクリプト
 * 使い方: npx tsx scripts/import-pmis.ts
 * 対象DB: TURSO_DATABASE_URL (ローカルまたは本番)
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@libsql/client";
import { readFileSync } from "fs";
import { resolve } from "path";

const PROD_URL = process.env.TURSO_AREMOTE_URL;
const AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;

// 引数で --prod を指定すると本番DBに投入
const isProd = process.argv.includes("--prod");

const client = createClient({
  url: isProd && PROD_URL ? PROD_URL : (process.env.TURSO_DATABASE_URL ?? "file:./local.db"),
  authToken: AUTH_TOKEN,
});

function cleanText(s: string): string {
  return s.replace(/\s*\+\d+\s*/g, "").trim();
}

function parseGenericNames(raw: string): string[] {
  const cleaned = cleanText(raw);
  return cleaned
    .split(/[、,，]/)
    .map((s) => s.replace(/など.*$/, "").trim())
    .filter(Boolean);
}

async function main() {
  console.log(`📥 PMISインポート先: ${isProd ? "本番Turso" : "ローカルDB"}`);

  // テーブル作成（なければ）
  await client.execute(`
    CREATE TABLE IF NOT EXISTS pmis_drugs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      drug_class TEXT NOT NULL,
      generic_names TEXT NOT NULL,
      target_patients TEXT,
      recommendation TEXT NOT NULL
    )
  `);

  // 既存データをクリア
  await client.execute("DELETE FROM pmis_drugs");

  const raw = readFileSync(resolve(process.cwd(), "pmis"), "utf-8");
  const lines = raw.trim().split("\n").slice(1); // ヘッダー行をスキップ

  let count = 0;
  for (const line of lines) {
    const cols = line.split(",");
    if (cols.length < 5) continue;

    const category = cleanText(cols[0]);
    const drugClass = cleanText(cols[1]);
    const genericNamesRaw = cleanText(cols[2]);
    const targetPatients = cleanText(cols[3]);
    const recommendation = cleanText(cols[4]);

    if (!category || !drugClass || !recommendation) continue;

    const genericNames = parseGenericNames(genericNamesRaw);

    await client.execute({
      sql: `INSERT INTO pmis_drugs (category, drug_class, generic_names, target_patients, recommendation)
            VALUES (?, ?, ?, ?, ?)`,
      args: [
        category,
        drugClass,
        JSON.stringify(genericNames),
        targetPatients || null,
        recommendation,
      ],
    });
    count++;
  }

  console.log(`✅ ${count}件インポート完了`);

  // 確認
  const { rows } = await client.execute("SELECT COUNT(*) as cnt FROM pmis_drugs");
  console.log(`   DB件数: ${rows[0][0]}件`);
  process.exit(0);
}

main().catch((e) => {
  console.error("❌ エラー:", e);
  process.exit(1);
});
