"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { deleteCase } from "@/actions/cases";
import { toast } from "sonner";

export function DeleteCaseButton({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteCase(caseId);
      toast.success("症例を削除しました");
      router.refresh();
    } catch {
      toast.error("削除に失敗しました");
    } finally {
      setDeleting(false);
      setConfirming(false);
    }
  };

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500">削除しますか?</span>
        <Button
          variant="destructive"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? "削除中" : "はい"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={() => setConfirming(false)}
        >
          キャンセル
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 px-2 text-gray-400 hover:text-red-500 hover:bg-red-50"
      onClick={() => setConfirming(true)}
    >
      削除
    </Button>
  );
}
