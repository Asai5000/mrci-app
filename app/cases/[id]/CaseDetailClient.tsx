"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { approveCase } from "@/actions/analyze";
import { deleteCase } from "@/actions/cases";
import { getMRCILevel } from "@/lib/mrci";
import { toast } from "sonner";
import type { Case, Medication } from "@/lib/schema";
import type { GeminiAnalysisResult, OptimizationSuggestion } from "@/lib/gemini";

interface Props {
  caseData: Case & { medications: Medication[] };
  geminiResult: GeminiAnalysisResult | null;
}

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-50 border-red-200",
  medium: "bg-yellow-50 border-yellow-200",
  low: "bg-blue-50 border-blue-200",
};

const PRIORITY_LABELS: Record<string, string> = {
  high: "優先度: 高",
  medium: "優先度: 中",
  low: "優先度: 低",
};

export default function CaseDetailClient({ caseData, geminiResult }: Props) {
  const router = useRouter();
  const isApproved = false; // 常に編集・再保存可能

  // 継続薬のセット（初期: 全薬剤）
  const [continuedIds, setContinuedIds] = useState<Set<string>>(
    new Set(caseData.medications.map((m) => m.id))
  );
  const [optimizationNotes, setOptimizationNotes] = useState<Record<string, string>>({});
  const [pharmacistNote, setPharmacistNote] = useState(caseData.pharmacistNote ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showSummary, setShowSummary] = useState(!!caseData.clinicalSummary);
  const [savedSummary, setSavedSummary] = useState(caseData.clinicalSummary ?? "");

  const toggleContinued = (id: string) => {
    setContinuedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 現在選択中の薬剤でMRCI合計を計算
  const currentMrci = caseData.medications
    .filter((m) => continuedIds.has(m.id))
    .reduce((s, m) => s + (m.mrciA ?? 0) + (m.mrciB ?? 0) + (m.mrciC ?? 0), 0);

  const originalMrci = caseData.mrciTotal ?? 0;
  const reduction = originalMrci - currentMrci;
  const reductionPct = originalMrci > 0 ? (reduction / originalMrci) * 100 : 0;
  const level = getMRCILevel(currentMrci);

  const handleApprove = async () => {
    setIsSaving(true);
    try {
      const { summary } = await approveCase(
        caseData.id,
        pharmacistNote,
        Array.from(continuedIds),
        optimizationNotes
      );
      setSavedSummary(summary);
      setShowSummary(true);
      toast.success("保存しました");
      router.refresh();
    } catch {
      toast.error("保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopySummary = () => {
    navigator.clipboard.writeText(savedSummary);
    toast.success("クリップボードにコピーしました");
  };

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">鑑別結果レビュー</h1>
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
        <div className="flex gap-2">
          {confirmDelete ? (
            <>
              <span className="text-sm text-gray-500 self-center">本当に削除しますか？</span>
              <Button
                variant="destructive"
                size="sm"
                disabled={isDeleting}
                onClick={async () => {
                  setIsDeleting(true);
                  try {
                    await deleteCase(caseData.id);
                    toast.success("症例を削除しました");
                    router.push("/");
                  } catch {
                    toast.error("削除に失敗しました");
                    setIsDeleting(false);
                    setConfirmDelete(false);
                  }
                }}
              >
                {isDeleting ? "削除中..." : "削除する"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>
                キャンセル
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                onClick={() => setConfirmDelete(true)}
              >
                削除
              </Button>
              <Button variant="outline" size="sm" onClick={() => router.push("/")}>
                ← 一覧へ
              </Button>
            </>
          )}
        </div>
      </div>

      {/* MRCIサマリー */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-gray-500">Section A（剤形）</p>
            <p className="text-2xl font-bold text-gray-700">
              {caseData.mrciSectionA?.toFixed(1) ?? "-"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-gray-500">Section B（頻度）</p>
            <p className="text-2xl font-bold text-gray-700">
              {caseData.mrciSectionB?.toFixed(1) ?? "-"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-gray-500">Section C（特別指示）</p>
            <p className="text-2xl font-bold text-gray-700">
              {caseData.mrciSectionC?.toFixed(1) ?? "-"}
            </p>
          </CardContent>
        </Card>
        <Card className="border-2 border-blue-200">
          <CardContent className="pt-6">
            <p className="text-xs text-gray-500">合計MRCI</p>
            <p className="text-3xl font-bold text-blue-600">
              {originalMrci.toFixed(1)}
            </p>
            <Badge
              variant={
                level.level === "high"
                  ? "destructive"
                  : level.level === "medium"
                  ? "secondary"
                  : "outline"
              }
              className="mt-1"
            >
              複雑度: {level.label}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* 薬剤一覧 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>薬剤一覧（チェックを外すと中止・変更扱い）</span>
            <span className="text-sm font-normal text-gray-500">
              継続: {continuedIds.size}/{caseData.medications.length}剤
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-gray-500 text-left">
                  <th className="pb-2 w-8"></th>
                  <th className="pb-2 pr-3 font-medium">薬剤名</th>
                  <th className="pb-2 pr-3 font-medium">用量・剤形</th>
                  <th className="pb-2 pr-3 font-medium">用法</th>
                  <th className="pb-2 pr-3 font-medium text-center">A</th>
                  <th className="pb-2 pr-3 font-medium text-center">B</th>
                  <th className="pb-2 pr-3 font-medium text-center">C</th>
                  <th className="pb-2 pr-3 font-medium text-center">小計</th>
                  <th className="pb-2 font-medium">変更メモ</th>
                </tr>
              </thead>
              <tbody>
                {caseData.medications.map((med) => {
                  const isContinued = continuedIds.has(med.id);
                  const instructions = med.specialInstructions
                    ? JSON.parse(med.specialInstructions)
                    : [];
                  const subtotal = (med.mrciA ?? 0) + (med.mrciB ?? 0) + (med.mrciC ?? 0);

                  return (
                    <tr
                      key={med.id}
                      className={`border-b transition-colors ${
                        isContinued ? "" : "opacity-40 bg-gray-50"
                      }`}
                    >
                      <td className="py-2">
                        <Checkbox
                          checked={isContinued}
                          onCheckedChange={() => !isApproved && toggleContinued(med.id)}
                          disabled={isApproved}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <span className="font-medium">{med.drugName}</span>
                        {med.brandName && med.brandName !== med.drugName && (
                          <span className="text-gray-400 text-xs ml-1">({med.brandName})</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-gray-600">
                        {med.dose ?? "-"} {med.dosageForm ?? ""}
                      </td>
                      <td className="py-2 pr-3 text-gray-600">
                        <div>{med.frequency ?? "-"}</div>
                        {instructions.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {instructions.map((inst: string, i: number) => (
                              <Badge key={i} variant="outline" className="text-xs px-1 py-0">
                                {inst}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-center font-mono">{med.mrciA?.toFixed(1)}</td>
                      <td className="py-2 pr-3 text-center font-mono">{med.mrciB?.toFixed(1)}</td>
                      <td className="py-2 pr-3 text-center font-mono">{med.mrciC?.toFixed(1)}</td>
                      <td className="py-2 pr-3 text-center font-mono font-semibold">{subtotal.toFixed(1)}</td>
                      <td className="py-2">
                        {!isContinued && !isApproved && (
                          <input
                            type="text"
                            placeholder="中止理由・代替案"
                            className="text-xs border rounded px-2 py-1 w-full"
                            value={optimizationNotes[med.id] ?? ""}
                            onChange={(e) =>
                              setOptimizationNotes((prev) => ({
                                ...prev,
                                [med.id]: e.target.value,
                              }))
                            }
                          />
                        )}
                        {isApproved && med.optimizationNote && (
                          <span className="text-xs text-gray-500">{med.optimizationNote}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 最適化後MRCI */}
          <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-green-800">最適化後 MRCI</span>
              <span className="text-2xl font-bold text-green-700">
                {currentMrci.toFixed(1)}
                {reduction > 0 && (
                  <span className="text-sm ml-2 text-green-600">
                    (-{reduction.toFixed(1)} / {reductionPct.toFixed(0)}%削減)
                  </span>
                )}
              </span>
            </div>
            <Progress value={100 - reductionPct} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* AI処方最適化提案 */}
      {geminiResult?.optimization_suggestions && geminiResult.optimization_suggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI処方最適化提案</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {geminiResult.optimization_suggestions.map((sug: OptimizationSuggestion, i: number) => (
              <div
                key={i}
                className={`p-3 rounded-lg border ${PRIORITY_COLORS[sug.priority]}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">
                        {sug.suggestion_type}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {PRIORITY_LABELS[sug.priority]}
                      </span>
                    </div>
                    <p className="text-sm font-medium">{sug.target_drug}</p>
                    <p className="text-sm text-gray-700 mt-0.5">{sug.detail}</p>
                    <p className="text-xs text-gray-500 mt-1">根拠: {sug.rationale}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-sm font-bold text-green-600">
                      -{sug.expected_mrci_reduction.toFixed(1)}
                    </span>
                    <p className="text-xs text-gray-400">MRCI削減</p>
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

      {/* 薬剤師コメント + 保存 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">薬剤師コメント・保存</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>薬剤師コメント（任意）</Label>
            <Textarea
              placeholder="医師への申し送り事項、注意点など"
              className="h-24"
              value={pharmacistNote}
              onChange={(e) => setPharmacistNote(e.target.value)}
            />
          </div>
          <Button
            className="w-full"
            onClick={handleApprove}
            disabled={isSaving}
          >
            {isSaving ? "保存中..." : "内容を保存・更新する"}
          </Button>
        </CardContent>
      </Card>

      {/* カルテ転記用テキスト */}
      {showSummary && savedSummary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>カルテ転記用サマリー</span>
              <Button variant="outline" size="sm" onClick={handleCopySummary}>
                コピー
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              className="h-48 font-mono text-sm bg-gray-50"
              value={savedSummary}
              readOnly
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
