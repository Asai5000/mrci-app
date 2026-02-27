const AGE_GROUP_MAP: Record<string, number> = {
  "10代": 15,
  "20代": 25,
  "30代": 35,
  "40代": 45,
  "50代": 55,
  "60代": 65,
  "70代": 75,
  "80代": 85,
  "90代以上": 90,
};

export function parseAgeFromGroup(ageGroup: string): number | null {
  return AGE_GROUP_MAP[ageGroup] ?? null;
}

/**
 * Cockcroft-Gault formula
 * CrCl (mL/min) = (140 - age) × weight / (72 × sCr) × [0.85 if female]
 */
export function calculateCrCl(
  ageGroup: string,
  gender: string | undefined,
  weightKg: number,
  serumCrMgDl: number
): number | null {
  const age = parseAgeFromGroup(ageGroup);
  if (!age || weightKg <= 0 || serumCrMgDl <= 0) return null;
  const genderFactor = gender === "女性" ? 0.85 : 1.0;
  const crcl = (((140 - age) * weightKg) / (72 * serumCrMgDl)) * genderFactor;
  return Math.max(0, Math.round(crcl * 10) / 10);
}

/**
 * Japanese eGFR formula (Matsuo 2009)
 * eGFR = 194 × sCr^(-1.094) × age^(-0.287) × 0.739 (if female)
 */
export function calculateEGFR(
  ageGroup: string,
  gender: string | undefined,
  serumCrMgDl: number
): number | null {
  const age = parseAgeFromGroup(ageGroup);
  if (!age || serumCrMgDl <= 0) return null;
  const genderFactor = gender === "女性" ? 0.739 : 1.0;
  const egfr =
    194 * Math.pow(serumCrMgDl, -1.094) * Math.pow(age, -0.287) * genderFactor;
  return Math.max(0, Math.round(egfr * 10) / 10);
}

export function getCKDStageLabel(egfr: number): string {
  if (egfr >= 90) return "G1 (正常)";
  if (egfr >= 60) return "G2 (軽度低下)";
  if (egfr >= 45) return "G3a (軽〜中等度低下)";
  if (egfr >= 30) return "G3b (中〜高度低下)";
  if (egfr >= 15) return "G4 (高度低下)";
  return "G5 (末期腎不全)";
}
