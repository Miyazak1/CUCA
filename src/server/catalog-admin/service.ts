import { buildAuditEvent, type AuditSink } from "../audit/audit.ts";
import { evaluatePolicy, type PolicyAction } from "../policy/policy.ts";
import { badRequest, conflict, forbidden, serviceUnavailable } from "../shared/errors.ts";
import { inputEnum, inputInteger, inputList, inputRecord, inputText, inputUuid } from "../shared/input.ts";
import type { RequestContext } from "../shared/request-context.ts";
import { CATALOG_READINESS_ENTITY_TYPES, CATALOG_READINESS_STATES, CATALOG_READINESS_REASON_CODES,
  type CatalogReadinessEntityType, type CatalogReadinessState } from "./publication-readiness.ts";

export const CATALOG_CITY_STATUSES = ["draft", "active", "archived"] as const;
export const CATALOG_VERIFICATION_STATUSES = ["unverified", "verified", "stale", "disputed", "invalid"] as const;

export type CatalogCityStatus = (typeof CATALOG_CITY_STATUSES)[number];
export type CatalogAdminVerificationStatus = (typeof CATALOG_VERIFICATION_STATUSES)[number];
export type CatalogAdminRole = "cuac_ops" | "cuac_admin";

export type CatalogCityDocument = {
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
  content: Record<string, unknown>;
  nearby: string[];
  sortOrder: number;
  sourceUrl: string;
  sourceLabel: string;
  sourceNote: string | null;
};

