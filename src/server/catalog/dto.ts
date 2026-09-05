export type SourceStatus = "verified" | "unverified" | "stale" | "disputed" | "invalid" | "draft" | "unknown";

export type SourceFieldLineage = Record<string, unknown>;

export type PublicProgramIntakeDto = {
  id: string;
  programId: string;
  intakeTerm: string;
  intakeYear: number;
  openDate: Date | null;
  deadlineDate: Date | null;
  deadlineLabel: string | null;
  applicationRound: string | null;
  status: "open";
};

export type PublicSchoolUpcomingDeadlineDto = {
  programId: string;
  programNameEn: string;
  intakeId: string;
  intakeTerm: string;
  intakeYear: number;
  deadlineDate: string | null;
  deadlineLabel: string | null;
  applicationRound: string | null;
};

export type PublicProgramDto = {
  id: string;
  schoolId: string;
  nameZh: string | null;
  nameEn: string;
  degreeLevel: string;
  fieldCategory: string | null;
  teachingLanguage: string | null;
  tuitionAmount: number | null;
  tuitionCurrency: string | null;
  tuitionPeriod: string | null;
  tuitionText: string | null;
  deadlineDate: Date | null;
  deadlineLabel: string | null;
  applicationRound: string | null;
  applicationUrl: string | null;
  applicationNote: string | null;
  sourceUrl: string | null;
  sourceLabel: string | null;
  lastVerifiedAt: Date | null;
  sourceStatus: SourceStatus;
  status: string;
  isVerified: boolean;
  hasScholarship: boolean;
  sourceFieldLineage: SourceFieldLineage;
  name: string;
  university: string | null;
  deadline: string | null;
  tuition: string | null;
  displayTuition: string | null;
  displaySubjects: unknown[];
};

export type PublicProgramDetailDto = PublicProgramDto & {
  slug: string;
  cityId: string | null;
  durationYears: number | null;
  durationMonths: number | null;
  subjectArea: string | null;
  cscaSubjects: unknown[];
  cscaRequirement: string | null;
  hskRequirement: string | null;
  englishRequirement: string | null;
  scholarshipText: string | null;
  badgeText: string | null;
  displayGroup: string | null;
  displayGroupLabel: string | null;
  verificationStatus: string;
  updatedAt: Date;
  school: {
    id: string;
    slug: string;
    nameZh: string | null;
    nameEn: string;
  };
  city: {
    slug: string;
    nameZh: string | null;
    nameEn: string;
  } | null;
};

export type PublicSchoolDto = {
  id: string;
  slug: string;
  nameZh: string | null;
  nameEn: string;
  schoolType: string | null;
  region: string | null;
  city: string | null;
  cityZh: string | null;
  citySlug: string | null;
  applicationLevel: string | null;
  languageOfInstruction: string | null;
  deadlineSummary: string | null;
  tuitionSummary: string | null;
  applicationFee: string | null;
  websiteUrl: string | null;
  admissionsUrl: string | null;
  sourceUrl: string | null;
  sourceLabel: string | null;
  lastVerifiedAt: Date | null;
  verificationStatus: string;
  sourceStatus: SourceStatus;
  status: string;
  sourceFieldLineage: SourceFieldLineage;
  programCount: number | null;
  englishProgramCount: number | null;
  scholarshipCount: number | null;
  upcomingDeadlines: PublicSchoolUpcomingDeadlineDto[];
};

export type PublicSchoolDetailDto = PublicSchoolDto & {
  cityId: string | null;
  province: string | null;
  regionLabel: string | null;
  ranking: string | null;
  cscaRequired: boolean;
  cscaRequirement: string | null;
  cscaSubjects: unknown[];
  languageRequirement: string | null;
  hskRequirement: string | null;
  englishRequirement: string | null;
  subjectTags: unknown[];
  languageTags: unknown[];
  tuitionBandLabel: string | null;
  campusHighlights: unknown[];
  updatedAt: Date;
};

export type PublicScholarshipBodySectionDto = {
  title: string;
  body: string | null;
  paragraphs: string[];
  items: string[];
};

export type PublicScholarshipBenefitItemDto = {
  key: string | null;
  label: string;
  included: boolean | null;
  note: string | null;
};

