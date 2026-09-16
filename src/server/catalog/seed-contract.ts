import { createHash } from "node:crypto";

export type CatalogSeedEntityStatus = "active" | "draft" | "archived";

export const CATALOG_SEED_ALLOWED_FIELDS = Object.freeze({
  bundle: ["version", "generatedAt", "handoff", "cities", "schools", "programs", "programIntakes", "scholarships"],
  handoff: ["sourceSystem", "cleanedExportName", "cleanedExportSha256", "sourceSchemaSha256", "reviewReference", "prohibitedDataReviewReference", "approvalRecordedAt", "sourceReadOnly", "prohibitedDataConfirmedExcluded"],
  cities: ["slug", "nameEn", "nameZh", "region", "province", "status", "sourceUrl", "sourceLabel", "sourceSha256", "capturedAt", "sourceFieldLineage"],
  schools: ["slug", "nameEn", "nameZh", "citySlug", "schoolType", "region", "applicationLevel", "languageOfInstruction", "languageRequirement", "hskRequirement", "englishRequirement", "deadlineSummary", "tuitionSummary", "applicationFee", "websiteUrl", "admissionsUrl", "cscaRequired", "cscaRequirement", "cscaSubjects", "subjectTags", "languageTags", "tuitionBandLabel", "campusHighlights", "contactNotes", "status", "verificationStatus", "lastVerifiedAt", "sourceUrl", "sourceLabel", "sourceSha256", "capturedAt", "sourceFieldLineage"],
  programs: ["slug", "schoolSlug", "citySlug", "nameEn", "nameZh", "degreeLevel", "durationYears", "durationMonths", "fieldCategory", "subjectArea", "teachingLanguage", "cscaSubjects", "cscaRequirement", "hskRequirement", "englishRequirement", "tuitionAmount", "tuitionCurrency", "tuitionPeriod", "tuitionText", "scholarshipText", "applicationUrl", "applicationNote", "hasScholarship", "badgeText", "displayTuition", "displaySubjects", "displayGroup", "displayGroupLabel", "status", "verificationStatus", "lastVerifiedAt", "sourceUrl", "sourceLabel", "sourceSha256", "capturedAt", "sourceFieldLineage"],
  programIntakes: ["programSlug", "intakeTerm", "intakeYear", "openDate", "deadlineDate", "deadlineLabel", "applicationRound", "status", "sourceUrl", "sourceLabel", "sourceSha256", "capturedAt", "sourceFieldLineage"],
  scholarships: ["slug", "title", "nameZh", "schoolSlug", "programSlug", "type", "typeLabel", "providerName", "providerNameEn", "providerLocation", "fundingLevel", "coverage", "applicableDegree", "applicableProgram", "amountText", "requirementText", "bodySections", "benefitItems", "eligibilityItems", "applicationMaterials", "applicationSteps", "actionLinks", "deadlineDate", "deadlineLabel", "applicationRound", "targetCountries", "targetRegions", "benefits", "tags", "summary", "sortOrder", "status", "verificationStatus", "lastVerifiedAt", "sourceUrl", "sourceLabel", "sourceSha256", "capturedAt", "sourceFieldLineage"],
} as const);

export const CATALOG_MIGRATION_PROHIBITED_FIELDS = Object.freeze([
  "password", "passwordHash", "passwordSalt", "secret", "apiKey", "privateKey", "sessionToken", "refreshToken",
  "userId", "studentId", "applicantId", "applicationId", "paymentId", "invoiceId", "cardNumber", "cvv",
  "passportNumber", "birthDate", "personalEmail", "personalPhone", "documentBytes", "fileBytes",
] as const);

const prohibitedFieldNames = new Set(CATALOG_MIGRATION_PROHIBITED_FIELDS.map((field) => field.toLowerCase()));
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type CatalogSeedSource = {
  sourceUrl: string;
  sourceLabel: string;
  sourceSha256?: string;
  capturedAt?: string;
  sourceFieldLineage?: Record<string, unknown>;
};

export type CatalogSeedCity = CatalogSeedSource & {
  slug: string;
  nameEn: string;
  nameZh?: string;
  region?: string;
  province?: string;
  status?: CatalogSeedEntityStatus;
};