export type CatalogCityRecord = CatalogCityDocument & {
  id: string;
  version: number;
  status: CatalogCityStatus;
  verificationStatus: CatalogAdminVerificationStatus;
  verifiedByUserId: string | null;
  lastVerifiedAt: Date | null;
  nextReviewDueAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CatalogCityRevision = {
  id: string;
  entityVersion: number;
  action: "created" | "updated" | "published" | "archived" | "restored";
  changedFields: string[];
  actorUserId: string | null;
  createdAt: Date;
};

export type CatalogSchoolDocument = {
  slug: string;
  nameZh: string | null;
  nameEn: string;
  schoolType: string | null;
  region: string | null;
  cityId: string;
  city: string | null;
  cityZh: string | null;
  citySlug: string | null;
  province: string | null;
  regionLabel: string | null;
  ranking: string | null;
  cscaRequired: boolean;
  cscaRequirement: string | null;
  cscaSubjects: string[];
  applicationLevel: string | null;
  languageOfInstruction: string | null;
  languageRequirement: string | null;
  hskRequirement: string | null;
  englishRequirement: string | null;
  deadlineSummary: string | null;
  tuitionSummary: string | null;
  applicationFee: string | null;
  websiteUrl: string;
  admissionsUrl: string | null;
  subjectTags: string[];
  fitNotes: string | null;
  languageTags: string[];
  tuitionBandLabel: string | null;
  campusHighlights: string[];
  contactNotes: string | null;
  qualityScore: number | null;
  missingFields: string[];
  completenessLabel: string | null;
  sourceUrl: string;
  sourceLabel: string;
  sourceNote: string | null;
};

export type CatalogSchoolRecord = Omit<CatalogSchoolDocument, "cityId"> & {
  id: string;
  cityId: string | null;
  version: number;
  status: CatalogCityStatus;
  verificationStatus: CatalogAdminVerificationStatus;
  verifiedByUserId: string | null;
  lastVerifiedAt: Date | null;
  nextReviewDueAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CatalogSchoolRevision = CatalogCityRevision;

export type CatalogProgramDocument = {
  schoolId: string; cityId: string; slug: string; nameZh: string | null; nameEn: string; degreeLevel: string;
  durationYears: number | null; durationMonths: number | null; fieldCategory: string | null; subjectArea: string | null;
  teachingLanguage: string | null; cscaSubjects: string[]; cscaRequirement: string | null; hskRequirement: string | null;
  englishRequirement: string | null; tuitionAmount: number | null; tuitionCurrency: string | null;
  tuitionPeriod: string | null; tuitionText: string | null; scholarshipText: string | null;
  applicationUrl: string | null; applicationNote: string | null; hasScholarship: boolean; badgeText: string | null;
  displayTuition: string | null; displaySubjects: string[]; displayGroup: string | null; displayGroupLabel: string | null;
  sortOrder: number; sourceUrl: string; sourceLabel: string; sourceNote: string | null;
};

export type CatalogProgramRecord = Omit<CatalogProgramDocument, "cityId"> & {
  id: string; cityId: string | null; isVerified: boolean; version: number; status: CatalogCityStatus;
  verificationStatus: CatalogAdminVerificationStatus; verifiedByUserId: string | null;
  lastVerifiedAt: Date | null; nextReviewDueAt: Date | null; createdAt: Date; updatedAt: Date;
};

export type CatalogProgramDependencies = {
  intakeCount: number; openIntakeCount: number; activeRequirementPublicationCount: number;
  activeScholarshipCount: number; activeApplicationChoiceCount: number;
};

export type CatalogProgramRevision = CatalogCityRevision;

export type CatalogScholarshipDocument = {
  slug: string; title: string; nameZh: string | null; type: string | null; typeLabel: string | null;
  fundingLevel: string | null; providerName: string | null; providerNameEn: string | null;
  providerLocation: string | null; schoolId: string | null; programId: string | null; coverage: string | null;
  applicableDegree: string | null; applicableProgram: string | null; amountText: string | null;
  requirementText: string | null; bodySections: unknown[]; benefitItems: unknown[]; eligibilityItems: unknown[];
  applicationMaterials: unknown[]; applicationSteps: unknown[]; contactInfo: Record<string, unknown>;
  actionLinks: unknown[]; deadlineDate: Date | null; deadlineLabel: string | null; applicationRound: string | null;
  targetCountries: string[]; targetRegions: string[]; benefits: string[]; tags: string[]; summary: string | null;
  sortOrder: number; sourceUrl: string; sourceLabel: string; sourceNote: string | null;
};

export type CatalogScholarshipRecord = CatalogScholarshipDocument & {
  id: string; version: number; status: CatalogCityStatus; verificationStatus: CatalogAdminVerificationStatus;
  verifiedByUserId: string | null; lastVerifiedAt: Date | null; nextReviewDueAt: Date | null;
  createdAt: Date; updatedAt: Date;
};

export type CatalogScholarshipDependencies = { activeApplicationChoiceCount: number; linkedProgramCount: number };
export type CatalogScholarshipRevision = CatalogCityRevision;

export type CatalogReadinessRecord = {
  entityType: CatalogReadinessEntityType;
  entityId: string;
  slug: string;
  label: string;
  status: CatalogCityStatus;
  verificationStatus: CatalogAdminVerificationStatus;
  version: number;
  ready: boolean;
  blockingReasons: string[];
  warningReasons: string[];
  nextReviewDueAt: Date | null;
  updatedAt: Date;
};

export type CatalogReadinessSummary = {
  total: number;
  ready: number;
  blocked: number;
  byEntityType: Record<CatalogReadinessEntityType, { total: number; ready: number; blocked: number }>;
  issueCounts: Record<string, number>;
  generatedAt: Date;
};

export type CatalogReleaseManifestStatus = "frozen" | "superseded";
export type CatalogReleaseManifestSelection = {
  entityType: CatalogReadinessEntityType;
  entityId: string;
  expectedVersion: number;
};
export type CatalogReleaseManifestRecord = {
  id: string;
  title: string;
  status: CatalogReleaseManifestStatus;
  version: number;
  selectionSha256: string;
  itemCount: number;
  driftedItemCount: number;
  createdByUserId: string | null;
  supersededByUserId: string | null;
  supersededAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
export type CatalogReleaseManifestItem = {
  id: string;
  position: number;
  entityType: CatalogReadinessEntityType;
  entityId: string;
  entityVersion: number;
  slug: string;
  label: string;
  readinessSnapshot: { ready: true; blockingReasons: []; warningReasons: string[]; capturedAt: string };
  current: CatalogReadinessRecord | null;
  driftReasons: string[];
};
export type CatalogReleaseManifestDetail = {
  manifest: CatalogReleaseManifestRecord;
  items: CatalogReleaseManifestItem[];
};

type Actor = { actorUserId: string; activeRole: CatalogAdminRole };
type Authorized<T> = { authorized: false } | { authorized: true; value: T };

export type CatalogAdminRepository = {
  listCities(input: Actor & { query: string | null; status: CatalogCityStatus | null; limit: number; offset: number }): Promise<Authorized<{ items: CatalogCityRecord[]; total: number }>>;
  getCity(input: Actor & { cityId: string }): Promise<Authorized<{ city: CatalogCityRecord; revisions: CatalogCityRevision[] } | null>>;
  createCity(input: Actor & { city: CatalogCityDocument }): Promise<Authorized<CatalogCityRecord | null>>;
  updateCity(input: Actor & { cityId: string; expectedVersion: number; city: CatalogCityDocument }): Promise<Authorized<CatalogCityRecord | null>>;
  publishCity(input: Actor & { cityId: string; expectedVersion: number; reviewDueAt: Date }): Promise<Authorized<CatalogCityRecord | null>>;
  archiveCity(input: Actor & { cityId: string; expectedVersion: number }): Promise<Authorized<CatalogCityRecord | null>>;
  restoreCity(input: Actor & { cityId: string; expectedVersion: number }): Promise<Authorized<CatalogCityRecord | null>>;
  listSchools(input: Actor & { query: string | null; status: CatalogCityStatus | null; limit: number; offset: number }): Promise<Authorized<{ items: CatalogSchoolRecord[]; total: number }>>;
  getSchool(input: Actor & { schoolId: string }): Promise<Authorized<{ school: CatalogSchoolRecord; revisions: CatalogSchoolRevision[] } | null>>;
  createSchool(input: Actor & { school: CatalogSchoolDocument }): Promise<Authorized<CatalogSchoolRecord | null>>;
  updateSchool(input: Actor & { schoolId: string; expectedVersion: number; school: CatalogSchoolDocument }): Promise<Authorized<CatalogSchoolRecord | null>>;
  publishSchool(input: Actor & { schoolId: string; expectedVersion: number; reviewDueAt: Date }): Promise<Authorized<CatalogSchoolRecord | null>>;
  archiveSchool(input: Actor & { schoolId: string; expectedVersion: number }): Promise<Authorized<CatalogSchoolRecord | null>>;
  restoreSchool(input: Actor & { schoolId: string; expectedVersion: number }): Promise<Authorized<CatalogSchoolRecord | null>>;
  listPrograms(input: Actor & { query: string | null; status: CatalogCityStatus | null; limit: number; offset: number }): Promise<Authorized<{ items: CatalogProgramRecord[]; total: number }>>;
  getProgram(input: Actor & { programId: string }): Promise<Authorized<{ program: CatalogProgramRecord; revisions: CatalogProgramRevision[]; dependencies: CatalogProgramDependencies } | null>>;
  createProgram(input: Actor & { program: CatalogProgramDocument }): Promise<Authorized<CatalogProgramRecord | null>>;
  updateProgram(input: Actor & { programId: string; expectedVersion: number; program: CatalogProgramDocument }): Promise<Authorized<CatalogProgramRecord | null>>;
  publishProgram(input: Actor & { programId: string; expectedVersion: number; reviewDueAt: Date }): Promise<Authorized<CatalogProgramRecord | null>>;
  archiveProgram(input: Actor & { programId: string; expectedVersion: number }): Promise<Authorized<CatalogProgramRecord | null>>;
  restoreProgram(input: Actor & { programId: string; expectedVersion: number }): Promise<Authorized<CatalogProgramRecord | null>>;
  listScholarships(input: Actor & { query: string | null; status: CatalogCityStatus | null; limit: number; offset: number }): Promise<Authorized<{ items: CatalogScholarshipRecord[]; total: number }>>;
  getScholarship(input: Actor & { scholarshipId: string }): Promise<Authorized<{ scholarship: CatalogScholarshipRecord; revisions: CatalogScholarshipRevision[]; dependencies: CatalogScholarshipDependencies } | null>>;
  createScholarship(input: Actor & { scholarship: CatalogScholarshipDocument }): Promise<Authorized<CatalogScholarshipRecord | null>>;
  updateScholarship(input: Actor & { scholarshipId: string; expectedVersion: number; scholarship: CatalogScholarshipDocument }): Promise<Authorized<CatalogScholarshipRecord | null>>;
  publishScholarship(input: Actor & { scholarshipId: string; expectedVersion: number; reviewDueAt: Date }): Promise<Authorized<CatalogScholarshipRecord | null>>;
  archiveScholarship(input: Actor & { scholarshipId: string; expectedVersion: number }): Promise<Authorized<CatalogScholarshipRecord | null>>;
  restoreScholarship(input: Actor & { scholarshipId: string; expectedVersion: number }): Promise<Authorized<CatalogScholarshipRecord | null>>;
  listReadiness(input: Actor & { entityType: CatalogReadinessEntityType | null; status: CatalogCityStatus | null;
    readiness: CatalogReadinessState | null; reason: string | null; query: string | null; limit: number; offset: number }):
    Promise<Authorized<{ items: CatalogReadinessRecord[]; total: number; summary: CatalogReadinessSummary }>>;
  getReadiness(input: Actor & { entityType: CatalogReadinessEntityType; entityId: string }):
    Promise<Authorized<CatalogReadinessRecord | null>>;
  listReleaseManifests(input: Actor & { status: CatalogReleaseManifestStatus | null; limit: number; offset: number }):
    Promise<Authorized<{ items: CatalogReleaseManifestRecord[]; total: number }>>;
  getReleaseManifest(input: Actor & { manifestId: string }): Promise<Authorized<CatalogReleaseManifestDetail | null>>;
  createReleaseManifest(input: Actor & { title: string; selections: CatalogReleaseManifestSelection[] }):
    Promise<Authorized<CatalogReleaseManifestDetail | null>>;
  supersedeReleaseManifest(input: Actor & { manifestId: string; expectedVersion: number }):
    Promise<Authorized<CatalogReleaseManifestRecord | null>>;
};

const dataClasses = ["public_catalog", "internal_catalog_metadata", "audit_security"] as const;

export class CatalogAdminService {
  private readonly repository: CatalogAdminRepository;
  private readonly auditSink: AuditSink;

  constructor(repository: CatalogAdminRepository, auditSink: AuditSink) {
    this.repository = repository;
    this.auditSink = auditSink;
  }

  async listCities(context: RequestContext, input: unknown = {}) {
    const actor = requireContext(context), decisionId = authorize(context, "catalog.read_master_data");
    const fields = inputRecord(input, ["query", "status", "limit", "offset"]);
    const query = fields.query === undefined || fields.query === "" ? null : inputText(fields.query, "City query", 120);
    const status = fields.status === undefined || fields.status === "" ? null
      : inputEnum(fields.status, "City status", CATALOG_CITY_STATUSES);
    const limit = fields.limit === undefined ? 50 : inputInteger(fields.limit, "City limit", 1, 100);
    const offset = fields.offset === undefined ? 0 : inputInteger(fields.offset, "City offset", 0, 100_000);
    const result = await this.repository.listCities({ ...actor, query, status, limit, offset });
    const value = requireAuthorized(result);
    await audit(this.auditSink, context, decisionId, "list", null, { itemCount: value.items.length, total: value.total });
    return value;
  }

  async getCity(context: RequestContext, cityIdInput: unknown) {
    const actor = requireContext(context), decisionId = authorize(context, "catalog.read_master_data");
    const cityId = inputUuid(cityIdInput, "City id");
    const value = requireAuthorized(await this.repository.getCity({ ...actor, cityId }));
    if (!value) throw notFoundConflict("City was not found.");
    await audit(this.auditSink, context, decisionId, "read", cityId, { version: value.city.version });
    return value;
  }

  async createCity(context: RequestContext, input: unknown) {
    const actor = requireContext(context), decisionId = authorize(context, "catalog.edit_master_data");
    const city = parseCityDocument(input);
    const value = requireMutation(await this.repository.createCity({ ...actor, city }), "City slug already exists.");
    await audit(this.auditSink, context, decisionId, "create", value.id, { version: value.version, slug: value.slug });
    return value;
  }

  async updateCity(context: RequestContext, cityIdInput: unknown, input: unknown) {
    const actor = requireContext(context), decisionId = authorize(context, "catalog.edit_master_data");
    const cityId = inputUuid(cityIdInput, "City id");
    const fields = inputRecord(input, ["expectedVersion", "document"]);
    const expectedVersion = inputInteger(fields.expectedVersion, "Expected city version", 1, 2_147_483_646);
    const city = parseCityDocument(fields.document);
    const value = requireMutation(await this.repository.updateCity({ ...actor, cityId, expectedVersion, city }));
    await audit(this.auditSink, context, decisionId, "update", cityId, { previousVersion: expectedVersion, version: value.version });
    return value;
  }

  async publishCity(context: RequestContext, cityIdInput: unknown, input: unknown) {
    return this.lifecycle(context, cityIdInput, input, "publish", "catalog.publish_master_data");
  }

  async archiveCity(context: RequestContext, cityIdInput: unknown, input: unknown) {
    return this.lifecycle(context, cityIdInput, input, "archive", "catalog.archive_master_data");
  }

  async restoreCity(context: RequestContext, cityIdInput: unknown, input: unknown) {
    return this.lifecycle(context, cityIdInput, input, "restore", "catalog.archive_master_data");
  }

  async listSchools(context: RequestContext, input: unknown = {}) {
    const actor = requireContext(context), decisionId = authorize(context, "catalog.read_master_data");
    const filters = parseListInput(input, "School");
    const value = requireAuthorized(await this.repository.listSchools({ ...actor, ...filters }));
    await auditEntity(this.auditSink, context, decisionId, "school", "list", null,
      { itemCount: value.items.length, total: value.total });
    return value;
  }

  async getSchool(context: RequestContext, schoolIdInput: unknown) {
    const actor = requireContext(context), decisionId = authorize(context, "catalog.read_master_data");
    const schoolId = inputUuid(schoolIdInput, "School id");
    const value = requireAuthorized(await this.repository.getSchool({ ...actor, schoolId }));
    if (!value) throw notFoundConflict("School was not found.");
    await auditEntity(this.auditSink, context, decisionId, "school", "read", schoolId, { version: value.school.version });
    return value;
  }

  async createSchool(context: RequestContext, input: unknown) {
    const actor = requireContext(context), decisionId = authorize(context, "catalog.edit_master_data");
    const school = parseSchoolDocument(input);
    const value = requireMutation(await this.repository.createSchool({ ...actor, school }), "School slug or city relationship is invalid.");
    await auditEntity(this.auditSink, context, decisionId, "school", "create", value.id, { version: value.version, slug: value.slug });
    return value;
  }

  async updateSchool(context: RequestContext, schoolIdInput: unknown, input: unknown) {
    const actor = requireContext(context), decisionId = authorize(context, "catalog.edit_master_data");
    const schoolId = inputUuid(schoolIdInput, "School id");
    const fields = inputRecord(input, ["expectedVersion", "document"]);
    const expectedVersion = inputInteger(fields.expectedVersion, "Expected school version", 1, 2_147_483_646);
    const school = parseSchoolDocument(fields.document);
    const value = requireMutation(await this.repository.updateSchool({ ...actor, schoolId, expectedVersion, school }),
      "School state, slug, or city relationship changed; reload before retrying.");
    await auditEntity(this.auditSink, context, decisionId, "school", "update", schoolId,
      { previousVersion: expectedVersion, version: value.version });
    return value;
  }

  async publishSchool(context: RequestContext, schoolIdInput: unknown, input: unknown) {
    return this.schoolLifecycle(context, schoolIdInput, input, "publish", "catalog.publish_master_data");
  }

  async archiveSchool(context: RequestContext, schoolIdInput: unknown, input: unknown) {
    return this.schoolLifecycle(context, schoolIdInput, input, "archive", "catalog.archive_master_data");
  }

  async restoreSchool(context: RequestContext, schoolIdInput: unknown, input: unknown) {
    return this.schoolLifecycle(context, schoolIdInput, input, "restore", "catalog.archive_master_data");
  }

  async listPrograms(context: RequestContext, input: unknown = {}) {
    const actor = requireContext(context), decisionId = authorize(context, "catalog.read_master_data");
    const filters = parseListInput(input, "Program");
    const value = requireAuthorized(await this.repository.listPrograms({ ...actor, ...filters }));
    await auditEntity(this.auditSink, context, decisionId, "program", "list", null,
      { itemCount: value.items.length, total: value.total });
    return value;
  }

  async getProgram(context: RequestContext, programIdInput: unknown) {
    const actor = requireContext(context), decisionId = authorize(context, "catalog.read_master_data");
    const programId = inputUuid(programIdInput, "Program id");
    const value = requireAuthorized(await this.repository.getProgram({ ...actor, programId }));
    if (!value) throw notFoundConflict("Program was not found.");
    await auditEntity(this.auditSink, context, decisionId, "program", "read", programId,
      { version: value.program.version });
    return value;
  }

  async createProgram(context: RequestContext, input: unknown) {
    const actor = requireContext(context), decisionId = authorize(context, "catalog.edit_master_data");
    const program = parseProgramDocument(input);
    const value = requireMutation(await this.repository.createProgram({ ...actor, program }),
      "Program slug, school, or city relationship is invalid.");
    await auditEntity(this.auditSink, context, decisionId, "program", "create", value.id,
      { version: value.version, slug: value.slug, schoolId: value.schoolId, cityId: value.cityId });
    return value;
  }

  async updateProgram(context: RequestContext, programIdInput: unknown, input: unknown) {
    const actor = requireContext(context), decisionId = authorize(context, "catalog.edit_master_data");
    const programId = inputUuid(programIdInput, "Program id");
    const fields = inputRecord(input, ["expectedVersion", "document"]);
    const expectedVersion = inputInteger(fields.expectedVersion, "Expected program version", 1, 2_147_483_646);
    const program = parseProgramDocument(fields.document);
    const value = requireMutation(await this.repository.updateProgram({ ...actor, programId, expectedVersion, program }),
      "Program state, slug, school, or city relationship changed; reload before retrying.");
    await auditEntity(this.auditSink, context, decisionId, "program", "update", programId,
      { previousVersion: expectedVersion, version: value.version, schoolId: value.schoolId, cityId: value.cityId });
    return value;
  }

  async publishProgram(context: RequestContext, programIdInput: unknown, input: unknown) {
    return this.programLifecycle(context, programIdInput, input, "publish", "catalog.publish_master_data");
  }

  async archiveProgram(context: RequestContext, programIdInput: unknown, input: unknown) {
    return this.programLifecycle(context, programIdInput, input, "archive", "catalog.archive_master_data");
  }

  async restoreProgram(context: RequestContext, programIdInput: unknown, input: unknown) {
    return this.programLifecycle(context, programIdInput, input, "restore", "catalog.archive_master_data");
  }

  async listScholarships(context: RequestContext, input: unknown = {}) {
    const actor = requireContext(context), decisionId = authorize(context, "catalog.read_master_data");
    const filters = parseListInput(input, "Scholarship");
    const value = requireAuthorized(await this.repository.listScholarships({ ...actor, ...filters }));
    await auditEntity(this.auditSink, context, decisionId, "scholarship", "list", null,
      { itemCount: value.items.length, total: value.total });
    return value;
  }

  async getScholarship(context: RequestContext, scholarshipIdInput: unknown) {
    const actor = requireContext(context), decisionId = authorize(context, "catalog.read_master_data");
    const scholarshipId = inputUuid(scholarshipIdInput, "Scholarship id");
    const value = requireAuthorized(await this.repository.getScholarship({ ...actor, scholarshipId }));
    if (!value) throw notFoundConflict("Scholarship was not found.");
    await auditEntity(this.auditSink, context, decisionId, "scholarship", "read", scholarshipId,
      { version: value.scholarship.version });
    return value;
  }

  async createScholarship(context: RequestContext, input: unknown) {
    const actor = requireContext(context), decisionId = authorize(context, "catalog.edit_master_data");
    const scholarship = parseScholarshipDocument(input);
    const value = requireMutation(await this.repository.createScholarship({ ...actor, scholarship }),
      "Scholarship slug, school, or program relationship is invalid.");
    await auditEntity(this.auditSink, context, decisionId, "scholarship", "create", value.id,
      { version: value.version, slug: value.slug, schoolId: value.schoolId, programId: value.programId });
    return value;
  }

  async updateScholarship(context: RequestContext, scholarshipIdInput: unknown, input: unknown) {
    const actor = requireContext(context), decisionId = authorize(context, "catalog.edit_master_data");
    const scholarshipId = inputUuid(scholarshipIdInput, "Scholarship id");
    const fields = inputRecord(input, ["expectedVersion", "document"]);
    const expectedVersion = inputInteger(fields.expectedVersion, "Expected scholarship version", 1, 2_147_483_646);
    const scholarship = parseScholarshipDocument(fields.document);
    const value = requireMutation(await this.repository.updateScholarship({ ...actor, scholarshipId, expectedVersion, scholarship }),
      "Scholarship state, slug, school, or program relationship changed; reload before retrying.");
    await auditEntity(this.auditSink, context, decisionId, "scholarship", "update", scholarshipId,
      { previousVersion: expectedVersion, version: value.version, schoolId: value.schoolId, programId: value.programId });
    return value;
  }

  async publishScholarship(context: RequestContext, scholarshipIdInput: unknown, input: unknown) {
    return this.scholarshipLifecycle(context, scholarshipIdInput, input, "publish", "catalog.publish_master_data");
  }

  async archiveScholarship(context: RequestContext, scholarshipIdInput: unknown, input: unknown) {
    return this.scholarshipLifecycle(context, scholarshipIdInput, input, "archive", "catalog.archive_master_data");
  }

  async restoreScholarship(context: RequestContext, scholarshipIdInput: unknown, input: unknown) {
    return this.scholarshipLifecycle(context, scholarshipIdInput, input, "restore", "catalog.archive_master_data");
  }

  async listReadiness(context: RequestContext, input: unknown = {}) {
    const actor = requireContext(context), decisionId = authorize(context, "catalog.read_master_data");
    const fields = inputRecord(input, ["entityType", "status", "readiness", "reason", "query", "limit", "offset"]);
    const entityType = fields.entityType === undefined || fields.entityType === "" ? null
      : inputEnum(fields.entityType, "Readiness entity type", CATALOG_READINESS_ENTITY_TYPES);
    const status = fields.status === undefined || fields.status === "" ? null
      : inputEnum(fields.status, "Readiness catalog status", CATALOG_CITY_STATUSES);
    const readiness = fields.readiness === undefined || fields.readiness === "" ? null
      : inputEnum(fields.readiness, "Readiness state", CATALOG_READINESS_STATES);
    const reason = fields.reason === undefined || fields.reason === "" ? null
      : inputEnum(fields.reason, "Readiness reason", CATALOG_READINESS_REASON_CODES);
    const query = fields.query === undefined || fields.query === "" ? null
      : inputText(fields.query, "Readiness query", 120);
    const limit = fields.limit === undefined ? 50 : inputInteger(fields.limit, "Readiness limit", 1, 100);
    const offset = fields.offset === undefined ? 0 : inputInteger(fields.offset, "Readiness offset", 0, 100_000);
    const value = requireAuthorized(await this.repository.listReadiness({ ...actor, entityType, status, readiness,
      reason, query, limit, offset }));
    await auditEntity(this.auditSink, context, decisionId, "catalog", "readiness_list", null,
      { itemCount: value.items.length, total: value.total, entityType, status, readiness, reason });
    return value;
  }

  async getReadiness(context: RequestContext, entityTypeInput: unknown, entityIdInput: unknown) {
    const actor = requireContext(context), decisionId = authorize(context, "catalog.read_master_data");
    const entityType = inputEnum(entityTypeInput, "Readiness entity type", CATALOG_READINESS_ENTITY_TYPES);
    const entityId = inputUuid(entityIdInput, "Readiness entity id");
    const value = requireAuthorized(await this.repository.getReadiness({ ...actor, entityType, entityId }));
    if (!value) throw notFoundConflict("Catalog readiness record was not found.");
    await auditEntity(this.auditSink, context, decisionId, "catalog", "readiness_read", entityId,
      { entityType, version: value.version, ready: value.ready });
    return value;
  }

  async listReleaseManifests(context: RequestContext, input: unknown = {}) {
    const actor = requireContext(context), decisionId = authorize(context, "catalog.read_master_data");
    const fields = inputRecord(input, ["status", "limit", "offset"]);
    const status = fields.status === undefined || fields.status === "" ? null
      : inputEnum(fields.status, "Release manifest status", ["frozen", "superseded"] as const);
    const limit = fields.limit === undefined ? 50 : inputInteger(fields.limit, "Release manifest limit", 1, 100);
    const offset = fields.offset === undefined ? 0 : inputInteger(fields.offset, "Release manifest offset", 0, 100_000);
    const value = requireAuthorized(await this.repository.listReleaseManifests({ ...actor, status, limit, offset }));
    await auditEntity(this.auditSink, context, decisionId, "release_manifest", "list", null,
      { itemCount: value.items.length, total: value.total, status });
    return value;
  }

  async getReleaseManifest(context: RequestContext, manifestIdInput: unknown) {
    const actor = requireContext(context), decisionId = authorize(context, "catalog.read_master_data");
    const manifestId = inputUuid(manifestIdInput, "Release manifest id");
    const value = requireAuthorized(await this.repository.getReleaseManifest({ ...actor, manifestId }));
    if (!value) throw notFoundConflict("Catalog release manifest was not found.");
    await auditEntity(this.auditSink, context, decisionId, "release_manifest", "read", manifestId,
      { version: value.manifest.version, itemCount: value.items.length, driftedItemCount: value.manifest.driftedItemCount });
    return value;
  }

  async createReleaseManifest(context: RequestContext, input: unknown) {
    const actor = requireContext(context), decisionId = authorize(context, "catalog.edit_master_data");
    const fields = inputRecord(input, ["title", "selections"]);
    const title = inputText(fields.title, "Release manifest title", 200);
    const selections = inputList(fields.selections, "Release manifest selections", 100, value => {
      const item = inputRecord(value, ["entityType", "entityId", "expectedVersion"]);
      return { entityType: inputEnum(item.entityType, "Selection entity type", CATALOG_READINESS_ENTITY_TYPES),
        entityId: inputUuid(item.entityId, "Selection entity id"),
        expectedVersion: inputInteger(item.expectedVersion, "Selection expected version", 1, 2_147_483_646) };
    });
    if (!selections.length) throw badRequest("Release manifest must contain at least one selection.");
    const identities = selections.map(item => `${item.entityType}:${item.entityId}`);
    if (new Set(identities).size !== identities.length) throw badRequest("Release manifest selections must be unique.");
    const value = requireMutation(await this.repository.createReleaseManifest({ ...actor, title, selections }),
      "A selected catalog record changed or no longer passes publication readiness; reload before creating the manifest.");
    await auditEntity(this.auditSink, context, decisionId, "release_manifest", "create", value.manifest.id,
      { version: value.manifest.version, itemCount: value.items.length, selectionSha256: value.manifest.selectionSha256 });
    return value;
  }

  async supersedeReleaseManifest(context: RequestContext, manifestIdInput: unknown, input: unknown) {
    const actor = requireContext(context), decisionId = authorize(context, "catalog.edit_master_data");
    const manifestId = inputUuid(manifestIdInput, "Release manifest id");
    const fields = inputRecord(input, ["expectedVersion"]);
    const expectedVersion = inputInteger(fields.expectedVersion, "Expected release manifest version", 1, 2_147_483_646);
    const value = requireMutation(await this.repository.supersedeReleaseManifest({ ...actor, manifestId, expectedVersion }),
      "Release manifest state changed; reload before retrying.");
    await auditEntity(this.auditSink, context, decisionId, "release_manifest", "supersede", manifestId,
      { previousVersion: expectedVersion, version: value.version, itemCount: value.itemCount });
    return value;
  }

  private async lifecycle(context: RequestContext, cityIdInput: unknown, input: unknown,
    action: "publish" | "archive" | "restore", policyAction: PolicyAction) {
    const actor = requireContext(context), decisionId = authorize(context, policyAction);
    const cityId = inputUuid(cityIdInput, "City id");
    const allowed = action === "publish" ? ["expectedVersion", "reviewDueAt"] : ["expectedVersion"];
    const fields = inputRecord(input, allowed);
    const expectedVersion = inputInteger(fields.expectedVersion, "Expected city version", 1, 2_147_483_646);
    let result: Authorized<CatalogCityRecord | null>;
    if (action === "publish") {
      const reviewDueAt = canonicalFutureTimestamp(fields.reviewDueAt);
      result = await this.repository.publishCity({ ...actor, cityId, expectedVersion, reviewDueAt });
    } else if (action === "archive") result = await this.repository.archiveCity({ ...actor, cityId, expectedVersion });
    else result = await this.repository.restoreCity({ ...actor, cityId, expectedVersion });
    const value = requireMutation(result, action === "archive"
      ? "City state changed or active schools or programs still depend on it."
      : "City state or publication evidence changed; reload before retrying.");
    await audit(this.auditSink, context, decisionId, action, cityId,
      { previousVersion: expectedVersion, version: value.version, status: value.status });
    return value;
  }

  private async schoolLifecycle(context: RequestContext, schoolIdInput: unknown, input: unknown,
    action: "publish" | "archive" | "restore", policyAction: PolicyAction) {
    const actor = requireContext(context), decisionId = authorize(context, policyAction);
    const schoolId = inputUuid(schoolIdInput, "School id");
    const fields = inputRecord(input, action === "publish" ? ["expectedVersion", "reviewDueAt"] : ["expectedVersion"]);
    const expectedVersion = inputInteger(fields.expectedVersion, "Expected school version", 1, 2_147_483_646);
    let result: Authorized<CatalogSchoolRecord | null>;
    if (action === "publish") result = await this.repository.publishSchool({ ...actor, schoolId, expectedVersion,
      reviewDueAt: canonicalFutureTimestamp(fields.reviewDueAt) });
    else if (action === "archive") result = await this.repository.archiveSchool({ ...actor, schoolId, expectedVersion });
    else result = await this.repository.restoreSchool({ ...actor, schoolId, expectedVersion });
    const value = requireMutation(result, action === "archive"
      ? "School state changed or active programs, scholarships, staff, or applications still depend on it."
      : "School state or publication evidence changed; reload before retrying.");
    await auditEntity(this.auditSink, context, decisionId, "school", action, schoolId,
      { previousVersion: expectedVersion, version: value.version, status: value.status });
    return value;
  }

  private async programLifecycle(context: RequestContext, programIdInput: unknown, input: unknown,
    action: "publish" | "archive" | "restore", policyAction: PolicyAction) {
    const actor = requireContext(context), decisionId = authorize(context, policyAction);
    const programId = inputUuid(programIdInput, "Program id");
    const fields = inputRecord(input, action === "publish" ? ["expectedVersion", "reviewDueAt"] : ["expectedVersion"]);
    const expectedVersion = inputInteger(fields.expectedVersion, "Expected program version", 1, 2_147_483_646);
    let result: Authorized<CatalogProgramRecord | null>;
    if (action === "publish") result = await this.repository.publishProgram({ ...actor, programId, expectedVersion,
      reviewDueAt: canonicalFutureTimestamp(fields.reviewDueAt) });
    else if (action === "archive") result = await this.repository.archiveProgram({ ...actor, programId, expectedVersion });
    else result = await this.repository.restoreProgram({ ...actor, programId, expectedVersion });
    const value = requireMutation(result, action === "archive"
      ? "Program state changed or open intakes, active scholarships, or current application choices still depend on it."
      : "Program state, relationship, or publication evidence changed; reload before retrying.");
    await auditEntity(this.auditSink, context, decisionId, "program", action, programId,
      { previousVersion: expectedVersion, version: value.version, status: value.status });
    return value;
  }

  private async scholarshipLifecycle(context: RequestContext, scholarshipIdInput: unknown, input: unknown,
    action: "publish" | "archive" | "restore", policyAction: PolicyAction) {
    const actor = requireContext(context), decisionId = authorize(context, policyAction);
    const scholarshipId = inputUuid(scholarshipIdInput, "Scholarship id");
    const fields = inputRecord(input, action === "publish" ? ["expectedVersion", "reviewDueAt"] : ["expectedVersion"]);
    const expectedVersion = inputInteger(fields.expectedVersion, "Expected scholarship version", 1, 2_147_483_646);
    let result: Authorized<CatalogScholarshipRecord | null>;
    if (action === "publish") result = await this.repository.publishScholarship({ ...actor, scholarshipId, expectedVersion,
      reviewDueAt: canonicalFutureTimestamp(fields.reviewDueAt) });
    else if (action === "archive") result = await this.repository.archiveScholarship({ ...actor, scholarshipId, expectedVersion });
    else result = await this.repository.restoreScholarship({ ...actor, scholarshipId, expectedVersion });
    const value = requireMutation(result, action === "archive"
      ? "Scholarship state changed or current application choices still depend on it."
      : "Scholarship state, relationship, deadline, or publication evidence changed; reload before retrying.");
    await auditEntity(this.auditSink, context, decisionId, "scholarship", action, scholarshipId,
      { previousVersion: expectedVersion, version: value.version, status: value.status });
    return value;
  }
}

function requireContext(context: RequestContext): Actor {
  if (!context.actorUserId || !["cuac_ops", "cuac_admin"].includes(context.activeRole)
    || context.selectedSurface !== "ops" || context.purpose !== "catalog_management"
    || context.tenantSchoolId !== null || !["session", "step_up"].includes(context.authStrength)) {
    throw forbidden("Authenticated CUAC catalog-management context is required.");
  }
  return { actorUserId: context.actorUserId, activeRole: context.activeRole as CatalogAdminRole };
}

function authorize(context: RequestContext, action: PolicyAction): string {
  const decision = evaluatePolicy(context, action, { type: "catalog", dataClasses });
  if (!decision.allowed) throw forbidden(decision.reason);
  return decision.id;
}

function parseCityDocument(value: unknown): CatalogCityDocument {
  const fields = inputRecord(value, ["slug", "nameZh", "nameEn", "region", "province", "monthlyCost",
    "monthlyCostRmb", "costLevel", "density", "tags", "content", "nearby", "sortOrder",
    "sourceUrl", "sourceLabel", "sourceNote"]);
  const slug = inputText(fields.slug, "City slug", 100).toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw badRequest("City slug must use lowercase letters, numbers, and single hyphens.");
  const content = boundedObject(fields.content, "City content", 131_072);
  const sourceUrl = httpsUrl(fields.sourceUrl, "City source URL");
  return {
    slug,
    nameZh: nullableText(fields.nameZh, "Chinese city name", 160),
    nameEn: inputText(fields.nameEn, "English city name", 160),
    region: nullableText(fields.region, "City region", 120),
    province: nullableText(fields.province, "City province", 160),
    monthlyCost: nullableText(fields.monthlyCost, "Monthly cost label", 160),
    monthlyCostRmb: fields.monthlyCostRmb === null || fields.monthlyCostRmb === undefined ? null
      : inputInteger(fields.monthlyCostRmb, "Monthly cost RMB", 0, 1_000_000),
    costLevel: nullableText(fields.costLevel, "City cost level", 80),
    density: nullableText(fields.density, "University density", 80),
    tags: inputList(fields.tags ?? [], "City tags", 30, item => inputText(item, "City tag", 80)),
    content,
    nearby: inputList(fields.nearby ?? [], "Nearby cities", 30, item => inputText(item, "Nearby city", 100)),
    sortOrder: fields.sortOrder === undefined ? 0 : inputInteger(fields.sortOrder, "City sort order", -100_000, 100_000),
    sourceUrl,
    sourceLabel: inputText(fields.sourceLabel, "City source label", 200),
    sourceNote: nullableText(fields.sourceNote, "City source note", 1000),
  };
}

function parseSchoolDocument(value: unknown): CatalogSchoolDocument {
  const fields = inputRecord(value, ["slug", "nameZh", "nameEn", "schoolType", "region", "cityId", "city", "cityZh",
    "citySlug", "province", "regionLabel", "ranking", "cscaRequired", "cscaRequirement", "cscaSubjects",
    "applicationLevel", "languageOfInstruction", "languageRequirement", "hskRequirement", "englishRequirement",
    "deadlineSummary", "tuitionSummary", "applicationFee", "websiteUrl", "admissionsUrl", "subjectTags", "fitNotes",
    "languageTags", "tuitionBandLabel", "campusHighlights", "contactNotes", "qualityScore", "missingFields",
    "completenessLabel", "sourceUrl", "sourceLabel", "sourceNote"]);
  const slug = inputText(fields.slug, "School slug", 160).toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw badRequest("School slug must use lowercase letters, numbers, and single hyphens.");
  if (typeof fields.cscaRequired !== "boolean") throw badRequest("CSCA required must be a boolean.");
  return {
    slug, nameZh: nullableText(fields.nameZh, "Chinese school name", 240),
    nameEn: inputText(fields.nameEn, "English school name", 240),
    schoolType: nullableText(fields.schoolType, "School type", 120), region: nullableText(fields.region, "School region", 120),
    cityId: inputUuid(fields.cityId, "School city id"), city: nullableText(fields.city, "School city", 160),
    cityZh: nullableText(fields.cityZh, "Chinese school city", 160), citySlug: nullableSlug(fields.citySlug, "City slug", 100),
    province: nullableText(fields.province, "School province", 160), regionLabel: nullableText(fields.regionLabel, "Region label", 160),
    ranking: nullableText(fields.ranking, "School ranking", 160), cscaRequired: fields.cscaRequired,
    cscaRequirement: nullableText(fields.cscaRequirement, "CSCA requirement", 1000),
    cscaSubjects: textList(fields.cscaSubjects, "CSCA subjects", 30, 120),
    applicationLevel: nullableText(fields.applicationLevel, "Application level", 240),
    languageOfInstruction: nullableText(fields.languageOfInstruction, "Language of instruction", 240),
    languageRequirement: nullableText(fields.languageRequirement, "Language requirement", 2000),
    hskRequirement: nullableText(fields.hskRequirement, "HSK requirement", 1000),
    englishRequirement: nullableText(fields.englishRequirement, "English requirement", 1000),
    deadlineSummary: nullableText(fields.deadlineSummary, "Deadline summary", 1000),
    tuitionSummary: nullableText(fields.tuitionSummary, "Tuition summary", 1000),
    applicationFee: nullableText(fields.applicationFee, "Application fee", 240),
    websiteUrl: httpsUrl(fields.websiteUrl, "School website URL"),
    admissionsUrl: nullableHttpsUrl(fields.admissionsUrl, "School admissions URL"),
    subjectTags: textList(fields.subjectTags, "School subject tags", 50, 120),
    fitNotes: nullableText(fields.fitNotes, "School fit notes", 3000),
    languageTags: textList(fields.languageTags, "School language tags", 30, 120),
    tuitionBandLabel: nullableText(fields.tuitionBandLabel, "Tuition band label", 240),
    campusHighlights: textList(fields.campusHighlights, "Campus highlights", 50, 500),
    contactNotes: nullableText(fields.contactNotes, "School contact notes", 2000),
    qualityScore: fields.qualityScore === null || fields.qualityScore === undefined ? null
      : inputInteger(fields.qualityScore, "School quality score", 0, 100),
    missingFields: textList(fields.missingFields, "School missing fields", 100, 120),
    completenessLabel: nullableText(fields.completenessLabel, "Completeness label", 240),
    sourceUrl: httpsUrl(fields.sourceUrl, "School source URL"),
    sourceLabel: inputText(fields.sourceLabel, "School source label", 200),
    sourceNote: nullableText(fields.sourceNote, "School source note", 1000),
  };
}

function parseProgramDocument(value: unknown): CatalogProgramDocument {
  const fields = inputRecord(value, ["schoolId","cityId","slug","nameZh","nameEn","degreeLevel","durationYears",
    "durationMonths","fieldCategory","subjectArea","teachingLanguage","cscaSubjects","cscaRequirement",
    "hskRequirement","englishRequirement","tuitionAmount","tuitionCurrency","tuitionPeriod","tuitionText",
    "scholarshipText","applicationUrl","applicationNote","hasScholarship","badgeText","displayTuition",
    "displaySubjects","displayGroup","displayGroupLabel","sortOrder","sourceUrl","sourceLabel","sourceNote"]);
  const slug = inputText(fields.slug, "Program slug", 180).toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw badRequest("Program slug must use lowercase letters, numbers, and single hyphens.");
  if (typeof fields.hasScholarship !== "boolean") throw badRequest("Program scholarship flag must be a boolean.");
  const tuitionCurrency = nullableText(fields.tuitionCurrency, "Tuition currency", 3)?.toUpperCase() ?? null;
  if (tuitionCurrency !== null && !/^[A-Z]{3}$/.test(tuitionCurrency)) throw badRequest("Tuition currency must be a three-letter code.");
  return {
    schoolId: inputUuid(fields.schoolId, "Program school id"), cityId: inputUuid(fields.cityId, "Program city id"), slug,
    nameZh: nullableText(fields.nameZh, "Chinese program name", 300), nameEn: inputText(fields.nameEn, "English program name", 300),
    degreeLevel: inputText(fields.degreeLevel, "Program degree level", 120),
    durationYears: nullableInteger(fields.durationYears, "Duration years", 0, 20),
    durationMonths: nullableInteger(fields.durationMonths, "Duration months", 0, 240),
    fieldCategory: nullableText(fields.fieldCategory, "Program field category", 200),
    subjectArea: nullableText(fields.subjectArea, "Program subject area", 200),
    teachingLanguage: nullableText(fields.teachingLanguage, "Program teaching language", 200),
    cscaSubjects: textList(fields.cscaSubjects, "Program CSCA subjects", 30, 120),
    cscaRequirement: nullableText(fields.cscaRequirement, "Program CSCA requirement", 2000),
    hskRequirement: nullableText(fields.hskRequirement, "Program HSK requirement", 2000),
    englishRequirement: nullableText(fields.englishRequirement, "Program English requirement", 2000),
    tuitionAmount: nullableInteger(fields.tuitionAmount, "Tuition amount", 0, 100_000_000), tuitionCurrency,
    tuitionPeriod: nullableText(fields.tuitionPeriod, "Tuition period", 120),
    tuitionText: nullableText(fields.tuitionText, "Tuition text", 1000),
    scholarshipText: nullableText(fields.scholarshipText, "Scholarship text", 2000),
    applicationUrl: nullableHttpsUrl(fields.applicationUrl, "Program application URL"),
    applicationNote: nullableText(fields.applicationNote, "Program application note", 3000),
    hasScholarship: fields.hasScholarship, badgeText: nullableText(fields.badgeText, "Program badge", 200),
    displayTuition: nullableText(fields.displayTuition, "Display tuition", 300),
    displaySubjects: textList(fields.displaySubjects, "Display subjects", 30, 120),
    displayGroup: nullableText(fields.displayGroup, "Display group", 120),
    displayGroupLabel: nullableText(fields.displayGroupLabel, "Display group label", 200),
    sortOrder: fields.sortOrder === undefined ? 0 : inputInteger(fields.sortOrder, "Program sort order", -100_000, 100_000),
    sourceUrl: httpsUrl(fields.sourceUrl, "Program source URL"),
    sourceLabel: inputText(fields.sourceLabel, "Program source label", 200),
    sourceNote: nullableText(fields.sourceNote, "Program source note", 1000),
  };
}

function nullableInteger(value: unknown, field: string, min: number, max: number): number | null {
  return value === undefined || value === null || value === "" ? null : inputInteger(value, field, min, max);
}

function parseScholarshipDocument(value: unknown): CatalogScholarshipDocument {
  const fields = inputRecord(value, ["slug","title","nameZh","type","typeLabel","fundingLevel","providerName",
    "providerNameEn","providerLocation","schoolId","programId","coverage","applicableDegree","applicableProgram",
    "amountText","requirementText","bodySections","benefitItems","eligibilityItems","applicationMaterials",
    "applicationSteps","contactInfo","actionLinks","deadlineDate","deadlineLabel","applicationRound",
    "targetCountries","targetRegions","benefits","tags","summary","sortOrder","sourceUrl","sourceLabel","sourceNote"]);
  const slug = inputText(fields.slug, "Scholarship slug", 180).toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw badRequest("Scholarship slug must use lowercase letters, numbers, and single hyphens.");
  return {
    slug, title: inputText(fields.title, "Scholarship title", 400), nameZh: nullableText(fields.nameZh, "Chinese scholarship name", 400),
    type: nullableText(fields.type, "Scholarship type", 120), typeLabel: nullableText(fields.typeLabel, "Scholarship type label", 200),
    fundingLevel: nullableText(fields.fundingLevel, "Funding level", 160), providerName: nullableText(fields.providerName, "Provider name", 300),
    providerNameEn: nullableText(fields.providerNameEn, "English provider name", 300),
    providerLocation: nullableText(fields.providerLocation, "Provider location", 240),
    schoolId: nullableUuid(fields.schoolId, "Scholarship school id"), programId: nullableUuid(fields.programId, "Scholarship program id"),
    coverage: nullableText(fields.coverage, "Scholarship coverage", 3000),
    applicableDegree: nullableText(fields.applicableDegree, "Applicable degree", 1000),
    applicableProgram: nullableText(fields.applicableProgram, "Applicable program", 1000),
    amountText: nullableText(fields.amountText, "Scholarship amount", 1000),
    requirementText: nullableText(fields.requirementText, "Scholarship requirements", 5000),
    bodySections: boundedJsonArray(fields.bodySections, "Scholarship body sections", 100, 131_072),
    benefitItems: boundedJsonArray(fields.benefitItems, "Scholarship benefit items", 100, 65_536),
    eligibilityItems: boundedJsonArray(fields.eligibilityItems, "Scholarship eligibility items", 100, 65_536),
    applicationMaterials: boundedJsonArray(fields.applicationMaterials, "Scholarship application materials", 100, 65_536),
    applicationSteps: boundedJsonArray(fields.applicationSteps, "Scholarship application steps", 100, 65_536),
    contactInfo: boundedObject(fields.contactInfo ?? {}, "Scholarship contact info", 16_384),
    actionLinks: boundedJsonArray(fields.actionLinks, "Scholarship action links", 30, 32_768),
    deadlineDate: nullableCanonicalTimestamp(fields.deadlineDate, "Scholarship deadline"),
    deadlineLabel: nullableText(fields.deadlineLabel, "Scholarship deadline label", 300),
    applicationRound: nullableText(fields.applicationRound, "Scholarship application round", 300),
    targetCountries: textList(fields.targetCountries, "Scholarship target countries", 100, 120),
    targetRegions: textList(fields.targetRegions, "Scholarship target regions", 100, 120),
    benefits: textList(fields.benefits, "Scholarship benefits", 100, 300), tags: textList(fields.tags, "Scholarship tags", 100, 120),
    summary: nullableText(fields.summary, "Scholarship summary", 5000),
    sortOrder: fields.sortOrder === undefined ? 0 : inputInteger(fields.sortOrder, "Scholarship sort order", -100_000, 100_000),
    sourceUrl: httpsUrl(fields.sourceUrl, "Scholarship source URL"),
    sourceLabel: inputText(fields.sourceLabel, "Scholarship source label", 200),
    sourceNote: nullableText(fields.sourceNote, "Scholarship source note", 1000),
  };
}

function nullableUuid(value: unknown, field: string): string | null {
  return value === undefined || value === null || value === "" ? null : inputUuid(value, field);
}

function boundedJsonArray(value: unknown, field: string, maxItems: number, maxBytes: number): unknown[] {
  const list = value ?? [];
  if (!Array.isArray(list) || list.length > maxItems || Buffer.byteLength(JSON.stringify(list), "utf8") > maxBytes) {
    throw badRequest(`${field} must be a bounded JSON array.`);
  }
  return list;
}

function nullableCanonicalTimestamp(value: unknown, field: string): Date | null {
  if (value === undefined || value === null || value === "") return null;
  const input = inputText(value, field, 24), parsed = new Date(input);
  if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString() !== input
    || parsed.getUTCFullYear() < 2020 || parsed.getUTCFullYear() > 2100) throw badRequest(`${field} must be a canonical UTC timestamp.`);
  return parsed;
}

function parseListInput(input: unknown, entity: string) {
  const fields = inputRecord(input, ["query", "status", "limit", "offset"]);
  return {
    query: fields.query === undefined || fields.query === "" ? null : inputText(fields.query, `${entity} query`, 120),
    status: fields.status === undefined || fields.status === "" ? null
      : inputEnum(fields.status, `${entity} status`, CATALOG_CITY_STATUSES),
    limit: fields.limit === undefined ? 50 : inputInteger(fields.limit, `${entity} limit`, 1, 100),
    offset: fields.offset === undefined ? 0 : inputInteger(fields.offset, `${entity} offset`, 0, 100_000),
  };
}

function nullableText(value: unknown, field: string, max: number): string | null {
  if (value === undefined || value === null || value === "") return null;
  return inputText(value, field, max);
}

function nullableSlug(value: unknown, field: string, max: number): string | null {
  const text = nullableText(value, field, max)?.toLowerCase() ?? null;
  if (text !== null && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(text)) throw badRequest(`${field} must be a lowercase slug.`);
  return text;
}

function textList(value: unknown, field: string, maxItems: number, maxText: number) {
  return inputList(value ?? [], field, maxItems, item => inputText(item, field, maxText));
}

function boundedObject(value: unknown, field: string, maxBytes: number): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw badRequest(`${field} must be an object.`);
  const encoded = JSON.stringify(value);
  if (Buffer.byteLength(encoded, "utf8") > maxBytes) throw badRequest(`${field} is too large.`);
  return value as Record<string, unknown>;
}

function httpsUrl(value: unknown, field: string): string {
  const text = inputText(value, field, 2048);
  try {
    const parsed = new URL(text);
    if (parsed.protocol !== "https:" || !parsed.hostname || parsed.username || parsed.password) throw new Error();
    return parsed.href;
  } catch { throw badRequest(`${field} must be a safe HTTPS URL.`); }
}

function nullableHttpsUrl(value: unknown, field: string): string | null {
  return value === undefined || value === null || value === "" ? null : httpsUrl(value, field);
}

function canonicalFutureTimestamp(value: unknown): Date {
  const input = inputText(value, "Review due at", 24), parsed = new Date(input), now = Date.now();
  if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString() !== input
    || parsed.getTime() < now + 30 * 86_400_000 || parsed.getTime() > now + 366 * 86_400_000) {
    throw badRequest("Review due at must be a canonical UTC timestamp between 30 and 366 days from now.");
  }
  return parsed;
}

