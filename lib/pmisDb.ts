import { db } from "./db";
import { pmisDrugs } from "./schema";
import type { PmisDrug } from "./schema";

export async function getAllPmisDrugs(): Promise<PmisDrug[]> {
  return db.select().from(pmisDrugs).orderBy(pmisDrugs.id);
}

function parseJson(json: string | null | undefined): string[] {
  if (!json) return [];
  try { return JSON.parse(json) as string[]; } catch { return []; }
}

/**
 * 薬剤名リストをPMISテーブルと照合。
 * 優先順: applicableGenericNames（詳細一般名）> genericNames（代表一般名）
 * 戻り値: { [drugName]: PmisDrug[] }
 */
export async function matchPmisDrugs(
  drugNames: string[]
): Promise<Record<string, PmisDrug[]>> {
  if (!drugNames.length) return {};

  const all = await db.select().from(pmisDrugs).orderBy(pmisDrugs.id);
  const result: Record<string, PmisDrug[]> = {};

  for (const drugName of drugNames) {
    const nameLower = drugName.toLowerCase();
    const hits: PmisDrug[] = [];

    for (const entry of all) {
      // 1. 該当する一般名（詳細）で完全/部分一致
      const applicable = parseJson(entry.applicableGenericNames);
      const hitApplicable = applicable.some(
        (n) => n && (nameLower.includes(n.toLowerCase()) || n.toLowerCase().includes(nameLower))
      );

      // 2. 代表的な一般名でフォールバック
      const representative = parseJson(entry.genericNames);
      const hitRepresentative = representative.some(
        (n) => n && (nameLower.includes(n.toLowerCase()) || n.toLowerCase().includes(nameLower))
      );

      if (hitApplicable || hitRepresentative) hits.push(entry);
    }

    if (hits.length > 0) result[drugName] = hits;
  }

  return result;
}
