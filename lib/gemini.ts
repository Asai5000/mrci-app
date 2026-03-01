import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface ExtractedMedication {
  drug_name: string;
  brand_name: string;
  dosage_form: string;
  route: string;
  dose: string;
  frequency: string;
  special_instructions: string[];
  mrci_a: number;
  mrci_b: number;
  mrci_c: number;
}

export interface OptimizationSuggestion {
  target_drug: string;
  suggestion_type:
    | "簡易懸濁法導入"
    | "一包化統合"
    | "投与回数削減"
    | "中止検討"
    | "代替剤形"
    | "投与タイミング統合"
    | "配合剤への変更"
    | "腎機能考慮減量"
    | "腎機能考慮中止";
  detail: string;
  expected_mrci_reduction: number;
  rationale: string;
  priority: "high" | "medium" | "low";
}

export interface RenalData {
  serumCreatinine: number; // mg/dL
  bodyWeight?: number;     // kg
  crcl?: number;           // mL/min (Cockcroft-Gault)
  egfr?: number;           // mL/min/1.73m² (Japanese equation)
}

export interface GeminiAnalysisResult {
  extracted_medications: ExtractedMedication[];
  mrci_summary: {
    section_a_total: number;
    section_b_total: number;
    section_c_total: number;
    total: number;
  };
  optimization_suggestions: OptimizationSuggestion[];
  optimized_mrci_total: number;
  clinical_notes: string;
}

const MRCI_SYSTEM_PROMPT = `あなたは薬剤師の持参薬鑑別業務を支援するAIです。
入力された処方情報を解析し、以下のMRCI（Medication Regimen Complexity Index）ルールに従ってスコアを算出し、JSON形式で出力してください。

【MRCI計算ルール】

Section A（剤形スコア）:
- 錠剤・カプセル・口腔内崩壊錠: 1点
- 液剤・シロップ・懸濁液（内服）: 2点
- クリーム・軟膏・ゲル・ローション: 2点
- 貼付剤・パッチ: 2点
- 舌下錠・バッカル錠: 2点
- 吸入薬（DPI/pMDI）: 3点
- 点眼液・点鼻液・点耳液: 3点
- 注射（プレフィルドシリンジ）: 3点
- 注射（バイアル・アンプル）: 4点
- 坐剤: 3点

Section B（投与頻度スコア）:
- 必要時（PRN）: 0.5点
- 週1回: 0.5点
- 週2〜3回・隔日: 1点
- 1日1回: 1点
- 1日2回: 2点
- 1日3回（毎食後・毎食前含む）: 3点
- 1日4回以上: 4点

Section C（特別指示 — 該当するものを加算）:
- 食前・食後・食間・就寝前・起床時・空腹時: 各0.5点
- 粉砕・簡易懸濁が必要: 1点
- 一包化不可: 0.5点
- 隔日投与・交互投与: 1点
- 冷所保存・遮光保存: 各0.5点

各薬剤のMRCI = Section A + Section B + Section C
総MRCI = 全薬剤のスコア合計

【薬剤情報の参照・記載ルール — 必ず遵守すること】
処方最適化・腎機能考慮の提案を行う際は、以下のルールを厳守してください:

1. 情報源: PMDA（独立行政法人医薬品医療機器総合機構）または製薬会社公式サイトに掲載されている「日本の添付文書」のみを根拠とすること。
2. 【最最優先】禁忌の確認: 各薬剤について「禁忌」の項を必ず最初に確認すること。禁忌に該当する場合は、他のいかなる検討よりも優先して priority を \"high\" で報告すること。禁忌の見落としは絶対に許容されない。
3. 優先順位（高→低）: ①禁忌 → ②警告・原則禁忌 → ③慎重投与 → ④用法及び用量（用量上限・投与間隔）の順で確認すること。用量評価においては「維持量」ではなく、現在の患者の状態（腎機能・年齢・体重・疾患等）における「最大許容量」を超過していないかを必ず確認すること。
4. 除外項目: 「薬物動態」の項（Tmax・t1/2・AUC・蛋白結合率等）からは情報を参照しないこと。
5. 確実性の原則: 確認された公式情報に基づく内容のみ記載すること。情報が不確かな場合や添付文書上の記載が確認できない場合は、推測で答えず rationale に「添付文書上の確認が必要」と明記すること。
6. ハルシネーション防止: 記憶のみに頼った薬剤情報（用量・禁忌・相互作用等）の記載は行わないこと。根拠が不明確な提案は suggestion として出力しないこと。

【処方最適化の観点】
以下の視点で処方スリム化の提案を行ってください:
1. 同一成分の配合剤・合剤への変更
2. 投与回数が少ない製剤への変更（例: 1日3回→1日1回）
3. より単純な剤形への変更（例: バイアル→プレフィルド、液剤→錠剤）
4. 投与タイミングの統合（例: 食前・食後をまとめて食後に）
5. 臨床的に中止を検討できる薬剤の指摘
6. 簡易懸濁法導入による業務効率化

【出力形式 — 必ずこのJSONのみを返すこと】
{
  "extracted_medications": [
    {
      "drug_name": "薬剤名（一般名優先）",
      "brand_name": "商品名",
      "dosage_form": "剤形",
      "route": "投与経路",
      "dose": "用量",
      "frequency": "頻度",
      "special_instructions": ["指示1", "指示2"],
      "mrci_a": 数値,
      "mrci_b": 数値,
      "mrci_c": 数値
    }
  ],
  "mrci_summary": {
    "section_a_total": 数値,
    "section_b_total": 数値,
    "section_c_total": 数値,
    "total": 数値
  },
  "optimization_suggestions": [
    {
      "target_drug": "対象薬剤名",
      "suggestion_type": "提案種別",
      "detail": "具体的な提案内容",
      "expected_mrci_reduction": 数値,
      "rationale": "医学的・薬学的根拠",
      "priority": "high|medium|low"
    }
  ],
  "optimized_mrci_total": 数値,
  "clinical_notes": "薬剤師向けの総合所見・注意事項"
}`;

