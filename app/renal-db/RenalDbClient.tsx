"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  updateRenalGuideline,
  createRenalGuideline,
  deleteRenalGuideline,
} from "@/actions/renalDb";
import type { RenalDosingGuideline } from "@/lib/schema";

interface Props {
  initialData: RenalDosingGuideline[];
}

const ROUTE_LABELS: Record<string, string> = {
  oral: "内服",
  injection: "注射",
  topical: "外用",
  inhalation: "吸入",
  unknown: "不明",
};

const PAGE_SIZE = 25;

const EMPTY_FORM: Omit<RenalDosingGuideline, "id"> = {
  category: null,
  genericName: "",
  drugNumber: null,
  brandName: null,
  routeCategory: "oral",
  dialyzability: null,
  renalDamage: null,
  isContraindicated: 0,
  doseNormal: null,
  doseMild: null,
  doseModerate: null,
  doseSevere: null,
  doseHdPd: null,
};

export default function RenalDbClient({ initialData }: Props) {
  const [data, setData] = useState(initialData);
  const [search, setSearch] = useState("");
  const [routeFilter, setRouteFilter] = useState<string>("all");
  const [contraindicatedOnly, setContraindicatedOnly] = useState(false);
  const [page, setPage] = useState(1);

  // Edit modal
  const [editTarget, setEditTarget] = useState<RenalDosingGuideline | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<Omit<RenalDosingGuideline, "id">>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // Filter
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((r) => {
      if (q && !r.genericName.toLowerCase().includes(q) &&
          !(r.brandName ?? "").toLowerCase().includes(q) &&
          !(r.category ?? "").toLowerCase().includes(q)) return false;
      if (routeFilter !== "all" && r.routeCategory !== routeFilter) return false;
      if (contraindicatedOnly && r.isContraindicated !== 1) return false;
      return true;
    });
  }, [data, search, routeFilter, contraindicatedOnly]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const openEdit = (row: RenalDosingGuideline) => {
    setIsNew(false);
    setEditTarget(row);
    setForm({ ...row });
  };

  const openNew = () => {
    setIsNew(true);
    setEditTarget({ id: -1, ...EMPTY_FORM });
    setForm({ ...EMPTY_FORM });
  };

  const handleSave = async () => {
    if (!form.genericName.trim()) {
      toast.error("一般名は必須です");
      return;
    }
    setIsSaving(true);
    try {
      if (isNew) {
        await createRenalGuideline(form);
        toast.success("追加しました");
        // Optimistic: reload page for accurate id
        window.location.reload();
      } else if (editTarget) {
        await updateRenalGuideline(editTarget.id, form);
        setData((prev) =>
          prev.map((r) => (r.id === editTarget.id ? { ...r, ...form } : r))
        );
        toast.success("保存しました");
        setEditTarget(null);
      }
    } catch {
      toast.error("保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    setIsSaving(true);
    try {
      await deleteRenalGuideline(id);
      setData((prev) => prev.filter((r) => r.id !== id));
      setEditTarget(null);
      setConfirmDeleteId(null);
      toast.success("削除しました");
    } catch {
      toast.error("削除に失敗しました");
    } finally {
      setIsSaving(false);
    }
  };

  const setField = <K extends keyof typeof form>(key: K, value: typeof form[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">腎機能投与量ガイドライン</h1>
          <p className="text-sm text-gray-500 mt-0.5">日本腎臓病薬物療法学会 第38版 ({data.length}件)</p>
        </div>
        <Button onClick={openNew} size="sm">＋ 追加</Button>
      </div>

      {/* フィルター */}
      <div className="flex flex-wrap gap-2 items-center">
        <Input
          placeholder="薬剤名・商品名・分類で検索"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-56 text-sm"
        />
        <select
          value={routeFilter}
          onChange={(e) => { setRouteFilter(e.target.value); setPage(1); }}
          className="text-sm border rounded px-2 py-1.5 bg-white"
        >
          <option value="all">全経路</option>
          <option value="oral">内服</option>
          <option value="injection">注射</option>
          <option value="topical">外用</option>
          <option value="inhalation">吸入</option>
        </select>
        <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
          <Checkbox
            checked={contraindicatedOnly}
            onCheckedChange={(v) => { setContraindicatedOnly(!!v); setPage(1); }}
          />
          禁忌のみ
        </label>
        <span className="text-sm text-gray-500 ml-auto">{filtered.length}件</span>
      </div>

      {/* テーブル */}
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-gray-50 border-b">
            <tr className="text-left text-xs text-gray-500">
              <th className="px-3 py-2 font-medium">分類</th>
              <th className="px-3 py-2 font-medium">一般名</th>
              <th className="px-3 py-2 font-medium">商品名</th>
              <th className="px-3 py-2 font-medium text-center">経路</th>
              <th className="px-3 py-2 font-medium text-center">禁忌</th>
              <th className="px-3 py-2 font-medium text-center">透析性</th>
              <th className="px-3 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-gray-400 text-sm">
                  該当するデータがありません
                </td>
              </tr>
            )}
            {paged.map((row) => (
              <tr
                key={row.id}
                className="border-b last:border-0 hover:bg-gray-50 cursor-pointer"
                onClick={() => openEdit(row)}
              >
                <td className="px-3 py-2 text-xs text-gray-500 max-w-[140px] truncate">
                  {row.category?.replace(/^"|"$/g, "") ?? "-"}
                </td>
                <td className="px-3 py-2 font-medium">{row.genericName}</td>
                <td className="px-3 py-2 text-gray-600 max-w-[160px] truncate">
                  {row.brandName ?? "-"}
                </td>
                <td className="px-3 py-2 text-center">
                  <Badge variant="outline" className="text-xs">
                    {ROUTE_LABELS[row.routeCategory] ?? row.routeCategory}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-center">
                  {row.isContraindicated === 1 && (
                    <Badge variant="destructive" className="text-xs">禁忌</Badge>
                  )}
                </td>
                <td className="px-3 py-2 text-center text-xs text-gray-500">
                  {row.dialyzability ?? "-"}
                </td>
                <td className="px-3 py-2 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7"
                    onClick={(e) => { e.stopPropagation(); openEdit(row); }}
                  >
                    編集
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ページネーション */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline" size="sm"
            disabled={currentPage <= 1}
            onClick={() => setPage(currentPage - 1)}
          >← 前</Button>
          <span className="text-sm text-gray-600">{currentPage} / {totalPages}</span>
          <Button
            variant="outline" size="sm"
            disabled={currentPage >= totalPages}
            onClick={() => setPage(currentPage + 1)}
          >次 →</Button>
        </div>
      )}

      {/* 編集モーダル */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isNew ? "新規追加" : "薬剤情報を編集"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* 基本情報 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">分類</Label>
                <Input
                  value={form.category ?? ""}
                  onChange={(e) => setField("category", e.target.value || null)}
                  placeholder="例: ニューキノロン系薬"
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">薬剤番号</Label>
                <Input
                  type="number"
                  value={form.drugNumber ?? ""}
                  onChange={(e) => setField("drugNumber", e.target.value ? Number(e.target.value) : null)}
                  className="text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">一般名 *</Label>
                <Input
                  value={form.genericName}
                  onChange={(e) => setField("genericName", e.target.value)}
                  placeholder="例: シプロフロキサシン"
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">商品名</Label>
                <Input
                  value={form.brandName ?? ""}
                  onChange={(e) => setField("brandName", e.target.value || null)}
                  placeholder="例: シプロキサン錠"
                  className="text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">投与経路</Label>
                <Select
                  value={form.routeCategory}
                  onValueChange={(v) => setField("routeCategory", v)}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="oral">内服</SelectItem>
                    <SelectItem value="injection">注射</SelectItem>
                    <SelectItem value="topical">外用</SelectItem>
                    <SelectItem value="inhalation">吸入</SelectItem>
                    <SelectItem value="unknown">不明</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">透析性</Label>
                <Input
                  value={form.dialyzability ?? ""}
                  onChange={(e) => setField("dialyzability", e.target.value || null)}
                  placeholder="例: △ / ○ / ×"
                  className="text-sm"
                />
              </div>
              <div className="space-y-1 flex flex-col justify-end pb-1">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={form.isContraindicated === 1}
                    onCheckedChange={(v) => setField("isContraindicated", v ? 1 : 0)}
                  />
                  <span className="text-red-600 font-medium">禁忌</span>
                </label>
              </div>
            </div>

            {/* 腎機能別用量 */}
            <div className="space-y-1 pt-2 border-t">
              <p className="text-xs font-medium text-gray-600 mb-2">腎機能別用量</p>
              <div className="space-y-2">
                {([
                  ["doseNormal", "常用量・GFR/CCr ≥80"],
                  ["doseMild", "軽度低下 50〜79"],
                  ["doseModerate", "中等度低下 30〜49"],
                  ["doseSevere", "高度低下・末期腎不全 <30"],
                  ["doseHdPd", "HD/PD"],
                ] as const).map(([key, label]) => (
                  <div key={key} className="space-y-0.5">
                    <Label className="text-xs text-gray-500">{label}</Label>
                    <Textarea
                      value={form[key] ?? ""}
                      onChange={(e) => setField(key, e.target.value || null)}
                      className="text-xs h-16 resize-none"
                      placeholder="記載なし"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
            {!isNew && (
              <>
                {confirmDeleteId === editTarget?.id ? (
                  <div className="flex items-center gap-2 mr-auto">
                    <span className="text-xs text-gray-500">削除しますか？</span>
                    <Button
                      variant="destructive" size="sm"
                      disabled={isSaving}
                      onClick={() => editTarget && handleDelete(editTarget.id)}
                    >
                      削除する
                    </Button>
                    <Button
                      variant="outline" size="sm"
                      onClick={() => setConfirmDeleteId(null)}
                    >
                      キャンセル
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline" size="sm"
                    className="mr-auto text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => editTarget && setConfirmDeleteId(editTarget.id)}
                  >
                    削除
                  </Button>
                )}
              </>
            )}
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              キャンセル
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
