import { sql, relations } from "drizzle-orm";
import { integer, real, text, sqliteTable } from "drizzle-orm/sqlite-core";

export const cases = sqliteTable("cases", {
  id: text("id").primaryKey(),
  patientAgeGroup: text("patient_age_group").notNull(),
  patientGender: text("patient_gender"),
  renalFunction: text("renal_function"),
  rawInputType: text("raw_input_type").notNull().default("text"), // "text" | "image"
  rawInputText: text("raw_input_text"),
  imagePath: text("image_path"),
  mrciSectionA: real("mrci_section_a"),
  mrciSectionB: real("mrci_section_b"),
  mrciSectionC: real("mrci_section_c"),
  mrciTotal: real("mrci_total"),
  mrciTotalOptimized: real("mrci_total_optimized"),
  serumCreatinine: real("serum_creatinine"),
  bodyWeight: real("body_weight"),
  calculatedCrcl: real("calculated_crcl"),
  calculatedEgfr: real("calculated_egfr"),
  geminiRawResponse: text("gemini_raw_response"),
  pharmacistNote: text("pharmacist_note"),
  clinicalSummary: text("clinical_summary"),
  status: text("status").notNull().default("draft"), // "draft" | "approved"
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch())`),
});

export const medications = sqliteTable("medications", {
  id: text("id").primaryKey(),
  caseId: text("case_id")
    .notNull()
    .references(() => cases.id, { onDelete: "cascade" }),
  drugName: text("drug_name").notNull(),
  brandName: text("brand_name"),
  dosageForm: text("dosage_form"),
  route: text("route"),
  dose: text("dose"),
  frequency: text("frequency"),
  specialInstructions: text("special_instructions"), // JSON array string
  mrciA: real("mrci_a").default(0),
  mrciB: real("mrci_b").default(0),
  mrciC: real("mrci_c").default(0),
  isContinued: integer("is_continued").default(1), // 1=継続, 0=中止
  optimizationNote: text("optimization_note"),
  pharmacistApproved: integer("pharmacist_approved").default(0),
  sortOrder: integer("sort_order").default(0),
  // ── 最適化変更情報（追加カラム） ──
  changeType: text("change_type").default("continued"), // continued/discontinued/form_changed/freq_changed/substituted
  originalMrciA: real("original_mrci_a"),   // AI解析時の元スコア（リセット基準値）
  originalMrciB: real("original_mrci_b"),   // 同上
  overrideDosageForm: text("override_dosage_form"), // 変更後の剤形
  overrideFrequency: text("override_frequency"),    // 変更後の用法
  overrideDose: text("override_dose"),              // 変更後の用量（用量調節時）
  isAdded: integer("is_added").default(0),          // 1=最適化時に追加した薬剤
});

export const casesRelations = relations(cases, ({ many }) => ({
  medications: many(medications),
}));

export const medicationsRelations = relations(medications, ({ one }) => ({
  case: one(cases, {
    fields: [medications.caseId],
    references: [cases.id],
  }),
}));

export const renalDosingGuidelines = sqliteTable("renal_dosing_guidelines", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  category: text("category"),
  genericName: text("generic_name").notNull(),
  drugNumber: integer("drug_number"),
  brandName: text("brand_name"),
  routeCategory: text("route_category").notNull().default("oral"), // oral / injection / topical / inhalation / unknown
  dialyzability: text("dialyzability"),
  renalDamage: text("renal_damage"),
  isContraindicated: integer("is_contraindicated").notNull().default(0),
  doseNormal: text("dose_normal"),   // GFR/CCr 80以上
  doseMild: text("dose_mild"),       // GFR/CCr 50〜79
  doseModerate: text("dose_moderate"), // GFR/CCr 30〜49
  doseSevere: text("dose_severe"),   // GFR/CCr 30未満
  doseHdPd: text("dose_hd_pd"),     // HD/PD
});

export const pimsDrugs = sqliteTable("pims_drugs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  category: text("category").notNull(),                     // 分類
  drugClass: text("drug_class").notNull(),                  // 薬物クラスまたは一般名
  genericNames: text("generic_names").notNull(),            // 代表的な一般名（JSON配列）
  targetPatients: text("target_patients"),                  // 対象となる患者群
  recommendation: text("recommendation").notNull(),         // 推奨される使用法
  applicableGenericNames: text("applicable_generic_names"), // 該当する一般名（詳細・JSON配列）
});

export type Case = typeof cases.$inferSelect;
export type NewCase = typeof cases.$inferInsert;
export type Medication = typeof medications.$inferSelect;
export type NewMedication = typeof medications.$inferInsert;
export type RenalDosingGuideline = typeof renalDosingGuidelines.$inferSelect;
export type PmisDrug = typeof pimsDrugs.$inferSelect;
export type NewPmisDrug = typeof pimsDrugs.$inferInsert;
