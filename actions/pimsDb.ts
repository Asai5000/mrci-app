"use server";

import { db } from "@/lib/db";
import { pimsDrugs } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { PmisDrug } from "@/lib/schema";

export type PmisDrugUpdate = Omit<PmisDrug, "id">;

export async function getPmisDrugs(): Promise<PmisDrug[]> {
  return db.select().from(pimsDrugs).orderBy(pimsDrugs.id);
}

export async function createPmisDrug(data: PmisDrugUpdate): Promise<void> {
  await db.insert(pimsDrugs).values(data);
  revalidatePath("/pims-db");
}

export async function updatePmisDrug(
  id: number,
  data: Partial<PmisDrugUpdate>
): Promise<void> {
  await db.update(pimsDrugs).set(data).where(eq(pimsDrugs.id, id));
  revalidatePath("/pims-db");
}

export async function deletePmisDrug(id: number): Promise<void> {
  await db.delete(pimsDrugs).where(eq(pimsDrugs.id, id));
  revalidatePath("/pims-db");
}
