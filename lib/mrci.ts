// MRCI (Medication Regimen Complexity Index) スコア計算ロジック
// George et al. 2004 に基づく

// Section A: 剤形スコア
export const DOSAGE_FORM_SCORES: Record<string, number> = {
  // 経口固形
  錠剤: 1,
  カプセル: 1,
  口腔内崩壊錠: 1,
  チュアブル錠: 1,
  // 経口液体
  液剤: 2,
  シロップ: 2,
  懸濁液: 2,
  // 外用
  クリーム: 2,
  軟膏: 2,
  ゲル: 2,
  ローション: 2,
  貼付剤: 2,
  // 吸入
  吸入薬: 3,
  吸入粉末: 3,
  定量噴霧: 3,
  // 点眼・点鼻・点耳
  点眼液: 3,
  点鼻液: 3,
  点耳液: 3,
  点眼薬: 3,
  点鼻薬: 3,
  // 注射
  注射プレフィルド: 3,
  注射バイアル: 4,
  注射アンプル: 4,
  // その他
  坐剤: 3,
  舌下錠: 2,
  バッカル錠: 2,
  パッチ: 2,
};

// Section B: 投与頻度スコア
export const FREQUENCY_SCORES: Record<string, number> = {
  必要時: 0.5,
  "PRN": 0.5,
  "週1回": 0.5,
  "週2回": 1,
  "週3回": 1,
  "隔日": 1,
  "1日1回": 1,
  "1日2回": 2,
  "1日3回": 3,
  "1日4回": 4,
  "1日4回以上": 4,
  "毎食後": 3,
  "毎食前": 3,
};

// Section C: 特別指示スコア（各指示で加算）
export const SPECIAL_INSTRUCTION_SCORES: Record<string, number> = {
  食前: 0.5,
  食後: 0.5,
  食間: 0.5,
  就寝前: 0.5,
  起床時: 0.5,
  空腹時: 0.5,
  粉砕: 1,
  簡易懸濁: 1,
  一包化不可: 0.5,
  隔日投与: 1,
  交互投与: 1,
  "水分制限": 0.5,
  "冷所保存": 0.5,
  遮光: 0.5,
  振って使用: 0.5,
  "使用前混合": 1,
};

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

export function calculateMRCIForMedication(med: MRCIMedication): MRCIScore {
  // Section A: 剤形
  let sectionA = 0;
  for (const [form, score] of Object.entries(DOSAGE_FORM_SCORES)) {
    if (med.dosageForm?.includes(form)) {
      sectionA = score;
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

  // Section C: 特別指示
  let sectionC = 0;
  for (const instruction of med.specialInstructions ?? []) {
    for (const [key, score] of Object.entries(SPECIAL_INSTRUCTION_SCORES)) {
      if (instruction.includes(key)) {
        sectionC += score;
      }
    }
  }

  return {
    sectionA,
    sectionB,
    sectionC,
    total: sectionA + sectionB + sectionC,
  };
}

export function calculateTotalMRCI(medications: MRCIMedication[]): {
  sectionATotal: number;
  sectionBTotal: number;
  sectionCTotal: number;
  grandTotal: number;
} {
  let sectionATotal = 0;
  let sectionBTotal = 0;
  let sectionCTotal = 0;

  for (const med of medications) {
    const score = calculateMRCIForMedication(med);
    sectionATotal += score.sectionA;
    sectionBTotal += score.sectionB;
    sectionCTotal += score.sectionC;
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
