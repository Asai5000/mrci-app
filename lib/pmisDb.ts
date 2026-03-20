import { db } from "./db";
import { pmisDrugs } from "./schema";
import type { PmisDrug } from "./schema";

/**
 * PMIS薬剤リストを全件取得
 */
export async function getAllPmisDrugs(): Promise<PmisDrug[]> {
  return db.select().from(pmisDrugs).orderBy(pmisDrugs.id);
}

/**
 * 薬剤名リストをPMISテーブルと照合し、ヒットしたエントリを返す。
 * 戻り値: { [drugName]: PmisDrug[] }
 */
export async function matchPmisDrugs(
  drugNames: string[]
): Promise<Record<string, PmisDrug[]>> {
  if (!drugNames.length) return {};

  const all = await db.select().from(pmisDrugs).orderBy(pmisDrugs.id);
  const result: Record<string, PmisDrug[]> = {};

  for (const drugName of drugNames) {
    const hits: PmisDrug[] = [];
    const nameLower = drugName.toLowerCase();

    for (const entry of all) {
      let names: string[] = [];
      try {
        names = JSON.parse(entry.genericNames) as string[];
      } catch {
        names = [entry.genericNames];
      }

      // 薬剤名 ↔ PMIS一般名の双方向部分一致
      const matched = names.some(
        (n) =>
          n && (nameLower.includes(n.toLowerCase()) || n.toLowerCase().includes(nameLower))
      );
      if (matched) hits.push(entry);
    }

    if (hits.length > 0) result[drugName] = hits;
  }

  return result;
}
