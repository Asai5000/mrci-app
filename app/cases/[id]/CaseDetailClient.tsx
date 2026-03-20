"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { approveCase, generatePharmacistSummary, resetOptimization } from "@/actions/analyze";
import { deleteCase, deleteAddedMedication } from "@/actions/cases";
import {
  getMRCILevel, DOSAGE_FORM_SCORES, FREQUENCY_SCORES, calculateSectionA,
  DOSAGE_FORM_CATEGORY_LIST, SECTION_C_CATEGORY_LIST, getFormCategory,
  type DosageFormCategory,
} from "@/lib/mrci";
import { toast } from "sonner";
import type { Case, Medication, PmisDrug } from "@/lib/schema";
import type { GeminiAnalysisResult, GeminiModel, NoteType, OptimizationSuggestion } from "@/lib/gemini";

interface Props {
  caseData: Case & { medications: Medication[] };
  geminiResult: GeminiAnalysisResult | null;
  pmisMatches: Record<string, PmisDrug[]>;
}

// ── 変更操作種別 ──────────────────────────────────────────────
type ChangeType = "continued" | "discontinued" | "form_changed" | "freq_changed" | "substituted";

interface MedChange {
  changeType: ChangeType;
  overrideForm?: string;
  overrideFreq?: string;
}

interface AddedMed {
  tempId: string;
  drugName: string;
  dosageForm: string;
  frequency: string;
  note: string;
}

// ── 剤形カテゴリの日本語ラベル ────────────────────────────────
const FORM_CATEGORY_LABELS: Record<string, string> = {
  tab_capsule: "錠剤・カプセル", topical_spray: "外用スプレー",
  gargle: "うがい薬", buccal_gum: "バッカル錠・ガム剤",
  liquids: "液剤・内服液", powders: "散剤・顆粒", sublingual: "舌下錠",
  creams_ointments: "クリーム・軟膏・ゲル", paints: "外用塗布薬",
  patches: "貼付剤・パッチ", nasal_spray: "点鼻スプレー",
  enemas: "浣腸", suppositories: "坐剤", vaginal: "膣用製剤",
  pastes: "ペースト剤", ear_drops: "点耳液", eye_drops: "点眼液",
  eye_gels: "点眼ゲル", nasal_drops: "点鼻液", dpi: "吸入粉末（DPI）",
  oxygen: "酸素療法", prefilled_syringe: "注射プレフィルド",
  mdi: "MDI（定量噴霧）", inj_ampoule_vial: "注射バイアル・アンプル",
  nebuliser: "ネブライザー",
};
const SECTION_C_LABELS: Record<string, string> = {
  break: "粉砕・割錠", dissolve: "溶解・簡易懸濁", multiple: "複数錠同時服用",
  variable: "変量投与", specified_time: "特定時刻指定", food_relation: "食事との関係",
  take_use: "特別な使用法", tapering: "漸増・漸減", alternating: "交互投与",
};

// ── スコア詳細モーダル型 ──────────────────────────────────────
interface DrugDetailData {
  drugName: string;
  brandName?: string | null;
  effectiveDosageForm: string;
  effectiveFrequency: string;
  specialInstructions: string[];
  mrciA: number;
  mrciB: number;
  mrciC: number;
  formCategory: DosageFormCategory | null;
  isFormDeduplicated: boolean;
  isDiscontinued: boolean;
  matchedFreqKey: string | null;
  sectionCHits: Array<{ categoryId: string; score: number; matched: string[] }>;
}

const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
  continued:   "継続",
  discontinued:"中止",
  form_changed:"剤形変更",
  freq_changed:"用法変更",
  substituted: "代替薬変更",
};

const CHANGE_BADGE_STYLES: Record<ChangeType, string> = {
  continued:   "hidden",
  discontinued:"bg-red-100 text-red-700 border-red-200",
  form_changed:"bg-blue-100 text-blue-700 border-blue-200",
  freq_changed:"bg-blue-100 text-blue-700 border-blue-200",
  substituted: "bg-purple-100 text-purple-700 border-purple-200",
};

function getEffectiveScores(
  med: Medication,
  change: MedChange
): { a: number; b: number; c: number } {
  if (change.changeType === "discontinued") return { a: 0, b: 0, c: 0 };
  // 空文字列（ドロップダウン未選択）を falsy として扱い、元スコアにフォールバック
  const a = change.overrideForm
    ? (DOSAGE_FORM_SCORES[change.overrideForm] ?? 1)
    : (med.mrciA ?? 0);
  const b = change.overrideFreq
    ? (FREQUENCY_SCORES[change.overrideFreq] ?? 1)
    : (med.mrciB ?? 0);
  return { a, b, c: med.mrciC ?? 0 };
}

function getAddedMedScores(med: AddedMed): { a: number; b: number; c: number } {
  return {
    a: DOSAGE_FORM_SCORES[med.dosageForm] ?? 1,
    b: FREQUENCY_SCORES[med.frequency] ?? 1,
    c: 0,
  };
}

// ── 薬剤師コメント用途 ────────────────────────────────────────
const PRIORITY_COLORS: Record<string, string> = {
  high:   "bg-red-50 border-red-200",
  medium: "bg-yellow-50 border-yellow-200",
  low:    "bg-blue-50 border-blue-200",
};
const PRIORITY_LABELS: Record<string, string> = {
  high: "優先度: 高", medium: "優先度: 中", low: "優先度: 低",
};
const NOTE_TYPES: { value: NoteType; label: string }[] = [
  { value: "chart",         label: "カルテ記載" },
  { value: "doctor",        label: "医師申し送り" },
  { value: "nurse",         label: "看護師申し送り" },
  { value: "inquiry",       label: "疑義照会メモ" },
  { value: "guidance_soap", label: "指導記録 (SOAP)" },
];
const QUICK_PHRASES: Record<NoteType, string[]> = {
  chart:         ["全薬剤継続", "疑義照会対応済", "医師確認済", "減量指示あり", "持参薬中止"],
  doctor:        ["要確認あり", "用量変更提案", "疑義照会実施済", "中止検討", "減量指示依頼"],
  nurse:         ["服薬指導実施", "理解良好", "要フォロー", "家族への説明必要", "アドヒアランス良好"],
  inquiry:       ["照会内容：", "根拠：", "対応結果：", "医師回答：", "変更指示あり"],
  guidance_soap: ["S：", "O：", "A：", "P：", "確認要", "次回フォロー予定"],
};

