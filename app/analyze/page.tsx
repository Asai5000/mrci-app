"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { analyzeOnlyText, analyzeOnlyImage, saveCase } from "@/actions/analyze";
import { getMRCILevel } from "@/lib/mrci";
import { calculateCrCl, calculateEGFR, getCKDStageLabel } from "@/lib/renal";
import { toast } from "sonner";
import type { GeminiAnalysisResult, GeminiModel, OptimizationSuggestion, RenalData } from "@/lib/gemini";
import { Input } from "@/components/ui/input";

const AGE_GROUPS = ["10代", "20代", "30代", "40代", "50代", "60代", "70代", "80代", "90代以上"];
const GENDERS = ["男性", "女性", "その他"];

const SAMPLE_PRESCRIPTION = `アムロジピン錠5mg 1錠 分1 朝食後
エナラプリルマレイン酸塩錠5mg 1錠 分1 朝食後
メトプロロール酒石酸塩錠60mg 2錠 分2 朝夕食後
フロセミド錠20mg 1錠 分1 朝食後
スピロノラクトン錠25mg 1錠 分1 朝食後
アスピリン腸溶錠100mg 1錠 分1 朝食後
クロピドグレル錠75mg 1錠 分1 朝食後
アトルバスタチンカルシウム錠10mg 1錠 分1 就寝前
エソメプラゾールカプセル20mg 1カプセル 分1 朝食前
ランソプラゾールOD錠15mg 1錠 分1 朝食前
アジスロマイシン水和物錠250mg 2錠 分1 朝食後 3日間
レバミピド錠100mg 3錠 分3 毎食後`;

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-50 border-red-200",
  medium: "bg-yellow-50 border-yellow-200",
  low: "bg-blue-50 border-blue-200",
};

type Phase = "input" | "result";