export type CatalogSeedSchool = CatalogSeedSource & {
  slug: string;
  nameEn: string;
  nameZh?: string;
  citySlug?: string;
  schoolType?: string;
  region?: string;
  applicationLevel?: string;
  languageOfInstruction?: string;
  languageRequirement?: string;
  hskRequirement?: string;
  englishRequirement?: string;
  deadlineSummary?: string;
  tuitionSummary?: string;
  applicationFee?: string;
  websiteUrl?: string;
  admissionsUrl?: string;
  cscaRequired?: boolean;
  cscaRequirement?: string;
  cscaSubjects?: string[];
  subjectTags?: string[];
  languageTags?: string[];
  tuitionBandLabel?: string;
  campusHighlights?: string[];
  contactNotes?: string;
  status?: CatalogSeedEntityStatus;
  verificationStatus?: CatalogVerificationStatus;
  lastVerifiedAt?: string;
};

export type CatalogSeedProgram = CatalogSeedSource & {
  slug: string;
  schoolSlug: string;
  citySlug?: string;
  nameEn: string;
  nameZh?: string;
  degreeLevel: string;
  durationYears?: number;
  durationMonths?: number;
  fieldCategory?: string;
  subjectArea?: string;
  teachingLanguage?: string;
  cscaSubjects?: string[];
  cscaRequirement?: string;
  hskRequirement?: string;
  englishRequirement?: string;
  tuitionAmount?: number;
  tuitionCurrency?: string;
  tuitionPeriod?: string;
  tuitionText?: string;
  scholarshipText?: string;
  applicationUrl?: string;
  applicationNote?: string;
  hasScholarship?: boolean;
  badgeText?: string;
  displayTuition?: string;
  displaySubjects?: string[];
  displayGroup?: string;
  displayGroupLabel?: string;
  status?: CatalogSeedEntityStatus;
  verificationStatus?: CatalogVerificationStatus;
  lastVerifiedAt?: string;
};

export type CatalogSeedProgramIntake = CatalogSeedSource & {
  programSlug: string;
  intakeTerm: string;
  intakeYear: number;
  openDate?: string;
  deadlineDate?: string;
  deadlineLabel?: string;
  applicationRound?: string;
  status?: "open" | "closed";
};
export type CatalogVerificationStatus = "verified" | "unverified" | "stale" | "disputed" | "invalid";

export type CatalogSeedScholarship = CatalogSeedSource & {
  slug: string;
  title: string;
  nameZh?: string;
  schoolSlug?: string;
  programSlug?: string;
  type?: string;
  typeLabel?: string;
  providerName?: string;
  providerNameEn?: string;
  providerLocation?: string;
  fundingLevel?: string;
  coverage?: string;
  applicableDegree?: string;
  applicableProgram?: string;
  amountText?: string;
  requirementText?: string;
  bodySections?: CatalogSeedScholarshipBodySection[];
  benefitItems?: CatalogSeedScholarshipBenefitItem[];
  eligibilityItems?: CatalogSeedScholarshipInfoItem[];
  applicationMaterials?: CatalogSeedScholarshipInfoItem[];
  applicationSteps?: CatalogSeedScholarshipInfoItem[];
  actionLinks?: CatalogSeedScholarshipActionLink[];
  deadlineDate?: string;
  deadlineLabel?: string;
  applicationRound?: string;
  targetCountries?: string[];
  targetRegions?: string[];
  benefits?: string[];
  tags?: string[];
  summary?: string;
  sortOrder?: number;
  status?: CatalogSeedEntityStatus;
  verificationStatus?: CatalogVerificationStatus;
  lastVerifiedAt?: string;
};

export type CatalogSeedScholarshipBodySection = {
  title: string;
  body?: string;
  paragraphs?: string[];
  items?: string[];
};

export type CatalogSeedScholarshipBenefitItem = {
  key?: string;
  label: string;
  included?: boolean;
  note?: string;
};

export type CatalogSeedScholarshipInfoItem = {
  label: string;
  value?: string;
  body?: string;
};

export type CatalogSeedScholarshipActionLink = {
  label: string;
  url: string;
  kind?: string;
};