function requireAuthorized<T>(result: Authorized<T>): T {
  if (!result.authorized) throw forbidden("Active CUAC staff access grant is required.");
  return result.value;
}

function requireMutation<T>(result: Authorized<T | null>, message = "Catalog state changed; reload before retrying."): T {
  const value = requireAuthorized(result);
  if (!value) throw conflict(message);
  return value;
}

function notFoundConflict(message: string) {
  return conflict(message);
}

async function audit(sink: AuditSink, context: RequestContext, decisionId: string, action: string,
  resourceId: string | null, metadata: Record<string, unknown>) {
  await sink.record(buildAuditEvent(context, {
    action: `ops.catalog.city.${action}`,
    resourceType: "catalog_city",
    resourceId,
    allowed: true,
    policyDecisionId: decisionId,
    dataClasses,
    metadata,
  }));
}

async function auditEntity(sink: AuditSink, context: RequestContext, decisionId: string,
  entityType: "city" | "school" | "program" | "scholarship" | "catalog" | "release_manifest", action: string, resourceId: string | null, metadata: Record<string, unknown>) {
  await sink.record(buildAuditEvent(context, {
    action: `ops.catalog.${entityType}.${action}`,
    resourceType: `catalog_${entityType}`,
    resourceId, allowed: true, policyDecisionId: decisionId, dataClasses, metadata,
  }));
}