export type PublicScholarshipInfoItemDto = {
  label: string;
  value: string | null;
  body: string | null;
};

export type PublicScholarshipActionLinkDto = {
  label: string;
  url: string;
  kind: string | null;
};

export type PublicScholarshipDto = {
  id: string;
  slug: string;
  title: string;
  type: string | null;
  typeLabel: string | null;
  fundingLevel: string | null;
  providerName: string | null;
  providerNameEn: string | null;
  providerLocation: string | null;
  schoolId: string | null;
  programId: string | null;
  coverage: string | null;
  amountText: string | null;
  requirementText: string | null;
  benefitItems: PublicScholarshipBenefitItemDto[];
  eligibilityItems: PublicScholarshipInfoItemDto[];
  applicationMaterials: PublicScholarshipInfoItemDto[];
  applicationSteps: PublicScholarshipInfoItemDto[];
  actionLinks: PublicScholarshipActionLinkDto[];
  deadlineDate: Date | null;
  deadlineLabel: string | null;
  applicationRound: string | null;
  targetCountries: string[];
  targetRegions: string[];
  sourceUrl: string | null;
  sourceLabel: string | null;
  lastVerifiedAt: Date | null;
  sourceStatus: SourceStatus;
  summary: string | null;
};

export type PublicScholarshipDetailDto = PublicScholarshipDto & {
  nameZh: string | null;
  applicableDegree: string | null;
  applicableProgram: string | null;
  bodySections: PublicScholarshipBodySectionDto[];
  benefits: string[];
  tags: string[];
  version: number;
  status: string;
  verificationStatus: string;
  sourceFieldLineage: SourceFieldLineage;
  updatedAt: Date;
  school: {
    id: string;
    slug: string;
    nameZh: string | null;
    nameEn: string;
  } | null;
  program: {
    id: string;
    slug: string;
    nameZh: string | null;
    nameEn: string;
  } | null;
};

export type PublicCityFactDto = {
  label: string;
  value: string;
  note: string | null;
};

export type PublicCityNarrativeDto = {
  label: string | null;
  text: string;
};

export type PublicCityBudgetSummaryDto = {
  monthly: string | null;
  yearly: string | null;
  note: string | null;
};

export type PublicCityFaqDto = {
  question: string;
  answer: string;
};

export type PublicCityContentDto = {
  summary: string | null;
  overview: string | null;
  bestFor: string[];
  quickFacts: PublicCityFactDto[];
  budgetSummary: PublicCityBudgetSummaryDto | null;
  costProfiles: PublicCityFactDto[];
  why: PublicCityNarrativeDto[];
  costBreakdown: PublicCityFactDto[];
  lifeSections: PublicCityNarrativeDto[];
  transportNotes: PublicCityNarrativeDto[];
  applicationTips: string[];
  applicationAdvice: PublicCityNarrativeDto[];
  relatedProgramKeywords: string[];
  nextSteps: PublicCityNarrativeDto[];
  faqs: PublicCityFaqDto[];
  cityFaqs: PublicCityFaqDto[];
};

export type PublicCityDto = {
  slug: string;
  nameZh: string | null;
  nameEn: string;
  region: string | null;
  province: string | null;
  monthlyCost: string | null;
  monthlyCostRmb: number | null;
  costLevel: string | null;
  density: string | null;
  tags: string[];
  content: PublicCityContentDto;
  nearby: string[];
  references: {
    schoolCount: number;
    programCount: number;
    englishProgramCount: number;
    scholarshipCount: number;
    cscaRequiredSchoolCount: number;
  };
  actualSchoolCount: number;
  actualProgramCount: number;
  actualEnglishProgramCount: number;
  actualScholarshipCount: number;
  actualCscaRequiredSchoolCount: number;
  status: string;
  sortOrder: number;
  version: number;
  updatedAt: Date;
};

export type PublicCityDetailDto = PublicCityDto & {
  id: string;
  verificationStatus: string;
  sourceStatus: SourceStatus;
  sourceUrl: string | null;
  sourceLabel: string | null;
  lastVerifiedAt: Date | null;
  sourceFieldLineage: SourceFieldLineage;
};

export type CatalogListOptions = {
  limit?: number;
  offset?: number;
  query?: string;
};