export type CatalogSeedBundle = {
  version: 1 | 2;
  generatedAt: string;
  handoff?: CatalogMigrationHandoff;
  cities?: CatalogSeedCity[];
  schools?: CatalogSeedSchool[];
  programs?: CatalogSeedProgram[];
  programIntakes?: CatalogSeedProgramIntake[];
  scholarships?: CatalogSeedScholarship[];
};

export type CatalogSeedValidationResult = {
  ok: boolean;
  errors: string[];
  summary: {
    cities: number;
    schools: number;
    programs: number;
    programIntakes: number;
    scholarships: number;
  };
};

export type CatalogSeedImportEntityType = "city" | "school" | "program" | "programIntake" | "scholarship";

export type CatalogSeedImportOperation = {
  order: number;
  entityType: CatalogSeedImportEntityType;
  slug: string;
  idempotencyKey: string;
  dependencyKeys: string[];
  sourceEvidence: CatalogSeedSource;
  status: CatalogSeedEntityStatus | "open" | "closed";
};

export type CatalogSeedImportPlan = CatalogSeedValidationResult & {
  operations: CatalogSeedImportOperation[];
};

export type CatalogMigrationHandoff = {
  sourceSystem: string;
  cleanedExportName: string;
  cleanedExportSha256: string;
  sourceSchemaSha256: string;
  reviewReference: string;
  prohibitedDataReviewReference: string;
  approvalRecordedAt: string;
  sourceReadOnly: true;
  prohibitedDataConfirmedExcluded: true;
};

export type CatalogMigrationValidationReport = CatalogSeedImportPlan & {
  validationPolicyVersion: 1;
  bundleSha256: string;
  operationPlanSha256: string;
};

export function validateCatalogSeedBundle(bundle: unknown): CatalogSeedValidationResult {
  const errors: string[] = [];
  const value = asRecord(bundle);

  if (!value) return emptyResult(["Seed bundle must be a JSON object."]);
  if (value.version !== 1 && value.version !== 2) errors.push("version must be 1 or 2.");

  requireString(value, "generatedAt", "generatedAt", errors);
  validateTimestamp(value.generatedAt, "generatedAt", errors);
  validateAllowedFields(value, CATALOG_SEED_ALLOWED_FIELDS.bundle, "bundle", errors);
  validateProhibitedFieldNames(value, "bundle", errors);
  if (value.version === 2) validateMigrationHandoff(value.handoff, errors);

  const cities = readArray<CatalogSeedCity>(value, "cities", errors);
  const schools = readArray<CatalogSeedSchool>(value, "schools", errors);
  const programs = readArray<CatalogSeedProgram>(value, "programs", errors);
  const programIntakes = readArray<CatalogSeedProgramIntake>(value, "programIntakes", errors);
  const scholarships = readArray<CatalogSeedScholarship>(value, "scholarships", errors);

  validateEntities("cities", cities, ["slug", "nameEn", "sourceUrl", "sourceLabel"], CATALOG_SEED_ALLOWED_FIELDS.cities, errors);
  validateEntities("schools", schools, ["slug", "nameEn", "sourceUrl", "sourceLabel"], CATALOG_SEED_ALLOWED_FIELDS.schools, errors);
  validateEntities("programs", programs, ["slug", "schoolSlug", "nameEn", "degreeLevel", "sourceUrl", "sourceLabel"], CATALOG_SEED_ALLOWED_FIELDS.programs, errors);
  validateEntities("programIntakes", programIntakes, ["programSlug", "intakeTerm", "sourceUrl", "sourceLabel"],
    CATALOG_SEED_ALLOWED_FIELDS.programIntakes, errors, "programSlug", ["open", "closed"], false);
  validateEntities("scholarships", scholarships, ["slug", "title", "sourceUrl", "sourceLabel"], CATALOG_SEED_ALLOWED_FIELDS.scholarships, errors);
  validateRichCatalogFields(schools, programs, programIntakes, scholarships, errors);
  validateReferences({
    cities: cities.filter((item) => asRecord(item)),
    schools: schools.filter((item) => asRecord(item)),
    programs: programs.filter((item) => asRecord(item)),
    programIntakes: programIntakes.filter((item) => asRecord(item)),
    scholarships: scholarships.filter((item) => asRecord(item)),
  }, errors);

  return {
    ok: errors.length === 0,
    errors,
    summary: {
      cities: cities.length,
      schools: schools.length,
      programs: programs.length,
      programIntakes: programIntakes.length,
      scholarships: scholarships.length,
    },
  };
}

