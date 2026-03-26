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

【MRCI計算ルール — George et al. 2004 / University of Colorado 原典準拠】

■ Section A（剤形スコア）— 重要: 処方全体で同一剤形カテゴリは1回のみカウント
各薬剤の mrci_a には「その薬剤の剤形スコア（個別値）」を記入。
section_a_total には「重複排除した剤形カテゴリのスコア合計」を記入すること。

剤形とスコア:
- 錠剤・カプセル・口腔内崩壊錠・OD錠・チュアブル錠: 1点
- 外用スプレー（吸入以外）: 1点
- うがい薬・含嗽薬: 2点
- バッカル錠・ガム剤: 2点
- 液剤・内服液・シロップ・懸濁液・ドライシロップ: 2点
- 散剤・顆粒・細粒: 2点
- 舌下錠: 2点
- クリーム・軟膏・ゲル・ローション: 2点
- 外用塗布薬: 2点
- 貼付剤・パッチ・テープ: 2点
- 点鼻スプレー: 2点（点鼻液とは別カテゴリ・スコアが異なる）
- 浣腸: 2点
- 坐剤・坐薬: 2点（※旧ルールの3点は誤り）
- 膣用製剤: 2点
- ペースト剤: 3点
- 点耳液: 3点
- 点眼液・点眼薬: 3点
- 点眼ゲル: 3点
- 点鼻液: 3点（点鼻スプレー=2と別カテゴリ）
- 吸入粉末・DPI（ドライパウダー吸入器）・吸入薬（種類不明時）: 3点
- 酸素療法・酸素吸入: 3点
- 注射プレフィルドシリンジ: 3点
- 定量噴霧式吸入器（MDI・pMDI・レスピマット）: 4点（※DPIの3点より高い）
- 注射バイアル・注射アンプル・注射液: 4点
- ネブライザー（吸入）: 5点（⚠️ 最高スコア）

■ Section B（投与頻度スコア）— 薬剤1剤ごとに mrci_b を記入
定期投与:
- 1日1回: 1点
- 1日2回: 2点
- 1日3回（毎食後・毎食前含む）: 3点
- 1日4回以上: 4点
- Q12H（12時間毎・時間固定）: 2.5点（"1日2回"とは別概念）
- Q8H（8時間毎）: 3.5点
- Q6H（6時間毎）: 4.5点
- Q4H（4時間毎）: 6.5点
- Q2H（2時間毎）: 12.5点
- 隔日（1日おき）: 2点（※旧ルールの1点は誤り）
- 週2〜3回: 1点
- 週1回: 0.5点

PRN（頓服・必要時）:
- 必要時のみ（定期なし）: 0.5点
- 1日1回頓服: 0.5点 / 1日2回頓服: 1点 / 1日3回頓服: 1.5点 / 1日4回頓服: 2点
- Q12H頓服: 1.5点 / Q8H頓服: 2点 / Q6H頓服: 2.5点 / Q4H頓服: 3.5点

酸素療法（特殊）:
- 酸素頓用: 1点 / 酸素15時間未満/日: 2点 / 酸素15時間以上/日: 3点

■ Section C（特別指示スコア）— 原典9カテゴリ、薬剤1剤ごとに加算
※ 同一カテゴリ内に複数の指示があっても1点のみカウント。カテゴリをまたぐ場合は加算。
※ 一包化不可・冷所保存・遮光保存はMRCIスコア対象外（原典に存在しない）

| カテゴリ | 該当する指示例 | スコア |
|---|---|---|
| 粉砕・割錠 | 粉砕、半錠、割錠 | 1点 |
| 溶解・簡易懸濁 | 溶解して服用、簡易懸濁法 | 1点 |
| 複数錠同時服用 | 3錠など複数錠を一度に服用 | 1点 |
| 変量投与 | 症状により1〜2錠など増減 | 1点 |
| 特定時刻指定 | 就寝前・起床直後など（食事と無関係な時刻指定） | 1点 |
| 食事との関係 | 食前・食後・食間・空腹時（どれか1つでも1点） | 1点 |
| 特別な使用法 | 吸入手順あり・点眼方法あり・注射手技指導要 | 2点 |
| 漸増・漸減 | 増量・減量スケジュール（テーパリング） | 2点 |
| 交互投与 | A日とB日で用量が異なる交互スケジュール | 2点 |

各薬剤のMRCI = mrci_a + mrci_b + mrci_c
section_a_total = 重複排除後の剤形スコア合計（同一カテゴリは1回のみ）
総MRCI = section_a_total + section_b_total + section_c_total

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
      "dose": "1日総量と錠数（錠剤・カプセルは必ず錠数を含める。例: 400mg（2錠/日）、200mg（1錠/日）、貼付剤なら1枚/日）",
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

export type NoteType = "chart" | "doctor" | "nurse" | "inquiry" | "guidance_soap" | "discharge_summary";

