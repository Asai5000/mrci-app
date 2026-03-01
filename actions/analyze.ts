"use server";

import { db } from "@/lib/db";
import { cases, medications } from "@/lib/schema";
import { analyzePrescription, analyzePrescriptionImage, generatePharmacistNote, type GeminiAnalysisResult, type GeminiModel, type OptimizationSuggestion, type PharmacistNoteInput, type RenalData } from "@/lib/gemini";
import { augmentWithRenalDb } from "@/lib/renalDb";
import { v4 as uuidv4 } from "uuid";
import { eq } from "drizzle-orm";

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
  model?: GeminiModel;
}): Promise<string> {
  const noteInput: PharmacistNoteInput = {
    patientInfo: input.patientInfo,
    clinicalNotes: input.clinicalNotes,
    selectedSuggestions: input.selectedSuggestions,
    briefComment: input.briefComment,
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
    isContinued: 1,
    pharmacistApproved: 1,
    sortOrder: index,
  }));

  const allMedIds = medItems.map((m) => m.id);
  const optimizedTotal = medItems.reduce(
    (sum, m) => sum + (m.mrciA ?? 0) + (m.mrciB ?? 0) + (m.mrciC ?? 0),
    0
  );

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
    mrciSectionA: result.mrci_summary.section_a_total,
    mrciSectionB: result.mrci_summary.section_b_total,
    mrciSectionC: result.mrci_summary.section_c_total,
    mrciTotal: result.mrci_summary.total,
    mrciTotalOptimized: optimizedTotal,
    geminiRawResponse: JSON.stringify(result),
    clinicalSummary: summary,
    status: "approved",
  });

  await db.insert(medications).values(medItems);

  return caseId;
}

// ── 承認処理 ──────────────────────────────────────────────────

export async function approveCase(
  caseId: string,
  pharmacistNote: string,
  approvedMedicationIds: string[],
  optimizationNotes: Record<string, string>
) {
  const allMeds = await db.query.medications.findMany({
    where: eq(medications.caseId, caseId),
  });

  for (const med of allMeds) {
    const isApproved = approvedMedicationIds.includes(med.id);
    await db
      .update(medications)
      .set({
        pharmacistApproved: isApproved ? 1 : 0,
        optimizationNote: optimizationNotes[med.id] ?? med.optimizationNote,
      })
      .where(eq(medications.id, med.id));
  }

  const continuedMeds = allMeds.filter((m) =>
    approvedMedicationIds.includes(m.id)
  );
  const optimizedTotal = continuedMeds.reduce(
    (sum, m) => sum + (m.mrciA ?? 0) + (m.mrciB ?? 0) + (m.mrciC ?? 0),
    0
  );

  const summary = generateClinicalSummary(
    allMeds,
    approvedMedicationIds,
    optimizedTotal,
    pharmacistNote
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

function generateClinicalSummary(
  allMeds: { drugName: string; dose?: string | null; frequency?: string | null; optimizationNote?: string | null; id?: string }[],
  approvedIds: string[],
  optimizedTotal: number,
  pharmacistNote: string
): string {
  const continued = allMeds.filter((m) => approvedIds.includes(m.id ?? ""));
  const discontinued = allMeds.filter((m) => !approvedIds.includes(m.id ?? ""));

  const lines = [
    "【持参薬鑑別結果】",
    `持参薬: ${allMeds.length}剤 → 最適化後: ${continued.length}剤 (MRCI: ${optimizedTotal.toFixed(1)})`,
    "",
    "【継続薬】",
    ...continued.map((m) => `・${m.drugName} ${m.dose ?? ""} ${m.frequency ?? ""}`),
  ];

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