export function createCatalogMigrationValidationReport(bundle: unknown): CatalogMigrationValidationReport {
  const plan = createCatalogSeedImportPlan(bundle);
  return {
    ...plan,
    validationPolicyVersion: 1,
    bundleSha256: sha256Canonical(bundle),
    operationPlanSha256: sha256Canonical(plan.operations),
  };
}

export function createCatalogSeedImportPlan(bundle: unknown): CatalogSeedImportPlan {
  const validation = validateCatalogSeedBundle(bundle);

  if (!validation.ok) {
    return {
      ...validation,
      operations: [],
    };
  }

  const seedBundle = bundle as CatalogSeedBundle;
  const operations: CatalogSeedImportOperation[] = [];

  for (const city of seedBundle.cities ?? []) {
    operations.push(createOperation(operations.length + 1, "city", city.slug, [], city));
  }

  for (const school of seedBundle.schools ?? []) {
    operations.push(
      createOperation(operations.length + 1, "school", school.slug, school.citySlug ? [`city:${school.citySlug}`] : [], school),
    );
  }

  for (const program of seedBundle.programs ?? []) {
    operations.push(createOperation(operations.length + 1, "program", program.slug, [`school:${program.schoolSlug}`], program));
  }

  for (const intake of seedBundle.programIntakes ?? []) {
    const identity = [intake.programSlug, intake.intakeTerm.toLowerCase(), intake.intakeYear].join("-");
    operations.push(createOperation(operations.length + 1, "programIntake", identity,
      [`program:${intake.programSlug}`], intake));
  }

  for (const scholarship of seedBundle.scholarships ?? []) {
    const dependencyKeys = [
      ...(scholarship.schoolSlug ? [`school:${scholarship.schoolSlug}`] : []),
      ...(scholarship.programSlug ? [`program:${scholarship.programSlug}`] : []),
    ];
    operations.push(createOperation(operations.length + 1, "scholarship", scholarship.slug, dependencyKeys, scholarship));
  }

  return {
    ...validation,
    operations,
  };
}

function validateEntities(
  entityName: string,
  entities: readonly Record<string, unknown>[],
  requiredFields: readonly string[],
  allowedFields: readonly string[],
  errors: string[],
  identityField = "slug",
  allowedStatuses: readonly string[] = ["active", "draft", "archived"],
  checkDuplicates = true,
) {
  const seenIdentities = new Set<string>();
  entities.forEach((entity, index) => {
    const label = `${entityName}[${index}]`;
    if (!asRecord(entity)) {
      errors.push(`${label} must be an object.`);
      return;
    }
    validateAllowedFields(entity, allowedFields, label, errors);
    for (const field of requiredFields) requireString(entity, field, `${label}.${field}`, errors);

    const identity = entity[identityField];
    if (typeof identity === "string") {
      if (!slugPattern.test(identity)) errors.push(`${label}.${identityField} must use lowercase kebab-case.`);
      const normalized = identity.toLowerCase();
      if (checkDuplicates && seenIdentities.has(normalized)) errors.push(`${label}.${identityField} duplicates ${identity}.`);
      seenIdentities.add(normalized);
    }

    validateSourceEvidence(entity, label, errors);
    if ("status" in entity && entity.status !== undefined && !allowedStatuses.includes(String(entity.status))) {
      errors.push(`${label}.status must be one of: ${allowedStatuses.join(", ")}.`);
    }
  });
}

