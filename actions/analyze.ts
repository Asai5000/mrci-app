"use server";

import { db } from "@/lib/db";
import { cases, medications } from "@/lib/schema";
import { analyzePrescription, analyzePrescriptionImage, generatePharmacistNote, type GeminiAnalysisResult, type GeminiModel, type NoteType, type OptimizationSuggestion, type PharmacistNoteInput, type RenalData } from "@/lib/gemini";
import { augmentWithRenalDb } from "@/lib/renalDb";
import { calculateSectionA } from "@/lib/mrci";
import { v4 as uuidv4 } from "uuid";
import { eq, and } from "drizzle-orm";

// ── AI解析のみ（DB保存なし） ───────────────────────────────────

export async function analyzeOnlyText(input: {
  prescriptionText: string;
  model?: GeminiModel;
  renalData?: RenalData;
}): Promise<GeminiAnalysisResult> {
  const result = await analyzePrescription(input.prescriptionText, input.model ?? "gemini-2.5-flash", input.renalData);
  return augmentWithRenalDb(result, input.renalData);
}

export async function analyzeOnlyImage(input: {
  images: Array<{ imageBase64: string; mimeType: string }>;
  model?: GeminiModel;
  renalData?: RenalData;
}): Promise<GeminiAnalysisResult> {
  const result = await analyzePrescriptionImage(
    input.images.map((img) => ({ base64: img.imageBase64, mimeType: img.mimeType })),
    input.model ?? "gemini-2.5-flash",
    input.renalData
  );
  return augmentWithRenalDb(result, input.renalData);
}

// ── AI薬剤師コメント生成 ──────────────────────────────────────────

export async function generatePharmacistSummary(input: {
  patientInfo: string;
  clinicalNotes: string;
  selectedSuggestions: OptimizationSuggestion[];
  briefComment: string;
  noteType: NoteType;
  model?: GeminiModel;
}): Promise<string> {
  const noteInput: PharmacistNoteInput = {
    patientInfo: input.patientInfo,
    clinicalNotes: input.clinicalNotes,
    selectedSuggestions: input.selectedSuggestions,
    briefComment: input.briefComment,
    noteType: input.noteType,
  };
  return generatePharmacistNote(noteInput, input.model ?? "gemini-2.5-flash");
}

// ── 症例をDBに保存（登録ボタン押下時） ───────────────────────────

export async function saveCase(input: {
  patientAgeGroup: string;
  patientGender?: string;
  renalFunction?: string;
  serumCreatinine?: number;
  bodyWeight?: number;
  calculatedCrcl?: number;
  calculatedEgfr?: number;
  rawInputType: "text" | "image";
  rawInputText?: string;
  result: GeminiAnalysisResult;
}): Promise<string> {
  const { result } = input;
  const caseId = uuidv4();

  // 薬剤IDを事前生成（初期登録は全薬剤を継続扱いで承認）
  const medItems = result.extracted_medications.map((med, index) => ({
    id: uuidv4(),
    caseId,
    drugName: med.drug_name,
    brandName: med.brand_name,
    dosageForm: med.dosage_form,
    route: med.route,
    dose: med.dose,
    frequency: med.frequency,
    specialInstructions: JSON.stringify(med.special_instructions),
    mrciA: med.mrci_a,
    mrciB: med.mrci_b,
    mrciC: med.mrci_c,
    originalMrciA: med.mrci_a,  // リセット基準値として保存
    originalMrciB: med.mrci_b,
    isContinued: 1,
    pharmacistApproved: 1,
    changeType: "continued",
    sortOrder: index,
  }));

  const allMedIds = medItems.map((m) => m.id);
  // Section A は剤形種類を重複排除してカウント
  const sectionAInit = calculateSectionA(medItems.map((m) => m.dosageForm ?? "").filter(Boolean));
  const sectionBCInit = medItems.reduce((sum, m) => sum + (m.mrciB ?? 0) + (m.mrciC ?? 0), 0);
  const optimizedTotal = sectionAInit + sectionBCInit;

  // デフォルトの臨床サマリーを生成（全薬剤継続・薬剤師コメントなし）
  const summary = generateClinicalSummary(
    medItems.map((m) => ({ drugName: m.drugName, dose: m.dose, frequency: m.frequency, optimizationNote: null, id: m.id })),
    allMedIds,
    optimizedTotal,
    ""
  );

  await db.insert(cases).values({
    id: caseId,
    patientAgeGroup: input.patientAgeGroup,
    patientGender: input.patientGender,
    renalFunction: input.renalFunction,
    serumCreatinine: input.serumCreatinine,
    bodyWeight: input.bodyWeight,
    calculatedCrcl: input.calculatedCrcl,
    calculatedEgfr: input.calculatedEgfr,
    rawInputType: input.rawInputType,
    rawInputText: input.rawInputText,
    mrciSectionA: sectionAInit, // 剤形重複排除で再計算
    mrciSectionB: result.mrci_summary.section_b_total,
    mrciSectionC: result.mrci_summary.section_c_total,
    mrciTotal: optimizedTotal, // sectionAInit + B + C
    mrciTotalOptimized: optimizedTotal,
    geminiRawResponse: JSON.stringify(result),
    clinicalSummary: summary,
    status: "approved",
  });

  await db.insert(medications).values(medItems);

  return caseId;
}

