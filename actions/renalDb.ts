"use server";

import { db } from "@/lib/db";
import { renalDosingGuidelines } from "@/lib/schema";
import { eq, or, like } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { RenalDosingGuideline } from "@/lib/schema";

export type RenalGuidelineUpdate = Omit<RenalDosingGuideline, "id">;

export async function getRenalGuidelines(search?: string): Promise<RenalDosingGuideline[]> {
  if (search && search.trim()) {
    const q = `%${search.trim()}%`;
    return db
      .select()
      .from(renalDosingGuidelines)
      .where(
        or(
          like(renalDosingGuidelines.genericName, q),
          like(renalDosingGuidelines.brandName, q),
          like(renalDosingGuidelines.category, q)
        )
      )
      .orderBy(renalDosingGuidelines.id);
  }
  return db.select().from(renalDosingGuidelines).orderBy(renalDosingGuidelines.id);
}

export async function updateRenalGuideline(
  id: number,
  data: Partial<RenalGuidelineUpdate>
): Promise<void> {
  await db
    .update(renalDosingGuidelines)
    .set(data)
    .where(eq(renalDosingGuidelines.id, id));
  revalidatePath("/renal-db");
}

export async function createRenalGuideline(
  data: RenalGuidelineUpdate
): Promise<void> {
  await db.insert(renalDosingGuidelines).values(data);
  revalidatePath("/renal-db");
}

export async function deleteRenalGuideline(id: number): Promise<void> {
  await db.delete(renalDosingGuidelines).where(eq(renalDosingGuidelines.id, id));
  revalidatePath("/renal-db");
}