function validateRichCatalogFields(
  schools: readonly CatalogSeedSchool[],
  programs: readonly CatalogSeedProgram[],
  intakes: readonly CatalogSeedProgramIntake[],
  scholarships: readonly CatalogSeedScholarship[],
  errors: string[],
) {
  const schoolTextFields = ["applicationLevel", "languageOfInstruction", "languageRequirement", "hskRequirement",
    "englishRequirement", "deadlineSummary", "tuitionSummary", "applicationFee", "tuitionBandLabel", "contactNotes"];
  schools.forEach((school, index) => {
    const label = `schools[${index}]`;
    validateOptionalTextFields(school, schoolTextFields, `schools[${index}]`, errors);
    validateOptionalTextArrays(school, ["cscaSubjects", "subjectTags", "languageTags", "campusHighlights"], `schools[${index}]`, errors);
    validateOptionalBoolean(school.cscaRequired, `schools[${index}].cscaRequired`, errors);
    validateOptionalHttpsUrl(school.websiteUrl, `schools[${index}].websiteUrl`, errors);
    validateOptionalHttpsUrl(school.admissionsUrl, `schools[${index}].admissionsUrl`, errors);
    validateVerificationFields(school, label, errors);
  });

  const programTextFields = ["citySlug", "fieldCategory", "subjectArea", "teachingLanguage", "cscaRequirement",
    "hskRequirement", "englishRequirement", "tuitionCurrency", "tuitionPeriod", "tuitionText", "scholarshipText",
    "applicationNote", "badgeText", "displayTuition", "displayGroup", "displayGroupLabel"];
  programs.forEach((program, index) => {
    const label = `programs[${index}]`;
    validateOptionalTextFields(program, programTextFields, `programs[${index}]`, errors);
    validateOptionalTextArrays(program, ["cscaSubjects", "displaySubjects"], `programs[${index}]`, errors);
    validateOptionalPositiveInteger(program.durationYears, `programs[${index}].durationYears`, errors);
    validateOptionalPositiveInteger(program.durationMonths, `programs[${index}].durationMonths`, errors);
    validateOptionalPositiveInteger(program.tuitionAmount, `programs[${index}].tuitionAmount`, errors);
    validateOptionalBoolean(program.hasScholarship, `programs[${index}].hasScholarship`, errors);
    validateOptionalHttpsUrl(program.applicationUrl, `programs[${index}].applicationUrl`, errors);
    validateVerificationFields(program, label, errors);
  });

  const seen = new Set<string>();
  intakes.forEach((intake, index) => {
    const label = `programIntakes[${index}]`;
    if (!Number.isInteger(intake.intakeYear) || intake.intakeYear < 2020 || intake.intakeYear > 2100) {
      errors.push(`${label}.intakeYear must be an integer between 2020 and 2100.`);
    }
    if (intake.openDate !== undefined) validateTimestamp(intake.openDate, `${label}.openDate`, errors);
    if (intake.deadlineDate !== undefined) validateTimestamp(intake.deadlineDate, `${label}.deadlineDate`, errors);
    validateOptionalTextFields(intake, ["deadlineLabel", "applicationRound"], label, errors);
    const identity = [intake.programSlug, intake.intakeTerm.toLowerCase(), intake.intakeYear].join(":");
    if (seen.has(identity)) errors.push(`${label} duplicates an existing program, term and year.`);
    seen.add(identity);
  });

  const scholarshipTextFields = ["nameZh", "schoolSlug", "programSlug", "type", "typeLabel", "providerName",
    "providerNameEn", "providerLocation", "fundingLevel", "coverage", "applicableDegree", "applicableProgram",
    "amountText", "requirementText", "deadlineLabel", "applicationRound", "summary"];
  scholarships.forEach((scholarship, index) => {
    const label = `scholarships[${index}]`;
    validateOptionalTextFields(scholarship, scholarshipTextFields, label, errors);
    validateOptionalTextArrays(scholarship, ["targetCountries", "targetRegions", "benefits", "tags"], label, errors);
    validateOptionalPositiveInteger(scholarship.sortOrder, `${label}.sortOrder`, errors, true);
    if (scholarship.deadlineDate !== undefined) validateIsoDate(scholarship.deadlineDate, `${label}.deadlineDate`, errors);
    validateVerificationFields(scholarship, label, errors);
    validateStructuredArray(scholarship.bodySections, `${label}.bodySections`, ["title"],
      ["title", "body", "paragraphs", "items"], ["title", "body"], ["paragraphs", "items"], errors);
    validateStructuredArray(scholarship.benefitItems, `${label}.benefitItems`, ["label"],
      ["key", "label", "included", "note"], ["key", "label", "note"], [], errors, ["included"]);
    validateStructuredArray(scholarship.eligibilityItems, `${label}.eligibilityItems`, ["label"],
      ["label", "value", "body"], ["label", "value", "body"], [], errors);
    validateStructuredArray(scholarship.applicationMaterials, `${label}.applicationMaterials`, ["label"],
      ["label", "value", "body"], ["label", "value", "body"], [], errors);
    validateStructuredArray(scholarship.applicationSteps, `${label}.applicationSteps`, ["label"],
      ["label", "value", "body"], ["label", "value", "body"], [], errors);
    validateStructuredArray(scholarship.actionLinks, `${label}.actionLinks`, ["label", "url"],
      ["label", "url", "kind"], ["label", "url", "kind"], [], errors);
    scholarship.actionLinks?.forEach((link, linkIndex) =>
      validateOptionalHttpsUrl(link.url, `${label}.actionLinks[${linkIndex}].url`, errors));
  });
}

