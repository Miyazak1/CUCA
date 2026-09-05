import type { InferSelectModel } from "drizzle-orm";
import type { cities, programs, scholarships, schools } from "../db/schema.ts";
import type {
  PublicCityDetailDto,
  PublicCityDto,
  PublicCityBudgetSummaryDto,
  PublicCityContentDto,
  PublicCityFactDto,
  PublicCityFaqDto,
  PublicCityNarrativeDto,
  PublicProgramDetailDto,
  PublicProgramDto,
  PublicScholarshipDetailDto,
  PublicScholarshipDto,
  PublicScholarshipActionLinkDto,
  PublicScholarshipBenefitItemDto,
  PublicScholarshipBodySectionDto,
  PublicScholarshipInfoItemDto,
  PublicSchoolDetailDto,
  PublicSchoolDto,
  PublicSchoolUpcomingDeadlineDto,
  SourceFieldLineage,
  SourceStatus,
} from "./dto.ts";

export type ProgramRow = InferSelectModel<typeof programs>;
export type SchoolRow = InferSelectModel<typeof schools>;
export type ScholarshipRow = InferSelectModel<typeof scholarships>;
export type CityRow = InferSelectModel<typeof cities>;

export type ProgramProjectionRow = ProgramRow & {
  schoolNameEn?: string | null;
  schoolNameZh?: string | null;
  schoolSlug?: string | null;
  citySlug?: string | null;
  cityNameEn?: string | null;
  cityNameZh?: string | null;
  deadlineDate?: Date | null;
  deadlineLabel?: string | null;
  applicationRound?: string | null;
};

export type ScholarshipProjectionRow = ScholarshipRow & {
  schoolSlug?: string | null;
  schoolNameEn?: string | null;
  schoolNameZh?: string | null;
  programSlug?: string | null;
  programNameEn?: string | null;
  programNameZh?: string | null;
};

export type SchoolProjectionRow = SchoolRow & {
  programCount?: number | null;
  englishProgramCount?: number | null;
  scholarshipCount?: number | null;
  upcomingDeadlines?: unknown;
};

function asLineage(value: unknown): SourceFieldLineage {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as SourceFieldLineage) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asSchoolUpcomingDeadlines(value: unknown): PublicSchoolUpcomingDeadlineDto[] {
  if (!Array.isArray(value)) throw new Error("Published school deadline projection must be an array.");
  return value.map(item => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("Published school deadline projection is invalid.");
    const row = item as Record<string, unknown>;
    const exactKeys = ["applicationRound", "deadlineDate", "deadlineLabel", "intakeId", "intakeTerm", "intakeYear", "programId", "programNameEn"];
    if (Object.keys(row).sort().join("\n") !== exactKeys.join("\n")
      || !requiredString(row.programId) || !requiredString(row.programNameEn)
      || !requiredString(row.intakeId) || !requiredString(row.intakeTerm)
      || !Number.isInteger(row.intakeYear)
      || !nullableString(row.deadlineDate) || !nullableString(row.deadlineLabel)
      || !nullableString(row.applicationRound)) throw new Error("Published school deadline projection is invalid.");
    return row as PublicSchoolUpcomingDeadlineDto;
  });
}

function requiredString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function asTextArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some(item => !requiredString(item))) {
    throw new Error(`Published ${label} projection is invalid.`);
  }
  return value.map(item => (item as string).trim());
}