// ── 承認処理 ──────────────────────────────────────────────────

export interface MedicationUpdate {
  changeType: string;
  isContinued: boolean;
  mrciA: number;
  mrciB: number;
  mrciC: number;
  overrideDosageForm?: string;
  overrideFrequency?: string;
  note: string;
}

export async function approveCase(
  caseId: string,
  pharmacistNote: string,
  medicationUpdates: Record<string, MedicationUpdate>,
  newMedications: Array<{
    drugName: string;
    dosageForm: string;
    frequency: string;
    mrciA: number;
    mrciB: number;
    mrciC: number;
    note: string;
  }> = []
) {
  const allMeds = await db.query.medications.findMany({
    where: eq(medications.caseId, caseId),
  });

  for (const med of allMeds) {
    const upd = medicationUpdates[med.id];
    if (!upd) continue;
    await db
      .update(medications)
      .set({
        isContinued: upd.isContinued ? 1 : 0,
        pharmacistApproved: upd.isContinued ? 1 : 0,
        changeType: upd.changeType,
        // 中止時はスコアを0で上書きしない — originalMrciA/B と mrciC をリセット用に温存
        mrciA: upd.isContinued ? upd.mrciA : (med.originalMrciA ?? med.mrciA),
        mrciB: upd.isContinued ? upd.mrciB : (med.originalMrciB ?? med.mrciB),
        mrciC: upd.isContinued ? upd.mrciC : med.mrciC,
        // 空文字列を null に変換（ドロップダウン未選択時の "" を防ぐ）
        overrideDosageForm: upd.overrideDosageForm || null,
        overrideFrequency: upd.overrideFrequency || null,
        optimizationNote: upd.note || null,
      })
      .where(eq(medications.id, med.id));
  }

  // 新規追加薬剤をINSERT（isAdded=1で区別）
  const sortOffset = allMeds.length;
  for (let i = 0; i < newMedications.length; i++) {
    const nm = newMedications[i];
    await db.insert(medications).values({
      id: uuidv4(),
      caseId,
      drugName: nm.drugName,
      dosageForm: nm.dosageForm,
      frequency: nm.frequency,
      mrciA: nm.mrciA,
      mrciB: nm.mrciB,
      mrciC: nm.mrciC,
      originalMrciA: nm.mrciA,
      originalMrciB: nm.mrciB,
      isContinued: 1,
      pharmacistApproved: 1,
      changeType: "continued",
      isAdded: 1,
      optimizationNote: nm.note || null,
      sortOrder: sortOffset + i,
    });
  }

  // optimizedTotal: 継続既存薬 + 既存追加薬（isAdded=1） + 新規薬（Section A は剤形種類を重複排除）
  const continuedExisting = allMeds.filter((m) => medicationUpdates[m.id]?.isContinued);
  const existingAddedMeds = allMeds.filter((m) => m.isAdded === 1);
  const continuedForms = continuedExisting.map((m) => {
    const upd = medicationUpdates[m.id];
    return (upd?.overrideDosageForm || m.dosageForm) ?? "";
  });
  const existingAddedForms = existingAddedMeds.map((m) => m.dosageForm ?? "");
  const newMedForms = newMedications.map((m) => m.dosageForm);
  const sectionAOptimized = calculateSectionA([...continuedForms, ...existingAddedForms, ...newMedForms].filter(Boolean));
  const sectionBOptimized = continuedExisting.reduce((sum, m) => {
    const upd = medicationUpdates[m.id];
    return sum + (upd?.mrciB ?? m.mrciB ?? 0);
  }, 0) + existingAddedMeds.reduce((sum, m) => sum + (m.mrciB ?? 0), 0) + newMedications.reduce((sum, m) => sum + m.mrciB, 0);
  const sectionCOptimized = continuedExisting.reduce((sum, m) => {
    const upd = medicationUpdates[m.id];
    return sum + (upd?.mrciC ?? m.mrciC ?? 0);
  }, 0) + existingAddedMeds.reduce((sum, m) => sum + (m.mrciC ?? 0), 0) + newMedications.reduce((sum, m) => sum + m.mrciC, 0);
  const optimizedTotal = sectionAOptimized + sectionBOptimized + sectionCOptimized;

  // generateClinicalSummary 用にデータを整形
  const allMedsWithNotes = allMeds.map((m) => ({
    ...m,
    optimizationNote: medicationUpdates[m.id]?.note || m.optimizationNote,
  }));
  const approvedIds = allMeds
    .filter((m) => medicationUpdates[m.id]?.isContinued || m.isAdded === 1)
    .map((m) => m.id);

  const summary = generateClinicalSummary(
    allMedsWithNotes,
    approvedIds,
    optimizedTotal,
    pharmacistNote,
    newMedications.filter((m) => m.drugName).map((m) => m.drugName)
  );

  await db
    .update(cases)
    .set({
      status: "approved",
      pharmacistNote,
      clinicalSummary: summary,
      mrciTotalOptimized: optimizedTotal,
      updatedAt: Math.floor(Date.now() / 1000),
    })
    .where(eq(cases.id, caseId));

  return { summary };
}