function validateVerificationFields(
  entity: { verificationStatus?: unknown; lastVerifiedAt?: unknown },
  label: string,
  errors: string[],
) {
  if (entity.verificationStatus !== undefined
    && !["verified", "unverified", "stale", "disputed", "invalid"].includes(String(entity.verificationStatus))) {
    errors.push(`${label}.verificationStatus must be a supported verification state.`);
  }
  if (entity.lastVerifiedAt !== undefined) validateTimestamp(entity.lastVerifiedAt, `${label}.lastVerifiedAt`, errors);
  if (entity.verificationStatus === "verified" && entity.lastVerifiedAt === undefined) {
    errors.push(`${label}.lastVerifiedAt is required when verificationStatus is verified.`);
  }
}

function validateStructuredArray(
  value: unknown,
  label: string,
  required: readonly string[],
  allowed: readonly string[],
  textFields: readonly string[],
  textArrayFields: readonly string[],
  errors: string[],
  booleanFields: readonly string[] = [],
) {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    errors.push(`${label} must be an array.`);
    return;
  }
  value.forEach((item, index) => {
    const itemLabel = `${label}[${index}]`;
    const record = asRecord(item);
    if (!record) {
      errors.push(`${itemLabel} must be an object.`);
      return;
    }
    validateAllowedFields(record, allowed, itemLabel, errors);
    required.forEach(field => requireString(record, field, `${itemLabel}.${field}`, errors));
    validateOptionalTextFields(record, textFields, itemLabel, errors);
    validateOptionalTextArrays(record, textArrayFields, itemLabel, errors);
    booleanFields.forEach(field => validateOptionalBoolean(record[field], `${itemLabel}.${field}`, errors));
  });
}

function validateOptionalTextFields(value: object, fields: readonly string[], label: string, errors: string[]) {
  const record = value as Record<string, unknown>;
  for (const field of fields) {
    if (record[field] !== undefined && (typeof record[field] !== "string" || !String(record[field]).trim())) {
      errors.push(`${label}.${field} must be a non-empty string when provided.`);
    }
  }
}

function validateOptionalTextArrays(value: object, fields: readonly string[], label: string, errors: string[]) {
  const record = value as Record<string, unknown>;
  for (const field of fields) {
    const candidate = record[field];
    if (candidate !== undefined && (!Array.isArray(candidate) || candidate.some(item => typeof item !== "string" || !item.trim()))) {
      errors.push(`${label}.${field} must contain only non-empty strings.`);
    }
  }
}

function validateOptionalPositiveInteger(value: unknown, label: string, errors: string[], allowZero = false) {
  if (value !== undefined && (!Number.isInteger(value) || Number(value) < (allowZero ? 0 : 1))) {
    errors.push(`${label} must be ${allowZero ? "a non-negative" : "a positive"} integer.`);
  }
}

function validateOptionalBoolean(value: unknown, label: string, errors: string[]) {
  if (value !== undefined && typeof value !== "boolean") errors.push(`${label} must be boolean.`);
}

function validateOptionalHttpsUrl(value: unknown, label: string, errors: string[]) {
  if (value === undefined) return;
  if (typeof value !== "string") {
    errors.push(`${label} must be an HTTPS URL.`);
    return;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) errors.push(`${label} must be an HTTPS URL without credentials.`);
  } catch {
    errors.push(`${label} must be a valid HTTPS URL.`);
  }
}