function exactObject(value: unknown, allowedKeys: readonly string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Published ${label} projection is invalid.`);
  const row = value as Record<string, unknown>;
  if (Object.keys(row).some(key => !allowedKeys.includes(key))) throw new Error(`Published ${label} projection is invalid.`);
  return row;
}

function optionalText(value: unknown): string | null {
  return value === undefined || value === null ? null : requiredString(value) ? value.trim() : invalidProjection();
}

function invalidProjection(): never {
  throw new Error("Published scholarship nested projection is invalid.");
}

function asScholarshipBodySections(value: unknown): PublicScholarshipBodySectionDto[] {
  if (!Array.isArray(value)) return invalidProjection();
  return value.map(item => {
    const row = exactObject(item, ["title", "body", "paragraphs", "items"], "scholarship body section");
    if (!requiredString(row.title)) return invalidProjection();
    return {
      title: row.title.trim(),
      body: optionalText(row.body),
      paragraphs: asTextArray(row.paragraphs ?? [], "scholarship body paragraphs"),
      items: asTextArray(row.items ?? [], "scholarship body items"),
    };
  });
}

function asScholarshipBenefitItems(value: unknown): PublicScholarshipBenefitItemDto[] {
  if (!Array.isArray(value)) return invalidProjection();
  return value.map(item => {
    const row = exactObject(item, ["key", "label", "included", "note"], "scholarship benefit item");
    if (!requiredString(row.label) || (row.included !== undefined && row.included !== null && typeof row.included !== "boolean")) return invalidProjection();
    return { key: optionalText(row.key), label: row.label.trim(), included: row.included ?? null, note: optionalText(row.note) };
  });
}

function asScholarshipInfoItems(value: unknown, label: string): PublicScholarshipInfoItemDto[] {
  if (!Array.isArray(value)) return invalidProjection();
  return value.map(item => {
    const row = exactObject(item, ["label", "value", "body"], label);
    if (!requiredString(row.label)) return invalidProjection();
    return { label: row.label.trim(), value: optionalText(row.value), body: optionalText(row.body) };
  });
}

function asScholarshipActionLinks(value: unknown): PublicScholarshipActionLinkDto[] {
  if (!Array.isArray(value)) return invalidProjection();
  return value.map(item => {
    const row = exactObject(item, ["label", "url", "kind"], "scholarship action link");
    if (!requiredString(row.label) || !requiredString(row.url)) return invalidProjection();
    return { label: row.label.trim(), url: row.url.trim(), kind: optionalText(row.kind) };
  });
}

const cityContentKeys = [
  "summary", "overview", "bestFor", "quickFacts", "budgetSummary", "costProfiles", "why", "costBreakdown",
  "lifeSections", "transportNotes", "applicationTips", "applicationAdvice", "relatedProgramKeywords", "nextSteps",
  "faqs", "cityFaqs",
] as const;

function optionalCityText(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (!requiredString(value)) throw new Error("Published city content projection is invalid.");
  return value.trim();
}

function asCityFacts(value: unknown, label: string): PublicCityFactDto[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`Published ${label} projection is invalid.`);
  return value.map(item => {
    const row = exactObject(item, ["label", "value", "note"], label);
    if (!requiredString(row.label) || !requiredString(row.value)) throw new Error(`Published ${label} projection is invalid.`);
    return { label: row.label.trim(), value: row.value.trim(), note: optionalCityText(row.note) };
  });
}

function asCityNarratives(value: unknown, label: string): PublicCityNarrativeDto[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`Published ${label} projection is invalid.`);
  return value.map(item => {
    if (requiredString(item)) return { label: null, text: item.trim() };
    const row = exactObject(item, ["title", "label", "body", "note", "value"], label);
    const itemLabel = optionalCityText(row.title ?? row.label);
    const text = optionalCityText(row.body ?? row.note ?? row.value);
    if (!itemLabel && !text) throw new Error(`Published ${label} projection is invalid.`);
    return text ? { label: itemLabel, text } : { label: null, text: itemLabel! };
  });
}

function asCityBudget(value: unknown): PublicCityBudgetSummaryDto | null {
  if (value === undefined || value === null) return null;
  const row = exactObject(value, ["monthly", "yearly", "note"], "city budget summary");
  const result = { monthly: optionalCityText(row.monthly), yearly: optionalCityText(row.yearly), note: optionalCityText(row.note) };
  if (!result.monthly && !result.yearly && !result.note) throw new Error("Published city budget summary projection is invalid.");
  return result;
}

function asCityFaqs(value: unknown, label: string): PublicCityFaqDto[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`Published ${label} projection is invalid.`);
  return value.map(item => {
    const row = exactObject(item, ["question", "answer"], label);
    if (!requiredString(row.question) || !requiredString(row.answer)) throw new Error(`Published ${label} projection is invalid.`);
    return { question: row.question.trim(), answer: row.answer.trim() };
  });
}

function asCityContent(value: unknown): PublicCityContentDto {
  const row = exactObject(value, cityContentKeys, "city content");
  return {
    summary: optionalCityText(row.summary),
    overview: optionalCityText(row.overview),
    bestFor: asTextArray(row.bestFor ?? [], "city best-for labels"),
    quickFacts: asCityFacts(row.quickFacts, "city quick fact"),
    budgetSummary: asCityBudget(row.budgetSummary),
    costProfiles: asCityFacts(row.costProfiles, "city cost profile"),
    why: asCityNarratives(row.why, "city reason"),
    costBreakdown: asCityFacts(row.costBreakdown, "city cost breakdown"),
    lifeSections: asCityNarratives(row.lifeSections, "city life section"),
    transportNotes: asCityNarratives(row.transportNotes, "city transport note"),
    applicationTips: asTextArray(row.applicationTips ?? [], "city application tips"),
    applicationAdvice: asCityNarratives(row.applicationAdvice, "city application advice"),
    relatedProgramKeywords: asTextArray(row.relatedProgramKeywords ?? [], "city program keywords"),
    nextSteps: asCityNarratives(row.nextSteps, "city next step"),
    faqs: asCityFaqs(row.faqs, "city FAQ"),
    cityFaqs: asCityFaqs(row.cityFaqs, "city FAQ"),
  };
}

function sourceStatus(status: string | null | undefined, verificationStatus: string | null | undefined): SourceStatus {
  if (status === "draft") {
    return "draft";
  }

  if (verificationStatus === "verified") {
    return "verified";
  }

  if (verificationStatus === "stale") {
    return "stale";
  }

  if (verificationStatus === "unverified") {
    return "unverified";
  }

  if (verificationStatus === "disputed") {
    return "disputed";
  }

  if (verificationStatus === "invalid") {
    return "invalid";
  }

  return "unknown";
}

export function toPublicProgramDetailDto(row: ProgramProjectionRow): PublicProgramDetailDto {
  const summary = toPublicProgramDto(row);
  if (!row.schoolSlug || !row.schoolNameEn) {
    throw new Error("Published program detail requires an active school projection.");
  }

  return {
    ...summary,
    slug: row.slug,
    cityId: row.cityId,
    durationYears: row.durationYears,
    durationMonths: row.durationMonths,
    subjectArea: row.subjectArea,
    cscaSubjects: asArray(row.cscaSubjects),
    cscaRequirement: row.cscaRequirement,
    hskRequirement: row.hskRequirement,
    englishRequirement: row.englishRequirement,
    scholarshipText: row.scholarshipText,
    badgeText: row.badgeText,
    displayGroup: row.displayGroup,
    displayGroupLabel: row.displayGroupLabel,
    verificationStatus: row.verificationStatus,
    updatedAt: row.updatedAt,
    school: {
      id: row.schoolId,
      slug: row.schoolSlug,
      nameZh: row.schoolNameZh ?? null,
      nameEn: row.schoolNameEn,
    },
    city: row.citySlug && row.cityNameEn ? {
      slug: row.citySlug,
      nameZh: row.cityNameZh ?? null,
      nameEn: row.cityNameEn,
    } : null,
  };
}

export function toPublicProgramDto(row: ProgramProjectionRow): PublicProgramDto {
  return {
    id: row.id,
    schoolId: row.schoolId,
    nameZh: row.nameZh,
    nameEn: row.nameEn,
    degreeLevel: row.degreeLevel,
    fieldCategory: row.fieldCategory,
    teachingLanguage: row.teachingLanguage,
    tuitionAmount: row.tuitionAmount,
    tuitionCurrency: row.tuitionCurrency,
    tuitionPeriod: row.tuitionPeriod,
    tuitionText: row.tuitionText,
    deadlineDate: row.deadlineDate ?? null,
    deadlineLabel: row.deadlineLabel ?? null,
    applicationRound: row.applicationRound ?? null,
    applicationUrl: row.applicationUrl,
    applicationNote: row.applicationNote,
    sourceUrl: row.sourceUrl,
    sourceLabel: row.sourceLabel,
    lastVerifiedAt: row.lastVerifiedAt,
    sourceStatus: sourceStatus(row.status, row.verificationStatus),
    status: row.status,
    isVerified: row.isVerified,
    hasScholarship: row.hasScholarship,
    sourceFieldLineage: asLineage(row.sourceFieldLineageJson),
    name: row.nameEn,
    university: row.schoolNameEn ?? null,
    deadline: row.deadlineLabel ?? null,
    tuition: row.displayTuition ?? row.tuitionText,
    displayTuition: row.displayTuition,
    displaySubjects: asArray(row.displaySubjects),
  };
}

export function toPublicSchoolDto(row: SchoolProjectionRow): PublicSchoolDto {
  return {
    id: row.id,
    slug: row.slug,
    nameZh: row.nameZh,
    nameEn: row.nameEn,
    schoolType: row.schoolType,
    region: row.region,
    city: row.city,
    cityZh: row.cityZh,
    citySlug: row.citySlug,
    applicationLevel: row.applicationLevel,
    languageOfInstruction: row.languageOfInstruction,
    deadlineSummary: row.deadlineSummary,
    tuitionSummary: row.tuitionSummary,
    applicationFee: row.applicationFee,
    websiteUrl: row.websiteUrl,
    admissionsUrl: row.admissionsUrl,
    sourceUrl: row.sourceUrl,
    sourceLabel: row.sourceLabel,
    lastVerifiedAt: row.lastVerifiedAt,
    verificationStatus: row.verificationStatus,
    sourceStatus: sourceStatus(row.status, row.verificationStatus),
    status: row.status,
    sourceFieldLineage: asLineage(row.sourceFieldLineageJson),
    programCount: row.programCount ?? null,
    englishProgramCount: row.englishProgramCount ?? null,
    scholarshipCount: row.scholarshipCount ?? null,
    upcomingDeadlines: asSchoolUpcomingDeadlines(row.upcomingDeadlines),
  };
}

export function toPublicSchoolDetailDto(row: SchoolProjectionRow): PublicSchoolDetailDto {
  return {
    ...toPublicSchoolDto(row),
    cityId: row.cityId,
    province: row.province,
    regionLabel: row.regionLabel,
    ranking: row.ranking,
    cscaRequired: row.cscaRequired,
    cscaRequirement: row.cscaRequirement,
    cscaSubjects: asArray(row.cscaSubjects),
    languageRequirement: row.languageRequirement,
    hskRequirement: row.hskRequirement,
    englishRequirement: row.englishRequirement,
    subjectTags: asArray(row.subjectTags),
    languageTags: asArray(row.languageTags),
    tuitionBandLabel: row.tuitionBandLabel,
    campusHighlights: asArray(row.campusHighlights),
    updatedAt: row.updatedAt,
  };
}

export function toPublicScholarshipDto(row: ScholarshipRow): PublicScholarshipDto {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    type: row.type,
    typeLabel: row.typeLabel,
    fundingLevel: row.fundingLevel,
    providerName: row.providerName,
    providerNameEn: row.providerNameEn,
    providerLocation: row.providerLocation,
    schoolId: row.schoolId,
    programId: row.programId,
    coverage: row.coverage,
    amountText: row.amountText,
    requirementText: row.requirementText,
    benefitItems: asScholarshipBenefitItems(row.benefitItems),
    eligibilityItems: asScholarshipInfoItems(row.eligibilityItems, "scholarship eligibility item"),
    applicationMaterials: asScholarshipInfoItems(row.applicationMaterials, "scholarship material item"),
    applicationSteps: asScholarshipInfoItems(row.applicationSteps, "scholarship application step"),
    actionLinks: asScholarshipActionLinks(row.actionLinks),
    deadlineDate: row.deadlineDate,
    deadlineLabel: row.deadlineLabel,
    applicationRound: row.applicationRound,
    targetCountries: asTextArray(row.targetCountries, "scholarship target countries"),
    targetRegions: asTextArray(row.targetRegions, "scholarship target regions"),
    sourceUrl: row.sourceUrl,
    sourceLabel: row.sourceLabel,
    lastVerifiedAt: row.lastVerifiedAt,
    sourceStatus: sourceStatus(row.status, row.verificationStatus),
    summary: row.summary,
  };
}

export function toPublicScholarshipDetailDto(row: ScholarshipProjectionRow): PublicScholarshipDetailDto {
  return {
    ...toPublicScholarshipDto(row),
    nameZh: row.nameZh,
    applicableDegree: row.applicableDegree,
    applicableProgram: row.applicableProgram,
    bodySections: asScholarshipBodySections(row.bodySections),
    benefits: asTextArray(row.benefits, "scholarship benefits"),
    tags: asTextArray(row.tags, "scholarship tags"),
    version: row.version,
    status: row.status,
    verificationStatus: row.verificationStatus,
    sourceFieldLineage: asLineage(row.sourceFieldLineageJson),
    updatedAt: row.updatedAt,
    school: row.schoolId && row.schoolSlug && row.schoolNameEn ? {
      id: row.schoolId,
      slug: row.schoolSlug,
      nameZh: row.schoolNameZh ?? null,
      nameEn: row.schoolNameEn,
    } : null,
    program: row.programId && row.programSlug && row.programNameEn ? {
      id: row.programId,
      slug: row.programSlug,
      nameZh: row.programNameZh ?? null,
      nameEn: row.programNameEn,
    } : null,
  };
}

export function toPublicCityDto(row: CityRow): PublicCityDto {
  return {
    slug: row.slug,
    nameZh: row.nameZh,
    nameEn: row.nameEn,
    region: row.region,
    province: row.province,
    monthlyCost: row.monthlyCost,
    monthlyCostRmb: row.monthlyCostRmb,
    costLevel: row.costLevel,
    density: row.density,
    tags: asTextArray(row.tags, "city tags"),
    content: asCityContent(row.contentJson),
    nearby: asTextArray(row.nearby, "city nearby references"),
    references: {
      schoolCount: row.referenceSchoolCount,
      programCount: row.referenceProgramCount,
      englishProgramCount: row.referenceEnglishProgramCount,
      scholarshipCount: row.referenceScholarshipCount,
      cscaRequiredSchoolCount: row.referenceCscaSchoolCount,
    },
    actualSchoolCount: row.referenceSchoolCount,
    actualProgramCount: row.referenceProgramCount,
    actualEnglishProgramCount: row.referenceEnglishProgramCount,
    actualScholarshipCount: row.referenceScholarshipCount,
    actualCscaRequiredSchoolCount: row.referenceCscaSchoolCount,
    status: row.status,
    sortOrder: row.sortOrder,
    version: row.version,
    updatedAt: row.updatedAt,
  };
}

export function toPublicCityDetailDto(row: CityRow): PublicCityDetailDto {
  return {
    ...toPublicCityDto(row),
    id: row.id,
    verificationStatus: row.verificationStatus,
    sourceStatus: sourceStatus(row.status, row.verificationStatus),
    sourceUrl: row.sourceUrl,
    sourceLabel: row.sourceLabel,
    lastVerifiedAt: row.lastVerifiedAt,
    sourceFieldLineage: asLineage(row.sourceFieldLineageJson),
  };
}