// ── コンポーネント ────────────────────────────────────────────
export default function CaseDetailClient({ caseData, geminiResult, pmisMatches }: Props) {
  const router = useRouter();

  // 元の薬剤 / 追加薬剤を分離
  const originalMeds = caseData.medications.filter((m) => !m.isAdded);
  // 追加薬剤はstateで管理（リセット・個別削除時に即座に反映するため）
  const [localAddedMeds, setLocalAddedMeds] = useState(
    caseData.medications.filter((m) => m.isAdded === 1)
  );
  // サーバーデータ更新時（router.refresh後）にstateを同期
  // ※ useStateの初期値はマウント時のみ設定されるため、プロップ変更時は手動同期が必要
  useEffect(() => {
    setLocalAddedMeds(caseData.medications.filter((m) => m.isAdded === 1));
    setPendingDeleteMedIds(new Set());
  }, [caseData.medications]);

  // 薬剤変更state — DBの値で初期化
  const [medChanges, setMedChanges] = useState<Record<string, MedChange>>(
    Object.fromEntries(
      originalMeds.map((m) => [
        m.id,
        {
          changeType: ((m.changeType as ChangeType) ?? (m.isContinued === 0 ? "discontinued" : "continued")),
          overrideForm: m.overrideDosageForm ?? undefined,
          overrideFreq: m.overrideFrequency ?? undefined,
        },
      ])
    )
  );
  const [manualNotes, setManualNotes] = useState<Record<string, string>>(
    Object.fromEntries(originalMeds.map((m) => [m.id, m.optimizationNote ?? ""]))
  );
  const [newAddedMeds, setNewAddedMeds] = useState<AddedMed[]>([]);
  const [selectedDrugDetail, setSelectedDrugDetail] = useState<DrugDetailData | null>(null);
  const [pendingDeleteMedIds, setPendingDeleteMedIds] = useState<Set<string>>(new Set());

  // 薬剤師コメントstate
  const [pharmacistMemo, setPharmacistMemo] = useState(caseData.pharmacistNote ?? "");
  const [generatedNote, setGeneratedNote] = useState("");
  const [noteType, setNoteType] = useState<NoteType>("chart");
  const [editableSummary, setEditableSummary] = useState(caseData.clinicalSummary ?? "");
  const [showSummary, setShowSummary] = useState(!!caseData.clinicalSummary);

  // AI生成state
  const [selectedSuggestionIndices, setSelectedSuggestionIndices] = useState<Set<number>>(
    new Set(geminiResult?.optimization_suggestions.map((_, i) => i) ?? [])
  );
  const [summaryModel, setSummaryModel] = useState<GeminiModel>("gemini-2.5-flash");
  const [isGenerating, setIsGenerating] = useState(false);

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [selectedPmisDrug, setSelectedPmisDrug] = useState<{ drugName: string; entries: PmisDrug[] } | null>(null);

  const memoRef = useRef<HTMLTextAreaElement>(null);
  const generatedRef = useRef<HTMLTextAreaElement>(null);

  // ── 薬剤変更ハンドラ ────────────────────────────────────────
  const updateChangeType = (medId: string, changeType: ChangeType) => {
    setMedChanges((prev) => {
      const current = prev[medId] ?? { changeType: "continued" };
      const next: MedChange = { changeType };
      if ((changeType === "form_changed" || changeType === "substituted") && current.overrideForm) {
        next.overrideForm = current.overrideForm;
      }
      if ((changeType === "freq_changed" || changeType === "substituted") && current.overrideFreq) {
        next.overrideFreq = current.overrideFreq;
      }
      return { ...prev, [medId]: next };
    });
  };
  const updateOverrideForm = (medId: string, form: string) => {
    setMedChanges((prev) => ({
      ...prev,
      [medId]: { ...(prev[medId] ?? { changeType: "form_changed" }), overrideForm: form },
    }));
  };
  const updateOverrideFreq = (medId: string, freq: string) => {
    setMedChanges((prev) => ({
      ...prev,
      [medId]: { ...(prev[medId] ?? { changeType: "freq_changed" }), overrideFreq: freq },
    }));
  };

  // ── 追加薬剤ハンドラ ────────────────────────────────────────
  const handleAddMed = () => {
    setNewAddedMeds((prev) => [
      ...prev,
      { tempId: Math.random().toString(36).slice(2), drugName: "", dosageForm: "錠剤", frequency: "1日1回", note: "" },
    ]);
  };
  const removeNewMed = (tempId: string) => {
    setNewAddedMeds((prev) => prev.filter((m) => m.tempId !== tempId));
  };
  const updateNewMed = (tempId: string, field: keyof AddedMed, value: string) => {
    setNewAddedMeds((prev) => prev.map((m) => (m.tempId === tempId ? { ...m, [field]: value } : m)));
  };

  // ── MRCI計算（Section A は剤形種類を重複排除） ────────────────
  const activeForms: string[] = [];
  let _sectionBTotal = 0;
  let _sectionCTotal = 0;
  for (const med of originalMeds) {
    const change = medChanges[med.id] ?? { changeType: "continued" };
    if (change.changeType === "discontinued") continue;
    const effectiveForm = change.overrideForm || med.dosageForm || "";
    if (effectiveForm) activeForms.push(effectiveForm);
    const s = getEffectiveScores(med, change);
    _sectionBTotal += s.b;
    _sectionCTotal += s.c;
  }
  for (const med of localAddedMeds) {
    if (pendingDeleteMedIds.has(med.id)) continue;
    if (med.dosageForm) activeForms.push(med.dosageForm);
    _sectionBTotal += med.mrciB ?? 0;
    _sectionCTotal += med.mrciC ?? 0;
  }
  for (const med of newAddedMeds) {
    if (med.dosageForm) activeForms.push(med.dosageForm);
    const s = getAddedMedScores(med);
    _sectionBTotal += s.b;
    _sectionCTotal += s.c;
  }
  const currentMrci = calculateSectionA(activeForms) + _sectionBTotal + _sectionCTotal;

  // ── 剤形カテゴリ重複排除状態（表示用）────────────────────────
  const formCategoryStatus: Record<string, { category: DosageFormCategory | null; isDeduplicated: boolean }> = {};
  const _seenCats = new Set<string>();
  for (const med of originalMeds) {
    const change = medChanges[med.id] ?? { changeType: "continued" };
    if (change.changeType === "discontinued") {
      formCategoryStatus[med.id] = { category: null, isDeduplicated: false };
      continue;
    }
    const cat = getFormCategory(change.overrideForm || med.dosageForm || "");
    formCategoryStatus[med.id] = { category: cat, isDeduplicated: !!cat && _seenCats.has(cat.categoryId) };
    if (cat) _seenCats.add(cat.categoryId);
  }
  for (const med of localAddedMeds) {
    if (pendingDeleteMedIds.has(med.id)) {
      formCategoryStatus[med.id] = { category: null, isDeduplicated: false };
      continue;
    }
    const cat = getFormCategory(med.dosageForm || "");
    formCategoryStatus[med.id] = { category: cat, isDeduplicated: !!cat && _seenCats.has(cat.categoryId) };
    if (cat) _seenCats.add(cat.categoryId);
  }
  for (const med of newAddedMeds) {
    const cat = getFormCategory(med.dosageForm || "");
    formCategoryStatus[med.tempId] = { category: cat, isDeduplicated: !!cat && _seenCats.has(cat.categoryId) };
    if (cat) _seenCats.add(cat.categoryId);
  }

  // ── 薬剤詳細モーダルを開くヘルパー ────────────────────────────
  const openDrugDetail = (
    drugName: string,
    brandName: string | null | undefined,
    effectiveDosageForm: string,
    effectiveFrequency: string,
    specialInstructions: string[],
    mrciA: number,
    mrciB: number,
    mrciC: number,
    catStatus: { category: DosageFormCategory | null; isDeduplicated: boolean } | undefined,
    isDiscontinued: boolean
  ) => {
    let matchedFreqKey: string | null = null;
    for (const key of Object.keys(FREQUENCY_SCORES)) {
      if (effectiveFrequency.includes(key)) { matchedFreqKey = key; break; }
    }
    const sectionCHits = SECTION_C_CATEGORY_LIST
      .filter((cat) => cat.keywords.some((kw) => specialInstructions.some((inst) => inst?.includes(kw))))
      .map((cat) => ({
        categoryId: cat.categoryId,
        score: cat.score,
        matched: cat.keywords.filter((kw) => specialInstructions.some((inst) => inst?.includes(kw))),
      }));
    setSelectedDrugDetail({
      drugName, brandName, effectiveDosageForm, effectiveFrequency,
      specialInstructions, mrciA, mrciB, mrciC,
      formCategory: catStatus?.category ?? null,
      isFormDeduplicated: catStatus?.isDeduplicated ?? false,
      isDiscontinued, matchedFreqKey, sectionCHits,
    });
  };

  const originalMrci = caseData.mrciTotal ?? 0;
  const reduction = originalMrci - currentMrci;
  const reductionPct = originalMrci > 0 ? (reduction / originalMrci) * 100 : 0;
  const level = getMRCILevel(currentMrci);

  const continuedCount =
    originalMeds.filter((m) => (medChanges[m.id]?.changeType ?? "continued") !== "discontinued").length +
    localAddedMeds.filter((m) => !pendingDeleteMedIds.has(m.id)).length +
    newAddedMeds.filter((m) => m.drugName.trim()).length;

  // ── AI生成 ───────────────────────────────────────────────────
  const toggleSuggestion = (i: number) => {
    setSelectedSuggestionIndices((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };
  const insertPhrase = (phrase: string, target: "memo" | "generated") => {
    const ref = target === "memo" ? memoRef : generatedRef;
    const setter = target === "memo" ? setPharmacistMemo : setGeneratedNote;
    const current = target === "memo" ? pharmacistMemo : generatedNote;
    const el = ref.current;
    if (el) {
      const start = el.selectionStart ?? current.length;
      const end = el.selectionEnd ?? current.length;
      setter(current.slice(0, start) + phrase + current.slice(end));
      setTimeout(() => { el.focus(); el.setSelectionRange(start + phrase.length, start + phrase.length); }, 0);
    } else {
      setter(current + phrase);
    }
  };

  const handleGenerateSummary = async () => {
    setIsGenerating(true);
    try {
      const selectedSugs = geminiResult?.optimization_suggestions.filter((_, i) => selectedSuggestionIndices.has(i)) ?? [];
      const patientInfo = [
        caseData.patientAgeGroup, caseData.patientGender,
        caseData.renalFunction ? `腎機能: ${caseData.renalFunction}` : null,
        caseData.calculatedCrcl != null ? `CrCl: ${caseData.calculatedCrcl} mL/min` : null,
        caseData.calculatedEgfr != null ? `eGFR: ${caseData.calculatedEgfr} mL/min/1.73m²` : null,
      ].filter(Boolean).join("、");
      const note = await generatePharmacistSummary({
        patientInfo, clinicalNotes: geminiResult?.clinical_notes ?? "",
        selectedSuggestions: selectedSugs, briefComment: pharmacistMemo,
        noteType, model: summaryModel,
      });
      setGeneratedNote(note);
      toast.success("生成しました");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "生成に失敗しました");
    } finally {
      setIsGenerating(false);
    }
  };

  // ── 保存ハンドラ ─────────────────────────────────────────────
  const handleApprove = async () => {
    setIsSaving(true);
    try {
      const noteToSave = generatedNote || pharmacistMemo;

      // 元の薬剤ごとの更新データを構築
      const medicationUpdates: Record<string, {
        changeType: string; isContinued: boolean;
        mrciA: number; mrciB: number; mrciC: number;
        overrideDosageForm?: string; overrideFrequency?: string; note: string;
      }> = {};

      for (const med of originalMeds) {
        const change = medChanges[med.id] ?? { changeType: "continued" };
        const scores = getEffectiveScores(med, change);

        let noteFromChange = "";
        if (change.changeType === "discontinued") {
          noteFromChange = "中止";
        } else if (change.changeType === "form_changed" && change.overrideForm) {
          const origForm = med.dosageForm ?? "";
          const origA = med.originalMrciA ?? med.mrciA ?? 0;
          noteFromChange = `剤形変更: ${origForm}(A=${origA})→${change.overrideForm}(A=${scores.a})`;
        } else if (change.changeType === "freq_changed" && change.overrideFreq) {
          const origFreq = med.frequency ?? "";
          const origB = med.originalMrciB ?? med.mrciB ?? 0;
          noteFromChange = `用法変更: ${origFreq}(B=${origB})→${change.overrideFreq}(B=${scores.b})`;
        } else if (change.changeType === "substituted") {
          const parts: string[] = [];
          if (change.overrideForm) parts.push(`剤形:${change.overrideForm}`);
          if (change.overrideFreq) parts.push(`用法:${change.overrideFreq}`);
          noteFromChange = `代替薬変更 → ${parts.join("・")}`;
        }

        const manualNote = manualNotes[med.id] ?? "";
        const finalNote = [noteFromChange, manualNote].filter(Boolean).join(" / ");

        medicationUpdates[med.id] = {
          changeType: change.changeType,
          isContinued: change.changeType !== "discontinued",
          mrciA: scores.a, mrciB: scores.b, mrciC: scores.c,
          overrideDosageForm: change.overrideForm,
          overrideFrequency: change.overrideFreq,
          note: finalNote,
        };
      }

      const newMedsData = newAddedMeds
        .filter((m) => m.drugName.trim())
        .map((m) => {
          const s = getAddedMedScores(m);
          return { drugName: m.drugName, dosageForm: m.dosageForm, frequency: m.frequency, mrciA: s.a, mrciB: s.b, mrciC: s.c, note: m.note };
        });

      // 削除待ちの追加薬剤をDB削除（保存時に一括実行）
      for (const medId of Array.from(pendingDeleteMedIds)) {
        await deleteAddedMedication(medId);
      }
      setPendingDeleteMedIds(new Set());

      const { summary } = await approveCase(caseData.id, noteToSave, medicationUpdates, newMedsData);
      setEditableSummary(summary);
      setShowSummary(true);
      setNewAddedMeds([]);
      toast.success("保存しました");
      router.refresh();
    } catch {
      toast.error("保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  };

  // ── リセットハンドラ ─────────────────────────────────────────
  const handleReset = async () => {
    setIsResetting(true);
    try {
      await resetOptimization(caseData.id);
      // React stateをリセット（router.refresh()だけではuseStateは再初期化されないため）
      setMedChanges(
        Object.fromEntries(originalMeds.map((m) => [m.id, { changeType: "continued" as ChangeType }]))
      );
      setManualNotes(Object.fromEntries(originalMeds.map((m) => [m.id, ""])));
      setNewAddedMeds([]);
      setLocalAddedMeds([]);
      setPendingDeleteMedIds(new Set());
      setEditableSummary("");
      setShowSummary(false);
      toast.success("最適化をリセットしました");
      router.refresh();
    } catch {
      toast.error("リセットに失敗しました");
    } finally {
      setIsResetting(false);
      setConfirmReset(false);
    }
  };

  // ── 追加薬剤個別削除ハンドラ（保存時に実行される遅延削除）────────
  const handleDeleteAddedMed = (medId: string) => {
    setPendingDeleteMedIds((prev) => new Set([...prev, medId]));
  };
  const handleUndoDeleteAddedMed = (medId: string) => {
    setPendingDeleteMedIds((prev) => {
      const next = new Set(prev);
      next.delete(medId);
      return next;
    });
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("コピーしました");
  };

  // ── 変更内容バッジ ───────────────────────────────────────────
  const renderChangeBadge = (med: Medication, change: MedChange) => {
    if (change.changeType === "continued") return null;
    const style = CHANGE_BADGE_STYLES[change.changeType];
    const label = CHANGE_TYPE_LABELS[change.changeType];
    return (
      <span className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded border font-medium ${style}`}>
        {label}
      </span>
    );
  };

  const renderScoreChange = (
    current: number,
    original: number | null | undefined,
    hasOverride: boolean,
    isDeduplicated = false,
    categoryLabel = ""
  ) => {
    if (isDeduplicated) {
      return (
        <span
          className="font-mono text-xs text-gray-300 italic"
          title={categoryLabel ? `重複排除: ${categoryLabel}は処方中に既にカウント済` : "重複排除済"}>
          ({current.toFixed(1)})
        </span>
      );
    }
    if (!hasOverride) return <span className="font-mono text-xs">{current.toFixed(1)}</span>;
    return (
      <div className="text-center">
        <span className="font-mono text-xs text-blue-600 font-semibold">{current.toFixed(1)}</span>
        {original != null && (
          <div className="font-mono text-[10px] text-gray-400 line-through">{original.toFixed(1)}</div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">鑑別結果レビュー</h1>
            <Badge variant={caseData.status === "approved" ? "default" : "outline"}>
              {caseData.status === "approved" ? "登録済" : "下書き"}
            </Badge>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {caseData.patientAgeGroup}
            {caseData.patientGender ? ` · ${caseData.patientGender}` : ""}
            {caseData.renalFunction ? ` · 腎機能: ${caseData.renalFunction}` : ""}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap shrink-0">
          {confirmDelete ? (
            <>
              <span className="text-sm text-gray-500 self-center">本当に削除しますか？</span>
              <Button variant="destructive" size="sm" disabled={isDeleting}
                onClick={async () => {
                  setIsDeleting(true);
                  try { await deleteCase(caseData.id); toast.success("症例を削除しました"); router.push("/"); }
                  catch { toast.error("削除に失敗しました"); setIsDeleting(false); setConfirmDelete(false); }
                }}>
                {isDeleting ? "削除中..." : "削除する"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>キャンセル</Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm"
                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                onClick={() => setConfirmDelete(true)}>削除</Button>
              <Button variant="outline" size="sm" onClick={() => router.push("/")}>← 一覧へ</Button>
            </>
          )}
        </div>
      </div>

      {/* MRCIサマリー */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: "Section A（剤形）", val: caseData.mrciSectionA },
          { label: "Section B（頻度）", val: caseData.mrciSectionB },
          { label: "Section C（特別指示）", val: caseData.mrciSectionC },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
              <p className="text-xs text-gray-500">{item.label}</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-700">{item.val?.toFixed(1) ?? "-"}</p>
            </CardContent>
          </Card>
        ))}
        <Card className="border-2 border-blue-200">
          <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
            <p className="text-xs text-gray-500">合計MRCI</p>
            <p className="text-2xl sm:text-3xl font-bold text-blue-600">{originalMrci.toFixed(1)}</p>
            <Badge variant={level.level === "high" ? "destructive" : level.level === "medium" ? "secondary" : "outline"} className="mt-1">
              複雑度: {level.label}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* 薬剤一覧 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between flex-wrap gap-2">
            <span>薬剤一覧</span>
            <div className="flex items-center gap-3">
              <span className="text-sm font-normal text-gray-500">
                継続: {continuedCount}/{originalMeds.length + localAddedMeds.filter((m) => !pendingDeleteMedIds.has(m.id)).length + newAddedMeds.filter((m) => m.drugName.trim()).length}剤
              </span>
              <Button size="sm" onClick={handleApprove} disabled={isSaving}>
                {isSaving ? "保存中..." : "変更を保存"}
              </Button>
              {/* リセットボタン */}
              {confirmReset ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">最適化をリセットしますか？</span>
                  <Button variant="destructive" size="sm" disabled={isResetting} onClick={handleReset}>
                    {isResetting ? "リセット中..." : "リセット"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setConfirmReset(false)}>キャンセル</Button>
                </div>
              ) : (
                <Button variant="outline" size="sm"
                  className="text-orange-500 hover:text-orange-600 hover:bg-orange-50 border-orange-200"
                  onClick={() => setConfirmReset(true)}>
                  最適化をリセット
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <table className="w-full text-sm min-w-[820px]">
              <thead>
                <tr className="border-b text-gray-500 text-left text-xs">
                  <th className="pb-2 pr-2 font-medium w-28">状態</th>
                  <th className="pb-2 pr-3 font-medium">薬剤名</th>
                  <th className="pb-2 pr-2 font-medium w-24">用量・剤形</th>
                  <th className="pb-2 pr-2 font-medium w-24">用法</th>
                  <th className="pb-2 pr-1 font-medium text-center w-14">A</th>
                  <th className="pb-2 pr-1 font-medium text-center w-14">B</th>
                  <th className="pb-2 pr-1 font-medium text-center w-14">C</th>
                  <th className="pb-2 pr-1 font-medium text-center w-16">小計</th>
                  <th className="pb-2 font-medium min-w-[160px]">変更内容</th>
                </tr>
              </thead>
              <tbody>
                {/* 元の薬剤 */}
                {originalMeds.map((med) => {
                  const change = medChanges[med.id] ?? { changeType: "continued" as ChangeType };
                  const scores = getEffectiveScores(med, change);
                  const effectiveTotal = scores.a + scores.b + scores.c;
                  const isDiscontinued = change.changeType === "discontinued";
                  const hasFormChange = change.overrideForm !== undefined;
                  const hasFreqChange = change.overrideFreq !== undefined;
                  const instructions = med.specialInstructions ? JSON.parse(med.specialInstructions) : [];
                  const catStatus = formCategoryStatus[med.id];
                  const isDeduplicated = catStatus?.isDeduplicated ?? false;
                  const catLabel = FORM_CATEGORY_LABELS[catStatus?.category?.categoryId ?? ""] ?? "";

                  return (
                    <tr key={med.id}
                      className={`border-b transition-colors ${isDiscontinued ? "opacity-40 bg-gray-50" : ""}`}>
                      {/* 状態 */}
                      <td className="py-2 pr-2">
                        <select
                          value={change.changeType}
                          onChange={(e) => updateChangeType(med.id, e.target.value as ChangeType)}
                          className="text-xs border rounded px-1.5 py-1 bg-white w-full">
                          {Object.entries(CHANGE_TYPE_LABELS).map(([val, label]) => (
                            <option key={val} value={val}>{label}</option>
                          ))}
                        </select>
                      </td>

                      {/* 薬剤名 + バッジ */}
                      <td className="py-2 pr-3">
                        <div className="flex flex-col gap-0.5">
                          <button
                            className="font-medium text-sm text-left hover:text-blue-600 hover:underline transition-colors cursor-pointer"
                            onClick={() => openDrugDetail(
                              med.drugName, med.brandName,
                              change.overrideForm || med.dosageForm || "",
                              change.overrideFreq || med.frequency || "",
                              instructions, scores.a, scores.b, scores.c,
                              catStatus, isDiscontinued
                            )}>
                            {med.drugName}
                          </button>
                          {med.brandName && med.brandName !== med.drugName && (
                            <span className="text-gray-400 text-xs">({med.brandName})</span>
                          )}
                          {renderChangeBadge(med, change)}
                          {pmisMatches[med.drugName] && (
                            <button
                              onClick={() => setSelectedPmisDrug({ drugName: med.drugName, entries: pmisMatches[med.drugName] })}
                              className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded border bg-orange-50 border-orange-300 text-orange-700 hover:bg-orange-100 transition-colors font-medium w-fit"
                            >
                              ⚠ PMIS
                            </button>
                          )}
                        </div>
                      </td>

                      {/* 用量・剤形 */}
                      <td className="py-2 pr-2 text-gray-600 text-xs">
                        {med.dose ?? "-"} {med.dosageForm ?? ""}
                      </td>

                      {/* 用法 */}
                      <td className="py-2 pr-2 text-gray-600 text-xs">
                        <div>{med.frequency ?? "-"}</div>
                        {instructions.length > 0 && (
                          <div className="flex flex-wrap gap-0.5 mt-0.5">
                            {instructions.map((inst: string, i: number) => (
                              <Badge key={i} variant="outline" className="text-xs px-1 py-0">{inst}</Badge>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* A */}
                      <td className="py-2 pr-1 text-center">
                        {isDiscontinued
                          ? <span className="font-mono text-xs text-gray-400">—</span>
                          : renderScoreChange(scores.a, med.originalMrciA ?? med.mrciA, hasFormChange, isDeduplicated, catLabel)}
                      </td>

                      {/* B */}
                      <td className="py-2 pr-1 text-center">
                        {isDiscontinued
                          ? <span className="font-mono text-xs text-gray-400">—</span>
                          : renderScoreChange(scores.b, med.originalMrciB ?? med.mrciB, hasFreqChange)}
                      </td>

                      {/* C */}
                      <td className="py-2 pr-1 text-center font-mono text-xs">
                        {isDiscontinued ? <span className="text-gray-400">—</span> : scores.c.toFixed(1)}
                      </td>

                      {/* 小計 */}
                      <td className={`py-2 pr-1 text-center font-mono text-xs font-semibold ${
                        isDiscontinued ? "text-gray-400" : change.changeType !== "continued" ? "text-blue-600" : ""
                      }`}>
                        {isDiscontinued ? "0.0" : effectiveTotal.toFixed(1)}
                      </td>

                      {/* 変更詳細（剤形・用法セレクトのみ） */}
                      <td className="py-2">
                        <div className="flex flex-col gap-1">
                          {(change.changeType === "form_changed" || change.changeType === "substituted") && (
                            <select
                              value={change.overrideForm ?? ""}
                              onChange={(e) => updateOverrideForm(med.id, e.target.value)}
                              className="text-xs border rounded px-1.5 py-0.5 bg-white">
                              <option value="">剤形を選択</option>
                              {Object.entries(DOSAGE_FORM_SCORES).map(([form, score]) => (
                                <option key={form} value={form}>{form} (A={score})</option>
                              ))}
                            </select>
                          )}
                          {(change.changeType === "freq_changed" || change.changeType === "substituted") && (
                            <select
                              value={change.overrideFreq ?? ""}
                              onChange={(e) => updateOverrideFreq(med.id, e.target.value)}
                              className="text-xs border rounded px-1.5 py-0.5 bg-white">
                              <option value="">用法を選択</option>
                              {Object.entries(FREQUENCY_SCORES).map(([freq, score]) => (
                                <option key={freq} value={freq}>{freq} (B={score})</option>
                              ))}
                            </select>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {/* 既存の追加薬剤（DBに保存済み） */}
                {localAddedMeds.map((med) => {
                  const total = (med.mrciA ?? 0) + (med.mrciB ?? 0) + (med.mrciC ?? 0);
                  const addedCatStatus = formCategoryStatus[med.id];
                  const addedIsDup = addedCatStatus?.isDeduplicated ?? false;
                  const addedCatLabel = FORM_CATEGORY_LABELS[addedCatStatus?.category?.categoryId ?? ""] ?? "";
                  const addedInstructions = med.specialInstructions ? JSON.parse(med.specialInstructions) : [];
                  const isPendingDelete = pendingDeleteMedIds.has(med.id);
                  return (
                    <tr key={med.id} className={`border-b transition-colors ${isPendingDelete ? "opacity-50 bg-red-50/40" : "bg-green-50/50"}`}>
                      <td className="py-2 pr-2">
                        {isPendingDelete ? (
                          <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded border bg-red-100 text-red-600 border-red-200 font-medium">
                            削除待ち
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded border bg-green-100 text-green-700 border-green-200 font-medium">
                            追加
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <button
                          className={`font-medium text-sm text-left hover:text-blue-600 hover:underline transition-colors ${isPendingDelete ? "line-through text-gray-400" : "text-green-800"}`}
                          onClick={() => !isPendingDelete && openDrugDetail(
                            med.drugName, null,
                            med.dosageForm || "", med.frequency || "",
                            addedInstructions, med.mrciA ?? 0, med.mrciB ?? 0, med.mrciC ?? 0,
                            addedCatStatus, false
                          )}>
                          {med.drugName}
                        </button>
                        {med.optimizationNote && med.optimizationNote !== "新規追加" && (
                          <div className="text-xs text-gray-500 mt-0.5">{med.optimizationNote}</div>
                        )}
                      </td>
                      <td className="py-2 pr-2 text-gray-600 text-xs">{med.dosageForm ?? "-"}</td>
                      <td className="py-2 pr-2 text-gray-600 text-xs">{med.frequency ?? "-"}</td>
                      <td className="py-2 pr-1 text-center">
                        {isPendingDelete
                          ? <span className="font-mono text-xs text-gray-300">—</span>
                          : addedIsDup
                            ? <span className="font-mono text-xs text-gray-300 italic" title={addedCatLabel ? `重複排除: ${addedCatLabel}` : "重複排除済"}>({(med.mrciA ?? 0).toFixed(1)})</span>
                            : <span className="font-mono text-xs text-green-700">{(med.mrciA ?? 0).toFixed(1)}</span>
                        }
                      </td>
                      <td className="py-2 pr-1 text-center font-mono text-xs text-green-700">{isPendingDelete ? "—" : (med.mrciB ?? 0).toFixed(1)}</td>
                      <td className="py-2 pr-1 text-center font-mono text-xs text-green-700">{isPendingDelete ? "—" : (med.mrciC ?? 0).toFixed(1)}</td>
                      <td className="py-2 pr-1 text-center font-mono text-xs font-semibold text-green-700">{isPendingDelete ? "—" : `+${total.toFixed(1)}`}</td>
                      <td className="py-2">
                        {isPendingDelete ? (
                          <button
                            onClick={() => handleUndoDeleteAddedMed(med.id)}
                            className="text-xs text-orange-500 hover:text-orange-700 transition-colors whitespace-nowrap">
                            取り消し
                          </button>
                        ) : (
                          <button
                            onClick={() => handleDeleteAddedMed(med.id)}
                            className="text-xs text-red-400 hover:text-red-600 transition-colors whitespace-nowrap">
                            削除
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 新規追加薬剤セクション */}
          <div className="mt-4 pt-4 border-t border-dashed border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                追加薬剤
                {newAddedMeds.length > 0 && (
                  <span className="ml-1.5 text-xs text-gray-500">（未保存 {newAddedMeds.length}剤）</span>
                )}
              </span>
              <Button variant="outline" size="sm" onClick={handleAddMed}>＋ 薬剤を追加</Button>
            </div>
            {newAddedMeds.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-2">
                入院後に開始した薬剤や代替薬を追加できます
              </p>
            )}
            {newAddedMeds.map((aMed) => {
              const s = getAddedMedScores(aMed);
              return (
                <div key={aMed.tempId}
                  className="flex flex-wrap gap-2 items-center mb-2 p-2 bg-green-50 rounded-lg border border-green-200">
                  <input type="text" placeholder="薬剤名"
                    className="text-xs border rounded px-2 py-1 flex-1 min-w-[100px] bg-white"
                    value={aMed.drugName}
                    onChange={(e) => updateNewMed(aMed.tempId, "drugName", e.target.value)} />
                  <select value={aMed.dosageForm}
                    onChange={(e) => updateNewMed(aMed.tempId, "dosageForm", e.target.value)}
                    className="text-xs border rounded px-1.5 py-1 bg-white">
                    {Object.entries(DOSAGE_FORM_SCORES).map(([form, score]) => (
                      <option key={form} value={form}>{form} (A={score})</option>
                    ))}
                  </select>
                  <select value={aMed.frequency}
                    onChange={(e) => updateNewMed(aMed.tempId, "frequency", e.target.value)}
                    className="text-xs border rounded px-1.5 py-1 bg-white">
                    {Object.entries(FREQUENCY_SCORES).map(([freq, score]) => (
                      <option key={freq} value={freq}>{freq} (B={score})</option>
                    ))}
                  </select>
                  <input type="text" placeholder="メモ（任意）"
                    className="text-xs border rounded px-2 py-1 w-28 bg-white"
                    value={aMed.note}
                    onChange={(e) => updateNewMed(aMed.tempId, "note", e.target.value)} />
                  <span className="text-xs font-mono font-semibold text-green-700 whitespace-nowrap">
                    MRCI +{(s.a + s.b + s.c).toFixed(1)}
                  </span>
                  <button onClick={() => removeNewMed(aMed.tempId)}
                    className="text-xs text-red-400 hover:text-red-600 transition-colors">削除</button>
                </div>
              );
            })}
          </div>

          {/* 変更内容まとめ */}
          {(Object.values(medChanges).some((c) => c.changeType !== "continued") ||
            localAddedMeds.length > 0 ||
            newAddedMeds.some((m) => m.drugName.trim())) && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">変更内容</h3>
              <div className="space-y-2">
                {/* 変更のある既存薬 */}
                {originalMeds
                  .filter((m) => (medChanges[m.id]?.changeType ?? "continued") !== "continued")
                  .map((med) => {
                    const change = medChanges[med.id]!;
                    const scores = getEffectiveScores(med, change);
                    let description = "";
                    if (change.changeType === "discontinued") {
                      description = "中止";
                    } else if (change.changeType === "form_changed" && change.overrideForm) {
                      description = `剤形変更: ${med.dosageForm ?? ""}(A=${(med.originalMrciA ?? med.mrciA ?? 0).toFixed(1)}) → ${change.overrideForm}(A=${scores.a.toFixed(1)})`;
                    } else if (change.changeType === "freq_changed" && change.overrideFreq) {
                      description = `用法変更: ${med.frequency ?? ""}(B=${(med.originalMrciB ?? med.mrciB ?? 0).toFixed(1)}) → ${change.overrideFreq}(B=${scores.b.toFixed(1)})`;
                    } else if (change.changeType === "substituted") {
                      const parts: string[] = [];
                      if (change.overrideForm) parts.push(`剤形: ${change.overrideForm}(A=${scores.a.toFixed(1)})`);
                      if (change.overrideFreq) parts.push(`用法: ${change.overrideFreq}(B=${scores.b.toFixed(1)})`);
                      description = `代替薬変更${parts.length ? ` → ${parts.join("・")}` : ""}`;
                    } else {
                      description = CHANGE_TYPE_LABELS[change.changeType];
                    }
                    const badgeStyle = CHANGE_BADGE_STYLES[change.changeType];
                    return (
                      <div key={med.id} className="flex items-center gap-2 p-2 rounded-lg border bg-gray-50">
                        <span className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0 ${badgeStyle}`}>
                          {CHANGE_TYPE_LABELS[change.changeType]}
                        </span>
                        <span className="text-sm font-medium min-w-0 truncate">{med.drugName}</span>
                        {description && (
                          <span className="text-xs text-gray-500 shrink-0">{description}</span>
                        )}
                        <input
                          type="text"
                          placeholder={
                            change.changeType === "discontinued" ? "中止理由（任意）"
                            : change.changeType === "substituted" ? "代替薬名（任意）"
                            : "備考（任意）"
                          }
                          className="text-xs border rounded px-2 py-1 ml-auto w-36 shrink-0 bg-white"
                          value={manualNotes[med.id] ?? ""}
                          onChange={(e) => setManualNotes((prev) => ({ ...prev, [med.id]: e.target.value }))}
                        />
                      </div>
                    );
                  })}

                {/* 既存の追加薬剤（DB保存済み） */}
                {localAddedMeds.map((med) => {
                  const isPendingDelete = pendingDeleteMedIds.has(med.id);
                  return (
                    <div key={med.id} className={`flex items-center gap-2 p-2 rounded-lg border ${isPendingDelete ? "bg-red-50/30 border-red-200 opacity-60" : "bg-green-50 border-green-200"}`}>
                      <span className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0 ${isPendingDelete ? "bg-red-100 text-red-600 border-red-200" : "bg-green-100 text-green-700 border-green-200"}`}>
                        {isPendingDelete ? "削除待ち" : "追加"}
                      </span>
                      <span className={`text-sm font-medium min-w-0 truncate ${isPendingDelete ? "line-through text-gray-400" : "text-green-800"}`}>{med.drugName}</span>
                      {!isPendingDelete && (
                        <span className="text-xs text-gray-500 shrink-0">
                          {med.dosageForm ?? "-"} / {med.frequency ?? "-"}
                          {` (MRCI +${((med.mrciA ?? 0) + (med.mrciB ?? 0) + (med.mrciC ?? 0)).toFixed(1)})`}
                        </span>
                      )}
                      {isPendingDelete ? (
                        <button
                          onClick={() => handleUndoDeleteAddedMed(med.id)}
                          className="text-xs text-orange-500 hover:text-orange-700 transition-colors ml-auto shrink-0">
                          取り消し
                        </button>
                      ) : (
                        <button
                          onClick={() => handleDeleteAddedMed(med.id)}
                          className="text-xs text-red-400 hover:text-red-600 transition-colors ml-auto shrink-0">
                          削除
                        </button>
                      )}
                    </div>
                  );
                })}

                {/* 未保存の新規追加薬剤 */}
                {newAddedMeds.filter((m) => m.drugName.trim()).map((med) => {
                  const s = getAddedMedScores(med);
                  return (
                    <div key={med.tempId} className="flex items-center gap-2 p-2 rounded-lg border bg-green-50 border-green-200">
                      <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded border bg-green-100 text-green-700 border-green-200 font-medium shrink-0">
                        追加
                      </span>
                      <span className="text-sm font-medium text-green-800 min-w-0 truncate">{med.drugName}</span>
                      <span className="text-xs text-gray-500 shrink-0">
                        {med.dosageForm} / {med.frequency}
                        {` (MRCI +${(s.a + s.b + s.c).toFixed(1)})`}
                      </span>
                      <span className="text-xs text-orange-500 ml-auto shrink-0">未保存</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 最適化後MRCI */}
          <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="text-sm font-medium text-green-800">最適化後 MRCI</span>
              <span className="text-xl sm:text-2xl font-bold text-green-700">
                {currentMrci.toFixed(1)}
                {reduction > 0 && (
                  <span className="text-sm ml-2 text-green-600">(-{reduction.toFixed(1)} / {reductionPct.toFixed(0)}%削減)</span>
                )}
                {reduction < 0 && (
                  <span className="text-sm ml-2 text-orange-600">(+{Math.abs(reduction).toFixed(1)} 増加)</span>
                )}
              </span>
            </div>
            <Progress value={Math.max(0, 100 - reductionPct)} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* AI処方最適化提案 */}
      {geminiResult?.optimization_suggestions && geminiResult.optimization_suggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 flex-wrap">
              <span>AI処方最適化提案</span>
              <span className="text-xs font-normal text-gray-400">（チェックした提案をAI生成に反映）</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {geminiResult.optimization_suggestions.map((sug: OptimizationSuggestion, i: number) => (
              <div key={i}
                className={`p-3 rounded-lg border ${PRIORITY_COLORS[sug.priority]} ${selectedSuggestionIndices.has(i) ? "" : "opacity-50"}`}>
                <div className="flex items-start gap-3">
                  <Checkbox checked={selectedSuggestionIndices.has(i)} onCheckedChange={() => toggleSuggestion(i)} className="mt-0.5 shrink-0" />
                  <div className="flex-1 flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">{sug.suggestion_type}</Badge>
                        <span className="text-xs text-gray-500">{PRIORITY_LABELS[sug.priority]}</span>
                      </div>
                      <p className="text-sm font-medium">{sug.target_drug}</p>
                      <p className="text-sm text-gray-700 mt-0.5">{sug.detail}</p>
                      <p className="text-xs text-gray-500 mt-1">根拠: {sug.rationale}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-sm font-bold text-green-600">-{sug.expected_mrci_reduction.toFixed(1)}</span>
                      <p className="text-xs text-gray-400">MRCI削減</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {geminiResult.clinical_notes && (
              <Alert className="mt-2">
                <AlertDescription className="text-sm">
                  <strong>AI総合所見:</strong> {geminiResult.clinical_notes}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* 薬剤師コメント生成 */}
      <Card>
        <CardHeader><CardTitle className="text-base">薬剤師コメント生成・保存</CardTitle></CardHeader>
        <CardContent className="space-y-5">

          {/* ① 用途選択 */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">① 用途を選択</Label>
            <div className="flex flex-wrap gap-2">
              {NOTE_TYPES.map((nt) => (
                <button key={nt.value} onClick={() => setNoteType(nt.value)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    noteType === nt.value ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                  }`}>
                  {nt.label}
                </button>
              ))}
            </div>
          </div>

          {/* ② 薬剤師メモ */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">② 薬剤師メモ（任意）</Label>
              <span className="text-xs text-gray-400">AI生成の補足・方針として使用</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_PHRASES[noteType].map((phrase) => (
                <button key={phrase} onClick={() => insertPhrase(phrase, "memo")}
                  className="text-xs px-2 py-1 rounded border border-gray-300 bg-gray-50 hover:bg-gray-100 text-gray-600 transition-colors">
                  {phrase}
                </button>
              ))}
            </div>
            <Textarea ref={memoRef} placeholder="気になる点・患者背景・特記事項（空欄でもAI生成可）"
              className="h-24" value={pharmacistMemo} onChange={(e) => setPharmacistMemo(e.target.value)} />
          </div>

          {/* ③ AI生成 */}
          {geminiResult && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">③ AIで生成</Label>
              <div className="flex flex-col gap-2 p-3 bg-gray-50 rounded-lg border">
                <p className="text-xs text-gray-500">選択した提案・メモ・AI所見をもとに生成します。</p>
                <div className="flex gap-2 flex-wrap">
                  <select value={summaryModel} onChange={(e) => setSummaryModel(e.target.value as GeminiModel)}
                    className="text-sm border rounded px-2 py-1.5 bg-white" disabled={isGenerating}>
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash（高速）</option>
                    <option value="gemini-3-flash-preview">Gemini 3 Flash（高精度）</option>
                  </select>
                  <Button variant="outline" onClick={handleGenerateSummary} disabled={isGenerating}>
                    {isGenerating ? "生成中..." : `「${NOTE_TYPES.find((n) => n.value === noteType)?.label}」を生成`}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ④ 生成結果 */}
          {(generatedNote || !geminiResult) && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  {geminiResult ? "④ 生成結果（編集可能）" : "薬剤師コメント"}
                </Label>
                {generatedNote && (
                  <Button variant="outline" size="sm" onClick={() => handleCopy(generatedNote)}>コピー</Button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_PHRASES[noteType].map((phrase) => (
                  <button key={phrase} onClick={() => insertPhrase(phrase, "generated")}
                    className="text-xs px-2 py-1 rounded border border-gray-300 bg-gray-50 hover:bg-gray-100 text-gray-600 transition-colors">
                    {phrase}
                  </button>
                ))}
              </div>
              <Textarea ref={generatedRef}
                className="h-48 font-mono text-sm"
                placeholder={noteType === "guidance_soap"
                  ? "S（主観的情報）:\n\nO（客観的情報）:\n\nA（アセスメント）:\n\nP（プラン）:"
                  : "生成されたコメントがここに表示されます"}
                value={generatedNote}
                onChange={(e) => setGeneratedNote(e.target.value)} />
            </div>
          )}

          <Button className="w-full" onClick={handleApprove} disabled={isSaving}>
            {isSaving ? "保存中..." : "内容を保存・更新する"}
          </Button>
        </CardContent>
      </Card>

      {/* カルテ転記用サマリー */}
      {showSummary && editableSummary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between flex-wrap gap-2">
              <span>カルテ転記用サマリー</span>
              <Button variant="outline" size="sm" onClick={() => handleCopy(editableSummary)}>コピー</Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea className="h-48 font-mono text-sm bg-gray-50"
              value={editableSummary} onChange={(e) => setEditableSummary(e.target.value)} />
          </CardContent>
        </Card>
      )}

      {/* ── 薬剤スコア詳細モーダル ── */}
      {selectedDrugDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelectedDrugDetail(null)}>
          <div
            className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>

            {/* ヘッダー */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{selectedDrugDetail.drugName}</h2>
                {selectedDrugDetail.brandName && selectedDrugDetail.brandName !== selectedDrugDetail.drugName && (
                  <p className="text-sm text-gray-400">（{selectedDrugDetail.brandName}）</p>
                )}
                {selectedDrugDetail.isDiscontinued && (
                  <span className="inline-flex items-center text-xs px-2 py-0.5 rounded bg-red-100 text-red-600 mt-1">中止</span>
                )}
              </div>
              <button
                onClick={() => setSelectedDrugDetail(null)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none ml-4 shrink-0">✕</button>
            </div>

            <div className="space-y-3">
              {/* Section A */}
              <div className="p-3 rounded-lg border bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Section A — 剤形</span>
                  <span className={`font-mono text-base font-bold ${selectedDrugDetail.isFormDeduplicated ? "text-gray-400" : "text-blue-700"}`}>
                    {selectedDrugDetail.isFormDeduplicated
                      ? `(${selectedDrugDetail.mrciA.toFixed(1)})`
                      : selectedDrugDetail.mrciA.toFixed(1)}
                  </span>
                </div>
                <div className="text-sm text-gray-700">
                  <span className="font-medium">{selectedDrugDetail.effectiveDosageForm || "—"}</span>
                  {selectedDrugDetail.formCategory && (
                    <span className="text-gray-400 text-xs ml-2">
                      [{FORM_CATEGORY_LABELS[selectedDrugDetail.formCategory.categoryId] ?? selectedDrugDetail.formCategory.categoryId}]
                    </span>
                  )}
                </div>
                {selectedDrugDetail.isFormDeduplicated ? (
                  <p className="text-xs text-orange-600 mt-2 bg-orange-50 rounded px-2 py-1.5">
                    ⚠️ 重複排除 — 同一剤形カテゴリが処方内に既にカウント済みのため、この薬剤の Section A は合計に加算されません
                  </p>
                ) : (
                  <p className="text-xs text-green-600 mt-2">✓ この薬剤が剤形カテゴリを代表してカウントされます</p>
                )}
              </div>

              {/* Section B */}
              <div className="p-3 rounded-lg border bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Section B — 頻度</span>
                  <span className="font-mono text-base font-bold text-blue-700">{selectedDrugDetail.mrciB.toFixed(1)}</span>
                </div>
                <div className="text-sm text-gray-700">
                  <span className="font-medium">{selectedDrugDetail.effectiveFrequency || "—"}</span>
                  {selectedDrugDetail.matchedFreqKey && (
                    <span className="text-gray-400 text-xs ml-2">[{selectedDrugDetail.matchedFreqKey}]</span>
                  )}
                </div>
              </div>

              {/* Section C */}
              <div className="p-3 rounded-lg border bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Section C — 特別指示</span>
                  <span className="font-mono text-base font-bold text-blue-700">{selectedDrugDetail.mrciC.toFixed(1)}</span>
                </div>
                {selectedDrugDetail.sectionCHits.length > 0 ? (
                  <div className="space-y-1.5">
                    {selectedDrugDetail.sectionCHits.map((hit) => (
                      <div key={hit.categoryId} className="flex items-center justify-between text-sm">
                        <div>
                          <span className="font-medium">{SECTION_C_LABELS[hit.categoryId] ?? hit.categoryId}</span>
                          <span className="text-xs text-gray-400 ml-1">（{hit.matched.join("・")}）</span>
                        </div>
                        <span className="font-mono text-xs text-blue-600 font-semibold ml-2">+{hit.score.toFixed(1)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">特別指示なし（0点）</p>
                )}
              </div>

              {/* 合計 */}
              <div className="p-3 rounded-lg border-2 border-blue-200 bg-blue-50">
                <p className="text-xs font-semibold text-gray-500 mb-2">この薬剤の小計</p>
                <div className="flex items-center gap-2 text-sm font-mono flex-wrap">
                  <span className={selectedDrugDetail.isFormDeduplicated ? "text-gray-400" : "text-gray-700"}>
                    A = {selectedDrugDetail.isFormDeduplicated ? `(${selectedDrugDetail.mrciA.toFixed(1)})` : selectedDrugDetail.mrciA.toFixed(1)}
                  </span>
                  <span className="text-gray-400">+</span>
                  <span className="text-gray-700">B = {selectedDrugDetail.mrciB.toFixed(1)}</span>
                  <span className="text-gray-400">+</span>
                  <span className="text-gray-700">C = {selectedDrugDetail.mrciC.toFixed(1)}</span>
                  <span className="text-gray-400 mx-1">=</span>
                  <span className="font-bold text-blue-700">
                    {(
                      (selectedDrugDetail.isFormDeduplicated ? 0 : selectedDrugDetail.mrciA) +
                      selectedDrugDetail.mrciB +
                      selectedDrugDetail.mrciC
                    ).toFixed(1)}
                    <span className="text-xs font-normal text-gray-400 ml-1">（実質寄与）</span>
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  ※ Section A は処方全体で剤形カテゴリを重複排除して計算されます
                </p>
              </div>
            </div>

            <Button variant="outline" className="w-full mt-4" onClick={() => setSelectedDrugDetail(null)}>
              閉じる
            </Button>
          </div>
        </div>
      )}

      {/* PMIS詳細モーダル */}
      {selectedPmisDrug && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedPmisDrug(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-2">
              <span className="text-xl">⚠️</span>
              <div>
                <h2 className="text-lg font-bold text-orange-800">PMIS 該当薬剤</h2>
                <p className="text-sm text-gray-500">{selectedPmisDrug.drugName}</p>
              </div>
            </div>
            <p className="text-xs text-gray-400">高齢者に潜在的に不適切な薬剤（Potentially Inappropriate Medications）</p>
            <div className="space-y-3">
              {selectedPmisDrug.entries.map((entry) => {
                let names: string[] = [];
                try { names = JSON.parse(entry.genericNames); } catch { names = []; }
                return (
                  <div key={entry.id} className="border border-orange-200 rounded-lg p-3 bg-orange-50 space-y-2">
                    <div className="flex flex-wrap gap-1">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-orange-200 text-orange-800 font-medium">
                        {entry.category}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                        {entry.drugClass}
                      </span>
                    </div>
                    {names.length > 0 && (
                      <p className="text-xs text-gray-600">
                        <span className="font-medium">代表的な一般名: </span>{names.join("、")}
                      </p>
                    )}
                    {entry.targetPatients && (
                      <p className="text-xs text-gray-600">
                        <span className="font-medium">対象患者群: </span>{entry.targetPatients}
                      </p>
                    )}
                    <div className="text-sm text-orange-900 font-medium border-t border-orange-200 pt-2">
                      {entry.recommendation}
                    </div>
                  </div>
                );
              })}
            </div>
            <Button variant="outline" className="w-full" onClick={() => setSelectedPmisDrug(null)}>
              閉じる
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