function validateIsoDate(value: unknown, label: string, errors: string[]) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    errors.push(`${label} must be an ISO-8601 calendar date (YYYY-MM-DD).`);
    return;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    errors.push(`${label} must be a valid calendar date.`);
  }
}

function validateReferences(
  bundle: {
    cities: readonly CatalogSeedCity[];
    schools: readonly CatalogSeedSchool[];
    programs: readonly CatalogSeedProgram[];
    programIntakes: readonly CatalogSeedProgramIntake[];
    scholarships: readonly CatalogSeedScholarship[];
  },
  errors: string[],
) {
  const citySlugs = new Set(bundle.cities.map((city) => city.slug));
  const schoolSlugs = new Set(bundle.schools.map((school) => school.slug));
  const programSlugs = new Set(bundle.programs.map((program) => program.slug));
  const programSchoolSlugs = new Map(bundle.programs.map((program) => [program.slug, program.schoolSlug]));

  bundle.schools.forEach((school, index) => {
    if (school.citySlug && !citySlugs.has(school.citySlug)) {
      errors.push(`schools[${index}].citySlug references unknown city ${school.citySlug}.`);
    }
  });

  bundle.programs.forEach((program, index) => {
    if (!schoolSlugs.has(program.schoolSlug)) errors.push(`programs[${index}].schoolSlug references unknown school ${program.schoolSlug}.`);
    if (program.citySlug && !citySlugs.has(program.citySlug)) errors.push(`programs[${index}].citySlug references unknown city ${program.citySlug}.`);
  });

  bundle.programIntakes.forEach((intake, index) => {
    if (!programSlugs.has(intake.programSlug)) errors.push(`programIntakes[${index}].programSlug references unknown program ${intake.programSlug}.`);
  });

  bundle.scholarships.forEach((scholarship, index) => {
    if (scholarship.schoolSlug && !schoolSlugs.has(scholarship.schoolSlug)) {
      errors.push(`scholarships[${index}].schoolSlug references unknown school ${scholarship.schoolSlug}.`);
    }

    if (scholarship.programSlug && !programSlugs.has(scholarship.programSlug)) {
      errors.push(`scholarships[${index}].programSlug references unknown program ${scholarship.programSlug}.`);
    }
    if (scholarship.schoolSlug && scholarship.programSlug
      && programSchoolSlugs.get(scholarship.programSlug) !== scholarship.schoolSlug) {
      errors.push(`scholarships[${index}] links a program outside school ${scholarship.schoolSlug}.`);
    }
  });
}

function readArray<T>(value: Record<string, unknown>, field: string, errors: string[]): T[] {
  if (value[field] === undefined) {
    return [];
  }

  if (!Array.isArray(value[field])) {
    errors.push(`${field} must be an array.`);
    return [];
  }

  return value[field] as T[];
}

function requireString(value: Record<string, unknown>, field: string, label: string, errors: string[]) {
  if (typeof value[field] !== "string" || !value[field].trim()) {
    errors.push(`${label} is required.`);
  }
}

function validateAllowedFields(value: Record<string, unknown>, allowedFields: readonly string[], label: string, errors: string[]) {
  const allowed = new Set(allowedFields);
  for (const field of Object.keys(value).sort()) {
    if (!allowed.has(field)) errors.push(`${label}.${field} is not in the migration whitelist.`);
  }
}

function validateProhibitedFieldNames(value: unknown, path: string, errors: string[]) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => validateProhibitedFieldNames(item, `${path}[${index}]`, errors));
    return;
  }
  const record = asRecord(value);
  if (!record) return;
  for (const field of Object.keys(record).sort()) {
    if (prohibitedFieldNames.has(field.toLowerCase())) errors.push(`${path}.${field} is prohibited migration data.`);
    validateProhibitedFieldNames(record[field], `${path}.${field}`, errors);
  }
}

