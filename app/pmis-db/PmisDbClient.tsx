"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { createPmisDrug, updatePmisDrug, deletePmisDrug } from "@/actions/pmisDb";
import type { PmisDrug } from "@/lib/schema";

interface Props {
  initialData: PmisDrug[];
}

type FormState = Omit<PmisDrug, "id">;

const EMPTY_FORM: FormState = {
  category: "",
  drugClass: "",
  genericNames: "[]",
  targetPatients: null,
  recommendation: "",
  applicableGenericNames: null,
};

function parseNames(json: string | null | undefined): string[] {
  if (!json) return [];
  try { return JSON.parse(json) as string[]; } catch { return []; }
}

export default function PmisDbClient({ initialData }: Props) {
  const [data, setData] = useState(initialData);
  const [search, setSearch] = useState("");
  const [editTarget, setEditTarget] = useState<PmisDrug | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [genericNamesInput, setGenericNamesInput] = useState("");
  const [applicableNamesInput, setApplicableNamesInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (r) =>
        r.category.toLowerCase().includes(q) ||
        r.drugClass.toLowerCase().includes(q) ||
        r.genericNames.toLowerCase().includes(q) ||
        r.recommendation.toLowerCase().includes(q) ||
        (r.applicableGenericNames ?? "").toLowerCase().includes(q)
    );
  }, [data, search]);

  function openEdit(drug: PmisDrug) {
    setEditTarget(drug);
    setIsNew(false);
    setGenericNamesInput(parseNames(drug.genericNames).join("、"));
    setApplicableNamesInput(parseNames(drug.applicableGenericNames).join("\n"));
    setForm({
      category: drug.category,
      drugClass: drug.drugClass,
      genericNames: drug.genericNames,
      targetPatients: drug.targetPatients ?? null,
      recommendation: drug.recommendation,
      applicableGenericNames: drug.applicableGenericNames ?? null,
    });
  }

  function openNew() {
    setEditTarget(null);
    setIsNew(true);
    setGenericNamesInput("");
    setApplicableNamesInput("");
    setForm(EMPTY_FORM);
  }

  function closeDialog() {
    setEditTarget(null);
    setIsNew(false);
  }

  function buildJson(input: string, sep: RegExp): string {
    const names = input.split(sep).map((s) => s.trim()).filter(Boolean);
    return JSON.stringify(names);
  }

  async function handleSave() {
    if (!form.category.trim() || !form.drugClass.trim() || !form.recommendation.trim()) {
      toast.error("分類・薬物クラス・推奨される使用法は必須です");
      return;
    }
    setIsSaving(true);
    const payload: FormState = {
      ...form,
      genericNames: buildJson(genericNamesInput, /[、,，]/),
      applicableGenericNames: applicableNamesInput.trim()
        ? buildJson(applicableNamesInput, /[\n、,，\s　]+/)
        : null,
    };
    try {
      if (isNew) {
        await createPmisDrug(payload);
        setData((prev) => [...prev, { ...payload, id: Date.now() }]);
        toast.success("追加しました");
      } else if (editTarget) {
        await updatePmisDrug(editTarget.id, payload);
        setData((prev) => prev.map((r) => (r.id === editTarget.id ? { ...r, ...payload } : r)));
        toast.success("更新しました");
      }
      closeDialog();
    } catch {
      toast.error("保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await deletePmisDrug(id);
      setData((prev) => prev.filter((r) => r.id !== id));
      setConfirmDeleteId(null);
      toast.success("削除しました");
    } catch {
      toast.error("削除に失敗しました");
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">PMIS 薬剤管理</h1>
          <p className="text-sm text-muted-foreground mt-1">
            高齢者に潜在的に不適切な薬剤（PMIS）一覧 — {data.length}件
          </p>
        </div>
        <Button onClick={openNew}>＋ 追加</Button>
      </div>

      <Input
        placeholder="分類・薬物クラス・一般名・推奨事項で検索..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="text-sm text-muted-foreground">{filtered.length}件表示</div>

      <div className="space-y-2">
        {filtered.map((drug) => {
          const repNames = parseNames(drug.genericNames);
          const appNames = parseNames(drug.applicableGenericNames);
          return (
            <div key={drug.id} className="border rounded-lg p-4 bg-card hover:bg-muted/40 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50 shrink-0">
                      {drug.category}
                    </Badge>
                    <span className="font-medium text-sm">{drug.drugClass}</span>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">代表的な一般名: </span>
                    {repNames.length > 0 ? repNames.join("、") : "—"}
                  </p>

                  {appNames.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">該当薬剤: </span>
                      {appNames.slice(0, 8).join(" / ")}
                      {appNames.length > 8 && <span className="text-gray-400"> …他{appNames.length - 8}件</span>}
                    </p>
                  )}

                  {drug.targetPatients && (
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">対象: </span>
                      {drug.targetPatients}
                    </p>
                  )}

                  <div className="text-sm text-amber-800 bg-amber-50 rounded px-2 py-1.5">
                    {drug.recommendation}
                  </div>

                </div>

                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => openEdit(drug)}>編集</Button>
                  <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50"
                    onClick={() => setConfirmDeleteId(drug.id)}>削除</Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 編集・新規ダイアログ */}
      <Dialog open={isNew || editTarget !== null} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isNew ? "PMIS薬剤を追加" : "PMIS薬剤を編集"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>分類 *</Label>
                <Input value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  placeholder="抗精神病薬" />
              </div>
              <div className="space-y-1">
                <Label>薬物クラス *</Label>
                <Input value={form.drugClass}
                  onChange={(e) => setForm((f) => ({ ...f, drugClass: e.target.value }))}
                  placeholder="定型抗精神病薬" />
              </div>
            </div>

            <div className="space-y-1">
              <Label>代表的な一般名（読点区切り）</Label>
              <Input value={genericNamesInput}
                onChange={(e) => setGenericNamesInput(e.target.value)}
                placeholder="ハロペリドール、リスペリドン" />
            </div>

            <div className="space-y-1">
              <Label>該当する一般名（改行または読点区切り）</Label>
              <Textarea rows={4} value={applicableNamesInput}
                onChange={(e) => setApplicableNamesInput(e.target.value)}
                placeholder={"ハロペリドール\nクロルプロマジン塩酸塩\nレボメプロマジンマレイン酸塩"} />
              <p className="text-xs text-muted-foreground">照合に使用する詳細な一般名リスト</p>
            </div>

            <div className="space-y-1">
              <Label>対象となる患者群</Label>
              <Input value={form.targetPatients ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, targetPatients: e.target.value || null }))}
                placeholder="認知症患者全般" />
            </div>

            <div className="space-y-1">
              <Label>推奨される使用法 *</Label>
              <Textarea rows={3} value={form.recommendation}
                onChange={(e) => setForm((f) => ({ ...f, recommendation: e.target.value }))}
                placeholder="可能な限り使用を控える。使用する場合は..." />
            </div>

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>キャンセル</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 削除確認 */}
      <Dialog open={confirmDeleteId !== null} onOpenChange={(o) => !o && setConfirmDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>削除の確認</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">このPMIS薬剤データを削除しますか？</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>キャンセル</Button>
            <Button variant="destructive"
              onClick={() => confirmDeleteId !== null && handleDelete(confirmDeleteId)}>
              削除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
