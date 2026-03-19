// MRCI (Medication Regimen Complexity Index) スコア計算ロジック
// George et al. 2004 / University of Colorado Access DB より逆解析

// ── Section A: 剤形カテゴリ（原典VBAの各チェックボックスに対応） ─────────────
// 処方全体で剤形種別ごとに1回のみカウント（重複排除）

export interface DosageFormCategory {
  categoryId: string;
  score: number;
  keys: string[]; // この剤形カテゴリに該当するキーワード（前方一致）
}

// 順序重要: より具体的なカテゴリを先に置く（MDI > DPI など）
export const DOSAGE_FORM_CATEGORY_LIST: DosageFormCategory[] = [
  // スコア 1
  { categoryId: "tab_capsule",       score: 1, keys: ["錠剤", "カプセル", "口腔内崩壊錠", "OD錠", "チュアブル錠"] },
  { categoryId: "topical_spray",     score: 1, keys: ["外用スプレー"] },
  // スコア 2
  { categoryId: "gargle",            score: 2, keys: ["うがい薬", "含嗽薬"] },
  { categoryId: "buccal_gum",        score: 2, keys: ["バッカル錠", "ガム剤"] },
  { categoryId: "liquids",           score: 2, keys: ["液剤", "内服液", "シロップ", "懸濁液", "ドライシロップ"] },
  { categoryId: "powders",           score: 2, keys: ["散剤", "顆粒", "細粒"] },
  { categoryId: "sublingual",        score: 2, keys: ["舌下錠", "舌下"] },
  { categoryId: "creams_ointments",  score: 2, keys: ["クリーム", "軟膏", "ゲル", "ローション"] },
  { categoryId: "paints",            score: 2, keys: ["外用塗布薬", "塗布薬"] },
  { categoryId: "patches",           score: 2, keys: ["貼付剤", "パッチ", "テープ"] },
  { categoryId: "nasal_spray",       score: 2, keys: ["点鼻スプレー"] },
  { categoryId: "enemas",            score: 2, keys: ["浣腸"] },
  { categoryId: "suppositories",     score: 2, keys: ["坐剤", "坐薬"] },
  { categoryId: "vaginal",           score: 2, keys: ["膣用製剤", "膣坐剤"] },
  // スコア 3
  { categoryId: "pastes",            score: 3, keys: ["ペースト剤"] },
  { categoryId: "ear_drops",         score: 3, keys: ["点耳液", "点耳薬"] },
  { categoryId: "eye_drops",         score: 3, keys: ["点眼液", "点眼薬"] },
  { categoryId: "eye_gels",          score: 3, keys: ["点眼ゲル"] },
  { categoryId: "nasal_drops",       score: 3, keys: ["点鼻液"] }, // 点鼻スプレー(2)とは別
  { categoryId: "dpi",               score: 3, keys: ["吸入粉末", "吸入薬", "DPI"] },
  { categoryId: "oxygen",            score: 3, keys: ["酸素療法", "酸素吸入"] },
  { categoryId: "prefilled_syringe", score: 3, keys: ["注射プレフィルド", "プレフィルドシリンジ", "プレフィルド"] },
  // スコア 4（MDI > DPI より先に記載して優先マッチ）
  { categoryId: "mdi",               score: 4, keys: ["定量噴霧", "MDI", "pMDI", "エアゾール吸入", "レスピマット"] },
  { categoryId: "inj_ampoule_vial",  score: 4, keys: ["注射バイアル", "注射アンプル", "バイアル", "アンプル", "注射液", "点滴"] },
  // スコア 5
  { categoryId: "nebuliser",         score: 5, keys: ["ネブライザー", "ネブライゼーション"] },
];

// UIドロップダウン用: 全キーを数値スコアにマップ（CaseDetailClient.tsx で import）
export const DOSAGE_FORM_SCORES: Record<string, number> = Object.fromEntries(
  DOSAGE_FORM_CATEGORY_LIST.flatMap((c) => c.keys.map((k) => [k, c.score]))
);

// ── Section B: 投与頻度スコア ────────────────────────────────────────────────
// 原典 VBA の乗数を忠実に再現（PRN ≈ 定期の半分）

export const FREQUENCY_SCORES: Record<string, number> = {
  // 定期投与
  "1日1回":   1,
  "1日2回":   2,
  "1日3回":   3,
  "1日4回":   4,
  "毎食後":   3,
  "毎食前":   3,
  "1日4回以上": 4,
  "Q12H":    2.5,
  "Q8H":     3.5,
  "Q6H":     4.5,
  "Q4H":     6.5,
  "Q2H":    12.5,
  "隔日":     2,
  "週2回":    1,
  "週3回":    1,
  "週1回":    0.5,
  // PRN（頓服・必要時）
  "必要時":   0.5,
  "PRN":      0.5,
  "1日1回頓服": 0.5,
  "1日2回頓服": 1,
  "1日3回頓服": 1.5,
  "1日4回頓服": 2,
  "Q12H頓服": 1.5,
  "Q8H頓服":  2,
  "Q6H頓服":  2.5,
  "Q4H頓服":  3.5,
  "Q2H頓服":  6.5,
  // 酸素療法（特殊）
  "酸素頓用":     1,
  "酸素15時間未満": 2,
  "酸素15時間以上": 3,
};

// ── Section C: 特別指示カテゴリ（原典9カテゴリ） ──────────────────────────────
// 1薬剤ごとに各カテゴリに該当するか判定し、該当カテゴリのスコアを加算。
// 同一カテゴリ内に複数の指示があっても1回のみカウント。

export interface SectionCCategory {
  categoryId: string;
  score: number;
  keywords: string[];
}