// ── 最適化リセット ─────────────────────────────────────────────

export async function resetOptimization(caseId: string) {
  const allMeds = await db.query.medications.findMany({
    where: eq(medications.caseId, caseId),
  });

  // 追加薬剤（isAdded=1）を削除
  await db
    .delete(medications)
    .where(and(eq(medications.caseId, caseId), eq(medications.isAdded, 1)));

  // 元の薬剤を全て継続にリセット
  for (const med of allMeds.filter((m) => !m.isAdded)) {
    await db
      .update(medications)
      .set({
        isContinued: 1,
        pharmacistApproved: 1,
        changeType: "continued",
        mrciA: med.originalMrciA ?? med.mrciA,
        mrciB: med.originalMrciB ?? med.mrciB,
        overrideDosageForm: null,
        overrideFrequency: null,
        optimizationNote: null,
      })
      .where(eq(medications.id, med.id));
  }

  // 元のMRCI合計を再計算（Section A は剤形種類を重複排除）
  const originalMedsOnly = allMeds.filter((m) => !m.isAdded);
  const originalForms = originalMedsOnly.map((m) => m.dosageForm ?? "").filter(Boolean);
  const sectionAOriginal = calculateSectionA(originalForms);
  const sectionBCOriginal = originalMedsOnly.reduce(
    (sum, m) => sum + (m.originalMrciB ?? m.mrciB ?? 0) + (m.mrciC ?? 0),
    0
  );
  const originalTotal = sectionAOriginal + sectionBCOriginal;

  await db
    .update(cases)
    .set({
      mrciTotalOptimized: originalTotal,
      clinicalSummary: null,
      updatedAt: Math.floor(Date.now() / 1000),
    })
    .where(eq(cases.id, caseId));
}

function generateClinicalSummary(
  allMeds: { drugName: string; dose?: string | null; frequency?: string | null; optimizationNote?: string | null; id?: string }[],
  approvedIds: string[],
  optimizedTotal: number,
  pharmacistNote: string,
  addedMedNames?: string[]
): string {
  const continued = allMeds.filter((m) => approvedIds.includes(m.id ?? ""));
  const discontinued = allMeds.filter((m) => !approvedIds.includes(m.id ?? ""));

  const totalAfter = continued.length + (addedMedNames?.length ?? 0);

  const lines = [
    "【持参薬鑑別結果】",
    `持参薬: ${allMeds.length}剤 → 最適化後: ${totalAfter}剤 (MRCI: ${optimizedTotal.toFixed(1)})`,
    "",
    "【継続薬】",
    ...continued.map((m) => {
      const note = m.optimizationNote;
      const hasChange = note && note !== "中止" && !note.startsWith("新規追加");
      return `・${m.drugName} ${m.dose ?? ""} ${m.frequency ?? ""}${hasChange ? ` [${note}]` : ""}`;
    }),
  ];

  if (addedMedNames && addedMedNames.length > 0) {
    lines.push("", "【追加薬剤】");
    lines.push(...addedMedNames.map((name) => `・${name}（新規追加）`));
  }

  if (discontinued.length > 0) {
    lines.push("", "【中止・変更検討薬】");
    lines.push(
      ...discontinued.map(
        (m) => `・${m.drugName} ${m.optimizationNote ? `→ ${m.optimizationNote}` : "(中止)"}`
      )
    );
  }

  if (pharmacistNote) {
    lines.push("", "【薬剤師コメント】", pharmacistNote);
  }

  return lines.join("\n");
}