export type GeminiModel = "gemini-2.5-flash" | "gemini-3-flash-preview";

export interface PharmacistNoteInput {
  patientInfo: string;
  clinicalNotes: string;
  selectedSuggestions: OptimizationSuggestion[];
  briefComment: string;
}

function buildRenalPromptSection(renalData: RenalData): string {
  const lines = ["\n\n【患者腎機能データ（必ず考慮すること）】"];
  lines.push(`血清クレアチニン: ${renalData.serumCreatinine} mg/dL`);
  if (renalData.bodyWeight) lines.push(`体重: ${renalData.bodyWeight} kg`);
  if (renalData.crcl != null) lines.push(`CrCl (Cockcroft-Gault): ${renalData.crcl} mL/min`);
  if (renalData.egfr != null) lines.push(`eGFR (日本式・Matsuo2009): ${renalData.egfr} mL/min/1.73m²`);
  lines.push("\n腎機能データを踏まえ、以下の追加解析を必ず実施してください:");
  lines.push("1. 各薬剤について、現在の処方用量が「患者の現在のeGFR/CrCl値における最大許容量（上限用量・投与間隔）」を超過していないかを、PMDA添付文書の「用法及び用量」「禁忌」「慎重投与」に記載された腎機能別用量基準に基づいて評価すること。維持量の確認ではなく、現患者の腎機能に応じた上限超過の有無を必ず確認すること（薬物動態の項は参照しないこと）");
  lines.push("2. 腎機能低下時の禁忌・要注意薬剤を添付文書の禁忌・警告・用法及び用量の記載に基づいて特定すること");
  lines.push("3. 腎保護の観点から中止・代替・減量が望ましい薬剤を、添付文書上の根拠がある場合のみ提案すること");
  lines.push("4. 腎機能関連の提案は suggestion_type を \"腎機能考慮減量\" または \"腎機能考慮中止\" とし、通常の最適化提案と区別する");
  lines.push("5. 重篤な腎毒性・薬物蓄積リスクがある場合は priority を \"high\" とする");
  lines.push("6. 添付文書上の具体的な数値（例: eGFR<30で禁忌）が確認できない場合は rationale に「添付文書上の確認が必要」と明記し、推測のみに基づく提案は行わないこと");
  return lines.join("\n");
}