export interface PharmacistNoteInput {
  patientInfo: string;
  clinicalNotes: string;
  selectedSuggestions: OptimizationSuggestion[];
  briefComment: string;
  noteType: NoteType;
  clinicalSummary?: string; // 退院サマリー生成時に使用
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

function buildNoteTypePrompt(noteType: NoteType): string {
  switch (noteType) {
    case "chart":
      return `あなたは病院薬剤師として、持参薬鑑別結果をカルテに記載するためのコメントを作成してください。

【出力の方針】
- 体言止め・箇条書き中心・200字以内
- 事実と判断を簡潔に記載（主観的表現は避ける）
- 問題点があれば最初に記載
- 出力はプレーンテキストのみ（JSONや見出し記号は不要）`;

    case "doctor":
      return `あなたは病院薬剤師として、持参薬鑑別結果を医師に申し送るためのコメントを作成してください。

【出力の方針】
- 要確認事項・問題点を最初に記載
- 薬剤名・用量・提案内容を具体的に明記
- 「問題点 → 提案」の構成で記述
- 300〜400字程度
- 出力はプレーンテキストのみ`;

    case "nurse":
      return `あなたは病院薬剤師として、持参薬鑑別結果を看護師に申し送るためのコメントを作成してください。

【出力の方針】
- 服薬指導のポイント・患者への注意事項を中心に記載
- 患者理解度・アドヒアランスに関する情報を含める
- 要フォローアップ事項を明記
- 看護師が実施すべきことを具体的に記載
- 300字程度
- 出力はプレーンテキストのみ`;

    case "inquiry":
      return `あなたは病院薬剤師として、疑義照会の記録を作成してください。

【出力の方針】
- 以下の3段構成で記載:
  1. 照会内容（何を、誰に照会したか）
  2. 根拠（照会理由・添付文書上の根拠）
  3. 対応結果（医師の回答・対応内容）
- 客観的・事実ベースで記載
- 300字程度
- 出力はプレーンテキストのみ`;

    case "guidance_soap":
      return `あなたは病院薬剤師として、薬剤指導記録をSOAP形式で作成してください。

【出力形式 — 必ずこの形式で出力すること】
S（主観的情報）:
患者の訴え・服薬に関する理解度・アドヒアランス・不安や疑問

O（客観的情報）:
持参薬剤数、MRCI合計値、腎機能データ（ある場合）、最適化提案の概要

A（アセスメント）:
薬剤師としての評価・問題点・薬学的リスク・介入の必要性

P（プラン）:
実施した指導内容・介入計画・医師・看護師への連絡事項・フォローアップ予定

【注意】
- 各セクションを必ず「S（主観的情報）:」「O（客観的情報）:」「A（アセスメント）:」「P（プラン）:」のラベルで始める
- 入力情報から合理的に推定できる内容を記載（不明な場合は「確認要」と記載）
- プレーンテキストのみ（JSONは不要）`;

    case "discharge_summary":
      return `あなたは病院薬剤師として、退院時の薬剤管理サマリーを作成してください。

【絶対的なルール】
- 以下に提供する「薬剤経過データ」に記載された薬剤名・変更内容・理由は一切変更・省略・創作しないこと
- 変更区分（中止・剤形変更・用法変更・代替薬変更・新規追加）は必ずそのまま使用すること
- 変更理由が「理由:」として記載されている場合はそのまま転記すること
- 情報が不足している箇所（患者状態・フォローアップ等）のみ薬学的根拠をもとに補完してよい

【出力形式 — 必ずこの4項目構成で出力すること】
【１．入院前の薬剤情報】
持参薬の内容・剤数・MRCI値（入院前）・PIMS該当薬の有無

【２．入院中の薬剤変更・調整内容】
変更・中止・追加になった薬剤とその理由（薬剤経過データの内容を必ず使用すること）

【３．退院時処方内容】
最適化後の薬剤内容・剤数・MRCI値（退院時）・ポリファーマシー改善状況

【４．変更後の患者状態・フォローアップ】
介入後の患者状態の変化・アドヒアランス・退院後の注意事項・かかりつけへの申し送り事項

【その他の注意】
- 各セクションを必ず上記の【１．】〜【４．】のラベルで始める
- PIMS該当薬（⚠PIMSマーク）がある場合は【１．】および【２．】で明記すること
- 数値（剤数・MRCI値）は薬剤経過データに記載された数値をそのまま使用すること
- プレーンテキストのみ（JSONは不要）`;
  }
}

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

  const noteTypePrompt = buildNoteTypePrompt(input.noteType);

  const clinicalSummarySection = input.clinicalSummary
    ? `\n【薬剤経過データ（必ずこの内容を使用すること・変更・省略・創作禁止）】\n${input.clinicalSummary}\n`
    : "";

  const prompt = `${noteTypePrompt}

【患者情報】
${input.patientInfo}

【薬剤師が選択した最適化提案】
${suggestionText}
${clinicalSummarySection}
【薬剤師のメモ（入力がある場合は優先）】
${input.briefComment || "（入力なし）"}

【AIの総合所見（参考）】
${input.clinicalNotes || "（なし）"}

上記を踏まえて出力してください。`;

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
