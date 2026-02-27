import { getCases } from "@/actions/cases";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMRCILevel } from "@/lib/mrci";
import { DeleteCaseButton } from "@/components/DeleteCaseButton";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const allCases = await getCases();

  const approvedCases = allCases.filter((c) => c.status === "approved");
  const avgMrci =
    approvedCases.length > 0
      ? approvedCases.reduce((s, c) => s + (c.mrciTotal ?? 0), 0) / approvedCases.length
      : 0;
  const avgReduction =
    approvedCases.length > 0
      ? approvedCases.reduce(
          (s, c) =>
            s +
            ((c.mrciTotal ?? 0) - (c.mrciTotalOptimized ?? c.mrciTotal ?? 0)),
          0
        ) / approvedCases.length
      : 0;

  return (
    <div className="space-y-6">
      {/* サマリーカード */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Card>
          <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6 pb-4">
            <p className="text-xs text-gray-500">総症例数</p>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900">{allCases.length}</p>
            <p className="text-xs text-gray-400 mt-1 hidden sm:block">承認済: {approvedCases.length}件</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6 pb-4">
            <p className="text-xs text-gray-500">平均MRCI</p>
            <p className="text-2xl sm:text-3xl font-bold text-blue-600">{avgMrci.toFixed(1)}</p>
            <p className="text-xs text-gray-400 mt-1 hidden sm:block">承認済症例の平均</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6 pb-4">
            <p className="text-xs text-gray-500">平均削減効果</p>
            <p className="text-2xl sm:text-3xl font-bold text-green-600">
              {avgReduction > 0 ? "-" : ""}
              {avgReduction.toFixed(1)}
            </p>
            <p className="text-xs text-gray-400 mt-1 hidden sm:block">最適化による改善</p>
          </CardContent>
        </Card>
      </div>

      {/* 症例一覧 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle>症例一覧</CardTitle>
          <Link href="/analyze">
            <Button size="sm">新規鑑別を開始</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {allCases.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-lg">まだ症例がありません</p>
              <p className="text-sm mt-2">「新規鑑別を開始」から処方情報を入力してください</p>
              <Link href="/analyze" className="mt-4 inline-block">
                <Button variant="outline">新規鑑別を開始</Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-2 sm:mx-0">
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="border-b text-gray-500 text-left">
                    <th className="pb-2 pr-3 font-medium">日時</th>
                    <th className="pb-2 pr-3 font-medium">患者属性</th>
                    <th className="pb-2 pr-3 font-medium">MRCI</th>
                    <th className="pb-2 pr-3 font-medium">最適化後</th>
                    <th className="pb-2 pr-3 font-medium">複雑度</th>
                    <th className="pb-2 pr-3 font-medium">状態</th>
                    <th className="pb-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {allCases.map((c) => {
                    const level = getMRCILevel(c.mrciTotal ?? 0);
                    const reduction =
                      (c.mrciTotal ?? 0) - (c.mrciTotalOptimized ?? c.mrciTotal ?? 0);
                    const date = new Date((c.createdAt ?? 0) * 1000);

                    return (
                      <tr key={c.id} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="py-3 pr-3 text-gray-600 whitespace-nowrap">
                          {date.toLocaleDateString("ja-JP", {
                            month: "numeric",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-3 pr-3 whitespace-nowrap">
                          {c.patientAgeGroup}
                          {c.patientGender ? ` · ${c.patientGender}` : ""}
                        </td>
                        <td className="py-3 pr-3 font-mono font-semibold whitespace-nowrap">
                          {c.mrciTotal?.toFixed(1) ?? "-"}
                        </td>
                        <td className="py-3 pr-3 whitespace-nowrap">
                          {c.mrciTotalOptimized != null ? (
                            <span className="text-green-600 font-mono">
                              {c.mrciTotalOptimized.toFixed(1)}
                              {reduction > 0 && (
                                <span className="text-xs ml-1">(-{reduction.toFixed(1)})</span>
                              )}
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="py-3 pr-3">
                          <Badge
                            variant={
                              level.level === "high"
                                ? "destructive"
                                : level.level === "medium"
                                ? "secondary"
                                : "outline"
                            }
                          >
                            {level.label}
                          </Badge>
                        </td>
                        <td className="py-3 pr-3">
                          <Badge variant={c.status === "approved" ? "default" : "outline"}>
                            {c.status === "approved" ? "登録済" : "下書き"}
                          </Badge>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-1 whitespace-nowrap">
                            <Link href={`/cases/${c.id}`}>
                              <Button variant="ghost" size="sm">詳細</Button>
                            </Link>
                            <DeleteCaseButton caseId={c.id} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
