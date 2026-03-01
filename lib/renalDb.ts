import { db } from "./db";
import { renalDosingGuidelines } from "./schema";
import { or, like, and, eq } from "drizzle-orm";
import type { GeminiAnalysisResult, RenalData } from "./gemini";

/** Geminiの投与経路文字列をDBのroute_categoryに変換 */
function toRouteCategory(route: string): string | null {
  if (!route) return null;
  if (/注射|静注|筋注|点滴|皮下注|静脈|筋肉/.test(route)) return "injection";
  if (/外用|点眼|点鼻|点耳|坐剤|坐薬|貼付|パッチ|テープ|軟膏|クリーム|ゲル/.test(route)) return "topical";
  if (/吸入|エアロゾル/.test(route)) return "inhalation";
  if (/経口|内服|口|舌下/.test(route)) return "oral";
  return null; // 不明な場合はフィルタしない
}

/**
 * 薬剤名（一般名・商品名）でDB検索。部分一致。
 * route が指定されると投与経路でもフィルタする。
 */
export async function searchRenalGuidelines(
  genericName: string,
  brandName?: string | null,
  route?: string | null
) {
  const nameCondition = or(
    like(renalDosingGuidelines.genericName, `%${genericName}%`),
    ...(brandName ? [like(renalDosingGuidelines.brandName, `%${brandName}%`)] : [])
  );

  const routeCategory = route ? toRouteCategory(route) : null;

  // 投与経路が特定できた場合のみフィルタ
  const whereClause = routeCategory
    ? and(nameCondition, eq(renalDosingGuidelines.routeCategory, routeCategory))
    : nameCondition;

  const results = await db
    .select()
    .from(renalDosingGuidelines)
    .where(whereClause);

  // 重複除去
  const seen = new Set<string>();
  return results.filter((r) => {
    const key = `${r.genericName}|${r.brandName ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * 患者のeGFR/CrClに対応するDB列を選択
 */
function selectDoseColumn(
  guideline: Awaited<ReturnType<typeof searchRenalGuidelines>>[number],
  renalValue: number | undefined
): { text: string | null; level: string } {
  if (renalValue === undefined || renalValue === null) {
    return { text: null, level: "unknown" };
  }
  if (renalValue >= 80) {
    return { text: guideline.doseNormal, level: "normal" };
  } else if (renalValue >= 50) {
    return { text: guideline.doseMild, level: "mild" };
  } else if (renalValue >= 30) {
    return { text: guideline.doseModerate, level: "moderate" };
  } else {
    return { text: guideline.doseSevere, level: "severe" };
  }
}

/**
 * Gemini解析結果に学会ガイドラインDBの情報を付加する。
 * 腎機能データがある場合のみ実行。
 */
export async function augmentWithRenalDb(
  result: GeminiAnalysisResult,
  renalData?: RenalData
): Promise<GeminiAnalysisResult> {
  if (!renalData) return result;

  // CrClを優先、なければeGFRを使用
  const renalValue = renalData.crcl ?? renalData.egfr;

  for (const med of result.extracted_medications) {
    const guidelines = await searchRenalGuidelines(med.drug_name, med.brand_name, med.route);
    if (!guidelines.length) continue;

    for (const g of guidelines) {
      // 禁忌チェック（HDを含む重度腎不全時の禁忌も考慮）
      const isHdContraindicated = renalValue !== undefined && renalValue < 15 &&
        g.doseHdPd?.includes("禁忌");
      const isContraindicated = g.isContraindicated === 1 || isHdContraindicated;

      if (isContraindicated) {
        const alreadyHigh = result.optimization_suggestions.some(
          (s) =>
            s.target_drug === med.drug_name &&
            s.suggestion_type === "腎機能考慮中止" &&
            s.rationale.includes("学会GL")
        );
        if (!alreadyHigh) {
          result.optimization_suggestions.unshift({
            target_drug: med.drug_name,
            suggestion_type: "腎機能考慮中止",
            detail: `【学会GL・禁忌】腎機能低下患者への投与禁忌薬剤です（${g.brandName ?? g.genericName}）。`,
            expected_mrci_reduction: 0,
            rationale: `[学会GL] 日本腎臓病薬物療法学会ガイドライン: 禁忌（${g.brandName ?? g.genericName}）`,
            priority: "high",
          });
        }
        continue; // 禁忌の場合は用量提案を追加しない
      }

      // 腎機能別用量チェック（GFR < 80 の場合に提案）
      if (renalValue === undefined || renalValue >= 80) continue;

      const { text: doseText, level } = selectDoseColumn(g, renalValue);
      if (!doseText) continue;

      // 同じ薬剤の学会GL提案が既にある場合はスキップ
      const alreadyExists = result.optimization_suggestions.some(
        (s) =>
          s.target_drug === med.drug_name &&
          s.suggestion_type === "腎機能考慮減量" &&
          s.rationale.includes("学会GL")
      );
      if (alreadyExists) continue;

      const priority = level === "severe" ? "high" : level === "moderate" ? "medium" : "low";

      result.optimization_suggestions.push({
        target_drug: med.drug_name,
        suggestion_type: "腎機能考慮減量",
        detail: `【学会GL】${doseText}`,
        expected_mrci_reduction: 0,
        rationale: `[学会GL] 日本腎臓病薬物療法学会ガイドライン（${g.brandName ?? g.genericName}）`,
        priority,
      });
    }
  }

  return result;
}