function validateSourceEvidence(value: Record<string, unknown>, label: string, errors: string[]) {
  if (typeof value.sourceUrl === "string" && value.sourceUrl) {
    try {
      const url = new URL(value.sourceUrl);
      if (url.protocol !== "https:" || url.username || url.password) errors.push(`${label}.sourceUrl must be an HTTPS URL without credentials.`);
    } catch {
      errors.push(`${label}.sourceUrl must be a valid HTTPS URL.`);
    }
  }
  if (value.capturedAt !== undefined) validateTimestamp(value.capturedAt, `${label}.capturedAt`, errors);
  if (value.sourceSha256 !== undefined && (typeof value.sourceSha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.sourceSha256))) {
    errors.push(`${label}.sourceSha256 must be a lowercase SHA-256 digest.`);
  }
  const lineage = asRecord(value.sourceFieldLineage);
  if (!lineage || !Object.keys(lineage).length) {
    errors.push(`${label}.sourceFieldLineage must map at least one imported field to its cleaned source field.`);
    return;
  }
  for (const [field, sourcePath] of Object.entries(lineage).sort(([left], [right]) => left.localeCompare(right))) {
    if (!(field in value)) errors.push(`${label}.sourceFieldLineage.${field} does not describe an imported field.`);
    if (typeof sourcePath !== "string" || !sourcePath.trim()) errors.push(`${label}.sourceFieldLineage.${field} must be a non-empty source path.`);
  }
}

function validateMigrationHandoff(value: unknown, errors: string[]) {
  const handoff = asRecord(value);
  if (!handoff) {
    errors.push("handoff is required for version 2 real-catalog migration bundles.");
    return;
  }
  validateAllowedFields(handoff, CATALOG_SEED_ALLOWED_FIELDS.handoff, "handoff", errors);
  for (const field of ["sourceSystem", "cleanedExportName", "cleanedExportSha256", "sourceSchemaSha256", "reviewReference", "prohibitedDataReviewReference", "approvalRecordedAt"]) {
    requireString(handoff, field, `handoff.${field}`, errors);
  }
  if (typeof handoff.cleanedExportName === "string" && /[\\/]/.test(handoff.cleanedExportName)) {
    errors.push("handoff.cleanedExportName must be a filename, not a filesystem path.");
  }
  for (const field of ["cleanedExportSha256", "sourceSchemaSha256"]) {
    if (typeof handoff[field] === "string" && !/^[a-f0-9]{64}$/.test(handoff[field])) errors.push(`handoff.${field} must be a lowercase SHA-256 digest.`);
  }
  for (const field of ["reviewReference", "prohibitedDataReviewReference"]) {
    if (typeof handoff[field] === "string" && /^(?:pending|todo|tbd|unknown|n\/a)$/i.test(handoff[field].trim())) {
      errors.push(`handoff.${field} must identify a completed review.`);
    }
  }
  validateTimestamp(handoff.approvalRecordedAt, "handoff.approvalRecordedAt", errors);
  if (handoff.sourceReadOnly !== true) errors.push("handoff.sourceReadOnly must be true.");
  if (handoff.prohibitedDataConfirmedExcluded !== true) errors.push("handoff.prohibitedDataConfirmedExcluded must be true.");
}

function validateTimestamp(value: unknown, label: string, errors: string[]) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)
    || !Number.isFinite(Date.parse(value))) errors.push(`${label} must be an ISO-8601 UTC timestamp.`);
}

function sha256Canonical(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = asRecord(value);
  if (record) return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function emptyResult(errors: string[]): CatalogSeedValidationResult {
  return {
    ok: false,
    errors,
    summary: {
      cities: 0,
      schools: 0,
      programs: 0,
      programIntakes: 0,
      scholarships: 0,
    },
  };
}

function createOperation(
  order: number,
  entityType: CatalogSeedImportEntityType,
  slug: string,
  dependencyKeys: string[],
  source: CatalogSeedSource & { status?: CatalogSeedEntityStatus | "open" | "closed" },
): CatalogSeedImportOperation {
  return {
    order,
    entityType,
    slug,
    idempotencyKey: `${entityType}:${slug}`,
    dependencyKeys,
    sourceEvidence: {
      sourceUrl: source.sourceUrl,
      sourceLabel: source.sourceLabel,
      sourceSha256: source.sourceSha256,
      capturedAt: source.capturedAt,
      sourceFieldLineage: source.sourceFieldLineage ?? {},
    },
    status: source.status ?? "draft",
  };
}