export function validateCatalogCityRecord(value: CatalogCityRecord): CatalogCityRecord {
  if (!value || !/^[a-f0-9-]{36}$/i.test(value.id) || !Number.isSafeInteger(value.version) || value.version < 1
    || !CATALOG_CITY_STATUSES.includes(value.status) || !CATALOG_VERIFICATION_STATUSES.includes(value.verificationStatus)
    || !(value.createdAt instanceof Date) || !(value.updatedAt instanceof Date)) {
    throw serviceUnavailable("Catalog city management data is unavailable.");
  }
  return value;
}

export function validateCatalogSchoolRecord(value: CatalogSchoolRecord): CatalogSchoolRecord {
  if (!value || !/^[a-f0-9-]{36}$/i.test(value.id) || !(value.cityId === null || /^[a-f0-9-]{36}$/i.test(value.cityId))
    || !Number.isSafeInteger(value.version) || value.version < 1 || !CATALOG_CITY_STATUSES.includes(value.status)
    || !CATALOG_VERIFICATION_STATUSES.includes(value.verificationStatus)
    || !(value.createdAt instanceof Date) || !(value.updatedAt instanceof Date)) {
    throw serviceUnavailable("Catalog school management data is unavailable.");
  }
  return value;
}

export function validateCatalogProgramRecord(value: CatalogProgramRecord): CatalogProgramRecord {
  if (!value || !/^[a-f0-9-]{36}$/i.test(value.id) || !/^[a-f0-9-]{36}$/i.test(value.schoolId)
    || !(value.cityId === null || /^[a-f0-9-]{36}$/i.test(value.cityId)) || typeof value.isVerified !== "boolean"
    || !Number.isSafeInteger(value.version) || value.version < 1 || !CATALOG_CITY_STATUSES.includes(value.status)
    || !CATALOG_VERIFICATION_STATUSES.includes(value.verificationStatus)
    || !(value.createdAt instanceof Date) || !(value.updatedAt instanceof Date)) {
    throw serviceUnavailable("Catalog program management data is unavailable.");
  }
  return value;
}

