#!/usr/bin/env python3
"""
日本腎臓病薬物療法学会 腎機能低下時薬剤投与量一覧 CSV → SQLite インポートスクリプト
Usage: python3 scripts/import-renal.py
"""

import csv
import re
import sqlite3
import os
import sys

CSV_PATH = os.path.join(os.path.dirname(__file__), "../../腎機能一覧 - シート1.csv")
DB_PATH  = os.path.join(os.path.dirname(__file__), "../local.db")

# 投与経路分類キーワード（優先順位: 注射 > 外用 > 吸入 > 内服）
INJECTION_KEYWORDS  = ["注射", "筋注", "静注", "点滴", "皮下注", "アンプル", "バイアル",
                        "シリンジ", "注用", "注液", "静脈", "筋肉"]
TOPICAL_KEYWORDS    = ["軟膏", "クリーム", "ゲル", "ローション", "貼付", "パッチ", "テープ",
                        "坐剤", "坐薬", "点眼", "点鼻", "点耳", "外用", "経皮", "噴霧"]
INHALATION_KEYWORDS = ["吸入", "エアロゾル", "ネブライザー"]
# 内服はデフォルト（錠・カプセル・散・細粒・シロップ・内用液・OD錠・DS 等）

def classify_route(brand_name) -> str:
    """商品名から投与経路カテゴリを推定する"""
    if not brand_name:
        return "unknown"
    for kw in INJECTION_KEYWORDS:
        if kw in brand_name:
            return "injection"
    for kw in TOPICAL_KEYWORDS:
        if kw in brand_name:
            return "topical"
    for kw in INHALATION_KEYWORDS:
        if kw in brand_name:
            return "inhalation"
    return "oral"  # デフォルトは内服

def clean(text):
    """引用マーカー等を除去して整形"""
    if not text:
        return None
    text = re.sub(r'\[cite_start\]', '', text)
    text = re.sub(r'\[cite:\s*\d+\]', '', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = text.strip()
    return text if text else None

def main():
    if not os.path.exists(CSV_PATH):
        print(f"❌ CSVファイルが見つかりません: {CSV_PATH}", file=sys.stderr)
        sys.exit(1)
    if not os.path.exists(DB_PATH):
        print(f"❌ DBファイルが見つかりません: {DB_PATH}", file=sys.stderr)
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # テーブル作成（既存データはクリア）
    cursor.execute("DROP TABLE IF EXISTS renal_dosing_guidelines")
    cursor.execute("""
        CREATE TABLE renal_dosing_guidelines (
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
    """)

    imported = 0
    skipped  = 0
    route_counts = {"oral": 0, "injection": 0, "topical": 0, "inhalation": 0, "unknown": 0}

    with open(CSV_PATH, encoding="utf-8", newline="") as f:
        reader = csv.reader(f)
        next(reader)  # ヘッダー行をスキップ

        for row in reader:
            if len(row) < 8:
                skipped += 1
                continue

            category            = clean(row[0])
            generic_name        = clean(row[1])
            drug_number_s       = clean(row[2])
            brand_name          = clean(row[3])
            dialyzability       = clean(row[4])
            renal_damage        = clean(row[5])
            contraindicated_raw = clean(row[6])
            dose_normal         = clean(row[7])
            dose_mild           = clean(row[8])  if len(row) > 8  else None
            dose_moderate       = clean(row[9])  if len(row) > 9  else None
            dose_severe         = clean(row[10]) if len(row) > 10 else None
            dose_hd_pd          = clean(row[11]) if len(row) > 11 else None

            if not generic_name:
                skipped += 1
                continue

            is_contraindicated = 1 if contraindicated_raw == "禁" else 0
            route_category     = classify_route(brand_name)
            route_counts[route_category] += 1

            try:
                drug_number = int(drug_number_s) if drug_number_s else None
            except ValueError:
                drug_number = None

            cursor.execute("""
                INSERT INTO renal_dosing_guidelines (
                    category, generic_name, drug_number, brand_name, route_category,
                    dialyzability, renal_damage, is_contraindicated,
                    dose_normal, dose_mild, dose_moderate, dose_severe, dose_hd_pd
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                category, generic_name, drug_number, brand_name, route_category,
                dialyzability, renal_damage, is_contraindicated,
                dose_normal, dose_mild, dose_moderate, dose_severe, dose_hd_pd
            ))
            imported += 1

    conn.commit()
    conn.close()

    print(f"✅ インポート完了: {imported} 件登録, {skipped} 件スキップ")
    print(f"   内服: {route_counts['oral']} / 注射: {route_counts['injection']} / "
          f"外用: {route_counts['topical']} / 吸入: {route_counts['inhalation']} / "
          f"不明: {route_counts['unknown']}")

if __name__ == "__main__":
    main()
