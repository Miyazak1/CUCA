export type CatalogEntityStatusRow = {
  id: string;
  slug: string;
  title: string;
  status: string;
  verification_status: string;
  last_verified_at: Date | null;
};

export type CatalogSnapshotRow = {
  id: string;
  snapshot: Record<string, unknown>;
};

export type CatalogTextTotalsRow = {
  programs: string;
  verified_programs: string;
  intakes: string;
  scholarships: string;
  rich_scholarships: string;
};

export type CatalogRichScholarshipRow = CatalogEntityStatusRow & {
  benefits: number;
  eligibility: number;
  materials: number;
  steps: number;
  links: number;
};

export type CatalogCityRow = {
  id: string;
  slug: string;
  name_en: string;
  name_zh: string | null;
  region: string | null;
  province: string | null;
  status: string;
  verification_status: string;
  source_url: string;
  source_label: string;
  source_note: string | null;
  source_field_lineage_json: unknown;
};

export type CatalogTotalsRow = {
  id: string;
  school_id: string;
  programs: number;
  verified_programs: number;
  intakes: number;
  scholarships: number;
  verified_scholarships: number;
  rich_verified_scholarships: number;
  count: number;
};

export type CatalogIntakeStatusRow = {
  slug: string;
  intake_year: number;
  intake_term: string;
  status: string;
};

export type CatalogCleanupBaseline = {
  school: CatalogEntityStatusRow[];
  city: CatalogEntityStatusRow[];
  safePrograms: CatalogEntityStatusRow[];
  safeScholarships: CatalogEntityStatusRow[];
  stableScholarship: CatalogEntityStatusRow[];
  programAliases: CatalogEntityStatusRow[];
  scholarshipAliases: CatalogEntityStatusRow[];
  totals: CatalogTotalsRow;
};