export function validateCatalogScholarshipRecord(value: CatalogScholarshipRecord): CatalogScholarshipRecord {
  if (!value || !/^[a-f0-9-]{36}$/i.test(value.id)
    || !(value.schoolId === null || /^[a-f0-9-]{36}$/i.test(value.schoolId))
    || !(value.programId === null || /^[a-f0-9-]{36}$/i.test(value.programId))
    || !Number.isSafeInteger(value.version) || value.version < 1 || !CATALOG_CITY_STATUSES.includes(value.status)
    || !CATALOG_VERIFICATION_STATUSES.includes(value.verificationStatus)
    || !(value.deadlineDate === null || value.deadlineDate instanceof Date)
    || !(value.createdAt instanceof Date) || !(value.updatedAt instanceof Date)) {
    throw serviceUnavailable("Catalog scholarship management data is unavailable.");
  }
  return value;
}

export function validateCatalogReadinessRecord(value: CatalogReadinessRecord): CatalogReadinessRecord {
  if (!value || !CATALOG_READINESS_ENTITY_TYPES.includes(value.entityType)
    || !/^[a-f0-9-]{36}$/i.test(value.entityId) || typeof value.slug !== "string" || typeof value.label !== "string"
    || !CATALOG_CITY_STATUSES.includes(value.status) || !CATALOG_VERIFICATION_STATUSES.includes(value.verificationStatus)
    || !Number.isSafeInteger(value.version) || value.version < 1 || typeof value.ready !== "boolean"
    || !Array.isArray(value.blockingReasons) || value.blockingReasons.some(item => typeof item !== "string")
    || !Array.isArray(value.warningReasons) || value.warningReasons.some(item => typeof item !== "string")
    || !(value.nextReviewDueAt === null || value.nextReviewDueAt instanceof Date) || !(value.updatedAt instanceof Date)) {
    throw serviceUnavailable("Catalog readiness data is unavailable.");
  }
  return value;
}
