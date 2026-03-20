"use server";

import { db } from "@/lib/db";
import { pmisDrugs } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { PmisDrug } from "@/lib/schema";

export type PmisDrugUpdate = Omit<PmisDrug, "id">;

export async function getPmisDrugs(): Promise<PmisDrug[]> {
  return db.select().from(pmisDrugs).orderBy(pmisDrugs.id);
}

export async function createPmisDrug(data: PmisDrugUpdate): Promise<void> {
  await db.insert(pmisDrugs).values(data);
  revalidatePath("/pmis-db");
}

export async function updatePmisDrug(
  id: number,
  data: Partial<PmisDrugUpdate>
): Promise<void> {
  await db.update(pmisDrugs).set(data).where(eq(pmisDrugs.id, id));
  revalidatePath("/pmis-db");
}

export async function deletePmisDrug(id: number): Promise<void> {
  await db.delete(pmisDrugs).where(eq(pmisDrugs.id, id));
  revalidatePath("/pmis-db");
}