export const SECTION_C_CATEGORY_LIST: SectionCCategory[] = [
  { categoryId: "break",          score: 1, keywords: ["粉砕", "割錠", "半錠"] },
  { categoryId: "dissolve",       score: 1, keywords: ["溶解", "簡易懸濁"] },
  { categoryId: "multiple",       score: 1, keywords: ["複数錠"] },
  { categoryId: "variable",       score: 1, keywords: ["変量", "増減", "1〜", "2〜", "症状により"] },
  { categoryId: "specified_time", score: 1, keywords: ["就寝前", "起床時", "起床直後", "就寝時"] },
  { categoryId: "food_relation",  score: 1, keywords: ["食前", "食後", "食間", "空腹時", "食直前", "食直後"] },
  { categoryId: "take_use",       score: 2, keywords: ["使用法", "吸入手順", "点眼方法", "点眼法", "注射方法", "使用方法"] },
  { categoryId: "tapering",       score: 2, keywords: ["漸増", "漸減", "テーパー", "tapering"] },
  { categoryId: "alternating",    score: 2, keywords: ["交互投与", "交互"] },
];

// ── 計算関数 ──────────────────────────────────────────────────────────────────

/**
 * 剤形文字列から最初にマッチするカテゴリを返す（UIの重複排除表示に使用）
 */
export function getFormCategory(dosageForm: string | null | undefined): DosageFormCategory | null {
  if (!dosageForm) return null;
  for (const category of DOSAGE_FORM_CATEGORY_LIST) {
    if (category.keys.some((key) => dosageForm.includes(key))) {
      return category;
    }
  }
  return null;
}

/**
 * Section A: 処方全体の剤形を重複排除してスコアを計算
 * 各剤形文字列を最初にマッチしたカテゴリに割り当て、カテゴリごとに1回だけカウント
 */
export function calculateSectionA(dosageForms: string[]): number {
  const hitCategories = new Set<string>();
  for (const form of dosageForms) {
    if (!form) continue;
    for (const category of DOSAGE_FORM_CATEGORY_LIST) {
      if (category.keys.some((key) => form.includes(key))) {
        hitCategories.add(category.categoryId);
        break; // 各剤形は最初にマッチしたカテゴリに割り当て
      }
    }
  }
  let total = 0;
  for (const catId of hitCategories) {
    const cat = DOSAGE_FORM_CATEGORY_LIST.find((c) => c.categoryId === catId);
    if (cat) total += cat.score;
  }
  return total;
}

/**
 * Section C: 薬剤1剤の特別指示をカテゴリで重複排除してスコアを計算
 */
export function calculateSectionC(instructions: string[]): number {
  let total = 0;
  for (const category of SECTION_C_CATEGORY_LIST) {
    const hit = category.keywords.some((kw) =>
      instructions.some((inst) => inst?.includes(kw))
    );
    if (hit) total += category.score;
  }
  return total;
}

export interface MRCIMedication {
  drugName: string;
  dosageForm: string;
  frequency: string;
  specialInstructions: string[];
}

export interface MRCIScore {
  sectionA: number;
  sectionB: number;
  sectionC: number;
  total: number;
}

/**
 * 薬剤1剤のMRCIスコアを計算（sectionA は個別剤形スコア）
 * 注意: 処方全体の Section A は calculateSectionA() で重複排除する
 */
export function calculateMRCIForMedication(med: MRCIMedication): MRCIScore {
  // Section A: 剤形（個別スコア — 処方全体の重複排除は calculateTotalMRCI で行う）
  let sectionA = 0;
  for (const category of DOSAGE_FORM_CATEGORY_LIST) {
    if (category.keys.some((key) => med.dosageForm?.includes(key))) {
      sectionA = category.score;
      break;
    }
  }
  if (sectionA === 0) sectionA = 1; // デフォルト: 錠剤相当

  // Section B: 頻度
  let sectionB = 0;
  for (const [freq, score] of Object.entries(FREQUENCY_SCORES)) {
    if (med.frequency?.includes(freq)) {
      sectionB = score;
      break;
    }
  }
  if (sectionB === 0) sectionB = 1; // デフォルト: 1日1回

  // Section C: 特別指示（カテゴリで重複排除）
  const sectionC = calculateSectionC(med.specialInstructions ?? []);

  return { sectionA, sectionB, sectionC, total: sectionA + sectionB + sectionC };
}

/**
 * 処方全体のMRCIスコアを計算
 * Section A は剤形種類で重複排除、Section B/C は薬剤ごとに集計
 */
export function calculateTotalMRCI(medications: MRCIMedication[]): {
  sectionATotal: number;
  sectionBTotal: number;
  sectionCTotal: number;
  grandTotal: number;
} {
  // Section A: 剤形の種類を重複排除
  const sectionATotal = calculateSectionA(medications.map((m) => m.dosageForm));

  // Section B/C: 薬剤ごとに集計
  let sectionBTotal = 0;
  let sectionCTotal = 0;
  for (const med of medications) {
    const { sectionB, sectionC } = calculateMRCIForMedication(med);
    sectionBTotal += sectionB;
    sectionCTotal += sectionC;
  }

  return {
    sectionATotal,
    sectionBTotal,
    sectionCTotal,
    grandTotal: sectionATotal + sectionBTotal + sectionCTotal,
  };
}

// MRCIスコアの複雑度評価
export function getMRCILevel(total: number): {
  level: "low" | "medium" | "high";
  label: string;
  description: string;
} {
  if (total < 10) {
    return { level: "low", label: "低", description: "比較的シンプルな処方" };
  } else if (total < 20) {
    return { level: "medium", label: "中", description: "中程度の複雑さ" };
  } else {
    return { level: "high", label: "高", description: "高度に複雑な処方 — 重点的な介入推奨" };
  }
}
