"use server";

import { db } from "@/lib/db";
import { cases, medications } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";

export async function getCases() {
  return db.query.cases.findMany({
    orderBy: [desc(cases.createdAt)],
  });
}

export async function getCase(id: string) {
  const caseData = await db.query.cases.findFirst({
    where: eq(cases.id, id),
    with: {
      medications: true,
    },
  });
  return caseData;
}

export async function deleteCase(id: string) {
  await db.delete(cases).where(eq(cases.id, id));
}

export async function deleteAddedMedication(medId: string) {
  await db.delete(medications).where(eq(medications.id, medId));
}

export async function updateMedication(
  medId: string,
  updates: {
    isContinued?: number;
    optimizationNote?: string;
    pharmacistApproved?: number;
  }
) {
  await db.update(medications).set(updates).where(eq(medications.id, medId));
}