export default function AnalyzePage() {
  const router = useRouter();

  // フェーズ管理
  const [phase, setPhase] = useState<Phase>("input");

  // 入力フォーム
  const [ageGroup, setAgeGroup] = useState("");
  const [gender, setGender] = useState("");
  const [serumCreatinine, setSerumCreatinine] = useState("");
  const [bodyWeight, setBodyWeight] = useState("");
  const [prescriptionText, setPrescriptionText] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [inputType, setInputType] = useState<"text" | "image">("text");
  const [selectedModel, setSelectedModel] = useState<GeminiModel>("gemini-2.5-flash");

  // 腎機能計算（リアルタイム）
  const creatinineVal = parseFloat(serumCreatinine) || null;
  const weightVal = parseFloat(bodyWeight) || null;
  const calcCrcl =
    ageGroup && creatinineVal && weightVal
      ? calculateCrCl(ageGroup, gender || undefined, weightVal, creatinineVal)
      : null;
  const calcEgfr =
    ageGroup && creatinineVal
      ? calculateEGFR(ageGroup, gender || undefined, creatinineVal)
      : null;

  // 解析結果（DB未保存）
  const [analysisResult, setAnalysisResult] = useState<GeminiAnalysisResult | null>(null);

  // UI状態
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addImageFiles = useCallback((files: File[]) => {
    const valid = files.filter((f) =>
      ["image/jpeg", "image/png", "image/webp"].includes(f.type)
    );
    if (valid.length === 0) return;
    setImageFiles((prev) => [...prev, ...valid]);
    valid.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) =>
        setImagePreviews((prev) => [...prev, ev.target?.result as string]);
      reader.readAsDataURL(file);
    });
  }, []);

  const removeImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    addImageFiles(files);
    e.target.value = "";
  };

  useEffect(() => {
    if (inputType !== "image") return;
    const handlePaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.items ?? [])
        .filter((item) => item.type.startsWith("image/"))
        .map((item) => item.getAsFile())
        .filter((f): f is File => f !== null);
      if (files.length > 0) addImageFiles(files);
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [inputType, addImageFiles]);

  // Step 1: AI解析（DB保存なし）
  const handleAnalyze = async () => {
    if (!ageGroup) { setError("年齢層を選択してください"); return; }
    if (inputType === "text" && !prescriptionText.trim()) { setError("処方情報を入力してください"); return; }
    if (inputType === "image" && imageFiles.length === 0) { setError("画像を選択してください"); return; }
    setError("");
    setIsAnalyzing(true);

    const renalData: RenalData | undefined = creatinineVal
      ? {
          serumCreatinine: creatinineVal,
          bodyWeight: weightVal ?? undefined,
          crcl: calcCrcl ?? undefined,
          egfr: calcEgfr ?? undefined,
        }
      : undefined;

    try {
      let result: GeminiAnalysisResult;
      if (inputType === "text") {
        result = await analyzeOnlyText({ prescriptionText: prescriptionText.trim(), model: selectedModel, renalData });
      } else {
        const images = imagePreviews.map((preview, i) => ({
          imageBase64: preview.split(",")[1],
          mimeType: imageFiles[i].type,
        }));
        result = await analyzeOnlyImage({ images, model: selectedModel, renalData });
      }
      setAnalysisResult(result);
      setPhase("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "解析に失敗しました");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Step 2: 症例登録（DB保存）
  const handleSave = async () => {
    if (!analysisResult) return;
    setIsSaving(true);
    try {
      const caseId = await saveCase({
        patientAgeGroup: ageGroup,
        patientGender: gender || undefined,
        serumCreatinine: creatinineVal ?? undefined,
        bodyWeight: weightVal ?? undefined,
        calculatedCrcl: calcCrcl ?? undefined,
        calculatedEgfr: calcEgfr ?? undefined,
        rawInputType: inputType,
        rawInputText: inputType === "text" ? prescriptionText : undefined,
        result: analysisResult,
      });
      toast.success("症例を登録しました");
      router.push(`/cases/${caseId}`);
    } catch {
      toast.error("登録に失敗しました");
    } finally {
      setIsSaving(false);
    }
  };

  // ── 入力フェーズ ────────────────────────────────────────────
  if (phase === "input") {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">持参薬鑑別 — 新規解析</h1>
          <p className="text-sm text-gray-500 mt-1">処方情報を入力し、AIによるMRCI算出と処方最適化提案を取得します</p>
        </div>

        {/* 患者属性 */}
        <Card>
          <CardHeader><CardTitle className="text-base">患者属性（匿名化情報）</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label>年齢層 <span className="text-red-500">*</span></Label>
                <Select value={ageGroup} onValueChange={setAgeGroup}>
                  <SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger>
                  <SelectContent>
                    {AGE_GROUPS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>性別区分</Label>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger><SelectValue placeholder="選択（任意）" /></SelectTrigger>
                  <SelectContent>
                    {GENDERS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 腎機能計算 */}
            <div className="border-t pt-3">
              <p className="text-xs text-gray-500 mb-2">腎機能計算（任意 — 入力すると腎機能考慮の提案が追加されます）</p>
              <div className="space-y-2">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1 min-w-[130px] flex-1 sm:flex-none sm:w-40">
                    <Label className="text-xs">血清Cr (mg/dL)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="例: 1.20"
                      value={serumCreatinine}
                      onChange={(e) => setSerumCreatinine(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1 min-w-[130px] flex-1 sm:flex-none sm:w-40">
                    <Label className="text-xs">体重 (kg) <span className="text-gray-400">CrCl用</span></Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="例: 65.0"
                      value={bodyWeight}
                      onChange={(e) => setBodyWeight(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm min-h-[1.5rem]">
                  {calcEgfr != null && (
                    <span className="text-gray-700">
                      eGFR: <strong className="text-blue-600">{calcEgfr}</strong>{" "}
                      <span className="text-xs text-gray-500">mL/min/1.73m²</span>
                      <span className="ml-1 text-xs text-gray-400">({getCKDStageLabel(calcEgfr)})</span>
                    </span>
                  )}
                  {calcCrcl != null && (
                    <span className="text-gray-700">
                      CrCl: <strong className="text-blue-600">{calcCrcl}</strong>{" "}
                      <span className="text-xs text-gray-500">mL/min</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* モデル選択 */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 p-3 bg-white border rounded-lg">
          <span className="text-sm font-medium text-gray-700">AIモデル:</span>
          <div className="flex gap-2">
            {(
              [
                { id: "gemini-2.5-flash", label: "2.5 Flash", desc: "安定版" },
                { id: "gemini-3-flash-preview", label: "3 Flash", desc: "最新Preview" },
              ] as { id: GeminiModel; label: string; desc: string }[]
            ).map(({ id, label, desc }) => (
              <button
                key={id}
                onClick={() => setSelectedModel(id)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  selectedModel === id
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {label}
                <span className="ml-1.5 text-xs opacity-75">{desc}</span>
              </button>
            ))}
          </div>
          <span className="text-xs text-gray-400 ml-auto">{selectedModel}</span>
        </div>

        {/* 処方入力 */}
        <Card>
          <CardHeader><CardTitle className="text-base">処方情報入力</CardTitle></CardHeader>
          <CardContent>
            <Tabs defaultValue="text" onValueChange={(v) => setInputType(v as "text" | "image")}>
              <TabsList className="mb-4">
                <TabsTrigger value="text">テキスト入力</TabsTrigger>
                <TabsTrigger value="image">画像アップロード</TabsTrigger>
              </TabsList>

              <TabsContent value="text" className="space-y-3">
                <Alert>
                  <AlertDescription className="text-xs text-gray-600">
                    お薬手帳や処方箋の内容をそのまま貼り付けてください。氏名・生年月日など個人を特定できる情報は入力しないでください。
                  </AlertDescription>
                </Alert>
                <Textarea
                  placeholder={`例:\nアムロジピン錠5mg 1錠 分1 朝食後\nメトプロロール錠60mg 2錠 分2 朝夕食後\n...`}
                  className="h-52 font-mono text-sm"
                  value={prescriptionText}
                  onChange={(e) => setPrescriptionText(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPrescriptionText(SAMPLE_PRESCRIPTION)}>
                    サンプルを入力
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPrescriptionText("")}>
                    クリア
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="image" className="space-y-3">
                <Alert>
                  <AlertDescription className="text-xs text-gray-600">
                    お薬手帳・処方箋の写真をアップロードしてください。複数枚まとめて解析できます。
                    <strong className="block mt-1">個人情報（氏名・生年月日）が写り込んでいても、AIは無視して処理します。</strong>
                  </AlertDescription>
                </Alert>

                {imagePreviews.length > 0 && (
                  <div className="grid grid-cols-2 gap-3">
                    {imagePreviews.map((preview, i) => (
                      <div key={i} className="relative group border rounded-lg overflow-hidden bg-gray-50">
                        <img
                          src={preview}
                          alt={`preview-${i + 1}`}
                          className="w-full max-h-48 object-contain"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(i)}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 text-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity leading-none"
                        >
                          ×
                        </button>
                        <p className="text-xs text-gray-400 px-2 py-1 truncate">{imageFiles[i]?.name ?? `画像 ${i + 1}`}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div
                  className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="text-gray-400">
                    <p className="text-3xl mb-1">📷</p>
                    <p className="text-sm">
                      {imagePreviews.length > 0 ? "クリックしてさらに追加" : "クリックまたはペーストで画像を追加"}
                    </p>
                    <p className="text-xs mt-1">JPG · PNG · WebP · Ctrl+V でペースト可 · 複数枚OK</p>
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={handleImageChange}
                />
              </TabsContent>
            </Tabs>

            {error && (
              <Alert variant="destructive" className="mt-3">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button className="w-full mt-4" onClick={handleAnalyze} disabled={isAnalyzing}>
              {isAnalyzing ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  AI解析中... (15〜30秒程度かかります)
                </span>
              ) : (
                "AI解析を開始"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── 結果確認フェーズ（DB未保存） ────────────────────────────
  const result = analysisResult!;
  const level = getMRCILevel(result.mrci_summary.total);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* ヘッダー */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">解析結果の確認</h1>
          <p className="text-sm text-gray-500 mt-1">
            {ageGroup}{gender ? ` · ${gender}` : ""}
            {calcEgfr != null && ` · eGFR: ${calcEgfr} (${getCKDStageLabel(calcEgfr)})`}
            {calcCrcl != null && ` · CrCl: ${calcCrcl} mL/min`}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => { setPhase("input"); setAnalysisResult(null); }}>
            ← 入力に戻る
          </Button>
        </div>
      </div>

      {/* 未保存バナー */}
      <Alert className="border-amber-300 bg-amber-50">
        <AlertDescription className="text-amber-800 font-medium">
          この結果はまだ保存されていません。内容を確認し、問題なければ「症例として登録」ボタンで保存してください。
        </AlertDescription>
      </Alert>

      {/* MRCIサマリー */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
            <p className="text-xs text-gray-500">Section A（剤形）</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-700">{result.mrci_summary.section_a_total.toFixed(1)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
            <p className="text-xs text-gray-500">Section B（頻度）</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-700">{result.mrci_summary.section_b_total.toFixed(1)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
            <p className="text-xs text-gray-500">Section C（特別指示）</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-700">{result.mrci_summary.section_c_total.toFixed(1)}</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-blue-200">
          <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
            <p className="text-xs text-gray-500">合計MRCI</p>
            <p className="text-2xl sm:text-3xl font-bold text-blue-600">{result.mrci_summary.total.toFixed(1)}</p>
            <Badge variant={level.level === "high" ? "destructive" : level.level === "medium" ? "secondary" : "outline"} className="mt-1">
              複雑度: {level.label}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* 薬剤一覧 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">抽出された薬剤一覧（{result.extracted_medications.length}剤）</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <table className="w-full text-sm min-w-[540px]">
              <thead>
                <tr className="border-b text-gray-500 text-left">
                  <th className="pb-2 pr-3 font-medium">薬剤名</th>
                  <th className="pb-2 pr-3 font-medium">用量・剤形</th>
                  <th className="pb-2 pr-3 font-medium">用法</th>
                  <th className="pb-2 pr-3 font-medium text-center">A</th>
                  <th className="pb-2 pr-3 font-medium text-center">B</th>
                  <th className="pb-2 pr-3 font-medium text-center">C</th>
                  <th className="pb-2 font-medium text-center">小計</th>
                </tr>
              </thead>
              <tbody>
                {result.extracted_medications.map((med, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-2 pr-3">
                      <span className="font-medium">{med.drug_name}</span>
                      {med.brand_name && med.brand_name !== med.drug_name && (
                        <span className="text-gray-400 text-xs ml-1">({med.brand_name})</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-gray-600">{med.dose} {med.dosage_form}</td>
                    <td className="py-2 pr-3 text-gray-600">
                      <div>{med.frequency}</div>
                      {med.special_instructions.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {med.special_instructions.map((inst, j) => (
                            <Badge key={j} variant="outline" className="text-xs px-1 py-0">{inst}</Badge>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-center font-mono">{med.mrci_a.toFixed(1)}</td>
                    <td className="py-2 pr-3 text-center font-mono">{med.mrci_b.toFixed(1)}</td>
                    <td className="py-2 pr-3 text-center font-mono">{med.mrci_c.toFixed(1)}</td>
                    <td className="py-2 text-center font-mono font-semibold">
                      {(med.mrci_a + med.mrci_b + med.mrci_c).toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 最適化提案 */}
      {result.optimization_suggestions.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">AI処方最適化提案</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {result.optimization_suggestions.map((sug: OptimizationSuggestion, i: number) => (
              <div key={i} className={`p-3 rounded-lg border ${PRIORITY_COLORS[sug.priority]}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">{sug.suggestion_type}</Badge>
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
            ))}
            {result.clinical_notes && (
              <Alert className="mt-2">
                <AlertDescription className="text-sm">
                  <strong>AI総合所見:</strong> {result.clinical_notes}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* 登録ボタン */}
      <Card className="border-2 border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div>
              <p className="font-medium text-gray-900">この結果を症例として登録しますか？</p>
              <p className="text-sm text-gray-500 mt-0.5">
                登録後は詳細ページで薬剤の継続/中止を選択し、カルテ転記が行えます
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" onClick={() => { setPhase("input"); setAnalysisResult(null); }}>
                やり直す
              </Button>
              <Button onClick={handleSave} disabled={isSaving} className="flex-1 sm:flex-none px-6">
                {isSaving ? "登録中..." : "症例として登録"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