export async function analyzePrescription(
  prescriptionText: string,
  modelId: GeminiModel = "gemini-2.5-flash",
  renalData?: RenalData
): Promise<GeminiAnalysisResult> {
  const model = genAI.getGenerativeModel({
    model: modelId,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1,
    },
  });

  const renalSection = renalData ? buildRenalPromptSection(renalData) : "";
  const prompt = `${MRCI_SYSTEM_PROMPT}${renalSection}\n\n【入力された持参薬情報】\n${prescriptionText}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    try {
      return JSON.parse(text) as GeminiAnalysisResult;
    } catch {
      throw new Error(`AIの応答をJSONとして解析できませんでした。再度お試しください。`);
    }
  } catch (err) {
    throw translateGeminiError(err, modelId);
  }
}

export async function analyzePrescriptionImage(
  images: Array<{ base64: string; mimeType: string }>,
  modelId: GeminiModel = "gemini-2.5-flash",
  renalData?: RenalData
): Promise<GeminiAnalysisResult> {
  const model = genAI.getGenerativeModel({
    model: modelId,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1,
    },
  });

  const renalSection = renalData ? buildRenalPromptSection(renalData) : "";
  const imageNote = images.length > 1 ? `（${images.length}枚の画像を統合して解析）` : "";
  const prompt = `${MRCI_SYSTEM_PROMPT}${renalSection}\n\n【指示】\n添付の画像${imageNote}（お薬手帳・処方箋・薬剤一覧）から持参薬情報を読み取り、上記ルールに従って解析してください。複数枚ある場合は全画像の薬剤を統合してください。個人を特定できる情報（氏名・生年月日・住所等）は無視してください。`;

  try {
    const result = await model.generateContent([
      { text: prompt },
      ...images.map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.base64 } })),
    ]);
    const text = result.response.text();
    try {
      return JSON.parse(text) as GeminiAnalysisResult;
    } catch {
      throw new Error(`AIの応答をJSONとして解析できませんでした。再度お試しください。`);
    }
  } catch (err) {
    throw translateGeminiError(err, modelId);
  }
}

const PHARMACIST_NOTE_PROMPT = `あなたは病院薬剤師として、持参薬鑑別結果を踏まえた薬剤師コメントを作成してください。

【出力の方針】
- 専門家向けの簡潔な記述（200〜400字程度）
- 箇条書きと文章を適切に組み合わせる
- AIが提案した内容のうち、薬剤師が選択した項目のみを反映する
- 薬剤師の簡易コメントがある場合はそれを優先し、ない場合はAI所見を参考にする
- 臨床的に重要な点（禁忌・腎機能考慮・高優先度提案）を最初に記載する
- 出力はプレーンテキストのみ（JSONや見出し記号は不要）`;

export async function generatePharmacistNote(
  input: PharmacistNoteInput,
  modelId: GeminiModel = "gemini-2.5-flash"
): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: modelId,
    generationConfig: { temperature: 0.3 },
  });

  const suggestionText =
    input.selectedSuggestions.length > 0
      ? input.selectedSuggestions
          .map(
            (s, i) =>
              `${i + 1}. [${s.suggestion_type}・優先度${s.priority}] ${s.target_drug}: ${s.detail}`
          )
          .join("\n")
      : "（選択提案なし）";

  const prompt = `${PHARMACIST_NOTE_PROMPT}

【患者情報】
${input.patientInfo}

【薬剤師が選択した最適化提案】
${suggestionText}

【薬剤師の簡易コメント（入力がある場合は優先）】
${input.briefComment || "（入力なし）"}

【AIの総合所見（参考）】
${input.clinicalNotes || "（なし）"}

上記を踏まえ、カルテ記載または医師・看護師への申し送りに適した薬剤師コメントを作成してください。`;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (err) {
    throw translateGeminiError(err, modelId);
  }
}

function translateGeminiError(err: unknown, modelName: string): Error {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("429") || msg.includes("Too Many Requests") || msg.includes("quota")) {
    if (modelName.includes("pro")) {
      return new Error(
        "gemini-2.5-pro はフリープランでは利用できません。Google AI Studio で有料プランを有効にするか、Flashモデルをご利用ください。"
      );
    }
    return new Error("APIの利用上限に達しました。しばらく待ってから再度お試しください。");
  }
  if (msg.includes("403") || msg.includes("API_KEY")) {
    return new Error("APIキーが無効です。.env.local の GEMINI_API_KEY を確認してください。");
  }
  // すでに翻訳済みのメッセージはそのまま返す
  if (err instanceof Error && !msg.includes("[GoogleGenerativeAI Error]")) {
    return err;
  }
  return new Error(`AI解析エラー: ${msg.slice(0, 120)}`);
}
