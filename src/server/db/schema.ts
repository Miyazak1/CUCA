import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

const catalogReviewFields = {
  status: text("status").notNull().default("draft"),
  verificationStatus: text("verification_status").notNull().default("unverified"),
  sourceUrl: text("source_url"),
  sourceLabel: text("source_label"),
  sourceNote: text("source_note"),
  sourceFieldLineageJson: jsonb("source_field_lineage_json").notNull().default({}),
  verifiedByUserId: uuid("verified_by_user_id").references(() => users.id, { onDelete: "set null" }),
  lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
  nextReviewDueAt: timestamp("next_review_due_at", { withTimezone: true }),
};

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    emailNormalized: text("email_normalized").notNull(),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    displayName: text("display_name"),
    accountStatus: text("account_status").notNull().default("active"),
    locale: text("locale").notNull().default("en"),
    timezone: text("timezone").notNull().default("UTC"),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    emailNormalizedUnique: uniqueIndex("users_email_normalized_unique").on(table.emailNormalized),
    accountStatusIdx: index("users_account_status_idx").on(table.accountStatus),
  }),
);

export const authIdentities = pgTable(
  "auth_identities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerSubject: text("provider_subject"),
    passwordHash: text("password_hash"),
    emailNormalized: text("email_normalized"),
    metadataJson: jsonb("metadata_json").notNull().default({}),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    providerSubjectUnique: uniqueIndex("auth_identities_provider_subject_unique").on(table.provider, table.providerSubject),
    userProviderIdx: index("auth_identities_user_provider_idx").on(table.userId, table.provider),
  }),
);

export const authSessions = pgTable(
  "auth_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionTokenHash: text("session_token_hash").notNull(),
    selectedSurface: text("selected_surface").notNull().default("student"),
    activeRole: text("active_role").notNull().default("student"),
    tenantSchoolId: uuid("tenant_school_id").references(() => schools.id, { onDelete: "set null" }),
    authStrength: text("auth_strength").notNull().default("session"),
    ipHash: text("ip_hash"),
    userAgentHash: text("user_agent_hash"),
    stepUpExpiresAt: timestamp("step_up_expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => ({
    sessionTokenHashUnique: uniqueIndex("auth_sessions_token_hash_unique").on(table.sessionTokenHash),
    userExpiresIdx: index("auth_sessions_user_expires_idx").on(table.userId, table.expiresAt),
    tenantSchoolIdx: index("auth_sessions_tenant_school_idx").on(table.tenantSchoolId),
    stepUpExpiresIdx: index("auth_sessions_step_up_expires_idx").on(table.userId, table.stepUpExpiresAt),
    strengthCheck: check("auth_sessions_strength_check", sql`${table.authStrength} = 'session'
      and (${table.stepUpExpiresAt} is null or (${table.stepUpExpiresAt} > ${table.createdAt}
        and ${table.stepUpExpiresAt} <= ${table.expiresAt}))`),
  }),
);

export const privacyNoticeScopes = pgTable("privacy_notice_scopes", {
  scopeKey: text("scope_key").primaryKey(),
  noticeKey: text("notice_key").notNull(),
  locale: text("locale").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  scopeUnique: uniqueIndex("privacy_notice_scope_unique").on(table.noticeKey, table.locale),
  scopeCheck: check("privacy_notice_scope_check", sql`${table.noticeKey} = 'application_disclosure' and ${table.locale} in ('en', 'zh-CN') and ${table.scopeKey} = ${table.noticeKey} || ':' || ${table.locale}`),
}));

export const privacyNoticeVersions = pgTable("privacy_notice_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  scopeKey: text("scope_key").notNull(),
  version: integer("version").notNull(),
  contentJson: jsonb("content_json").notNull(),
  contentSha256: text("content_sha256").notNull(),
  preparedByUserId: uuid("prepared_by_user_id").notNull(),
  reviewStatus: text("review_status").notNull().default("draft"),
  approvedByUserId: uuid("approved_by_user_id"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  effectiveFrom: timestamp("effective_from", { withTimezone: true }),
  reviewDueAt: timestamp("review_due_at", { withTimezone: true }),
  reviewEvidenceJson: jsonb("review_evidence_json"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  scopeFk: foreignKey({ name: "privacy_notice_version_scope_fk", columns: [table.scopeKey], foreignColumns: [privacyNoticeScopes.scopeKey] }).onDelete("restrict"),
  preparerFk: foreignKey({ name: "privacy_notice_preparer_fk", columns: [table.preparedByUserId], foreignColumns: [users.id] }).onDelete("restrict"),
  reviewerFk: foreignKey({ name: "privacy_notice_reviewer_fk", columns: [table.approvedByUserId], foreignColumns: [users.id] }).onDelete("restrict"),
  versionUnique: uniqueIndex("privacy_notice_version_unique").on(table.scopeKey, table.version),
  idScopeUnique: uniqueIndex("privacy_notice_id_scope_unique").on(table.id, table.scopeKey),
  versionCheck: check("privacy_notice_version_check", sql`${table.version} > 0`),
  digestCheck: check("privacy_notice_digest_check", sql`${table.contentSha256} ~ '^[a-f0-9]{64}$'`),
  contentCheck: check("privacy_notice_content_check", sql`jsonb_typeof(${table.contentJson}) = 'object' and octet_length(${table.contentJson}::text) <= 98304`),
  reviewCheck: check("privacy_notice_review_check", sql`(${table.reviewStatus} = 'draft' and ${table.approvedByUserId} is null and ${table.reviewedAt} is null and ${table.effectiveFrom} is null and ${table.reviewDueAt} is null and ${table.reviewEvidenceJson} is null) or (${table.reviewStatus} = 'approved' and ${table.approvedByUserId} is not null and ${table.approvedByUserId} <> ${table.preparedByUserId} and ${table.reviewedAt} is not null and ${table.effectiveFrom} is not null and ${table.reviewDueAt} is not null and ${table.createdAt} <= ${table.reviewedAt} and ${table.reviewedAt} <= ${table.effectiveFrom} and ${table.effectiveFrom} < ${table.reviewDueAt} and ${table.reviewEvidenceJson} is not null and jsonb_typeof(${table.reviewEvidenceJson}) = 'object' and octet_length(${table.reviewEvidenceJson}::text) <= 8192)`),
}));

export const privacyNoticePublications = pgTable("privacy_notice_publications", {
  scopeKey: text("scope_key").primaryKey(),
  versionId: uuid("version_id").notNull(),
  contentSha256: text("content_sha256").notNull(),
  approvalSha256: text("approval_sha256").notNull(),
  revision: integer("revision").notNull(),
  status: text("status").notNull().default("active"),
  ...timestamps,
}, (table) => ({
  scopeFk: foreignKey({ name: "privacy_notice_publication_scope_fk", columns: [table.versionId, table.scopeKey], foreignColumns: [privacyNoticeVersions.id, privacyNoticeVersions.scopeKey] }).onDelete("restrict"),
  digestCheck: check("privacy_notice_publication_digest_check", sql`${table.contentSha256} ~ '^[a-f0-9]{64}$' and ${table.approvalSha256} ~ '^[a-f0-9]{64}$'`),
  revisionCheck: check("privacy_notice_publication_revision_check", sql`${table.revision} > 0`),
  statusCheck: check("privacy_notice_publication_status_check", sql`${table.status} in ('active', 'withdrawn')`),
}));

export const emailVerificationChallenges = pgTable(
  "email_verification_challenges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    emailNormalized: text("email_normalized").notNull(),
    verificationTokenHash: text("verification_token_hash").notNull(),
    status: text("status").notNull().default("pending"),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    metadataJson: jsonb("metadata_json").notNull().default({}),
  },
  (table) => ({
    tokenHashUnique: uniqueIndex("email_verification_challenges_token_hash_unique").on(table.verificationTokenHash),
    ownerUnique: uniqueIndex("email_verification_challenge_owner_unique").on(table.id, table.userId),
    userStatusIdx: index("email_verification_challenges_user_status_idx").on(table.userId, table.status),
    emailStatusIdx: index("email_verification_challenges_email_status_idx").on(table.emailNormalized, table.status),
    expiresIdx: index("email_verification_challenges_expires_idx").on(table.expiresAt),
  }),
);

export const passwordResetChallenges = pgTable(
  "password_reset_challenges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    emailNormalized: text("email_normalized").notNull(),
    resetTokenHash: text("reset_token_hash").notNull(),
    status: text("status").notNull().default("pending"),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    metadataJson: jsonb("metadata_json").notNull().default({}),
  },
  (table) => ({
    tokenHashUnique: uniqueIndex("password_reset_challenges_token_hash_unique").on(table.resetTokenHash),
    ownerUnique: uniqueIndex("password_reset_challenge_owner_unique").on(table.id, table.userId),
    userStatusIdx: index("password_reset_challenges_user_status_idx").on(table.userId, table.status),
    emailStatusIdx: index("password_reset_challenges_email_status_idx").on(table.emailNormalized, table.status),
    expiresIdx: index("password_reset_challenges_expires_idx").on(table.expiresAt),
  }),
);

export const authEmailOutbox = pgTable("auth_email_outbox", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull(),
  messageType: text("message_type").notNull(),
  verificationChallengeId: uuid("verification_challenge_id"),
  resetChallengeId: uuid("reset_challenge_id"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  envelopeJson: jsonb("envelope_json"),
  status: text("status").notNull().default("queued"),
  attemptCount: integer("attempt_count").notNull().default(0),
  availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
  leaseId: uuid("lease_id"),
  leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
  outcome: text("outcome"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  ...timestamps,
}, (table) => ({
  verificationFk: foreignKey({ name: "auth_email_outbox_verification_owner_fk", columns: [table.verificationChallengeId, table.userId], foreignColumns: [emailVerificationChallenges.id, emailVerificationChallenges.userId] }).onDelete("cascade"),
  resetFk: foreignKey({ name: "auth_email_outbox_reset_owner_fk", columns: [table.resetChallengeId, table.userId], foreignColumns: [passwordResetChallenges.id, passwordResetChallenges.userId] }).onDelete("cascade"),
  verificationUnique: uniqueIndex("auth_email_outbox_verification_unique").on(table.verificationChallengeId),
  resetUnique: uniqueIndex("auth_email_outbox_reset_unique").on(table.resetChallengeId),
  queueIdx: index("auth_email_outbox_queue_idx").on(table.status, table.availableAt, table.id),
  expiryIdx: index("auth_email_outbox_expiry_idx").on(table.status, table.expiresAt, table.leaseExpiresAt),
  kindCheck: check("auth_email_outbox_kind_check", sql`(${table.messageType} = 'auth.email_verification' and ${table.verificationChallengeId} is not null and ${table.resetChallengeId} is null) or (${table.messageType} = 'auth.password_reset' and ${table.resetChallengeId} is not null and ${table.verificationChallengeId} is null)`),
  attemptCheck: check("auth_email_outbox_attempt_check", sql`${table.attemptCount} between 0 and 5`),
  stateCheck: check("auth_email_outbox_state_check", sql`(${table.status} = 'queued' and ${table.leaseId} is null and ${table.leaseExpiresAt} is null) or (${table.status} in ('leased', 'sending') and ${table.leaseId} is not null and ${table.leaseExpiresAt} is not null) or (${table.status} in ('accepted', 'cancelled', 'failed', 'uncertain') and ${table.leaseId} is null and ${table.leaseExpiresAt} is null)`),
  payloadCheck: check("auth_email_outbox_payload_check", sql`(${table.status} in ('queued', 'leased', 'sending') and ${table.completedAt} is null and ${table.envelopeJson} is not null and jsonb_typeof(${table.envelopeJson}) = 'object' and octet_length(${table.envelopeJson}::text) <= 1024) or (${table.status} in ('accepted', 'cancelled', 'failed', 'uncertain') and ${table.completedAt} is not null and ${table.envelopeJson} is null)`),
  outcomeCheck: check("auth_email_outbox_outcome_check", sql`${table.outcome} is null or ${table.outcome} in ('accepted', 'not_accepted', 'unknown', 'expired', 'ineligible', 'invalid_envelope', 'attempt_limit', 'lease_expired')`),
}));

export const authRateLimitBuckets = pgTable(
  "auth_rate_limit_buckets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    action: text("action").notNull(),
    keyHash: text("key_hash").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    windowSeconds: integer("window_seconds").notNull(),
    attemptCount: integer("attempt_count").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }).notNull(),
    metadataJson: jsonb("metadata_json").notNull().default({}),
  },
  (table) => ({
    actionKeyWindowUnique: uniqueIndex("auth_rate_limit_buckets_action_key_window_unique").on(
      table.action,
      table.keyHash,
      table.windowStart,
    ),
    keyExpiresIdx: index("auth_rate_limit_buckets_key_expires_idx").on(table.keyHash, table.expiresAt),
    actionExpiresIdx: index("auth_rate_limit_buckets_action_expires_idx").on(table.action, table.expiresAt),
  }),
);

export const userRoles = pgTable(
  "user_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    grantedByUserId: uuid("granted_by_user_id").references((): typeof users.id => users.id, { onDelete: "set null" }),
    grantSource: text("grant_source").notNull().default("system"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => ({
    activeUserRoleUnique: uniqueIndex("user_roles_active_user_role_unique")
      .on(table.userId, table.role)
      .where(sql`${table.revokedAt} is null`),
    userRoleIdx: index("user_roles_user_role_idx").on(table.userId, table.role),
  }),
);

export const cities = pgTable(
  "cities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    nameZh: text("name_zh"),
    nameEn: text("name_en").notNull(),
    region: text("region"),
    province: text("province"),
    monthlyCost: text("monthly_cost"),
    monthlyCostRmb: integer("monthly_cost_rmb"),
    costLevel: text("cost_level"),
    density: text("density"),
    tags: jsonb("tags").notNull().default([]),
    contentJson: jsonb("content_json").notNull().default({}),
    nearby: jsonb("nearby").notNull().default([]),
    referenceSchoolCount: integer("reference_school_count").notNull().default(0),
    referenceProgramCount: integer("reference_program_count").notNull().default(0),
    referenceEnglishProgramCount: integer("reference_english_program_count").notNull().default(0),
    referenceScholarshipCount: integer("reference_scholarship_count").notNull().default(0),
    referenceCscaSchoolCount: integer("reference_csca_school_count").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
    version: integer("version").notNull().default(1),
    ...catalogReviewFields,
    ...timestamps,
  },
  (table) => ({
    slugUnique: uniqueIndex("cities_slug_unique").on(table.slug),
    statusIdx: index("cities_status_idx").on(table.status),
    regionIdx: index("cities_region_idx").on(table.region),
  }),
);

export const schools = pgTable(
  "schools",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    nameZh: text("name_zh"),
    nameEn: text("name_en").notNull(),
    schoolType: text("school_type"),
    region: text("region"),
    cityId: uuid("city_id").references(() => cities.id, { onDelete: "set null" }),
    city: text("city"),
    cityZh: text("city_zh"),
    citySlug: text("city_slug"),
    province: text("province"),
    regionLabel: text("region_label"),
    ranking: text("ranking"),
    cscaRequired: boolean("csca_required").notNull().default(false),
    cscaRequirement: text("csca_requirement"),
    cscaSubjects: jsonb("csca_subjects").notNull().default([]),
    applicationLevel: text("application_level"),
    languageOfInstruction: text("language_of_instruction"),
    languageRequirement: text("language_requirement"),
    hskRequirement: text("hsk_requirement"),
    englishRequirement: text("english_requirement"),
    deadlineSummary: text("deadline_summary"),
    tuitionSummary: text("tuition_summary"),
    applicationFee: text("application_fee"),
    websiteUrl: text("website_url"),
    admissionsUrl: text("admissions_url"),
    subjectTags: jsonb("subject_tags").notNull().default([]),
    fitNotes: text("fit_notes"),
    languageTags: jsonb("language_tags").notNull().default([]),
    tuitionBandLabel: text("tuition_band_label"),
    campusHighlights: jsonb("campus_highlights").notNull().default([]),
    contactNotes: text("contact_notes"),
    qualityScore: integer("quality_score"),
    missingFields: jsonb("missing_fields").notNull().default([]),
    completenessLabel: text("completeness_label"),
    ...catalogReviewFields,
    ...timestamps,
  },
  (table) => ({
    slugUnique: uniqueIndex("schools_slug_unique").on(table.slug),
    cityIdx: index("schools_city_idx").on(table.cityId),
    statusIdx: index("schools_status_idx").on(table.status),
    verificationIdx: index("schools_verification_status_idx").on(table.verificationStatus),
  }),
);

export const schoolStaffInvites = pgTable(
  "school_staff_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    emailNormalized: text("email_normalized").notNull(),
    role: text("role").notNull(),
    tokenHash: text("token_hash").notNull(),
    status: text("status").notNull().default("pending"),
    invitedByUserId: uuid("invited_by_user_id").references(() => users.id, { onDelete: "set null" }),
    acceptedByUserId: uuid("accepted_by_user_id").references(() => users.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    tokenHashUnique: uniqueIndex("school_staff_invites_token_hash_unique").on(table.tokenHash),
    pendingSchoolEmailUnique: uniqueIndex("school_staff_invites_pending_school_email_unique")
      .on(table.schoolId, table.emailNormalized)
      .where(sql`${table.status} = 'pending' and ${table.acceptedAt} is null and ${table.revokedAt} is null`),
    schoolStatusIdx: index("school_staff_invites_school_status_idx").on(table.schoolId, table.status),
    emailStatusIdx: index("school_staff_invites_email_status_idx").on(table.emailNormalized, table.status),
  }),
);

export const schoolStaffMemberships = pgTable(
  "school_staff_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    status: text("status").notNull().default("invited"),
    invitedByUserId: uuid("invited_by_user_id").references((): typeof users.id => users.id, { onDelete: "set null" }),
    ...timestamps,
    removedAt: timestamp("removed_at", { withTimezone: true }),
  },
  (table) => ({
    activeSchoolUserUnique: uniqueIndex("school_staff_memberships_active_school_user_unique")
      .on(table.schoolId, table.userId)
      .where(sql`${table.removedAt} is null`),
    schoolStatusIdx: index("school_staff_memberships_school_status_idx").on(table.schoolId, table.status),
    userStatusIdx: index("school_staff_memberships_user_status_idx").on(table.userId, table.status),
    idUserSchoolRoleUnique: uniqueIndex("school_staff_memberships_id_user_school_role_unique")
      .on(table.id, table.userId, table.schoolId, table.role),
  }),
);

export const cuacStaffAccessGrants = pgTable(
  "cuac_staff_access_grants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    emailNormalized: text("email_normalized").notNull(),
    requestedSurface: text("requested_surface").notNull().default("cuac_internal"),
    requestedRole: text("requested_role").notNull(),
    status: text("status").notNull().default("pending"),
    tokenHash: text("token_hash"),
    requestedByUserId: uuid("requested_by_user_id").references((): typeof users.id => users.id, { onDelete: "set null" }),
    approvedByUserId: uuid("approved_by_user_id").references((): typeof users.id => users.id, { onDelete: "set null" }),
    reason: text("reason"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    emailStatusIdx: index("cuac_staff_access_grants_email_status_idx").on(table.emailNormalized, table.status),
    userStatusIdx: index("cuac_staff_access_grants_user_status_idx").on(table.userId, table.status),
    authorityLookupIdx: index("cuac_staff_access_grants_authority_lookup_idx").on(
      table.userId, table.requestedRole, table.status, table.expiresAt,
    ),
    activeUserRoleUnique: uniqueIndex("cuac_staff_access_grants_active_user_role_unique")
      .on(table.userId, table.requestedRole)
      .where(sql`${table.status} = 'approved' and ${table.revokedAt} is null`),
    idUserRoleUnique: uniqueIndex("cuac_staff_access_grants_id_user_role_unique")
      .on(table.id, table.userId, table.requestedRole),
    surfaceCheck: check("cuac_staff_access_grants_surface_check", sql`${table.requestedSurface} = 'cuac_internal'`),
    roleCheck: check("cuac_staff_access_grants_role_check", sql`${table.requestedRole} in ('cuac_ops','cuac_admin')`),
    statusCheck: check("cuac_staff_access_grants_status_check", sql`${table.status} in ('pending','approved','revoked','expired')`),
    emailCheck: check("cuac_staff_access_grants_email_check", sql`char_length(${table.emailNormalized}) between 3 and 320
      and ${table.emailNormalized} = lower(trim(${table.emailNormalized}))`),
    tokenHashCheck: check("cuac_staff_access_grants_token_hash_check", sql`${table.tokenHash} is null
      or ${table.tokenHash} ~ '^sha256:[a-f0-9]{64}$'`),
    approvedLifecycleCheck: check("cuac_staff_access_grants_approved_lifecycle_check", sql`${table.status} <> 'approved' or (
      ${table.userId} is not null and ${table.approvedByUserId} is not null
      and ${table.approvedByUserId} <> ${table.userId}
      and ${table.approvedAt} is not null and ${table.approvedAt} >= ${table.createdAt}
      and ${table.expiresAt} is not null and ${table.expiresAt} > ${table.approvedAt}
      and ${table.revokedAt} is null and ${table.reason} is not null
      and char_length(trim(${table.reason})) between 1 and 500
    )`),
  }),
);

export const schoolCatalogCorrectionRequests = pgTable(
  "school_catalog_correction_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").notNull(),
    sourceSchoolUpdatedAt: timestamp("source_school_updated_at", { withTimezone: true }).notNull(),
    changeSetJson: jsonb("change_set_json").$type<Record<string, string | null>>().notNull(),
    evidenceUrl: text("evidence_url").notNull(),
    reasonCode: text("reason_code").notNull(),
    revision: integer("revision").notNull().default(1),
    status: text("status").notNull().default("submitted"),
    requestedByUserId: uuid("requested_by_user_id").notNull(),
    requestedMembershipId: uuid("requested_membership_id").notNull(),
    requestedMembershipRole: text("requested_membership_role").notNull(),
    claimedByUserId: uuid("claimed_by_user_id"),
    claimedByGrantId: uuid("claimed_by_grant_id"),
    claimedByRole: text("claimed_by_role"),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    resolvedByUserId: uuid("resolved_by_user_id"),
    resolvedByGrantId: uuid("resolved_by_grant_id"),
    resolvedByRole: text("resolved_by_role"),
    resolutionCode: text("resolution_code"),
    resolutionReference: text("resolution_reference"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resultSchoolUpdatedAt: timestamp("result_school_updated_at", { withTimezone: true }),
    ...timestamps,
  },
  table => ({
    activeGenerationUnique: uniqueIndex("school_catalog_correction_requests_active_generation_unique")
      .on(table.schoolId, table.sourceSchoolUpdatedAt)
      .where(sql`${table.status} in ('submitted','claimed')`),
    schoolCreatedIdx: index("school_catalog_correction_requests_school_created_idx")
      .on(table.schoolId, table.createdAt, table.id),
    statusUpdatedIdx: index("school_catalog_correction_requests_status_updated_idx")
      .on(table.status, table.updatedAt, table.id),
    requesterMembershipFk: foreignKey({
      columns: [table.requestedMembershipId, table.requestedByUserId, table.schoolId, table.requestedMembershipRole],
      foreignColumns: [schoolStaffMemberships.id, schoolStaffMemberships.userId,
        schoolStaffMemberships.schoolId, schoolStaffMemberships.role],
      name: "school_catalog_correction_requests_requester_membership_fk",
    }).onDelete("restrict"),
    claimedGrantScopeFk: foreignKey({
      columns: [table.claimedByGrantId, table.claimedByUserId, table.claimedByRole],
      foreignColumns: [cuacStaffAccessGrants.id, cuacStaffAccessGrants.userId, cuacStaffAccessGrants.requestedRole],
      name: "school_catalog_correction_requests_claimed_grant_scope_fk",
    }).onDelete("restrict"),
    resolvedGrantScopeFk: foreignKey({
      columns: [table.resolvedByGrantId, table.resolvedByUserId, table.resolvedByRole],
      foreignColumns: [cuacStaffAccessGrants.id, cuacStaffAccessGrants.userId, cuacStaffAccessGrants.requestedRole],
      name: "school_catalog_correction_requests_resolved_grant_scope_fk",
    }).onDelete("restrict"),
    requestCheck: check("school_catalog_correction_requests_request_check", sql`
      ${table.requestedMembershipRole} in ('admissions','counselor','school_admin')
      and ${table.reasonCode} in ('official_website_changed','admissions_route_changed','fee_information_changed',
        'language_information_changed','outdated_public_information')
      and jsonb_typeof(${table.changeSetJson}) = 'object'
      and octet_length(convert_to(${table.changeSetJson}::text, 'UTF8')) between 2 and 8192
      and ${table.evidenceUrl} ~ '^https://[^[:space:]]+$'
      and char_length(${table.evidenceUrl}) between 9 and 2048
      and isfinite(${table.sourceSchoolUpdatedAt})`),
    roleCheck: check("school_catalog_correction_requests_role_check", sql`
      (${table.claimedByRole} is null or ${table.claimedByRole} in ('cuac_ops','cuac_admin'))
      and (${table.resolvedByRole} is null or ${table.resolvedByRole} = 'cuac_admin')`),
    referenceCheck: check("school_catalog_correction_requests_reference_check", sql`
      ${table.resolutionReference} is null or ${table.resolutionReference} ~ '^[A-Za-z0-9._:-]{1,128}$'`),
    lifecycleCheck: check("school_catalog_correction_requests_lifecycle_check", sql`
      ${table.revision} between 1 and 2147483647
      and isfinite(${table.createdAt}) and isfinite(${table.updatedAt})
      and ${table.createdAt} >= ${table.sourceSchoolUpdatedAt} and ${table.updatedAt} >= ${table.createdAt}
      and (${table.resolvedByUserId} is null or ${table.resolvedByUserId} <> ${table.claimedByUserId})
      and (
        (${table.status} = 'submitted' and ${table.revision} = 1
          and ${table.claimedByUserId} is null and ${table.claimedByGrantId} is null
          and ${table.claimedByRole} is null and ${table.claimedAt} is null
          and ${table.resolvedByUserId} is null and ${table.resolvedByGrantId} is null
          and ${table.resolvedByRole} is null and ${table.resolutionCode} is null
          and ${table.resolutionReference} is null and ${table.resolvedAt} is null
          and ${table.resultSchoolUpdatedAt} is null)
        or (${table.status} = 'claimed' and ${table.revision} = 2
          and ${table.claimedByUserId} is not null and ${table.claimedByGrantId} is not null
          and ${table.claimedByRole} in ('cuac_ops','cuac_admin')
          and ${table.claimedAt} is not null and isfinite(${table.claimedAt})
          and ${table.claimedAt} >= ${table.createdAt}
          and ${table.resolvedByUserId} is null and ${table.resolvedByGrantId} is null
          and ${table.resolvedByRole} is null and ${table.resolutionCode} is null
          and ${table.resolutionReference} is null and ${table.resolvedAt} is null
          and ${table.resultSchoolUpdatedAt} is null)
        or (${table.status} in ('applied','rejected') and ${table.revision} = 3
          and ${table.claimedByUserId} is not null and ${table.claimedByGrantId} is not null
          and ${table.claimedByRole} in ('cuac_ops','cuac_admin')
          and ${table.claimedAt} is not null and isfinite(${table.claimedAt})
          and ${table.resolvedByUserId} is not null and ${table.resolvedByGrantId} is not null
          and ${table.resolvedByRole} = 'cuac_admin'
          and ${table.resolutionReference} is not null and ${table.resolvedAt} is not null
          and isfinite(${table.resolvedAt}) and ${table.resolvedAt} >= ${table.claimedAt}
          and ${table.resultSchoolUpdatedAt} is not null and isfinite(${table.resultSchoolUpdatedAt})
          and ((${table.status} = 'applied' and ${table.resolutionCode} = 'applied_unverified'
              and ${table.resultSchoolUpdatedAt} = ${table.resolvedAt}
              and ${table.resultSchoolUpdatedAt} > ${table.sourceSchoolUpdatedAt})
            or (${table.status} = 'rejected'
              and ${table.resolutionCode} in ('rejected_duplicate','rejected_unverifiable','rejected_out_of_scope')
              and ${table.resultSchoolUpdatedAt} = ${table.sourceSchoolUpdatedAt})))
      )`),
  }),
);

export const signInContinuations = pgTable(
  "sign_in_continuations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    continuationTokenHash: text("continuation_token_hash").notNull(),
    guestSessionId: text("guest_session_id"),
    targetRoute: text("target_route").notNull(),
    actionKey: text("action_key").notNull(),
    requiredRole: text("required_role"),
    tenantSchoolId: uuid("tenant_school_id").references(() => schools.id, { onDelete: "set null" }),
    payloadPreviewJson: jsonb("payload_preview_json").notNull().default({}),
    deviceFingerprintHash: text("device_fingerprint_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    consumedByUserId: uuid("consumed_by_user_id").references(() => users.id, { onDelete: "set null" }),
  },
  (table) => ({
    tokenHashUnique: uniqueIndex("sign_in_continuations_token_hash_unique").on(table.continuationTokenHash),
    guestSessionIdx: index("sign_in_continuations_guest_session_idx").on(table.guestSessionId),
    expiresIdx: index("sign_in_continuations_expires_idx").on(table.expiresAt),
  }),
);

export const programs = pgTable(
  "programs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    cityId: uuid("city_id").references(() => cities.id, { onDelete: "set null" }),
    slug: text("slug").notNull(),
    nameZh: text("name_zh"),
    nameEn: text("name_en").notNull(),
    degreeLevel: text("degree_level").notNull(),
    durationYears: integer("duration_years"),
    durationMonths: integer("duration_months"),
    fieldCategory: text("field_category"),
    subjectArea: text("subject_area"),
    teachingLanguage: text("teaching_language"),
    cscaSubjects: jsonb("csca_subjects").notNull().default([]),
    cscaRequirement: text("csca_requirement"),
    hskRequirement: text("hsk_requirement"),
    englishRequirement: text("english_requirement"),
    tuitionAmount: integer("tuition_amount"),
    tuitionCurrency: text("tuition_currency"),
    tuitionPeriod: text("tuition_period"),
    tuitionText: text("tuition_text"),
    scholarshipText: text("scholarship_text"),
    applicationUrl: text("application_url"),
    applicationNote: text("application_note"),
    isVerified: boolean("is_verified").notNull().default(false),
    hasScholarship: boolean("has_scholarship").notNull().default(false),
    badgeText: text("badge_text"),
    displayTuition: text("display_tuition"),
    displaySubjects: jsonb("display_subjects").notNull().default([]),
    displayGroup: text("display_group"),
    displayGroupLabel: text("display_group_label"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...catalogReviewFields,
    createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    updatedByUserId: uuid("updated_by_user_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => ({
    slugUnique: uniqueIndex("programs_slug_unique").on(table.slug),
    schoolIdx: index("programs_school_idx").on(table.schoolId),
    idSchoolUnique: uniqueIndex("programs_id_school_unique").on(table.id, table.schoolId),
    cityIdx: index("programs_city_idx").on(table.cityId),
    degreeStatusIdx: index("programs_degree_status_idx").on(table.degreeLevel, table.status),
  }),
);

export const programIntakes = pgTable(
  "program_intakes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    programId: uuid("program_id")
      .notNull()
      .references(() => programs.id, { onDelete: "cascade" }),
    intakeTerm: text("intake_term").notNull(),
    intakeYear: integer("intake_year").notNull(),
    openDate: timestamp("open_date", { withTimezone: true }),
    deadlineDate: timestamp("deadline_date", { withTimezone: true }),
    deadlineLabel: text("deadline_label"),
    applicationRound: text("application_round"),
    status: text("status").notNull().default("open"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (table) => ({
    programTermYearUnique: uniqueIndex("program_intakes_program_term_year_unique").on(table.programId, table.intakeTerm, table.intakeYear),
    scopeUnique: uniqueIndex("program_intakes_id_program_unique").on(table.id, table.programId),
    deadlineIdx: index("program_intakes_deadline_idx").on(table.deadlineDate),
  }),
);

export const programRequirementVersions = pgTable("program_requirement_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  programIntakeId: uuid("program_intake_id").notNull(),
  version: integer("version").notNull(),
  contentJson: jsonb("content_json").notNull(),
  contentSha256: text("content_sha256").notNull(),
  preparedByUserId: uuid("prepared_by_user_id"),
  reviewEvidenceJson: jsonb("review_evidence_json"),
  reviewStatus: text("review_status").notNull().default("draft"),
  approvedByUserId: uuid("approved_by_user_id"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  effectiveFrom: timestamp("effective_from", { withTimezone: true }),
  reviewDueAt: timestamp("review_due_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => ({
  intakeFk: foreignKey({ name: "program_requirements_intake_fk", columns: [table.programIntakeId], foreignColumns: [programIntakes.id] }).onDelete("restrict"),
  approverFk: foreignKey({ name: "program_requirements_approver_fk", columns: [table.approvedByUserId], foreignColumns: [users.id] }).onDelete("restrict"),
  preparerFk: foreignKey({ name: "program_requirements_preparer_fk", columns: [table.preparedByUserId], foreignColumns: [users.id] }).onDelete("restrict"),
  versionUnique: uniqueIndex("program_requirements_intake_version_unique").on(table.programIntakeId, table.version),
  scopeUnique: uniqueIndex("program_requirements_id_intake_unique").on(table.id, table.programIntakeId),
  versionCheck: check("program_requirements_version_check", sql`${table.version} > 0`),
  digestCheck: check("program_requirements_digest_check", sql`${table.contentSha256} ~ '^[a-f0-9]{64}$'`),
  contentCheck: check("program_requirements_content_check", sql`jsonb_typeof(${table.contentJson}) = 'object' and octet_length(${table.contentJson}::text) <= 131072`),
  reviewCheck: check("program_requirements_review_check", sql`(${table.reviewStatus} = 'draft' and ${table.approvedByUserId} is null and ${table.reviewedAt} is null and ${table.effectiveFrom} is null and ${table.reviewDueAt} is null) or (${table.reviewStatus} = 'approved' and ${table.approvedByUserId} is not null and ${table.reviewedAt} is not null and ${table.effectiveFrom} is not null and ${table.reviewDueAt} is not null and ${table.reviewedAt} <= ${table.effectiveFrom} and ${table.effectiveFrom} < ${table.reviewDueAt})`),
  governanceCheck: check("program_requirements_governance_check", sql`(${table.preparedByUserId} is null and ${table.reviewEvidenceJson} is null) or (${table.preparedByUserId} is not null and ((${table.reviewStatus} = 'draft' and ${table.reviewEvidenceJson} is null) or (${table.reviewStatus} = 'approved' and ${table.preparedByUserId} <> ${table.approvedByUserId} and ${table.reviewEvidenceJson} is not null and jsonb_typeof(${table.reviewEvidenceJson}) = 'object' and octet_length(${table.reviewEvidenceJson}::text) <= 16384)))`),
}));

export const programRequirementPublications = pgTable("program_requirement_publications", {
  programIntakeId: uuid("program_intake_id").primaryKey(),
  versionId: uuid("version_id").notNull(),
  revision: integer("revision").notNull().default(1),
  status: text("status").notNull().default("withdrawn"),
  ...timestamps,
}, table => ({
  scopeFk: foreignKey({ name: "program_requirement_publication_scope_fk", columns: [table.versionId, table.programIntakeId], foreignColumns: [programRequirementVersions.id, programRequirementVersions.programIntakeId] }).onDelete("restrict"),
  revisionCheck: check("program_requirement_publication_revision_check", sql`${table.revision} > 0`),
  statusCheck: check("program_requirement_publication_status_check", sql`${table.status} in ('active', 'withdrawn')`),
}));

export const officialSubmissionPolicyVersions = pgTable("official_submission_policy_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").notNull(),
  policyKey: text("policy_key").notNull(),
  admissionRouteKey: text("admission_route_key").notNull(),
  version: integer("version").notNull(),
  formMode: text("form_mode").notNull(),
  maxProgramChoices: integer("max_program_choices").notNull(),
  orderingMode: text("ordering_mode").notNull(),
  externalChannelType: text("external_channel_type").notNull(),
  documentJson: jsonb("document_json").notNull(),
  documentSha256: text("document_sha256").notNull(),
  targetSetSha256: text("target_set_sha256").notNull(),
  preparedByUserId: uuid("prepared_by_user_id").notNull(),
  reviewStatus: text("review_status").notNull().default("draft"),
  approvedByUserId: uuid("approved_by_user_id"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  effectiveFrom: timestamp("effective_from", { withTimezone: true }),
  reviewDueAt: timestamp("review_due_at", { withTimezone: true }),
  reviewEvidenceJson: jsonb("review_evidence_json"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => ({
  schoolFk: foreignKey({ name: "official_submission_policy_version_school_fk", columns: [table.schoolId], foreignColumns: [schools.id] }).onDelete("restrict"),
  preparerFk: foreignKey({ name: "official_submission_policy_version_preparer_fk", columns: [table.preparedByUserId], foreignColumns: [users.id] }).onDelete("restrict"),
  reviewerFk: foreignKey({ name: "official_submission_policy_version_reviewer_fk", columns: [table.approvedByUserId], foreignColumns: [users.id] }).onDelete("restrict"),
  scopeVersionUnique: uniqueIndex("official_submission_policy_scope_version_unique")
    .on(table.schoolId, table.policyKey, table.admissionRouteKey, table.version),
  idScopeUnique: uniqueIndex("official_submission_policy_id_scope_unique").on(table.id, table.schoolId, table.admissionRouteKey),
  scopeCheck: check("official_submission_policy_scope_check", sql`${table.policyKey} ~ '^[a-z][a-z0-9_-]{0,63}$'
    and ${table.admissionRouteKey} ~ '^[a-z][a-z0-9_-]{0,63}$' and ${table.version} > 0`),
  ruleCheck: check("official_submission_policy_rule_check", sql`${table.formMode} in ('one_program_per_form','multi_program_form')
    and ${table.maxProgramChoices} between 1 and 20 and ${table.orderingMode} in ('none','ranked')
    and ${table.externalChannelType} in ('university_portal','approved_manual_handoff')`),
  digestCheck: check("official_submission_policy_digest_check", sql`${table.documentSha256} ~ '^[a-f0-9]{64}$'
    and ${table.targetSetSha256} ~ '^[a-f0-9]{64}$'`),
  documentCheck: check("official_submission_policy_document_check", sql`jsonb_typeof(${table.documentJson}) = 'object'
    and octet_length(${table.documentJson}::text) <= 65536
    and ${table.documentJson} ?& array['schemaVersion','admissionRouteKey','formMode','maxProgramChoices','orderingMode','externalChannelType','sources']
    and ${table.documentJson} - array['schemaVersion','admissionRouteKey','formMode','maxProgramChoices','orderingMode','externalChannelType','sources'] = '{}'::jsonb
    and ${table.documentJson}->'schemaVersion' = '1'::jsonb
    and ${table.documentJson}->>'admissionRouteKey' = ${table.admissionRouteKey}
    and ${table.documentJson}->>'formMode' = ${table.formMode}
    and ${table.documentJson}->>'maxProgramChoices' = ${table.maxProgramChoices}::text
    and ${table.documentJson}->>'orderingMode' = ${table.orderingMode}
    and ${table.documentJson}->>'externalChannelType' = ${table.externalChannelType}
    and jsonb_typeof(${table.documentJson}->'sources') = 'array'
    and jsonb_array_length(${table.documentJson}->'sources') between 1 and 12`),
  reviewCheck: check("official_submission_policy_review_check", sql`(${table.reviewStatus} = 'draft'
      and ${table.approvedByUserId} is null and ${table.reviewedAt} is null and ${table.effectiveFrom} is null
      and ${table.reviewDueAt} is null and ${table.reviewEvidenceJson} is null)
    or (${table.reviewStatus} = 'approved' and ${table.approvedByUserId} is not null
      and ${table.approvedByUserId} <> ${table.preparedByUserId} and ${table.reviewedAt} is not null
      and ${table.effectiveFrom} is not null and ${table.reviewDueAt} is not null and ${table.reviewEvidenceJson} is not null
      and ${table.createdAt} <= ${table.reviewedAt} and ${table.reviewedAt} <= ${table.effectiveFrom}
      and ${table.effectiveFrom} < ${table.reviewDueAt} and jsonb_typeof(${table.reviewEvidenceJson}) = 'object'
      and octet_length(${table.reviewEvidenceJson}::text) <= 16384)`),
}));

export const officialSubmissionPolicyVersionTargets = pgTable("official_submission_policy_version_targets", {
  policyVersionId: uuid("policy_version_id").notNull(),
  schoolId: uuid("school_id").notNull(),
  programId: uuid("program_id").notNull(),
  programIntakeId: uuid("program_intake_id").notNull(),
  admissionRouteKey: text("admission_route_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => ({
  pk: primaryKey({ name: "official_submission_policy_version_targets_pk", columns: [table.policyVersionId, table.programIntakeId] }),
  versionScopeFk: foreignKey({ name: "official_submission_policy_target_version_scope_fk",
    columns: [table.policyVersionId, table.schoolId, table.admissionRouteKey],
    foreignColumns: [officialSubmissionPolicyVersions.id, officialSubmissionPolicyVersions.schoolId,
      officialSubmissionPolicyVersions.admissionRouteKey] }).onDelete("restrict"),
  programSchoolFk: foreignKey({ name: "official_submission_policy_target_program_school_fk",
    columns: [table.programId, table.schoolId], foreignColumns: [programs.id, programs.schoolId] }).onDelete("restrict"),
  intakeProgramFk: foreignKey({ name: "official_submission_policy_target_intake_program_fk",
    columns: [table.programIntakeId, table.programId], foreignColumns: [programIntakes.id, programIntakes.programId] }).onDelete("restrict"),
  publicationScopeUnique: uniqueIndex("official_submission_policy_target_publication_unique")
    .on(table.policyVersionId, table.programIntakeId, table.programId, table.schoolId, table.admissionRouteKey),
  intakeRouteIdx: index("official_submission_policy_target_intake_route_idx").on(table.programIntakeId, table.admissionRouteKey),
  routeCheck: check("official_submission_policy_target_route_check", sql`${table.admissionRouteKey} ~ '^[a-z][a-z0-9_-]{0,63}$'`),
}));

export const officialSubmissionPolicyPublications = pgTable("official_submission_policy_publications", {
  programIntakeId: uuid("program_intake_id").notNull(),
  programId: uuid("program_id").notNull(),
  schoolId: uuid("school_id").notNull(),
  admissionRouteKey: text("admission_route_key").notNull(),
  versionId: uuid("version_id").notNull(),
  documentSha256: text("document_sha256").notNull(),
  targetSetSha256: text("target_set_sha256").notNull(),
  approvalSha256: text("approval_sha256").notNull(),
  revision: integer("revision").notNull(),
  status: text("status").notNull().default("active"),
  ...timestamps,
}, table => ({
  pk: primaryKey({ name: "official_submission_policy_publications_pk", columns: [table.programIntakeId, table.admissionRouteKey] }),
  targetFk: foreignKey({ name: "official_submission_policy_publication_target_fk",
    columns: [table.versionId, table.programIntakeId, table.programId, table.schoolId, table.admissionRouteKey],
    foreignColumns: [officialSubmissionPolicyVersionTargets.policyVersionId, officialSubmissionPolicyVersionTargets.programIntakeId,
      officialSubmissionPolicyVersionTargets.programId, officialSubmissionPolicyVersionTargets.schoolId,
      officialSubmissionPolicyVersionTargets.admissionRouteKey] }).onDelete("restrict"),
  digestCheck: check("official_submission_policy_publication_digest_check", sql`${table.documentSha256} ~ '^[a-f0-9]{64}$'
    and ${table.targetSetSha256} ~ '^[a-f0-9]{64}$' and ${table.approvalSha256} ~ '^[a-f0-9]{64}$'`),
  stateCheck: check("official_submission_policy_publication_state_check", sql`${table.admissionRouteKey} ~ '^[a-z][a-z0-9_-]{0,63}$'
    and ${table.revision} > 0 and ${table.status} in ('active','withdrawn')`),
  schoolRouteStatusIdx: index("official_submission_policy_publication_school_route_status_idx")
    .on(table.schoolId, table.admissionRouteKey, table.status),
}));

export const scholarships = pgTable(
  "scholarships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    nameZh: text("name_zh"),
    type: text("type"),
    typeLabel: text("type_label"),
    fundingLevel: text("funding_level"),
    providerName: text("provider_name"),
    providerNameEn: text("provider_name_en"),
    providerLocation: text("provider_location"),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "set null" }),
    programId: uuid("program_id").references(() => programs.id, { onDelete: "set null" }),
    coverage: text("coverage"),
    applicableDegree: text("applicable_degree"),
    applicableProgram: text("applicable_program"),
    amountText: text("amount_text"),
    requirementText: text("requirement_text"),
    bodySections: jsonb("body_sections").notNull().default([]),
    benefitItems: jsonb("benefit_items").notNull().default([]),
    eligibilityItems: jsonb("eligibility_items").notNull().default([]),
    applicationMaterials: jsonb("application_materials").notNull().default([]),
    applicationSteps: jsonb("application_steps").notNull().default([]),
    contactInfo: jsonb("contact_info").notNull().default({}),
    actionLinks: jsonb("action_links").notNull().default([]),
    deadlineDate: timestamp("deadline_date", { withTimezone: true }),
    deadlineLabel: text("deadline_label"),
    applicationRound: text("application_round"),
    targetCountries: jsonb("target_countries").notNull().default([]),
    targetRegions: jsonb("target_regions").notNull().default([]),
    benefits: jsonb("benefits").notNull().default([]),
    tags: jsonb("tags").notNull().default([]),
    summary: text("summary"),
    sortOrder: integer("sort_order").notNull().default(0),
    version: integer("version").notNull().default(1),
    ...catalogReviewFields,
    ...timestamps,
  },
  (table) => ({
    slugUnique: uniqueIndex("scholarships_slug_unique").on(table.slug),
    schoolIdx: index("scholarships_school_idx").on(table.schoolId),
    programIdx: index("scholarships_program_idx").on(table.programId),
    statusIdx: index("scholarships_status_idx").on(table.status),
  }),
);

export const programScholarships = pgTable(
  "program_scholarships",
  {
    programId: uuid("program_id")
      .notNull()
      .references(() => programs.id, { onDelete: "cascade" }),
    scholarshipId: uuid("scholarship_id")
      .notNull()
      .references(() => scholarships.id, { onDelete: "cascade" }),
    eligibilityNote: text("eligibility_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.programId, table.scholarshipId] }),
  }),
);

export const catalogSourceEvidence = pgTable(
  "catalog_source_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    sourceUrl: text("source_url"),
    sourceLabel: text("source_label"),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
    capturedByUserId: uuid("captured_by_user_id").references(() => users.id, { onDelete: "set null" }),
    evidenceNote: text("evidence_note"),
    checksum: text("checksum"),
    sourceFieldLineageJson: jsonb("source_field_lineage_json").notNull().default({}),
    metadataJson: jsonb("metadata_json").notNull().default({}),
  },
  (table) => ({
    identityUnique: unique("catalog_source_evidence_identity_unique")
      .on(table.id, table.entityType, table.entityId, table.capturedAt),
    entityIdx: index("catalog_source_evidence_entity_idx").on(table.entityType, table.entityId),
    capturedAtIdx: index("catalog_source_evidence_captured_at_idx").on(table.capturedAt),
  }),
);

export const studentProfiles = pgTable(
  "student_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    displayName: text("display_name"),
    citizenshipCountry: text("citizenship_country"),
    targetDegreeLevel: text("target_degree_level"),
    targetIntake: text("target_intake"),
    preferencesJson: jsonb("preferences_json").notNull().default({}),
    profileCompletionJson: jsonb("profile_completion_json").notNull().default({}),
    consentSummaryJson: jsonb("consent_summary_json").notNull().default({}),
    ...timestamps,
  },
  (table) => ({
    userUnique: uniqueIndex("student_profiles_user_unique").on(table.userId),
    targetDegreeIdx: index("student_profiles_target_degree_idx").on(table.targetDegreeLevel),
  }),
);

export const studentApplicantProfiles = pgTable("student_applicant_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  revision: integer("revision").notNull().default(1),
  fullName: text("full_name"),
  contactEmail: text("contact_email"),
  citizenshipCountry: text("citizenship_country"),
  ...timestamps,
}, (table) => ({
  userUnique: uniqueIndex("student_applicant_profiles_user_unique").on(table.userId),
  revisionCheck: check("student_applicant_profiles_revision_check", sql`${table.revision} > 0`),
  fullNameCheck: check("student_applicant_profiles_full_name_check", sql`${table.fullName} is null or char_length(btrim(${table.fullName})) between 1 and 200`),
  emailCheck: check("student_applicant_profiles_email_check", sql`${table.contactEmail} is null or char_length(btrim(${table.contactEmail})) between 1 and 254`),
  countryCheck: check("student_applicant_profiles_country_check", sql`${table.citizenshipCountry} is null or ${table.citizenshipCountry} ~ '^[A-Z]{2}$'`),
}));

export const studentFileAssets = pgTable("student_file_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  category: text("category").notNull(),
  originalFilename: text("original_filename").notNull(),
  contentType: text("content_type").notNull(),
  expectedBytes: integer("expected_bytes").notNull(),
  expectedSha256: text("expected_sha256").notNull(),
  objectKey: text("object_key").notNull(),
  objectVersionId: text("object_version_id"),
  objectEtag: text("object_etag"),
  observedBytes: integer("observed_bytes"),
  actualSha256: text("actual_sha256"),
  status: text("status").notNull().default("pending_upload"),
  scanOutcome: text("scan_outcome"),
  scanProvider: text("scan_provider"),
  scanAttemptCount: integer("scan_attempt_count").notNull().default(0),
  deleteAttemptCount: integer("delete_attempt_count").notNull().default(0),
  availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
  leaseKind: text("lease_kind"),
  leaseToken: uuid("lease_token"),
  leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
  idempotencyKeyHash: text("idempotency_key_hash").notNull(),
  requestSha256: text("request_sha256").notNull(),
  revision: integer("revision").notNull().default(1),
  uploadExpiresAt: timestamp("upload_expires_at", { withTimezone: true }).notNull(),
  retentionUntil: timestamp("retention_until", { withTimezone: true }).notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }),
  scanCompletedAt: timestamp("scan_completed_at", { withTimezone: true }),
  deleteRequestedAt: timestamp("delete_requested_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  ...timestamps,
}, table => ({
  objectKeyUnique: uniqueIndex("student_file_assets_object_key_unique").on(table.objectKey),
  ownerCommandUnique: uniqueIndex("student_file_assets_owner_command_unique").on(table.userId, table.idempotencyKeyHash),
  ownerStatusIdx: index("student_file_assets_owner_status_idx").on(table.userId, table.status, table.createdAt),
  workerStatusIdx: index("student_file_assets_worker_status_idx").on(table.status, table.availableAt, table.id),
  retentionIdx: index("student_file_assets_retention_idx").on(table.status, table.retentionUntil),
  inputCheck: check("student_file_assets_input_check", sql`${table.category} in ('identity_document','transcript','test_score','recommendation','supporting_document')
    and octet_length(${table.originalFilename}) between 1 and 255 and ${table.originalFilename} !~ '[[:cntrl:]]'
    and ${table.originalFilename} = btrim(${table.originalFilename}) and ${table.originalFilename} not in ('.','..')
    and strpos(${table.originalFilename}, '/') = 0 and strpos(${table.originalFilename}, chr(92)) = 0
    and ${table.contentType} in ('application/pdf','image/jpeg','image/png','application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    and ${table.expectedBytes} between 1 and 104857600 and ${table.expectedSha256} ~ '^[a-f0-9]{64}$'
    and ${table.objectKey} ~ '^private/student-files/[a-f0-9]{2}/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
    and substring(${table.objectKey} from 23 for 2) = substring(${table.id}::text from 1 for 2)
    and right(${table.objectKey}, 36) = ${table.id}::text`),
  digestCheck: check("student_file_assets_digest_check", sql`${table.idempotencyKeyHash} ~ '^[a-f0-9]{64}$' and ${table.requestSha256} ~ '^[a-f0-9]{64}$'
    and (${table.actualSha256} is null or ${table.actualSha256} ~ '^[a-f0-9]{64}$')`),
  metadataCheck: check("student_file_assets_metadata_check", sql`(${table.objectVersionId} is null or (octet_length(${table.objectVersionId}) between 1 and 1024 and ${table.objectVersionId} !~ '[[:cntrl:]]'))
    and (${table.objectEtag} is null or (octet_length(${table.objectEtag}) between 1 and 256 and ${table.objectEtag} !~ '[[:cntrl:]]'))
    and (${table.observedBytes} is null or ${table.observedBytes} between 1 and 104857600)
    and (${table.scanProvider} is null or ${table.scanProvider} ~ '^[a-z][a-z0-9_-]{0,63}$')
    and ${table.scanAttemptCount} between 0 and 5 and ${table.deleteAttemptCount} between 0 and 2147483647
    and ${table.revision} between 1 and 2147483647 and isfinite(${table.uploadExpiresAt}) and isfinite(${table.retentionUntil})
    and isfinite(${table.availableAt}) and (${table.leaseExpiresAt} is null or isfinite(${table.leaseExpiresAt}))
    and (${table.uploadedAt} is null or isfinite(${table.uploadedAt}))
    and (${table.scanCompletedAt} is null or isfinite(${table.scanCompletedAt}))
    and (${table.deleteRequestedAt} is null or isfinite(${table.deleteRequestedAt}))
    and (${table.deletedAt} is null or isfinite(${table.deletedAt}))
    and ${table.uploadExpiresAt} > ${table.createdAt} and ${table.retentionUntil} > ${table.createdAt}
    and (${table.uploadedAt} is null or ${table.uploadedAt} >= ${table.createdAt})
    and (${table.scanCompletedAt} is null or ${table.scanCompletedAt} >= ${table.createdAt})
    and (${table.deleteRequestedAt} is null or ${table.deleteRequestedAt} >= ${table.createdAt})
    and (${table.deletedAt} is null or ${table.deletedAt} >= ${table.deleteRequestedAt})`),
  stateCheck: check("student_file_assets_state_check", sql`(
      ${table.status} = 'pending_upload' and ${table.objectVersionId} is null and ${table.objectEtag} is null and ${table.observedBytes} is null
      and ${table.actualSha256} is null and ${table.scanOutcome} is null and ${table.scanProvider} is null and ${table.uploadedAt} is null
      and ${table.scanCompletedAt} is null and ${table.deleteRequestedAt} is null and ${table.deletedAt} is null
      and ${table.leaseKind} is null and ${table.leaseToken} is null and ${table.leaseExpiresAt} is null
    ) or (
      ${table.status} = 'pending_scan' and ${table.objectVersionId} is not null and ${table.objectEtag} is not null and ${table.observedBytes} is not null
      and ${table.actualSha256} is null and ${table.scanOutcome} is null and ${table.scanProvider} is null and ${table.uploadedAt} is not null
      and ${table.scanCompletedAt} is null and ${table.deleteRequestedAt} is null and ${table.deletedAt} is null
      and ${table.leaseKind} is null and ${table.leaseToken} is null and ${table.leaseExpiresAt} is null
    ) or (
      ${table.status} = 'scanning' and ${table.objectVersionId} is not null and ${table.objectEtag} is not null and ${table.observedBytes} is not null
      and ${table.actualSha256} is null and ${table.scanOutcome} is null and ${table.scanProvider} is null and ${table.uploadedAt} is not null
      and ${table.scanCompletedAt} is null and ${table.deleteRequestedAt} is null and ${table.deletedAt} is null
      and ${table.leaseKind} = 'scan' and ${table.leaseToken} is not null and ${table.leaseExpiresAt} is not null
    ) or (
      ${table.status} = 'clean' and ${table.objectVersionId} is not null and ${table.objectEtag} is not null and ${table.observedBytes} = ${table.expectedBytes}
      and ${table.actualSha256} = ${table.expectedSha256} and ${table.scanOutcome} = 'clean' and ${table.scanProvider} is not null
      and ${table.uploadedAt} is not null and ${table.scanCompletedAt} is not null and ${table.deleteRequestedAt} is null and ${table.deletedAt} is null
      and ${table.leaseKind} is null and ${table.leaseToken} is null and ${table.leaseExpiresAt} is null
    ) or (
      ${table.status} = 'delete_pending' and ${table.deleteRequestedAt} is not null and ${table.deletedAt} is null
      and ${table.leaseKind} is null and ${table.leaseToken} is null and ${table.leaseExpiresAt} is null
    ) or (
      ${table.status} = 'deleting' and ${table.deleteRequestedAt} is not null and ${table.deletedAt} is null
      and ${table.leaseKind} = 'delete' and ${table.leaseToken} is not null and ${table.leaseExpiresAt} is not null
    ) or (
      ${table.status} = 'deleted' and ${table.deleteRequestedAt} is not null and ${table.deletedAt} is not null
      and ${table.leaseKind} is null and ${table.leaseToken} is null and ${table.leaseExpiresAt} is null
    )`),
  scanOutcomeCheck: check("student_file_assets_scan_outcome_check", sql`${table.scanOutcome} is null or ${table.scanOutcome} in ('clean','malware','integrity_mismatch','scan_error')`),
}));

export const studentEducationHistories = pgTable("student_education_histories", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  revision: integer("revision").notNull().default(1),
  ...timestamps,
}, (table) => ({
  revisionCheck: check("student_education_histories_revision_check", sql`${table.revision} > 0`),
}));

export const studentEducationRecords = pgTable("student_education_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  institutionName: text("institution_name"),
  institutionCountry: text("institution_country"),
  educationLevel: text("education_level"),
  qualificationName: text("qualification_name"),
  fieldOfStudy: text("field_of_study"),
  attendanceStatus: text("attendance_status"),
  startYear: integer("start_year"),
  endYear: integer("end_year"),
  expectedCompletionYear: integer("expected_completion_year"),
  ...timestamps,
  removedAt: timestamp("removed_at", { withTimezone: true }),
}, (table) => ({
  activeUserIdx: index("student_education_records_active_user_idx").on(table.userId, table.createdAt, table.id).where(sql`${table.removedAt} is null`),
  historyFk: foreignKey({ name: "student_education_records_history_fk", columns: [table.userId], foreignColumns: [studentEducationHistories.userId] }).onDelete("cascade"),
  activeCheck: check("student_education_records_active_check", sql`${table.removedAt} is not null or (${table.institutionName} is not null and ${table.educationLevel} is not null and ${table.attendanceStatus} is not null)`),
  erasedCheck: check("student_education_records_erased_check", sql`${table.removedAt} is null or (${table.institutionName} is null and ${table.institutionCountry} is null and ${table.educationLevel} is null and ${table.qualificationName} is null and ${table.fieldOfStudy} is null and ${table.attendanceStatus} is null and ${table.startYear} is null and ${table.endYear} is null and ${table.expectedCompletionYear} is null)`),
  textCheck: check("student_education_records_text_check", sql`(${table.institutionName} is null or char_length(btrim(${table.institutionName})) between 1 and 200) and (${table.qualificationName} is null or char_length(btrim(${table.qualificationName})) between 1 and 200) and (${table.fieldOfStudy} is null or char_length(btrim(${table.fieldOfStudy})) between 1 and 200)`),
  countryCheck: check("student_education_records_country_check", sql`${table.institutionCountry} is null or ${table.institutionCountry} ~ '^[A-Z]{2}$'`),
  levelCheck: check("student_education_records_level_check", sql`${table.educationLevel} is null or ${table.educationLevel} in ('secondary', 'vocational', 'associate', 'bachelor', 'master', 'doctorate', 'other')`),
  statusCheck: check("student_education_records_status_check", sql`${table.attendanceStatus} is null or ${table.attendanceStatus} in ('unknown', 'in_progress', 'completed', 'discontinued')`),
  yearsCheck: check("student_education_records_years_check", sql`(${table.startYear} is null or ${table.startYear} between 1900 and 2199) and (${table.endYear} is null or ${table.endYear} between 1900 and 2199) and (${table.expectedCompletionYear} is null or ${table.expectedCompletionYear} between 1900 and 2199) and (${table.startYear} is null or ${table.endYear} is null or ${table.startYear} <= ${table.endYear}) and (${table.startYear} is null or ${table.expectedCompletionYear} is null or ${table.startYear} <= ${table.expectedCompletionYear})`),
  attendanceCheck: check("student_education_records_attendance_check", sql`(${table.attendanceStatus} is distinct from 'in_progress' or ${table.endYear} is null) and (${table.expectedCompletionYear} is null or ${table.attendanceStatus} = 'in_progress')`),
}));

export const studentAssessmentHistories = pgTable("student_assessment_histories", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  revision: integer("revision").notNull().default(1),
  ...timestamps,
}, (table) => ({
  revisionCheck: check("student_assessment_histories_revision_check", sql`${table.revision} > 0`),
}));

export const studentAssessmentRecords = pgTable("student_assessment_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  assessmentCategory: text("assessment_category"),
  assessmentName: text("assessment_name"),
  assessmentVariant: text("assessment_variant"),
  resultStatus: text("result_status"),
  resultForm: text("result_form"),
  testDate: date("test_date"),
  reportDate: date("report_date"),
  componentsJson: jsonb("components_json"),
  ...timestamps,
  removedAt: timestamp("removed_at", { withTimezone: true }),
}, (table) => ({
  activeUserIdx: index("student_assessment_records_active_user_idx").on(table.userId, table.createdAt, table.id).where(sql`${table.removedAt} is null`),
  historyFk: foreignKey({ name: "student_assessment_records_history_fk", columns: [table.userId], foreignColumns: [studentAssessmentHistories.userId] }).onDelete("cascade"),
  activeCheck: check("student_assessment_records_active_check", sql`${table.removedAt} is not null or (${table.assessmentCategory} is not null and ${table.assessmentName} is not null and ${table.resultStatus} is not null and ${table.resultForm} is not null and ${table.componentsJson} is not null)`),
  erasedCheck: check("student_assessment_records_erased_check", sql`${table.removedAt} is null or (${table.assessmentCategory} is null and ${table.assessmentName} is null and ${table.assessmentVariant} is null and ${table.resultStatus} is null and ${table.resultForm} is null and ${table.testDate} is null and ${table.reportDate} is null and ${table.componentsJson} is null)`),
  textCheck: check("student_assessment_records_text_check", sql`(${table.assessmentName} is null or char_length(btrim(${table.assessmentName})) between 1 and 120) and (${table.assessmentVariant} is null or char_length(btrim(${table.assessmentVariant})) between 1 and 160)`),
  categoryCheck: check("student_assessment_records_category_check", sql`${table.assessmentCategory} is null or ${table.assessmentCategory} in ('language', 'admissions', 'other')`),
  statusCheck: check("student_assessment_records_status_check", sql`${table.resultStatus} is null or ${table.resultStatus} in ('planned', 'awaiting_result', 'reported')`),
  formCheck: check("student_assessment_records_form_check", sql`${table.resultForm} is null or ${table.resultForm} in ('unspecified', 'single_sitting', 'combined', 'partial_retake')`),
  datesCheck: check("student_assessment_records_dates_check", sql`(${table.testDate} is null or ${table.testDate} between '1900-01-01'::date and '2199-12-31'::date) and (${table.reportDate} is null or ${table.reportDate} between '1900-01-01'::date and '2199-12-31'::date) and (${table.testDate} is null or ${table.reportDate} is null or ${table.testDate} <= ${table.reportDate})`),
  componentsCheck: check("student_assessment_records_components_check", sql`${table.componentsJson} is null or case when jsonb_typeof(${table.componentsJson}) = 'array' then jsonb_array_length(${table.componentsJson}) <= 20 and octet_length(${table.componentsJson}::text) <= 16384 else false end`),
  resultCheck: check("student_assessment_records_result_check", sql`${table.removedAt} is not null or case when jsonb_typeof(${table.componentsJson}) = 'array' then case when ${table.resultStatus} = 'reported' then jsonb_array_length(${table.componentsJson}) > 0 else jsonb_array_length(${table.componentsJson}) = 0 and ${table.reportDate} is null end else false end`),
}));

export const savedItems = pgTable(
  "saved_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    savedFromSurface: text("saved_from_surface").notNull().default("student"),
    notes: text("notes"),
    metadataJson: jsonb("metadata_json").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    removedAt: timestamp("removed_at", { withTimezone: true }),
  },
  (table) => ({
    activeUserEntityUnique: uniqueIndex("saved_items_active_user_entity_unique")
      .on(table.userId, table.entityType, table.entityId)
      .where(sql`${table.removedAt} is null`),
    userEntityIdx: index("saved_items_user_entity_idx").on(table.userId, table.entityType),
  }),
);

export const applicationReferenceCounters = pgTable(
  "application_reference_counters",
  {
    referenceYear: integer("reference_year").primaryKey(),
    lastIssuedSequence: integer("last_issued_sequence").notNull(),
    ...timestamps,
  },
  (table) => ({
    yearCheck: check("application_reference_counters_year_check", sql`${table.referenceYear} between 2020 and 9999`),
    sequenceCheck: check("application_reference_counters_sequence_check", sql`${table.lastIssuedSequence} between 1 and 999999`),
  }),
);

export const applicationSets = pgTable(
  "application_sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    status: text("status").notNull().default("draft"),
    cuacReferenceYear: integer("cuac_reference_year").notNull(),
    cuacReferenceSequence: integer("cuac_reference_sequence").notNull(),
    cuacId: text("cuac_id").notNull().generatedAlwaysAs(
      sql`'CUAC-' || lpad("cuac_reference_year"::text, 4, '0') || '-' || lpad("cuac_reference_sequence"::text, 6, '0')`,
    ),
    targetIntake: text("target_intake"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    revision: integer("revision").notNull().default(1),
    metadataJson: jsonb("metadata_json").notNull().default({}),
    ...timestamps,
  },
  (table) => ({
    userStatusIdx: index("application_sets_user_status_idx").on(table.userId, table.status),
    idUserUnique: uniqueIndex("application_sets_id_user_unique").on(table.id, table.userId),
    idCuacUnique: uniqueIndex("application_sets_id_cuac_id_unique").on(table.id, table.cuacId),
    cuacIdUnique: uniqueIndex("application_sets_cuac_id_unique").on(table.cuacId),
    cuacAllocationUnique: uniqueIndex("application_sets_cuac_allocation_unique").on(table.cuacReferenceYear, table.cuacReferenceSequence),
    cuacYearCheck: check("application_sets_cuac_year_check", sql`${table.cuacReferenceYear} between 2020 and 9999`),
    cuacSequenceCheck: check("application_sets_cuac_sequence_check", sql`${table.cuacReferenceSequence} between 1 and 999999`),
    revisionCheck: check("application_sets_revision_check", sql`${table.revision} > 0`),
  }),
);

export const opsSupportAccessSessions = pgTable(
  "ops_support_access_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: uuid("actor_user_id").notNull(),
    staffAccessGrantId: uuid("staff_access_grant_id").notNull(),
    activeRole: text("active_role").notNull(),
    applicationSetId: uuid("application_set_id").notNull(),
    cuacId: text("cuac_id").notNull(),
    reasonCode: text("reason_code").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    grantScopeFk: foreignKey({
      columns: [table.staffAccessGrantId, table.actorUserId, table.activeRole],
      foreignColumns: [cuacStaffAccessGrants.id, cuacStaffAccessGrants.userId, cuacStaffAccessGrants.requestedRole],
      name: "ops_support_access_sessions_grant_scope_fk",
    }).onDelete("restrict"),
    applicationScopeFk: foreignKey({
      columns: [table.applicationSetId, table.cuacId],
      foreignColumns: [applicationSets.id, applicationSets.cuacId],
      name: "ops_support_access_sessions_application_scope_fk",
    }).onDelete("restrict"),
    actorExpiryIdx: index("ops_support_access_sessions_actor_expiry_idx")
      .on(table.actorUserId, table.expiresAt, table.id),
    grantExpiryIdx: index("ops_support_access_sessions_grant_expiry_idx")
      .on(table.staffAccessGrantId, table.expiresAt),
    roleCheck: check("ops_support_access_sessions_role_check", sql`${table.activeRole} in ('cuac_ops','cuac_admin')`),
    cuacIdCheck: check("ops_support_access_sessions_cuac_id_check", sql`${table.cuacId} ~ '^CUAC-[0-9]{4}-[0-9]{6}$'`),
    reasonCheck: check("ops_support_access_sessions_reason_check", sql`${table.reasonCode} in (
      'student_inquiry','school_inquiry','payment_inquiry','delivery_investigation','incident_response'
    )`),
    lifecycleCheck: check("ops_support_access_sessions_lifecycle_check", sql`${table.expiresAt} > ${table.createdAt}
      and ${table.expiresAt} <= ${table.createdAt} + interval '15 minutes'
      and (${table.closedAt} is null or ${table.closedAt} >= ${table.createdAt})`),
  }),
);

export const applicationChoices = pgTable(
  "application_choices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationSetId: uuid("application_set_id")
      .notNull()
      .references(() => applicationSets.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    programId: uuid("program_id").references(() => programs.id, { onDelete: "set null" }),
    programIntakeId: uuid("program_intake_id"),
    admissionRouteKey: text("admission_route_key"),
    targetKey: text("target_key").notNull().generatedAlwaysAs(sql`coalesce("program_id"::text, '') || '/' || coalesce("program_intake_id"::text, '')`),
    scholarshipId: uuid("scholarship_id").references(() => scholarships.id, { onDelete: "set null" }),
    rankOrder: integer("rank_order").notNull().default(0),
    status: text("status").notNull().default("draft"),
    studentNotes: text("student_notes"),
    requirementSnapshotJson: jsonb("requirement_snapshot_json").notNull().default({}),
    metadataJson: jsonb("metadata_json").notNull().default({}),
    ...timestamps,
    removedAt: timestamp("removed_at", { withTimezone: true }),
  },
  (table) => ({
    setRankIdx: index("application_choices_set_rank_idx").on(table.applicationSetId, table.rankOrder),
    scopeUnique: uniqueIndex("application_choices_scope_unique").on(table.id, table.applicationSetId, table.userId, table.schoolId),
    targetUnique: uniqueIndex("application_choices_target_unique").on(table.id, table.targetKey),
    setOwnerFk: foreignKey({
      name: "application_choices_set_owner_fk",
      columns: [table.applicationSetId, table.userId],
      foreignColumns: [applicationSets.id, applicationSets.userId],
    }).onDelete("cascade"),
    programSchoolFk: foreignKey({
      name: "application_choices_program_school_fk",
      columns: [table.programId, table.schoolId],
      foreignColumns: [programs.id, programs.schoolId],
    }),
    userStatusIdx: index("application_choices_user_status_idx").on(table.userId, table.status),
    intakeProgramFk: foreignKey({
      name: "application_choices_intake_program_fk",
      columns: [table.programIntakeId, table.programId],
      foreignColumns: [programIntakes.id, programIntakes.programId],
    }).onDelete("restrict"),
    intakeProgramCheck: check("application_choices_intake_program_check", sql`${table.programIntakeId} is null or ${table.programId} is not null`),
    admissionRouteCheck: check("application_choices_admission_route_check",
      sql`${table.admissionRouteKey} is null or ${table.admissionRouteKey} ~ '^[a-z][a-z0-9_-]{0,63}$'`),
    intakeRouteIdx: index("application_choices_intake_route_idx").on(table.programIntakeId, table.admissionRouteKey)
      .where(sql`${table.removedAt} is null and ${table.admissionRouteKey} is not null`),
    activeSetProgramUnique: uniqueIndex("application_choices_active_set_program_unique")
      .on(table.applicationSetId, table.programId)
      .where(sql`${table.removedAt} is null and ${table.programId} is not null and ${table.programIntakeId} is null`),
    activeSetProgramIntakeUnique: uniqueIndex("application_choices_active_set_program_intake_unique")
      .on(table.applicationSetId, table.programId, table.programIntakeId)
      .where(sql`${table.removedAt} is null and ${table.programIntakeId} is not null`),
  }),
);

export const applicationMaterialSelections = pgTable("application_material_selections", {
  choiceId: uuid("choice_id").primaryKey(),
  applicationSetId: uuid("application_set_id").notNull(),
  userId: uuid("user_id").notNull(),
  schoolId: uuid("school_id").notNull(),
  programId: uuid("program_id").notNull(),
  programIntakeId: uuid("program_intake_id").notNull(),
  targetKey: text("target_key").notNull().generatedAlwaysAs(sql`coalesce("program_id"::text, '') || '/' || coalesce("program_intake_id"::text, '')`),
  revision: integer("revision").notNull().default(1),
  sourceSetRevision: integer("source_set_revision").notNull(),
  sourceApplicantRevision: integer("source_applicant_revision").notNull(),
  sourceEducationRevision: integer("source_education_revision").notNull(),
  sourceAssessmentRevision: integer("source_assessment_revision").notNull(),
  selectionJson: jsonb("selection_json").notNull(),
  ...timestamps,
}, table => ({
  choiceScopeFk: foreignKey({ name: "application_material_selection_scope_fk", columns: [table.choiceId, table.applicationSetId, table.userId, table.schoolId],
    foreignColumns: [applicationChoices.id, applicationChoices.applicationSetId, applicationChoices.userId, applicationChoices.schoolId] }).onDelete("cascade"),
  choiceTargetFk: foreignKey({ name: "application_material_selection_target_fk", columns: [table.choiceId, table.targetKey],
    foreignColumns: [applicationChoices.id, applicationChoices.targetKey] }),
  revisionCheck: check("application_material_selection_revision_check", sql`${table.revision} > 0 and ${table.sourceSetRevision} > 0 and ${table.sourceApplicantRevision} >= 0 and ${table.sourceEducationRevision} >= 0 and ${table.sourceAssessmentRevision} >= 0`),
  selectionCheck: check("application_material_selection_content_check", sql`jsonb_typeof(${table.selectionJson}) = 'object' and octet_length(${table.selectionJson}::text) <= 8192
    and ${table.selectionJson} ?& array['applicantFields','educationRecordIds','assessmentRecordIds']
    and ${table.selectionJson} - array['applicantFields','educationRecordIds','assessmentRecordIds'] = '{}'::jsonb
    and case when jsonb_typeof(${table.selectionJson}->'applicantFields') = 'array' and jsonb_typeof(${table.selectionJson}->'educationRecordIds') = 'array' and jsonb_typeof(${table.selectionJson}->'assessmentRecordIds') = 'array'
      then jsonb_array_length(${table.selectionJson}->'applicantFields') <= 3 and (${table.selectionJson}->'applicantFields') <@ '["fullName","contactEmail","citizenshipCountry"]'::jsonb
        and jsonb_array_length(${table.selectionJson}->'educationRecordIds') <= 20 and jsonb_array_length(${table.selectionJson}->'assessmentRecordIds') <= 40 else false end`),
}));

export const applicationSubmissionAuthorizations = pgTable("application_submission_authorizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  applicationSetId: uuid("application_set_id").notNull().references(() => applicationSets.id, { onDelete: "restrict" }),
  applicationChoiceId: uuid("application_choice_id").notNull().references(() => applicationChoices.id, { onDelete: "restrict" }),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "restrict" }),
  programId: uuid("program_id").notNull().references(() => programs.id, { onDelete: "restrict" }),
  programIntakeId: uuid("program_intake_id").notNull().references(() => programIntakes.id, { onDelete: "restrict" }),
  targetKey: text("target_key").notNull().generatedAlwaysAs(sql`"program_id"::text || '/' || "program_intake_id"::text`),
  authorizationFormat: text("authorization_format").notNull().default("cuac.application-submission-authorization.v2"),
  admissionRouteKey: text("admission_route_key"),
  policyVersionId: uuid("policy_version_id"),
  policyPublicationRevision: integer("policy_publication_revision"),
  policyDocumentSha256: text("policy_document_sha256"),
  policyTargetSetSha256: text("policy_target_set_sha256"),
  policyApprovalSha256: text("policy_approval_sha256"),
  purpose: text("purpose").notNull().default("application_submission"),
  materialSelectionRevision: integer("material_selection_revision").notNull(),
  sourceSetRevision: integer("source_set_revision").notNull(),
  sourceApplicantRevision: integer("source_applicant_revision").notNull(),
  sourceEducationRevision: integer("source_education_revision").notNull(),
  sourceAssessmentRevision: integer("source_assessment_revision").notNull(),
  selectionJson: jsonb("selection_json").notNull(),
  selectionSha256: text("selection_sha256").notNull(),
  materialContentSha256: text("material_content_sha256").notNull(),
  noticeScopeKey: text("notice_scope_key").notNull(),
  noticeLocale: text("notice_locale").notNull(),
  noticeVersionId: uuid("notice_version_id").notNull(),
  noticePublicationRevision: integer("notice_publication_revision").notNull(),
  noticeContentSha256: text("notice_content_sha256").notNull(),
  confirmationMethod: text("confirmation_method").notNull().default("authenticated_explicit_action"),
  scopeSha256: text("scope_sha256").notNull(),
  confirmedRequestId: text("confirmed_request_id").notNull(),
  status: text("status").notNull().default("active"),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  endReason: text("end_reason"),
  ...timestamps,
}, table => ({
  choiceScopeFk: foreignKey({ name: "application_submission_authorization_choice_scope_fk",
    columns: [table.applicationChoiceId, table.applicationSetId, table.userId, table.schoolId],
    foreignColumns: [applicationChoices.id, applicationChoices.applicationSetId, applicationChoices.userId, applicationChoices.schoolId] }).onDelete("restrict"),
  choiceTargetFk: foreignKey({ name: "application_submission_authorization_choice_target_fk",
    columns: [table.applicationChoiceId, table.targetKey], foreignColumns: [applicationChoices.id, applicationChoices.targetKey] }).onDelete("restrict"),
  programSchoolFk: foreignKey({ name: "application_submission_authorization_program_school_fk",
    columns: [table.programId, table.schoolId], foreignColumns: [programs.id, programs.schoolId] }).onDelete("restrict"),
  intakeProgramFk: foreignKey({ name: "application_submission_authorization_intake_program_fk",
    columns: [table.programIntakeId, table.programId], foreignColumns: [programIntakes.id, programIntakes.programId] }).onDelete("restrict"),
  noticeVersionScopeFk: foreignKey({ name: "application_submission_authorization_notice_version_fk",
    columns: [table.noticeVersionId, table.noticeScopeKey], foreignColumns: [privacyNoticeVersions.id, privacyNoticeVersions.scopeKey] }).onDelete("restrict"),
  policyTargetFk: foreignKey({ name: "application_submission_authorization_policy_target_fk",
    columns: [table.policyVersionId, table.programIntakeId, table.programId, table.schoolId, table.admissionRouteKey],
    foreignColumns: [officialSubmissionPolicyVersionTargets.policyVersionId, officialSubmissionPolicyVersionTargets.programIntakeId,
      officialSubmissionPolicyVersionTargets.programId, officialSubmissionPolicyVersionTargets.schoolId,
      officialSubmissionPolicyVersionTargets.admissionRouteKey] }).onDelete("restrict"),
  activeChoiceUnique: uniqueIndex("application_submission_authorization_active_choice_unique")
    .on(table.applicationChoiceId).where(sql`${table.status} = 'active'`),
  scopeUnique: uniqueIndex("application_submission_authorization_scope_unique").on(table.id, table.userId,
    table.applicationSetId, table.applicationChoiceId, table.schoolId, table.programId, table.programIntakeId),
  userChoiceIdx: index("application_submission_authorization_user_choice_idx").on(table.userId, table.applicationChoiceId, table.confirmedAt),
  policyIdx: index("application_submission_authorization_policy_idx").on(table.policyVersionId, table.programIntakeId,
    table.admissionRouteKey),
  versionCheck: check("application_submission_authorization_version_check", sql`${table.materialSelectionRevision} > 0 and ${table.sourceSetRevision} > 0
    and ${table.sourceApplicantRevision} >= 0 and ${table.sourceEducationRevision} >= 0 and ${table.sourceAssessmentRevision} >= 0
    and ${table.noticePublicationRevision} > 0`),
  selectionCheck: check("application_submission_authorization_selection_check", sql`jsonb_typeof(${table.selectionJson}) = 'object'
    and octet_length(${table.selectionJson}::text) <= 8192 and ${table.selectionJson} ?& array['applicantFields','educationRecordIds','assessmentRecordIds']
    and ${table.selectionJson} - array['applicantFields','educationRecordIds','assessmentRecordIds'] = '{}'::jsonb
    and case when jsonb_typeof(${table.selectionJson}->'applicantFields') = 'array'
      and jsonb_typeof(${table.selectionJson}->'educationRecordIds') = 'array'
      and jsonb_typeof(${table.selectionJson}->'assessmentRecordIds') = 'array'
      then jsonb_array_length(${table.selectionJson}->'applicantFields') <= 3
        and (${table.selectionJson}->'applicantFields') <@ '["fullName","contactEmail","citizenshipCountry"]'::jsonb
        and jsonb_array_length(${table.selectionJson}->'educationRecordIds') <= 20
        and jsonb_array_length(${table.selectionJson}->'assessmentRecordIds') <= 40 else false end`),
  digestCheck: check("application_submission_authorization_digest_check", sql`${table.selectionSha256} ~ '^[a-f0-9]{64}$'
    and ${table.materialContentSha256} ~ '^[a-f0-9]{64}$' and ${table.noticeContentSha256} ~ '^[a-f0-9]{64}$'
    and ${table.scopeSha256} ~ '^[a-f0-9]{64}$'`),
  policyBindingCheck: check("application_submission_authorization_policy_binding_check", sql`(
      ${table.authorizationFormat} = 'cuac.application-submission-authorization.v1'
      and ${table.admissionRouteKey} is null and ${table.policyVersionId} is null
      and ${table.policyPublicationRevision} is null and ${table.policyDocumentSha256} is null
      and ${table.policyTargetSetSha256} is null and ${table.policyApprovalSha256} is null
    ) or (
      ${table.authorizationFormat} = 'cuac.application-submission-authorization.v2'
      and ${table.admissionRouteKey} is not null and ${table.admissionRouteKey} ~ '^[a-z][a-z0-9_-]{0,63}$'
      and ${table.policyVersionId} is not null and ${table.policyPublicationRevision} is not null
      and ${table.policyPublicationRevision} > 0 and ${table.policyDocumentSha256} is not null
      and ${table.policyDocumentSha256} ~ '^[a-f0-9]{64}$' and ${table.policyTargetSetSha256} is not null
      and ${table.policyTargetSetSha256} ~ '^[a-f0-9]{64}$' and ${table.policyApprovalSha256} is not null
      and ${table.policyApprovalSha256} ~ '^[a-f0-9]{64}$'
    )`),
  noticeCheck: check("application_submission_authorization_notice_check", sql`${table.noticeLocale} in ('en','zh-CN')
    and ${table.noticeScopeKey} = 'application_disclosure:' || ${table.noticeLocale}`),
  confirmationCheck: check("application_submission_authorization_confirmation_check", sql`${table.purpose} = 'application_submission'
    and ${table.confirmationMethod} = 'authenticated_explicit_action' and char_length(${table.confirmedRequestId}) between 1 and 128`),
  lifecycleCheck: check("application_submission_authorization_lifecycle_check", sql`(${table.status} = 'active' and ${table.endedAt} is null and ${table.endReason} is null)
    or (${table.status} = 'withdrawn' and ${table.endedAt} is not null and ${table.confirmedAt} <= ${table.endedAt}
      and ${table.endReason} in ('student_withdrawal','choice_removed'))
    or (${table.status} = 'superseded' and ${table.endedAt} is not null and ${table.confirmedAt} <= ${table.endedAt}
      and ${table.endReason} = 'reauthorized')`),
}));

export const applicationMaterialSnapshots = pgTable("application_material_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  applicationSetId: uuid("application_set_id").notNull().references(() => applicationSets.id, { onDelete: "restrict" }),
  applicationChoiceId: uuid("application_choice_id").notNull().references(() => applicationChoices.id, { onDelete: "restrict" }),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "restrict" }),
  programId: uuid("program_id").notNull().references(() => programs.id, { onDelete: "restrict" }),
  programIntakeId: uuid("program_intake_id").notNull().references(() => programIntakes.id, { onDelete: "restrict" }),
  targetKey: text("target_key").notNull().generatedAlwaysAs(sql`"program_id"::text || '/' || "program_intake_id"::text`),
  authorizationId: uuid("authorization_id").notNull(),
  authorizationScopeSha256: text("authorization_scope_sha256").notNull(),
  materialSelectionRevision: integer("material_selection_revision").notNull(),
  sourceSetRevision: integer("source_set_revision").notNull(),
  sourceApplicantRevision: integer("source_applicant_revision").notNull(),
  sourceEducationRevision: integer("source_education_revision").notNull(),
  sourceAssessmentRevision: integer("source_assessment_revision").notNull(),
  selectionSha256: text("selection_sha256").notNull(),
  materialContentSha256: text("material_content_sha256").notNull(),
  payloadSha256: text("payload_sha256").notNull(),
  payloadBytes: integer("payload_bytes").notNull(),
  payloadFormat: text("payload_format").notNull().default("cuac.application-material-snapshot.v1"),
  encryptionScheme: text("encryption_scheme").notNull().default("aes-256-gcm-v1"),
  encryptionKeyId: text("encryption_key_id").notNull(),
  envelopeJson: jsonb("envelope_json").notNull(),
  capturedRequestId: text("captured_request_id").notNull(),
  capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
}, table => ({
  authorizationUnique: uniqueIndex("application_material_snapshot_authorization_unique").on(table.authorizationId),
  userChoiceIdx: index("application_material_snapshot_user_choice_idx").on(table.userId, table.applicationChoiceId, table.capturedAt),
  choiceScopeFk: foreignKey({ name: "application_material_snapshot_choice_scope_fk",
    columns: [table.applicationChoiceId, table.applicationSetId, table.userId, table.schoolId],
    foreignColumns: [applicationChoices.id, applicationChoices.applicationSetId, applicationChoices.userId, applicationChoices.schoolId] }).onDelete("restrict"),
  choiceTargetFk: foreignKey({ name: "application_material_snapshot_choice_target_fk",
    columns: [table.applicationChoiceId, table.targetKey], foreignColumns: [applicationChoices.id, applicationChoices.targetKey] }).onDelete("restrict"),
  authorizationScopeFk: foreignKey({ name: "application_material_snapshot_authorization_scope_fk",
    columns: [table.authorizationId, table.userId, table.applicationSetId, table.applicationChoiceId,
      table.schoolId, table.programId, table.programIntakeId],
    foreignColumns: [applicationSubmissionAuthorizations.id, applicationSubmissionAuthorizations.userId,
      applicationSubmissionAuthorizations.applicationSetId, applicationSubmissionAuthorizations.applicationChoiceId,
      applicationSubmissionAuthorizations.schoolId, applicationSubmissionAuthorizations.programId,
      applicationSubmissionAuthorizations.programIntakeId] }).onDelete("restrict"),
  programSchoolFk: foreignKey({ name: "application_material_snapshot_program_school_fk",
    columns: [table.programId, table.schoolId], foreignColumns: [programs.id, programs.schoolId] }).onDelete("restrict"),
  intakeProgramFk: foreignKey({ name: "application_material_snapshot_intake_program_fk",
    columns: [table.programIntakeId, table.programId], foreignColumns: [programIntakes.id, programIntakes.programId] }).onDelete("restrict"),
  versionCheck: check("application_material_snapshot_version_check", sql`${table.materialSelectionRevision} > 0
    and ${table.sourceSetRevision} > 0 and ${table.sourceApplicantRevision} >= 0
    and ${table.sourceEducationRevision} >= 0 and ${table.sourceAssessmentRevision} >= 0`),
  digestCheck: check("application_material_snapshot_digest_check", sql`${table.authorizationScopeSha256} ~ '^[a-f0-9]{64}$'
    and ${table.selectionSha256} ~ '^[a-f0-9]{64}$' and ${table.materialContentSha256} ~ '^[a-f0-9]{64}$'
    and ${table.payloadSha256} ~ '^[a-f0-9]{64}$'`),
  formatCheck: check("application_material_snapshot_format_check", sql`${table.payloadFormat} = 'cuac.application-material-snapshot.v1'
    and ${table.encryptionScheme} = 'aes-256-gcm-v1' and ${table.encryptionKeyId} ~ '^[A-Za-z0-9_-]{1,64}$'
    and ${table.payloadBytes} between 1 and 409600 and char_length(${table.capturedRequestId}) between 1 and 128`),
  envelopeCheck: check("application_material_snapshot_envelope_check", sql`jsonb_typeof(${table.envelopeJson}) = 'object'
    and ${table.envelopeJson} ?& array['version','keyId','nonce','ciphertext','tag']
    and ${table.envelopeJson} - array['version','keyId','nonce','ciphertext','tag'] = '{}'::jsonb
    and ${table.envelopeJson}->'version' = '1'::jsonb
    and jsonb_typeof(${table.envelopeJson}->'keyId') = 'string' and ${table.envelopeJson}->>'keyId' = ${table.encryptionKeyId}
    and (${table.envelopeJson}->>'keyId') ~ '^[A-Za-z0-9_-]{1,64}$'
    and jsonb_typeof(${table.envelopeJson}->'nonce') = 'string' and (${table.envelopeJson}->>'nonce') ~ '^[A-Za-z0-9_-]{16}$'
    and jsonb_typeof(${table.envelopeJson}->'tag') = 'string' and (${table.envelopeJson}->>'tag') ~ '^[A-Za-z0-9_-]{22}$'
    and jsonb_typeof(${table.envelopeJson}->'ciphertext') = 'string'
    and char_length(${table.envelopeJson}->>'ciphertext') between 2 and 546136
    and (${table.envelopeJson}->>'ciphertext') ~ '^[A-Za-z0-9_-]+$'`),
  submissionScopeUnique: uniqueIndex("application_material_snapshot_submission_scope_unique").on(table.id,
    table.userId, table.applicationSetId, table.applicationChoiceId, table.schoolId, table.programId,
    table.programIntakeId, table.authorizationId),
}));

export const applicationSubmissions = pgTable("application_submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  applicationSetId: uuid("application_set_id").notNull().references(() => applicationSets.id, { onDelete: "restrict" }),
  submissionFormat: text("submission_format").notNull().default("cuac.application-submission.v1"),
  sourceSetRevision: integer("source_set_revision").notNull(),
  choiceCount: integer("choice_count").notNull(),
  groupCount: integer("group_count").notNull(),
  manifestSha256: text("manifest_sha256").notNull(),
  confirmationMethod: text("confirmation_method").notNull().default("authenticated_explicit_action"),
  confirmedRequestId: text("confirmed_request_id").notNull(),
  status: text("status").notNull().default("accepted"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull(),
  ...timestamps,
}, table => ({
  setOwnerFk: foreignKey({ name: "application_submissions_set_owner_fk",
    columns: [table.applicationSetId, table.userId],
    foreignColumns: [applicationSets.id, applicationSets.userId] }).onDelete("restrict"),
  setUnique: uniqueIndex("application_submissions_set_unique").on(table.applicationSetId),
  scopeUnique: uniqueIndex("application_submissions_scope_unique").on(table.id, table.userId, table.applicationSetId),
  formatCheck: check("application_submissions_format_check", sql`${table.submissionFormat} = 'cuac.application-submission.v1'
    and ${table.confirmationMethod} = 'authenticated_explicit_action'
    and char_length(${table.confirmedRequestId}) between 1 and 128`),
  countCheck: check("application_submissions_count_check", sql`${table.sourceSetRevision} > 0
    and ${table.choiceCount} between 1 and 20 and ${table.groupCount} between 1 and ${table.choiceCount}`),
  manifestCheck: check("application_submissions_manifest_check", sql`${table.manifestSha256} ~ '^[a-f0-9]{64}$'`),
  lifecycleCheck: check("application_submissions_lifecycle_check", sql`${table.status} = 'accepted'
    and ${table.createdAt} <= ${table.submittedAt}`),
}));

export const studentApplicationCommandReceipts = pgTable("student_application_command_receipts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  operation: text("operation").notNull(),
  keyHash: text("key_hash").notNull(),
  requestHash: text("request_hash").notNull(),
  resourceId: uuid("resource_id"),
  originalRequestId: text("original_request_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`clock_timestamp()`),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => ({
  ownerFk: foreignKey({ name: "student_application_command_receipts_user_id_fkey", columns: [table.userId], foreignColumns: [users.id] }).onDelete("cascade"),
  scopeUnique: uniqueIndex("student_application_commands_scope_unique").on(table.userId, table.operation, table.keyHash),
  operationCheck: check("student_application_commands_operation_check", sql`${table.operation} in ('application_set.create', 'application_choice.add', 'application_authorization.record', 'application_material_snapshot.create', 'application.submit')`),
  hashCheck: check("student_application_commands_hash_check", sql`${table.keyHash} ~ '^[a-f0-9]{64}$' and ${table.requestHash} ~ '^[a-f0-9]{64}$'`),
  completionCheck: check("student_application_commands_completion_check", sql`(${table.resourceId} is null) = (${table.completedAt} is null)`),
}));

export const applicationChoiceStatusEvents = pgTable(
  "application_choice_status_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationChoiceId: uuid("application_choice_id")
      .notNull()
      .references(() => applicationChoices.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    reason: text("reason"),
    metadataJson: jsonb("metadata_json").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    choiceCreatedIdx: index("application_choice_status_events_choice_created_idx").on(table.applicationChoiceId, table.createdAt),
  }),
);

export const schoolApplications = pgTable(
  "school_applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationRecordFormat: text("application_record_format").notNull().default("cuac.program-application.v2"),
    applicationSubmissionId: uuid("application_submission_id"),
    applicationSetId: uuid("application_set_id")
      .notNull()
      .references(() => applicationSets.id, { onDelete: "cascade" }),
    cuacId: text("cuac_id"),
    applicationChoiceId: uuid("application_choice_id")
      .notNull()
      .references(() => applicationChoices.id, { onDelete: "cascade" }),
    studentUserId: uuid("student_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    programId: uuid("program_id").references(() => programs.id, { onDelete: "restrict" }),
    programIntakeId: uuid("program_intake_id"),
    targetKey: text("target_key").notNull().generatedAlwaysAs(sql`coalesce("program_id"::text, '') || '/' || coalesce("program_intake_id"::text, '')`),
    admissionRouteKey: text("admission_route_key"),
    authorizationId: uuid("authorization_id"),
    materialSnapshotId: uuid("material_snapshot_id"),
    feeEntitlementId: uuid("fee_entitlement_id"),
    requirementVersionId: uuid("requirement_version_id"),
    requirementPublicationRevision: integer("requirement_publication_revision"),
    requirementContentSha256: text("requirement_content_sha256"),
    policyVersionId: uuid("policy_version_id"),
    policyPublicationRevision: integer("policy_publication_revision"),
    policyDocumentSha256: text("policy_document_sha256"),
    policyTargetSetSha256: text("policy_target_set_sha256"),
    policyApprovalSha256: text("policy_approval_sha256"),
    status: text("status").notNull().default("pending_submission"),
    schoolRevision: integer("school_revision").notNull().default(1),
    statusChangedAt: timestamp("status_changed_at", { withTimezone: true }).notNull().default(sql`clock_timestamp()`),
    schoolVisibleProfileJson: jsonb("school_visible_profile_json").notNull().default({}),
    routingMetadataJson: jsonb("routing_metadata_json").notNull().default({}),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    firstViewedAt: timestamp("first_viewed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    choiceUnique: uniqueIndex("school_applications_choice_unique").on(table.applicationChoiceId),
    idSchoolUnique: uniqueIndex("school_applications_id_school_unique").on(table.id, table.schoolId),
    submissionEvidenceUnique: uniqueIndex("school_applications_submission_evidence_unique").on(table.id,
      table.applicationSubmissionId, table.studentUserId, table.applicationSetId, table.schoolId,
      table.programId, table.programIntakeId, table.admissionRouteKey, table.policyVersionId,
      table.applicationChoiceId, table.authorizationId, table.materialSnapshotId, table.feeEntitlementId),
    submissionScopeFk: foreignKey({
      name: "school_applications_submission_scope_fk",
      columns: [table.applicationSubmissionId, table.studentUserId, table.applicationSetId],
      foreignColumns: [applicationSubmissions.id, applicationSubmissions.userId, applicationSubmissions.applicationSetId],
    }).onDelete("restrict"),
    choiceTargetFk: foreignKey({
      name: "school_applications_choice_target_fk",
      columns: [table.applicationChoiceId, table.targetKey],
      foreignColumns: [applicationChoices.id, applicationChoices.targetKey],
    }).onDelete("cascade"),
    choiceScopeFk: foreignKey({
      name: "school_applications_choice_scope_fk",
      columns: [table.applicationChoiceId, table.applicationSetId, table.studentUserId, table.schoolId],
      foreignColumns: [applicationChoices.id, applicationChoices.applicationSetId, applicationChoices.userId, applicationChoices.schoolId],
    }).onDelete("cascade"),
    programSchoolFk: foreignKey({
      name: "school_applications_program_school_fk",
      columns: [table.programId, table.schoolId],
      foreignColumns: [programs.id, programs.schoolId],
    }),
    intakeProgramFk: foreignKey({
      name: "school_applications_intake_program_fk",
      columns: [table.programIntakeId, table.programId],
      foreignColumns: [programIntakes.id, programIntakes.programId],
    }).onDelete("restrict"),
    authorizationScopeFk: foreignKey({
      name: "school_applications_authorization_scope_fk",
      columns: [table.authorizationId, table.studentUserId, table.applicationSetId, table.applicationChoiceId,
        table.schoolId, table.programId, table.programIntakeId],
      foreignColumns: [applicationSubmissionAuthorizations.id, applicationSubmissionAuthorizations.userId,
        applicationSubmissionAuthorizations.applicationSetId, applicationSubmissionAuthorizations.applicationChoiceId,
        applicationSubmissionAuthorizations.schoolId, applicationSubmissionAuthorizations.programId,
        applicationSubmissionAuthorizations.programIntakeId],
    }).onDelete("restrict"),
    snapshotScopeFk: foreignKey({
      name: "school_applications_snapshot_scope_fk",
      columns: [table.materialSnapshotId, table.studentUserId, table.applicationSetId, table.applicationChoiceId,
        table.schoolId, table.programId, table.programIntakeId, table.authorizationId],
      foreignColumns: [applicationMaterialSnapshots.id, applicationMaterialSnapshots.userId,
        applicationMaterialSnapshots.applicationSetId, applicationMaterialSnapshots.applicationChoiceId,
        applicationMaterialSnapshots.schoolId, applicationMaterialSnapshots.programId,
        applicationMaterialSnapshots.programIntakeId, applicationMaterialSnapshots.authorizationId],
    }).onDelete("restrict"),
    entitlementScopeFk: foreignKey({
      name: "school_applications_entitlement_scope_fk",
      columns: [table.feeEntitlementId, table.studentUserId, table.applicationSetId, table.applicationChoiceId,
        table.schoolId, table.programId, table.programIntakeId, table.admissionRouteKey],
      foreignColumns: [applicationFeeEntitlements.id, applicationFeeEntitlements.userId,
        applicationFeeEntitlements.applicationSetId, applicationFeeEntitlements.applicationChoiceId,
        applicationFeeEntitlements.schoolId, applicationFeeEntitlements.programId,
        applicationFeeEntitlements.programIntakeId, applicationFeeEntitlements.admissionRouteKey],
    }).onDelete("restrict"),
    requirementScopeFk: foreignKey({
      name: "school_applications_requirement_scope_fk",
      columns: [table.requirementVersionId, table.programIntakeId],
      foreignColumns: [programRequirementVersions.id, programRequirementVersions.programIntakeId],
    }).onDelete("restrict"),
    policyTargetFk: foreignKey({
      name: "school_applications_policy_target_fk",
      columns: [table.policyVersionId, table.programIntakeId, table.programId, table.schoolId, table.admissionRouteKey],
      foreignColumns: [officialSubmissionPolicyVersionTargets.policyVersionId,
        officialSubmissionPolicyVersionTargets.programIntakeId, officialSubmissionPolicyVersionTargets.programId,
        officialSubmissionPolicyVersionTargets.schoolId, officialSubmissionPolicyVersionTargets.admissionRouteKey],
    }).onDelete("restrict"),
    formatCheck: check("school_applications_format_check", sql`(
        ${table.applicationRecordFormat} = 'cuac.program-application.v1'
        and ${table.applicationSubmissionId} is null and ${table.admissionRouteKey} is null
        and ${table.authorizationId} is null and ${table.materialSnapshotId} is null
        and ${table.feeEntitlementId} is null and ${table.requirementVersionId} is null
        and ${table.requirementPublicationRevision} is null and ${table.requirementContentSha256} is null
        and ${table.policyVersionId} is null and ${table.policyPublicationRevision} is null
        and ${table.policyDocumentSha256} is null and ${table.policyTargetSetSha256} is null
        and ${table.policyApprovalSha256} is null and ${table.acceptedAt} is null
      ) or (
        ${table.applicationRecordFormat} = 'cuac.program-application.v2'
        and ${table.applicationSubmissionId} is not null and ${table.programId} is not null
        and ${table.programIntakeId} is not null and ${table.admissionRouteKey} is not null
        and ${table.admissionRouteKey} ~ '^[a-z][a-z0-9_-]{0,63}$'
        and ${table.authorizationId} is not null and ${table.materialSnapshotId} is not null
        and ${table.feeEntitlementId} is not null and ${table.requirementVersionId} is not null
        and ${table.requirementPublicationRevision} > 0
        and ${table.requirementContentSha256} ~ '^[a-f0-9]{64}$'
        and ${table.policyVersionId} is not null and ${table.policyPublicationRevision} > 0
        and ${table.policyDocumentSha256} ~ '^[a-f0-9]{64}$'
        and ${table.policyTargetSetSha256} ~ '^[a-f0-9]{64}$'
        and ${table.policyApprovalSha256} ~ '^[a-f0-9]{64}$'
        and ${table.acceptedAt} is not null
      )`),
    schoolStatusIdx: index("school_applications_school_status_idx").on(table.schoolId, table.status),
    schoolCuacIdIdx: index("school_applications_school_cuac_id_idx").on(table.schoolId, table.cuacId),
    studentStatusIdx: index("school_applications_student_status_idx").on(table.studentUserId, table.status),
    cuacIdCheck: check("school_applications_cuac_id_check", sql`${table.cuacId} is null or ${table.cuacId} ~ '^CUAC-[0-9]{4}-[0-9]{6}$'`),
    cuacIdRequiredCheck: check("school_applications_v2_cuac_id_required_check",
      sql`${table.applicationRecordFormat} = 'cuac.program-application.v1' or ${table.cuacId} is not null`),
    cuacScopeFk: foreignKey({
      name: "school_applications_cuac_scope_fk",
      columns: [table.applicationSetId, table.cuacId],
      foreignColumns: [applicationSets.id, applicationSets.cuacId],
    }).onDelete("cascade"),
    workflowCheck: check("school_applications_workflow_check", sql`${table.schoolRevision} between 1 and 2147483647
      and isfinite(${table.statusChangedAt})
      and (
        (${table.applicationRecordFormat} = 'cuac.program-application.v1'
          and ${table.status} in ('pending_submission','submitted','under_review','new','needs_review','contact_queued',
            'contacted','waiting_for_documents','documents_received_by_school','not_a_fit',
            'converted_to_official_application','archived'))
        or (${table.applicationRecordFormat} = 'cuac.program-application.v2'
          and ${table.status} in ('pending_submission','new','needs_review','contact_queued','contacted',
            'waiting_for_documents','documents_received_by_school','not_a_fit',
            'converted_to_official_application','archived')
          and ((${table.status} = 'pending_submission' and ${table.submittedAt} is null)
            or (${table.status} <> 'pending_submission' and ${table.submittedAt} is not null
              and isfinite(${table.submittedAt}))))
      )`),
  }),
);

export const officialSubmissionGroups = pgTable("official_submission_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicationSubmissionId: uuid("application_submission_id").notNull(),
  userId: uuid("user_id").notNull(),
  applicationSetId: uuid("application_set_id").notNull(),
  schoolId: uuid("school_id").notNull(),
  groupFormat: text("group_format").notNull().default("cuac.official-submission-group.v1"),
  admissionRouteKey: text("admission_route_key").notNull(),
  policyVersionId: uuid("policy_version_id").notNull(),
  policyDocumentSha256: text("policy_document_sha256").notNull(),
  policyTargetSetSha256: text("policy_target_set_sha256").notNull(),
  policyApprovalSha256: text("policy_approval_sha256").notNull(),
  formMode: text("form_mode").notNull(),
  maxProgramChoices: integer("max_program_choices").notNull(),
  orderingMode: text("ordering_mode").notNull(),
  externalChannelType: text("external_channel_type").notNull(),
  groupSequence: integer("group_sequence").notNull(),
  memberCount: integer("member_count").notNull(),
  memberManifestSha256: text("member_manifest_sha256").notNull(),
  transportStatus: text("transport_status").notNull().default("pending"),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull(),
  ...timestamps,
}, table => ({
  submissionScopeFk: foreignKey({ name: "official_submission_groups_submission_scope_fk",
    columns: [table.applicationSubmissionId, table.userId, table.applicationSetId],
    foreignColumns: [applicationSubmissions.id, applicationSubmissions.userId,
      applicationSubmissions.applicationSetId] }).onDelete("restrict"),
  schoolFk: foreignKey({ name: "official_submission_groups_school_fk", columns: [table.schoolId],
    foreignColumns: [schools.id] }).onDelete("restrict"),
  policyScopeFk: foreignKey({ name: "official_submission_groups_policy_scope_fk",
    columns: [table.policyVersionId, table.schoolId, table.admissionRouteKey],
    foreignColumns: [officialSubmissionPolicyVersions.id, officialSubmissionPolicyVersions.schoolId,
      officialSubmissionPolicyVersions.admissionRouteKey] }).onDelete("restrict"),
  sequenceUnique: uniqueIndex("official_submission_groups_sequence_unique").on(table.applicationSubmissionId,
    table.groupSequence),
  scopeUnique: uniqueIndex("official_submission_groups_scope_unique").on(table.id,
    table.applicationSubmissionId, table.userId, table.applicationSetId, table.schoolId,
    table.admissionRouteKey, table.policyVersionId),
  dispatchScopeUnique: uniqueIndex("official_submission_groups_dispatch_scope_unique").on(table.id,
    table.applicationSubmissionId, table.schoolId),
  formatCheck: check("official_submission_groups_format_check", sql`${table.groupFormat} = 'cuac.official-submission-group.v1'
    and ${table.admissionRouteKey} ~ '^[a-z][a-z0-9_-]{0,63}$'
    and ${table.policyDocumentSha256} ~ '^[a-f0-9]{64}$'
    and ${table.policyTargetSetSha256} ~ '^[a-f0-9]{64}$'
    and ${table.policyApprovalSha256} ~ '^[a-f0-9]{64}$'
    and ${table.memberManifestSha256} ~ '^[a-f0-9]{64}$'`),
  ruleCheck: check("official_submission_groups_rule_check", sql`${table.formMode} in ('one_program_per_form','multi_program_form')
    and ${table.maxProgramChoices} between 1 and 20 and ${table.orderingMode} in ('none','ranked')
    and ${table.externalChannelType} in ('university_portal','approved_manual_handoff')
    and ${table.groupSequence} > 0 and ${table.memberCount} between 1 and ${table.maxProgramChoices}
    and (${table.formMode} = 'multi_program_form' or ${table.memberCount} = 1)`),
  stateCheck: check("official_submission_groups_state_check", sql`${table.transportStatus} in ('pending','leased','dispatched','quarantined')
    and ${table.createdAt} <= ${table.acceptedAt}`),
}));

export const officialSubmissionGroupMembers = pgTable("official_submission_group_members", {
  groupId: uuid("group_id").notNull(),
  applicationSubmissionId: uuid("application_submission_id").notNull(),
  userId: uuid("user_id").notNull(),
  applicationSetId: uuid("application_set_id").notNull(),
  schoolId: uuid("school_id").notNull(),
  admissionRouteKey: text("admission_route_key").notNull(),
  policyVersionId: uuid("policy_version_id").notNull(),
  schoolApplicationId: uuid("school_application_id").notNull(),
  applicationChoiceId: uuid("application_choice_id").notNull(),
  programId: uuid("program_id").notNull(),
  programIntakeId: uuid("program_intake_id").notNull(),
  authorizationId: uuid("authorization_id").notNull(),
  materialSnapshotId: uuid("material_snapshot_id").notNull(),
  feeEntitlementId: uuid("fee_entitlement_id").notNull(),
  memberPosition: integer("member_position").notNull(),
  memberManifestSha256: text("member_manifest_sha256").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => ({
  pk: primaryKey({ name: "official_submission_group_members_pk", columns: [table.groupId, table.memberPosition] }),
  applicationUnique: uniqueIndex("official_submission_group_members_application_unique").on(table.schoolApplicationId),
  groupScopeFk: foreignKey({ name: "official_submission_group_members_group_scope_fk",
    columns: [table.groupId, table.applicationSubmissionId, table.userId, table.applicationSetId,
      table.schoolId, table.admissionRouteKey, table.policyVersionId],
    foreignColumns: [officialSubmissionGroups.id, officialSubmissionGroups.applicationSubmissionId,
      officialSubmissionGroups.userId, officialSubmissionGroups.applicationSetId,
      officialSubmissionGroups.schoolId, officialSubmissionGroups.admissionRouteKey,
      officialSubmissionGroups.policyVersionId] }).onDelete("restrict"),
  applicationEvidenceFk: foreignKey({ name: "official_submission_group_members_application_evidence_fk",
    columns: [table.schoolApplicationId, table.applicationSubmissionId, table.userId, table.applicationSetId,
      table.schoolId, table.programId, table.programIntakeId, table.admissionRouteKey, table.policyVersionId,
      table.applicationChoiceId, table.authorizationId, table.materialSnapshotId, table.feeEntitlementId],
    foreignColumns: [schoolApplications.id, schoolApplications.applicationSubmissionId,
      schoolApplications.studentUserId, schoolApplications.applicationSetId, schoolApplications.schoolId,
      schoolApplications.programId, schoolApplications.programIntakeId, schoolApplications.admissionRouteKey,
      schoolApplications.policyVersionId, schoolApplications.applicationChoiceId,
      schoolApplications.authorizationId, schoolApplications.materialSnapshotId,
      schoolApplications.feeEntitlementId] }).onDelete("restrict"),
  policyTargetFk: foreignKey({ name: "official_submission_group_members_policy_target_fk",
    columns: [table.policyVersionId, table.programIntakeId, table.programId, table.schoolId,
      table.admissionRouteKey],
    foreignColumns: [officialSubmissionPolicyVersionTargets.policyVersionId,
      officialSubmissionPolicyVersionTargets.programIntakeId, officialSubmissionPolicyVersionTargets.programId,
      officialSubmissionPolicyVersionTargets.schoolId,
      officialSubmissionPolicyVersionTargets.admissionRouteKey] }).onDelete("restrict"),
  positionCheck: check("official_submission_group_members_position_check", sql`${table.memberPosition} > 0
    and ${table.admissionRouteKey} ~ '^[a-z][a-z0-9_-]{0,63}$'
    and ${table.memberManifestSha256} ~ '^[a-f0-9]{64}$'`),
}));

export const officialSubmissionOutbox = pgTable("official_submission_outbox", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id").notNull(),
  applicationSubmissionId: uuid("application_submission_id").notNull(),
  schoolId: uuid("school_id").notNull(),
  eventType: text("event_type").notNull().default("official_submission.dispatch_requested"),
  payloadFormat: text("payload_format").notNull().default("cuac.official-submission-dispatch.v1"),
  manifestSha256: text("manifest_sha256").notNull(),
  status: text("status").notNull().default("pending"),
  attemptCount: integer("attempt_count").notNull().default(0),
  availableAt: timestamp("available_at", { withTimezone: true }).notNull(),
  leaseToken: uuid("lease_token"),
  leasedAt: timestamp("leased_at", { withTimezone: true }),
  leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
  lastErrorCode: text("last_error_code"),
  payloadSha256: text("payload_sha256"),
  providerName: text("provider_name"),
  outcome: text("outcome"),
  providerReceiptId: text("provider_receipt_id"),
  providerReceivedAt: timestamp("provider_received_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
  quarantinedAt: timestamp("quarantined_at", { withTimezone: true }),
  ...timestamps,
}, table => ({
  groupFk: foreignKey({ name: "official_submission_outbox_group_fk",
    columns: [table.groupId, table.applicationSubmissionId, table.schoolId],
    foreignColumns: [officialSubmissionGroups.id, officialSubmissionGroups.applicationSubmissionId,
      officialSubmissionGroups.schoolId] }).onDelete("restrict"),
  groupUnique: uniqueIndex("official_submission_outbox_group_unique").on(table.groupId),
  deliveryScopeUnique: uniqueIndex("official_submission_outbox_delivery_scope_unique")
    .on(table.id, table.groupId, table.applicationSubmissionId, table.schoolId),
  pendingIdx: index("official_submission_outbox_pending_idx").on(table.status, table.availableAt, table.id),
  formatCheck: check("official_submission_outbox_format_check", sql`${table.eventType} = 'official_submission.dispatch_requested'
    and ${table.payloadFormat} = 'cuac.official-submission-dispatch.v1'
    and ${table.manifestSha256} ~ '^[a-f0-9]{64}$' and ${table.attemptCount} between 0 and 5
    and (${table.payloadSha256} is null or ${table.payloadSha256} ~ '^[a-f0-9]{64}$')
    and (${table.providerName} is null or ${table.providerName} ~ '^[a-z][a-z0-9_-]{0,63}$')
    and ((${table.providerName} is null and ${table.payloadSha256} is null)
      or (${table.providerName} is not null and ${table.payloadSha256} is not null))
    and (${table.providerReceiptId} is null or (char_length(${table.providerReceiptId}) between 1 and 128
      and ${table.providerReceiptId} ~ '^[A-Za-z0-9._:-]+$'))
    and (${table.lastErrorCode} is null or ${table.lastErrorCode} ~ '^[A-Z0-9_]{1,64}$')
    and (${table.outcome} is null or ${table.outcome} in ('accepted','not_accepted','unknown','invalid_payload','attempt_limit','lease_expired'))`),
  lifecycleCheck: check("official_submission_outbox_lifecycle_check", sql`(
      ${table.status} = 'pending' and ${table.leaseToken} is null and ${table.leasedAt} is null
      and ${table.leaseExpiresAt} is null and ${table.dispatchedAt} is null and ${table.quarantinedAt} is null
      and ${table.completedAt} is null and ${table.providerReceiptId} is null and ${table.providerReceivedAt} is null
      and (${table.outcome} is null or ${table.outcome} in ('not_accepted','lease_expired'))
    ) or (
      ${table.status} = 'leased' and ${table.leaseToken} is not null and ${table.leasedAt} is not null
      and ${table.leaseExpiresAt} is not null and ${table.leasedAt} < ${table.leaseExpiresAt}
      and ${table.dispatchedAt} is null and ${table.quarantinedAt} is null and ${table.completedAt} is null
      and ${table.providerReceiptId} is null and ${table.providerReceivedAt} is null
    ) or (
      ${table.status} = 'sending' and ${table.leaseToken} is not null and ${table.leasedAt} is not null
      and ${table.leaseExpiresAt} is not null and ${table.leasedAt} < ${table.leaseExpiresAt}
      and ${table.attemptCount} between 1 and 5 and ${table.providerName} is not null and ${table.payloadSha256} is not null
      and ${table.dispatchedAt} is null and ${table.quarantinedAt} is null and ${table.completedAt} is null
      and ${table.providerReceiptId} is null and ${table.providerReceivedAt} is null
    ) or (
      ${table.status} = 'dispatched' and ${table.leaseToken} is null and ${table.leasedAt} is null
      and ${table.leaseExpiresAt} is null and ${table.dispatchedAt} is not null and ${table.quarantinedAt} is null
      and ${table.completedAt} is not null and ${table.outcome} = 'accepted' and ${table.providerName} is not null
      and ${table.payloadSha256} is not null and ${table.providerReceiptId} is not null
      and ${table.providerReceivedAt} is not null and isfinite(${table.providerReceivedAt})
    ) or (
      ${table.status} = 'quarantined' and ${table.leaseToken} is null and ${table.leasedAt} is null
      and ${table.leaseExpiresAt} is null and ${table.dispatchedAt} is null and ${table.quarantinedAt} is not null
      and ${table.completedAt} is not null and ${table.outcome} in ('unknown','invalid_payload','attempt_limit')
      and ${table.providerReceiptId} is null and ${table.providerReceivedAt} is null
    )`),
}));

export const officialSubmissionDeliveryReceipts = pgTable("official_submission_delivery_receipts", {
  id: uuid("id").primaryKey().defaultRandom(),
  outboxId: uuid("outbox_id").notNull(),
  groupId: uuid("group_id").notNull(),
  applicationSubmissionId: uuid("application_submission_id").notNull(),
  schoolId: uuid("school_id").notNull(),
  providerName: text("provider_name").notNull(),
  providerReceiptId: text("provider_receipt_id").notNull(),
  providerReceivedAt: timestamp("provider_received_at", { withTimezone: true }).notNull(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }).notNull().default(sql`clock_timestamp()`),
  payloadSha256: text("payload_sha256").notNull(),
  manifestSha256: text("manifest_sha256").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`clock_timestamp()`),
}, table => ({
  outboxScopeFk: foreignKey({ name: "official_submission_delivery_receipts_outbox_scope_fk",
    columns: [table.outboxId, table.groupId, table.applicationSubmissionId, table.schoolId],
    foreignColumns: [officialSubmissionOutbox.id, officialSubmissionOutbox.groupId,
      officialSubmissionOutbox.applicationSubmissionId, officialSubmissionOutbox.schoolId] }).onDelete("restrict"),
  outboxUnique: uniqueIndex("official_submission_delivery_receipts_outbox_unique").on(table.outboxId),
  providerReceiptUnique: uniqueIndex("official_submission_delivery_receipts_provider_receipt_unique")
    .on(table.providerName, table.providerReceiptId),
  valueCheck: check("official_submission_delivery_receipts_value_check", sql`${table.providerName} ~ '^[a-z][a-z0-9_-]{0,63}$'
    and char_length(${table.providerReceiptId}) between 1 and 128
    and ${table.providerReceiptId} ~ '^[A-Za-z0-9._:-]+$'
    and ${table.payloadSha256} ~ '^[a-f0-9]{64}$' and ${table.manifestSha256} ~ '^[a-f0-9]{64}$'
    and isfinite(${table.providerReceivedAt}) and isfinite(${table.confirmedAt})
    and ${table.providerReceivedAt} <= ${table.confirmedAt} + interval '5 minutes'
    and ${table.createdAt} >= ${table.confirmedAt}`),
}));

export const schoolApplicationStatusEvents = pgTable(
  "school_application_status_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolApplicationId: uuid("school_application_id")
      .notNull()
      .references(() => schoolApplications.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    reason: text("reason"),
    applicationRevision: integer("application_revision"),
    commandKeyHash: text("command_key_hash"),
    requestHash: text("request_hash"),
    metadataJson: jsonb("metadata_json").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    applicationCreatedIdx: index("school_application_status_events_application_created_idx").on(
      table.schoolApplicationId,
      table.createdAt,
    ),
    commandUnique: uniqueIndex("school_application_status_events_command_unique")
      .on(table.schoolApplicationId, table.actorUserId, table.commandKeyHash)
      .where(sql`${table.commandKeyHash} is not null`),
    workflowCheck: check("school_application_status_events_workflow_check", sql`(
        ${table.applicationRevision} is null and ${table.commandKeyHash} is null and ${table.requestHash} is null
      ) or (
        ${table.applicationRevision} = 1 and ${table.actorUserId} is null
        and ${table.commandKeyHash} is null and ${table.requestHash} is null
        and ${table.fromStatus} = 'pending_submission' and ${table.toStatus} = 'new'
        and ${table.reason} is null
      ) or (
        ${table.applicationRevision} between 2 and 2147483647 and ${table.actorUserId} is not null
        and ${table.commandKeyHash} ~ '^[a-f0-9]{64}$' and ${table.requestHash} ~ '^[a-f0-9]{64}$'
        and ${table.fromStatus} in ('new','needs_review','contact_queued','contacted','waiting_for_documents',
          'documents_received_by_school')
        and ${table.toStatus} in ('needs_review','contact_queued','contacted','waiting_for_documents',
          'documents_received_by_school','not_a_fit','converted_to_official_application','archived')
        and (${table.reason} is null or (char_length(${table.reason}) between 1 and 500))
      )`),
  }),
);

export const schoolApplicationContactLogs = pgTable("school_application_contact_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolApplicationId: uuid("school_application_id").notNull(),
  schoolId: uuid("school_id").notNull(),
  actorUserId: uuid("actor_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  channel: text("channel").notNull(),
  direction: text("direction").notNull(),
  outcome: text("outcome").notNull(),
  note: text("note").notNull(),
  commandKeyHash: text("command_key_hash").notNull(),
  requestHash: text("request_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`clock_timestamp()`),
}, table => ({
  applicationScopeFk: foreignKey({ name: "school_application_contact_logs_application_scope_fk",
    columns: [table.schoolApplicationId, table.schoolId],
    foreignColumns: [schoolApplications.id, schoolApplications.schoolId] }).onDelete("cascade"),
  schoolFk: foreignKey({ name: "school_application_contact_logs_school_id_fkey", columns: [table.schoolId],
    foreignColumns: [schools.id] }).onDelete("restrict"),
  commandUnique: uniqueIndex("school_application_contact_logs_command_unique")
    .on(table.schoolApplicationId, table.actorUserId, table.commandKeyHash),
  applicationCreatedIdx: index("school_application_contact_logs_application_created_idx")
    .on(table.schoolApplicationId, table.createdAt, table.id),
  valueCheck: check("school_application_contact_logs_value_check", sql`${table.channel} in ('email','phone','whatsapp','in_person','other')
    and ${table.direction} in ('outbound','inbound')
    and ${table.outcome} in ('attempted','reached','replied','follow_up_required')
    and char_length(${table.note}) between 1 and 2000
    and ${table.commandKeyHash} ~ '^[a-f0-9]{64}$' and ${table.requestHash} ~ '^[a-f0-9]{64}$'
    and isfinite(${table.createdAt})`),
}));

export const agentPersonaSessions = pgTable(
  "agent_persona_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    anonymousSessionHash: text("anonymous_session_hash"),
    selectedSurface: text("selected_surface").notNull(),
    activeRole: text("active_role").notNull(),
    contextScope: text("context_scope").notNull(),
    tenantSchoolId: uuid("tenant_school_id").references(() => schools.id, { onDelete: "cascade" }),
    memoryNamespace: text("memory_namespace"),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (table) => ({
    userScopeStatusIdx: index("agent_persona_sessions_user_scope_status_idx").on(table.userId, table.contextScope, table.status),
    anonymousStatusIdx: index("agent_persona_sessions_anonymous_status_idx").on(table.anonymousSessionHash, table.status),
    tenantStatusIdx: index("agent_persona_sessions_tenant_status_idx").on(table.tenantSchoolId, table.status),
  }),
);

export const agentToolRateLimitBuckets = pgTable(
  "agent_tool_rate_limit_buckets",
  {
    toolKey: text("tool_key").notNull(),
    keyHash: text("key_hash").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    windowSeconds: integer("window_seconds").notNull(),
    attemptCount: integer("attempt_count").notNull().default(1),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    toolKeyWindowUnique: uniqueIndex("agent_tool_rate_limit_buckets_tool_key_hash_window_unique")
      .on(table.toolKey, table.keyHash, table.windowStart),
    keyExpiresIdx: index("agent_tool_rate_limit_buckets_key_expires_idx").on(table.keyHash, table.expiresAt),
    toolExpiresIdx: index("agent_tool_rate_limit_buckets_tool_expires_idx").on(table.toolKey, table.expiresAt),
    toolKeyCheck: check("agent_tool_rate_limit_buckets_tool_key_check",
      sql`${table.toolKey} ~ '^[a-z][a-z0-9_.]{2,95}$'`),
    keyHashCheck: check("agent_tool_rate_limit_buckets_key_hash_check",
      sql`${table.keyHash} ~ '^sha256:[a-f0-9]{64}$'`),
    windowCheck: check("agent_tool_rate_limit_buckets_window_check",
      sql`${table.windowSeconds} between 1 and 86400 and ${table.attemptCount} between 1 and 2147483647
        and isfinite(${table.windowStart}) and isfinite(${table.expiresAt}) and isfinite(${table.lastAttemptAt})
        and ${table.expiresAt} = ${table.windowStart} + (${table.windowSeconds} * interval '1 second')
        and ${table.lastAttemptAt} >= ${table.windowStart} and ${table.lastAttemptAt} < ${table.expiresAt}`),
  }),
);

export const agentStudentMemorySettings = pgTable("agent_student_memory_settings", {
  userId: uuid("user_id").primaryKey(),
  enabled: boolean("enabled").notNull().default(true),
  revision: integer("revision").notNull().default(1),
  resetAt: timestamp("reset_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  ownerFk: foreignKey({ name: "agent_student_memory_settings_user_id_fkey", columns: [table.userId], foreignColumns: [users.id] }).onDelete("cascade"),
  revisionCheck: check("agent_student_memory_settings_revision_check", sql`${table.revision} > 0`),
}));

export const agentContextCandidates = pgTable(
  "agent_context_candidates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    anonymousSessionHash: text("anonymous_session_hash"),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    continuationId: uuid("continuation_id").references(() => signInContinuations.id, { onDelete: "set null" }),
    candidateType: text("candidate_type").notNull(),
    contextScope: text("context_scope").notNull(),
    activeRole: text("active_role").notNull(),
    tenantSchoolId: uuid("tenant_school_id").references(() => schools.id, { onDelete: "cascade" }),
    memoryNamespace: text("memory_namespace"),
    dataClass: text("data_class").notNull(),
    confidence: text("confidence").notNull(),
    summary: text("summary").notNull(),
    structuredJson: jsonb("structured_json").notNull().default({}),
    sourceEntityIdsJson: jsonb("source_entity_ids_json").notNull().default([]),
    status: text("status").notNull().default("proposed"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    payloadClearedAt: timestamp("payload_cleared_at", { withTimezone: true }),
  },
  (table) => ({
    userStatusIdx: index("agent_context_candidates_user_status_idx").on(table.userId, table.status),
    cleanupIdx: index("agent_context_candidates_cleanup_idx").on(table.status, table.expiresAt, table.id).where(sql`${table.payloadClearedAt} is null`),
    anonymousStatusIdx: index("agent_context_candidates_anonymous_status_idx").on(table.anonymousSessionHash, table.status),
    guestPendingCapacityIdx: index("agent_context_candidates_guest_pending_capacity_idx").on(table.anonymousSessionHash, table.expiresAt).where(sql`${table.payloadClearedAt} is null
      and ${table.status} = 'proposed' and ${table.contextScope} = 'guest_page' and ${table.activeRole} = 'guest'
      and ${table.userId} is null and ${table.tenantSchoolId} is null and ${table.memoryNamespace} is null`),
    studentPendingCapacityIdx: index("agent_context_candidates_student_pending_capacity_idx").on(table.userId, table.expiresAt).where(sql`${table.payloadClearedAt} is null
      and ${table.status} = 'proposed' and ${table.contextScope} = 'student_account' and ${table.activeRole} = 'student'
      and ${table.anonymousSessionHash} is null and ${table.tenantSchoolId} is null`),
    continuationStatusIdx: index("agent_context_candidates_continuation_status_idx").on(table.continuationId, table.status),
    tenantStatusIdx: index("agent_context_candidates_tenant_status_idx").on(table.tenantSchoolId, table.status),
  }),
);

export const agentMemoryEntries = pgTable(
  "agent_memory_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    memoryType: text("memory_type").notNull(),
    contextScope: text("context_scope").notNull(),
    activeRole: text("active_role").notNull(),
    tenantSchoolId: uuid("tenant_school_id").references(() => schools.id, { onDelete: "cascade" }),
    memoryNamespace: text("memory_namespace").notNull(),
    dataClass: text("data_class").notNull(),
    confidence: text("confidence").notNull(),
    summary: text("summary").notNull(),
    structuredJson: jsonb("structured_json").notNull().default({}),
    source: text("source").notNull(),
    sourceCandidateId: uuid("source_candidate_id").references(() => agentContextCandidates.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    clearedAt: timestamp("cleared_at", { withTimezone: true }),
  },
  (table) => ({
    sourceCandidateUnique: uniqueIndex("agent_memory_entries_source_candidate_unique").on(table.sourceCandidateId),
    namespaceActiveIdx: index("agent_memory_entries_namespace_active_idx").on(table.memoryNamespace, table.clearedAt),
    userScopeIdx: index("agent_memory_entries_user_scope_idx").on(table.userId, table.contextScope),
    tenantScopeIdx: index("agent_memory_entries_tenant_scope_idx").on(table.tenantSchoolId, table.contextScope),
    studentExpiryCleanupIdx: index("agent_memory_entries_student_expiry_cleanup_idx").on(table.expiresAt, table.id).where(sql`${table.clearedAt} is null
      and ${table.contextScope} = 'student_account' and ${table.activeRole} = 'student'
      and ${table.tenantSchoolId} is null and ${table.dataClass} = 'low_sensitive_preference'`),
    studentRetentionCheck: check("agent_memory_entries_student_retention_check", sql`not (
      ${table.clearedAt} is null and ${table.contextScope} = 'student_account' and ${table.activeRole} = 'student'
      and ${table.tenantSchoolId} is null and ${table.dataClass} = 'low_sensitive_preference'
    ) or (${table.expiresAt} is not null and isfinite(${table.createdAt}) and isfinite(${table.expiresAt})
      and ${table.expiresAt} <= ${table.createdAt} + interval '365 days')`),
  }),
);

export const billingCustomers = pgTable(
  "billing_customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerCustomerId: text("provider_customer_id"),
    status: text("status").notNull().default("active"),
    metadataJson: jsonb("metadata_json").notNull().default({}),
    ...timestamps,
  },
  (table) => ({
    userProviderUnique: uniqueIndex("billing_customers_user_provider_unique").on(table.userId, table.provider),
    providerCustomerIdx: index("billing_customers_provider_customer_idx").on(table.provider, table.providerCustomerId),
  }),
);

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    applicationSetId: uuid("application_set_id").references(() => applicationSets.id, { onDelete: "set null" }),
    cuacId: text("cuac_id"),
    billingCustomerId: uuid("billing_customer_id").references(() => billingCustomers.id, { onDelete: "set null" }),
    status: text("status").notNull().default("draft"),
    currency: text("currency").notNull(),
    subtotalMinor: integer("subtotal_minor").notNull().default(0),
    discountMinor: integer("discount_minor").notNull().default(0),
    totalMinor: integer("total_minor").notNull().default(0),
    provider: text("provider"),
    providerInvoiceId: text("provider_invoice_id"),
    idempotencyKey: text("idempotency_key").notNull(),
    metadataJson: jsonb("metadata_json").notNull().default({}),
    ...timestamps,
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
  },
  (table) => ({
    idempotencyKeyUnique: uniqueIndex("invoices_idempotency_key_unique").on(table.idempotencyKey),
    idOwnerSetUnique: uniqueIndex("invoices_id_user_set_unique").on(table.id, table.userId, table.applicationSetId),
    userStatusIdx: index("invoices_user_status_idx").on(table.userId, table.status),
    applicationSetIdx: index("invoices_application_set_idx").on(table.applicationSetId),
    cuacIdIdx: index("invoices_cuac_id_idx").on(table.cuacId),
    providerInvoiceIdx: index("invoices_provider_invoice_idx").on(table.provider, table.providerInvoiceId),
    lifecycleCheck: check("invoices_lifecycle_check", sql`(
        ${table.status} = 'draft' and ${table.finalizedAt} is null and ${table.voidedAt} is null
      ) or (
        ${table.status} = 'paid' and ${table.finalizedAt} is not null and ${table.voidedAt} is null
      ) or (
        ${table.status} = 'void' and ${table.finalizedAt} is null and ${table.voidedAt} is not null
      )`),
    amountCheck: check("invoices_amount_check", sql`${table.currency} ~ '^[A-Z]{3}$'
      and ${table.subtotalMinor} >= 0 and ${table.discountMinor} >= 0
      and ${table.totalMinor} = ${table.subtotalMinor} - ${table.discountMinor}`),
    cuacIdCheck: check("invoices_cuac_id_check", sql`${table.cuacId} is null or ${table.cuacId} ~ '^CUAC-[0-9]{4}-[0-9]{6}$'`),
  }),
);

export const invoiceLines = pgTable(
  "invoice_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    applicationChoiceId: uuid("application_choice_id").references(() => applicationChoices.id, { onDelete: "set null" }),
    lineFormat: text("line_format").notNull().default("cuac.invoice-line.v2"),
    userId: uuid("user_id").references(() => users.id, { onDelete: "restrict" }),
    applicationSetId: uuid("application_set_id").references(() => applicationSets.id, { onDelete: "restrict" }),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "restrict" }),
    programId: uuid("program_id").references(() => programs.id, { onDelete: "restrict" }),
    programIntakeId: uuid("program_intake_id").references(() => programIntakes.id, { onDelete: "restrict" }),
    admissionRouteKey: text("admission_route_key"),
    targetKey: text("target_key").generatedAlwaysAs(sql`case when "program_id" is not null and "program_intake_id" is not null then "program_id"::text || '/' || "program_intake_id"::text end`),
    lineType: text("line_type").notNull(),
    feeCode: text("fee_code"),
    description: text("description").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull(),
    pricingBasisSha256: text("pricing_basis_sha256"),
    metadataJson: jsonb("metadata_json").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    invoiceScopeFk: foreignKey({ name: "invoice_lines_invoice_scope_fk",
      columns: [table.invoiceId, table.userId, table.applicationSetId],
      foreignColumns: [invoices.id, invoices.userId, invoices.applicationSetId] }).onDelete("restrict"),
    choiceScopeFk: foreignKey({ name: "invoice_lines_choice_scope_fk",
      columns: [table.applicationChoiceId, table.applicationSetId, table.userId, table.schoolId],
      foreignColumns: [applicationChoices.id, applicationChoices.applicationSetId,
        applicationChoices.userId, applicationChoices.schoolId] }).onDelete("restrict"),
    choiceTargetFk: foreignKey({ name: "invoice_lines_choice_target_fk",
      columns: [table.applicationChoiceId, table.targetKey],
      foreignColumns: [applicationChoices.id, applicationChoices.targetKey] }).onDelete("restrict"),
    programSchoolFk: foreignKey({ name: "invoice_lines_program_school_fk",
      columns: [table.programId, table.schoolId], foreignColumns: [programs.id, programs.schoolId] }).onDelete("restrict"),
    intakeProgramFk: foreignKey({ name: "invoice_lines_intake_program_fk",
      columns: [table.programIntakeId, table.programId],
      foreignColumns: [programIntakes.id, programIntakes.programId] }).onDelete("restrict"),
    invoiceIdx: index("invoice_lines_invoice_idx").on(table.invoiceId),
    choiceIdx: index("invoice_lines_choice_idx").on(table.applicationChoiceId),
    evidenceUnique: uniqueIndex("invoice_lines_entitlement_evidence_unique").on(table.id, table.invoiceId,
      table.userId, table.applicationSetId, table.applicationChoiceId, table.schoolId, table.programId,
      table.programIntakeId, table.admissionRouteKey, table.lineFormat, table.lineType, table.feeCode,
      table.amountMinor, table.currency, table.pricingBasisSha256),
    applicationFeeUnique: uniqueIndex("invoice_lines_v2_application_fee_unique")
      .on(table.invoiceId, table.applicationChoiceId, table.feeCode)
      .where(sql`${table.lineFormat} = 'cuac.invoice-line.v2' and ${table.lineType} = 'application_fee'`),
    setFeeUnique: uniqueIndex("invoice_lines_v2_set_fee_unique")
      .on(table.invoiceId, table.feeCode)
      .where(sql`${table.lineFormat} = 'cuac.invoice-line.v2' and ${table.applicationChoiceId} is null`),
    formatCheck: check("invoice_lines_format_check", sql`(
        ${table.lineFormat} = 'cuac.invoice-line.v1'
        and ${table.userId} is null and ${table.applicationSetId} is null and ${table.schoolId} is null
        and ${table.programId} is null and ${table.programIntakeId} is null and ${table.admissionRouteKey} is null
        and ${table.feeCode} is null and ${table.pricingBasisSha256} is null
      ) or (
        ${table.lineFormat} = 'cuac.invoice-line.v2' and ${table.userId} is not null
        and ${table.applicationSetId} is not null and ${table.feeCode} is not null
        and ${table.pricingBasisSha256} is not null and ${table.pricingBasisSha256} ~ '^[a-f0-9]{64}$'
        and ${table.amountMinor} >= 0 and ${table.currency} ~ '^[A-Z]{3}$'
        and char_length(${table.description}) between 1 and 256
        and ((
          ${table.lineType} = 'application_fee' and ${table.feeCode} = 'application_submission'
          and ${table.applicationChoiceId} is not null and ${table.schoolId} is not null
          and ${table.programId} is not null and ${table.programIntakeId} is not null
          and ${table.admissionRouteKey} is not null and ${table.admissionRouteKey} ~ '^[a-z][a-z0-9_-]{0,63}$'
        ) or (
          ${table.lineType} = 'service_fee' and ${table.feeCode} = 'cuac_service'
          and ${table.applicationChoiceId} is null and ${table.schoolId} is null
          and ${table.programId} is null and ${table.programIntakeId} is null
          and ${table.admissionRouteKey} is null
        ))
      )`),
  }),
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerPaymentId: text("provider_payment_id"),
    providerCheckoutSessionId: text("provider_checkout_session_id"),
    status: text("status").notNull().default("requires_payment"),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull(),
    failureCode: text("failure_code"),
    failureMessagePublic: text("failure_message_public"),
    metadataJson: jsonb("metadata_json").notNull().default({}),
    ...timestamps,
    paidAt: timestamp("paid_at", { withTimezone: true }),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
  },
  (table) => ({
    idInvoiceOwnerUnique: uniqueIndex("payments_id_invoice_user_unique").on(table.id, table.invoiceId, table.userId),
    invoiceUnique: uniqueIndex("payments_invoice_unique").on(table.invoiceId),
    invoiceStatusIdx: index("payments_invoice_status_idx").on(table.invoiceId, table.status),
    userStatusIdx: index("payments_user_status_idx").on(table.userId, table.status),
    providerPaymentIdx: index("payments_provider_payment_idx").on(table.provider, table.providerPaymentId),
    providerPaymentUnique: uniqueIndex("payments_provider_payment_unique")
      .on(table.provider, table.providerPaymentId).where(sql`${table.providerPaymentId} is not null`),
    providerCheckoutIdx: index("payments_provider_checkout_idx").on(table.provider, table.providerCheckoutSessionId),
    providerCheckoutUnique: uniqueIndex("payments_provider_checkout_unique")
      .on(table.provider, table.providerCheckoutSessionId).where(sql`${table.providerCheckoutSessionId} is not null`),
    lifecycleCheck: check("payments_lifecycle_check", sql`(
        ${table.status} = 'requires_payment' and ${table.paidAt} is null
        and ${table.canceledAt} is null and ${table.refundedAt} is null
      ) or (
        ${table.status} = 'succeeded' and ${table.paidAt} is not null
        and ${table.canceledAt} is null and ${table.refundedAt} is null
      ) or (
        ${table.status} = 'canceled' and ${table.paidAt} is null
        and ${table.canceledAt} is not null and ${table.refundedAt} is null
      ) or (
        ${table.status} = 'refunded' and ${table.paidAt} is not null
        and ${table.canceledAt} is null and ${table.refundedAt} is not null
      )`),
    amountCheck: check("payments_amount_check", sql`${table.amountMinor} >= 0 and ${table.currency} ~ '^[A-Z]{3}$'`),
  }),
);

export const paymentStatusEvents = pgTable(
  "payment_status_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    providerEventId: text("provider_event_id"),
    reasonPublic: text("reason_public"),
    metadataJson: jsonb("metadata_json").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    idPaymentStatusUnique: uniqueIndex("payment_status_events_id_payment_status_unique")
      .on(table.id, table.paymentId, table.toStatus),
    paymentCreatedIdx: index("payment_status_events_payment_created_idx").on(table.paymentId, table.createdAt),
    providerEventIdx: index("payment_status_events_provider_event_idx").on(table.providerEventId),
    statusCheck: check("payment_status_events_status_check", sql`${table.toStatus} in ('succeeded','canceled','refunded')
      and (${table.fromStatus} is null or ${table.fromStatus} in ('requires_payment','succeeded','canceled','refunded'))`),
  }),
);

export const paymentProviderEvents = pgTable(
  "payment_provider_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").notNull(),
    providerEventId: text("provider_event_id").notNull(),
    eventType: text("event_type").notNull(),
    payloadSha256: text("payload_sha256").notNull(),
    invoiceId: uuid("invoice_id").notNull().references(() => invoices.id, { onDelete: "restrict" }),
    paymentId: uuid("payment_id").references(() => payments.id, { onDelete: "restrict" }),
    providerCheckoutSessionId: text("provider_checkout_session_id").notNull(),
    providerPaymentId: text("provider_payment_id"),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    state: text("state").notNull().default("pending"),
    outcome: text("outcome"),
    attemptCount: integer("attempt_count").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    quarantinedAt: timestamp("quarantined_at", { withTimezone: true }),
    quarantineReason: text("quarantine_reason"),
    ...timestamps,
  },
  table => ({
    providerEventUnique: uniqueIndex("payment_provider_events_provider_event_unique")
      .on(table.provider, table.providerEventId),
    pendingIdx: index("payment_provider_events_pending_idx").on(table.state, table.nextAttemptAt, table.receivedAt),
    invoiceIdx: index("payment_provider_events_invoice_idx").on(table.invoiceId, table.receivedAt),
    paymentIdx: index("payment_provider_events_payment_idx").on(table.paymentId, table.receivedAt),
    formatCheck: check("payment_provider_events_format_check", sql`${table.provider} ~ '^[a-z][a-z0-9_-]{0,63}$'
      and char_length(${table.providerEventId}) between 1 and 128
      and ${table.eventType} in ('payment.succeeded','payment.canceled','payment.refunded')
      and ${table.payloadSha256} ~ '^[a-f0-9]{64}$'
      and char_length(${table.providerCheckoutSessionId}) between 1 and 256
      and (${table.providerPaymentId} is null or char_length(${table.providerPaymentId}) between 1 and 256)
      and (${table.eventType} = 'payment.canceled' or ${table.providerPaymentId} is not null)
      and ${table.amountMinor} >= 0 and ${table.currency} ~ '^[A-Z]{3}$'
      and ${table.attemptCount} between 0 and 100 and isfinite(${table.occurredAt})
      and isfinite(${table.nextAttemptAt}) and isfinite(${table.receivedAt})`),
    lifecycleCheck: check("payment_provider_events_lifecycle_check", sql`(
        ${table.state} = 'pending' and ${table.outcome} is null and ${table.processedAt} is null
        and ${table.quarantinedAt} is null and ${table.quarantineReason} is null
      ) or (
        ${table.state} = 'processed' and ${table.outcome} in (
          'applied_succeeded','applied_canceled','applied_refunded','already_applied'
        ) and ${table.processedAt} is not null and ${table.quarantinedAt} is null
        and ${table.quarantineReason} is null
      ) or (
        ${table.state} = 'quarantined' and ${table.outcome} is null and ${table.processedAt} is null
        and ${table.quarantinedAt} is not null and char_length(${table.quarantineReason}) between 1 and 128
      )`),
  }),
);

export const opsPaymentEventReviews = pgTable(
  "ops_payment_event_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    paymentProviderEventId: uuid("payment_provider_event_id").notNull().references(() => paymentProviderEvents.id, { onDelete: "restrict" }),
    revision: integer("revision").notNull().default(1),
    status: text("status").notNull().default("investigating"),
    assignedUserId: uuid("assigned_user_id").notNull(),
    assignedGrantId: uuid("assigned_grant_id").notNull(),
    assignedRole: text("assigned_role").notNull(),
    escalationCode: text("escalation_code"),
    escalationReference: text("escalation_reference"),
    escalatedAt: timestamp("escalated_at", { withTimezone: true }),
    resolvedByUserId: uuid("resolved_by_user_id"),
    resolvedByGrantId: uuid("resolved_by_grant_id"),
    resolvedByRole: text("resolved_by_role"),
    resolutionCode: text("resolution_code"),
    resolutionReference: text("resolution_reference"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    ...timestamps,
  },
  table => ({
    eventUnique: uniqueIndex("ops_payment_event_reviews_event_unique").on(table.paymentProviderEventId),
    statusUpdatedIdx: index("ops_payment_event_reviews_status_updated_idx").on(table.status, table.updatedAt, table.id),
    assigneeStatusIdx: index("ops_payment_event_reviews_assignee_status_idx").on(table.assignedUserId, table.status, table.updatedAt),
    assignedGrantScopeFk: foreignKey({
      columns: [table.assignedGrantId, table.assignedUserId, table.assignedRole],
      foreignColumns: [cuacStaffAccessGrants.id, cuacStaffAccessGrants.userId, cuacStaffAccessGrants.requestedRole],
      name: "ops_payment_event_reviews_assigned_grant_scope_fk",
    }).onDelete("restrict"),
    resolvedGrantScopeFk: foreignKey({
      columns: [table.resolvedByGrantId, table.resolvedByUserId, table.resolvedByRole],
      foreignColumns: [cuacStaffAccessGrants.id, cuacStaffAccessGrants.userId, cuacStaffAccessGrants.requestedRole],
      name: "ops_payment_event_reviews_resolved_grant_scope_fk",
    }).onDelete("restrict"),
    revisionCheck: check("ops_payment_event_reviews_revision_check", sql`${table.revision} between 1 and 2147483647`),
    roleCheck: check("ops_payment_event_reviews_role_check", sql`${table.assignedRole} in ('cuac_ops','cuac_admin')
      and (${table.resolvedByRole} is null or ${table.resolvedByRole} = 'cuac_admin')`),
    referenceCheck: check("ops_payment_event_reviews_reference_check", sql`(${table.escalationReference} is null
        or ${table.escalationReference} ~ '^[A-Za-z0-9._:-]{1,128}$')
      and (${table.resolutionReference} is null or ${table.resolutionReference} ~ '^[A-Za-z0-9._:-]{1,128}$')`),
    lifecycleCheck: check("ops_payment_event_reviews_lifecycle_check", sql`${table.updatedAt} >= ${table.createdAt}
      and isfinite(${table.createdAt}) and isfinite(${table.updatedAt})
      and (${table.resolvedByUserId} is null or ${table.resolvedByUserId} <> ${table.assignedUserId})
      and (
        (${table.status} = 'investigating' and ${table.revision} = 1
          and ${table.escalationCode} is null and ${table.escalationReference} is null and ${table.escalatedAt} is null
          and ${table.resolvedByUserId} is null and ${table.resolvedByGrantId} is null and ${table.resolvedByRole} is null
          and ${table.resolutionCode} is null and ${table.resolutionReference} is null and ${table.resolvedAt} is null)
        or (${table.status} = 'escalated' and ${table.revision} = 2
          and ${table.escalationCode} in ('provider_investigation_required','finance_approval_required','security_investigation_required','internal_data_repair_required')
          and ${table.escalationReference} is not null and ${table.escalatedAt} is not null and isfinite(${table.escalatedAt})
          and ${table.resolvedByUserId} is null and ${table.resolvedByGrantId} is null and ${table.resolvedByRole} is null
          and ${table.resolutionCode} is null and ${table.resolutionReference} is null and ${table.resolvedAt} is null)
        or (${table.status} = 'resolved_no_change' and ${table.revision} in (2,3)
          and ((${table.escalationCode} is null and ${table.escalationReference} is null and ${table.escalatedAt} is null)
            or (${table.escalationCode} in ('provider_investigation_required','finance_approval_required','security_investigation_required','internal_data_repair_required')
              and ${table.escalationReference} is not null and ${table.escalatedAt} is not null and isfinite(${table.escalatedAt})))
          and ${table.resolvedByUserId} is not null and ${table.resolvedByGrantId} is not null and ${table.resolvedByRole} = 'cuac_admin'
          and ${table.resolutionCode} in ('provider_confirmed_no_change','duplicate_event_no_change','invalid_event_no_change','superseded_by_provider_case')
          and ${table.resolutionReference} is not null and ${table.resolvedAt} is not null and isfinite(${table.resolvedAt}))
      )`),
  }),
);

export const opsSubmissionDeliveryReviews = pgTable(
  "ops_submission_delivery_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    officialSubmissionOutboxId: uuid("official_submission_outbox_id").notNull()
      .references(() => officialSubmissionOutbox.id, { onDelete: "restrict" }),
    sourceOutcome: text("source_outcome").notNull(),
    sourceErrorCode: text("source_error_code").notNull(),
    sourceAttemptCount: integer("source_attempt_count").notNull(),
    sourceQuarantinedAt: timestamp("source_quarantined_at", { withTimezone: true }).notNull(),
    revision: integer("revision").notNull().default(1),
    status: text("status").notNull().default("investigating"),
    assignedUserId: uuid("assigned_user_id").notNull(),
    assignedGrantId: uuid("assigned_grant_id").notNull(),
    assignedRole: text("assigned_role").notNull(),
    escalationCode: text("escalation_code"),
    escalationReference: text("escalation_reference"),
    escalatedAt: timestamp("escalated_at", { withTimezone: true }),
    resolvedByUserId: uuid("resolved_by_user_id"),
    resolvedByGrantId: uuid("resolved_by_grant_id"),
    resolvedByRole: text("resolved_by_role"),
    resolutionCode: text("resolution_code"),
    resolutionReference: text("resolution_reference"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    ...timestamps,
  },
  table => ({
    outboxGenerationUnique: uniqueIndex("ops_submission_delivery_reviews_outbox_generation_unique")
      .on(table.officialSubmissionOutboxId, table.sourceQuarantinedAt),
    retryApprovalUnique: uniqueIndex("ops_submission_delivery_reviews_retry_approval_unique")
      .on(table.officialSubmissionOutboxId)
      .where(sql`${table.status} = 'retry_approved'`),
    statusUpdatedIdx: index("ops_submission_delivery_reviews_status_updated_idx").on(table.status, table.updatedAt, table.id),
    assigneeStatusIdx: index("ops_submission_delivery_reviews_assignee_status_idx")
      .on(table.assignedUserId, table.status, table.updatedAt),
    assignedGrantScopeFk: foreignKey({
      columns: [table.assignedGrantId, table.assignedUserId, table.assignedRole],
      foreignColumns: [cuacStaffAccessGrants.id, cuacStaffAccessGrants.userId, cuacStaffAccessGrants.requestedRole],
      name: "ops_submission_delivery_reviews_assigned_grant_scope_fk",
    }).onDelete("restrict"),
    resolvedGrantScopeFk: foreignKey({
      columns: [table.resolvedByGrantId, table.resolvedByUserId, table.resolvedByRole],
      foreignColumns: [cuacStaffAccessGrants.id, cuacStaffAccessGrants.userId, cuacStaffAccessGrants.requestedRole],
      name: "ops_submission_delivery_reviews_resolved_grant_scope_fk",
    }).onDelete("restrict"),
    sourceCheck: check("ops_submission_delivery_reviews_source_check", sql`
      ${table.sourceAttemptCount} between 0 and 5 and isfinite(${table.sourceQuarantinedAt}) and (
        (${table.sourceOutcome} = 'attempt_limit' and ${table.sourceErrorCode} = 'ATTEMPT_LIMIT'
          and ${table.sourceAttemptCount} = 5)
        or (${table.sourceOutcome} = 'invalid_payload'
          and ${table.sourceErrorCode} in ('INVALID_PAYLOAD','DELIVERY_BINDING_CHANGED'))
        or (${table.sourceOutcome} = 'unknown'
          and ${table.sourceErrorCode} in ('PROVIDER_RESULT_UNKNOWN','PROVIDER_RECEIPT_TIME_INVALID','SENDING_LEASE_EXPIRED'))
      )`),
    roleCheck: check("ops_submission_delivery_reviews_role_check", sql`
      ${table.assignedRole} in ('cuac_ops','cuac_admin')
      and (${table.resolvedByRole} is null or ${table.resolvedByRole} = 'cuac_admin')`),
    referenceCheck: check("ops_submission_delivery_reviews_reference_check", sql`
      (${table.escalationReference} is null or ${table.escalationReference} ~ '^[A-Za-z0-9._:-]{1,128}$')
      and (${table.resolutionReference} is null or ${table.resolutionReference} ~ '^[A-Za-z0-9._:-]{1,128}$')`),
    lifecycleCheck: check("ops_submission_delivery_reviews_lifecycle_check", sql`
      ${table.revision} between 1 and 2147483647
      and isfinite(${table.createdAt}) and isfinite(${table.updatedAt})
      and ${table.createdAt} >= ${table.sourceQuarantinedAt} and ${table.updatedAt} >= ${table.createdAt}
      and (${table.resolvedByUserId} is null or ${table.resolvedByUserId} <> ${table.assignedUserId})
      and (
        (${table.status} = 'investigating' and ${table.revision} = 1
          and ${table.escalationCode} is null and ${table.escalationReference} is null and ${table.escalatedAt} is null
          and ${table.resolvedByUserId} is null and ${table.resolvedByGrantId} is null and ${table.resolvedByRole} is null
          and ${table.resolutionCode} is null and ${table.resolutionReference} is null and ${table.resolvedAt} is null)
        or (${table.status} = 'escalated' and ${table.revision} = 2
          and ${table.escalationCode} in ('provider_receipt_investigation','payload_integrity_investigation',
            'delivery_attempts_exhausted','security_investigation_required')
          and ${table.escalationReference} is not null and ${table.escalatedAt} is not null and isfinite(${table.escalatedAt})
          and ${table.resolvedByUserId} is null and ${table.resolvedByGrantId} is null and ${table.resolvedByRole} is null
          and ${table.resolutionCode} is null and ${table.resolutionReference} is null and ${table.resolvedAt} is null)
        or (${table.status} in ('closed_no_retry','retry_approved') and (
            (${table.revision} = 2 and ${table.escalationCode} is null
              and ${table.escalationReference} is null and ${table.escalatedAt} is null)
            or (${table.revision} = 3
              and ${table.escalationCode} in ('provider_receipt_investigation','payload_integrity_investigation',
                'delivery_attempts_exhausted','security_investigation_required')
              and ${table.escalationReference} is not null and ${table.escalatedAt} is not null
              and isfinite(${table.escalatedAt})))
          and ${table.resolvedByUserId} is not null and ${table.resolvedByGrantId} is not null
          and ${table.resolvedByRole} = 'cuac_admin' and ${table.resolutionReference} is not null
          and ${table.resolvedAt} is not null and isfinite(${table.resolvedAt})
          and ((${table.status} = 'retry_approved'
              and ${table.resolutionCode} = 'provider_not_accepted_retry_approved'
              and ${table.sourceOutcome} = 'attempt_limit' and ${table.sourceErrorCode} = 'ATTEMPT_LIMIT'
              and ${table.sourceAttemptCount} = 5)
            or (${table.status} = 'closed_no_retry' and ${table.resolutionCode} in (
              'provider_acceptance_uncertain_no_retry','payload_rebuild_required_no_retry',
              'policy_evidence_invalid_no_retry','duplicate_risk_unresolved_no_retry'))))
      )`),
  }),
);

export const opsCatalogQualityReviews = pgTable(
  "ops_catalog_quality_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    sourceEntityUpdatedAt: timestamp("source_entity_updated_at", { withTimezone: true }).notNull(),
    sourceEvidenceId: uuid("source_evidence_id"),
    sourceEvidenceCapturedAt: timestamp("source_evidence_captured_at", { withTimezone: true }),
    sourceIssueCode: text("source_issue_code").notNull(),
    revision: integer("revision").notNull().default(1),
    status: text("status").notNull().default("investigating"),
    assignedUserId: uuid("assigned_user_id").notNull(),
    assignedGrantId: uuid("assigned_grant_id").notNull(),
    assignedRole: text("assigned_role").notNull(),
    escalationCode: text("escalation_code"),
    escalationReference: text("escalation_reference"),
    escalatedAt: timestamp("escalated_at", { withTimezone: true }),
    resolvedByUserId: uuid("resolved_by_user_id"),
    resolvedByGrantId: uuid("resolved_by_grant_id"),
    resolvedByRole: text("resolved_by_role"),
    resolutionCode: text("resolution_code"),
    resolutionReference: text("resolution_reference"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    reviewDueAt: timestamp("review_due_at", { withTimezone: true }),
    resultEntityUpdatedAt: timestamp("result_entity_updated_at", { withTimezone: true }),
    ...timestamps,
  },
  table => ({
    generationUnique: unique("ops_catalog_quality_reviews_generation_unique")
      .on(table.entityType, table.entityId, table.sourceEntityUpdatedAt, table.sourceEvidenceId)
      .nullsNotDistinct(),
    statusUpdatedIdx: index("ops_catalog_quality_reviews_status_updated_idx").on(table.status, table.updatedAt, table.id),
    entityStatusIdx: index("ops_catalog_quality_reviews_entity_status_idx")
      .on(table.entityType, table.entityId, table.status, table.updatedAt),
    assignedGrantScopeFk: foreignKey({
      columns: [table.assignedGrantId, table.assignedUserId, table.assignedRole],
      foreignColumns: [cuacStaffAccessGrants.id, cuacStaffAccessGrants.userId, cuacStaffAccessGrants.requestedRole],
      name: "ops_catalog_quality_reviews_assigned_grant_scope_fk",
    }).onDelete("restrict"),
    resolvedGrantScopeFk: foreignKey({
      columns: [table.resolvedByGrantId, table.resolvedByUserId, table.resolvedByRole],
      foreignColumns: [cuacStaffAccessGrants.id, cuacStaffAccessGrants.userId, cuacStaffAccessGrants.requestedRole],
      name: "ops_catalog_quality_reviews_resolved_grant_scope_fk",
    }).onDelete("restrict"),
    sourceEvidenceFk: foreignKey({
      columns: [table.sourceEvidenceId, table.entityType, table.entityId, table.sourceEvidenceCapturedAt],
      foreignColumns: [catalogSourceEvidence.id, catalogSourceEvidence.entityType,
        catalogSourceEvidence.entityId, catalogSourceEvidence.capturedAt],
      name: "ops_catalog_quality_reviews_source_evidence_fk",
    }).onDelete("restrict"),
    sourceCheck: check("ops_catalog_quality_reviews_source_check", sql`
      ${table.entityType} in ('city','school','program','scholarship')
      and ${table.sourceIssueCode} in ('missing_source_evidence','invalid_source_url','unverified','stale','disputed','verification_metadata_missing')
      and isfinite(${table.sourceEntityUpdatedAt})
      and ((${table.sourceIssueCode} = 'missing_source_evidence'
          and ${table.sourceEvidenceId} is null and ${table.sourceEvidenceCapturedAt} is null)
        or (${table.sourceIssueCode} <> 'missing_source_evidence'
          and ${table.sourceEvidenceId} is not null and ${table.sourceEvidenceCapturedAt} is not null
          and isfinite(${table.sourceEvidenceCapturedAt})))`),
    roleCheck: check("ops_catalog_quality_reviews_role_check", sql`
      ${table.assignedRole} in ('cuac_ops','cuac_admin')
      and (${table.resolvedByRole} is null or ${table.resolvedByRole} = 'cuac_admin')`),
    referenceCheck: check("ops_catalog_quality_reviews_reference_check", sql`
      (${table.escalationReference} is null or ${table.escalationReference} ~ '^[A-Za-z0-9._:-]{1,128}$')
      and (${table.resolutionReference} is null or ${table.resolutionReference} ~ '^[A-Za-z0-9._:-]{1,128}$')`),
    lifecycleCheck: check("ops_catalog_quality_reviews_lifecycle_check", sql`
      ${table.revision} between 1 and 2147483647
      and isfinite(${table.createdAt}) and isfinite(${table.updatedAt})
      and ${table.createdAt} >= ${table.sourceEntityUpdatedAt} and ${table.updatedAt} >= ${table.createdAt}
      and (${table.resolvedByUserId} is null or ${table.resolvedByUserId} <> ${table.assignedUserId})
      and (
        (${table.status} = 'investigating' and ${table.revision} = 1
          and ${table.escalationCode} is null and ${table.escalationReference} is null and ${table.escalatedAt} is null
          and ${table.resolvedByUserId} is null and ${table.resolvedByGrantId} is null and ${table.resolvedByRole} is null
          and ${table.resolutionCode} is null and ${table.resolutionReference} is null and ${table.resolvedAt} is null
          and ${table.reviewDueAt} is null and ${table.resultEntityUpdatedAt} is null)
        or (${table.status} = 'escalated' and ${table.revision} = 2
          and ${table.escalationCode} in ('source_owner_confirmation_required','conflicting_official_sources',
            'legal_or_policy_review_required','suspected_source_tampering')
          and ${table.escalationReference} is not null and ${table.escalatedAt} is not null and isfinite(${table.escalatedAt})
          and ${table.resolvedByUserId} is null and ${table.resolvedByGrantId} is null and ${table.resolvedByRole} is null
          and ${table.resolutionCode} is null and ${table.resolutionReference} is null and ${table.resolvedAt} is null
          and ${table.reviewDueAt} is null and ${table.resultEntityUpdatedAt} is null)
        or (${table.status} in ('verified','disputed','closed_no_change') and (
            (${table.revision} = 2 and ${table.escalationCode} is null
              and ${table.escalationReference} is null and ${table.escalatedAt} is null)
            or (${table.revision} = 3
              and ${table.escalationCode} in ('source_owner_confirmation_required','conflicting_official_sources',
                'legal_or_policy_review_required','suspected_source_tampering')
              and ${table.escalationReference} is not null and ${table.escalatedAt} is not null
              and isfinite(${table.escalatedAt})))
          and ${table.resolvedByUserId} is not null and ${table.resolvedByGrantId} is not null
          and ${table.resolvedByRole} = 'cuac_admin' and ${table.resolutionReference} is not null
          and ${table.resolvedAt} is not null and isfinite(${table.resolvedAt})
          and ${table.resultEntityUpdatedAt} is not null and isfinite(${table.resultEntityUpdatedAt})
          and ${table.resolvedAt} >= ${table.createdAt} and ${table.resultEntityUpdatedAt} >= ${table.sourceEntityUpdatedAt}
          and ((${table.status} = 'verified' and ${table.resolutionCode} = 'source_confirmed'
              and ${table.sourceEvidenceId} is not null and ${table.reviewDueAt} is not null
              and isfinite(${table.reviewDueAt}) and ${table.reviewDueAt} >= ${table.resolvedAt} + interval '30 days'
              and ${table.reviewDueAt} <= ${table.resolvedAt} + interval '366 days'
              and ${table.resultEntityUpdatedAt} = ${table.resolvedAt})
            or (${table.status} = 'disputed' and ${table.resolutionCode} in ('source_conflict_confirmed','source_invalid')
              and ${table.sourceEvidenceId} is not null and ${table.reviewDueAt} is null
              and ${table.resultEntityUpdatedAt} = ${table.resolvedAt})
            or (${table.status} = 'closed_no_change' and ${table.resolutionCode} = 'source_evidence_required_no_change'
              and ${table.sourceEvidenceId} is null and ${table.reviewDueAt} is null
              and ${table.resultEntityUpdatedAt} = ${table.sourceEntityUpdatedAt})))
      )`),
  }),
);

export const applicationFeeEntitlements = pgTable("application_fee_entitlements", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  applicationSetId: uuid("application_set_id").notNull().references(() => applicationSets.id, { onDelete: "restrict" }),
  applicationChoiceId: uuid("application_choice_id").notNull().references(() => applicationChoices.id, { onDelete: "restrict" }),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "restrict" }),
  programId: uuid("program_id").notNull().references(() => programs.id, { onDelete: "restrict" }),
  programIntakeId: uuid("program_intake_id").notNull().references(() => programIntakes.id, { onDelete: "restrict" }),
  targetKey: text("target_key").notNull().generatedAlwaysAs(sql`"program_id"::text || '/' || "program_intake_id"::text`),
  admissionRouteKey: text("admission_route_key").notNull(),
  invoiceId: uuid("invoice_id").notNull().references(() => invoices.id, { onDelete: "restrict" }),
  invoiceLineId: uuid("invoice_line_id").notNull().references(() => invoiceLines.id, { onDelete: "restrict" }),
  paymentId: uuid("payment_id").notNull().references(() => payments.id, { onDelete: "restrict" }),
  paymentStatusEventId: uuid("payment_status_event_id").notNull().references(() => paymentStatusEvents.id, { onDelete: "restrict" }),
  sourcePaymentStatus: text("source_payment_status").notNull().default("succeeded"),
  lineFormat: text("line_format").notNull().default("cuac.invoice-line.v2"),
  lineType: text("line_type").notNull().default("application_fee"),
  feeCode: text("fee_code").notNull().default("application_submission"),
  pricingBasisSha256: text("pricing_basis_sha256").notNull(),
  amountMinor: integer("amount_minor").notNull(),
  currency: text("currency").notNull(),
  status: text("status").notNull().default("active"),
  grantKeySha256: text("grant_key_sha256").notNull(),
  grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  revocationReason: text("revocation_reason"),
  ...timestamps,
}, table => ({
  choiceScopeFk: foreignKey({ name: "application_fee_entitlements_choice_scope_fk",
    columns: [table.applicationChoiceId, table.applicationSetId, table.userId, table.schoolId],
    foreignColumns: [applicationChoices.id, applicationChoices.applicationSetId,
      applicationChoices.userId, applicationChoices.schoolId] }).onDelete("restrict"),
  choiceTargetFk: foreignKey({ name: "application_fee_entitlements_choice_target_fk",
    columns: [table.applicationChoiceId, table.targetKey],
    foreignColumns: [applicationChoices.id, applicationChoices.targetKey] }).onDelete("restrict"),
  programSchoolFk: foreignKey({ name: "application_fee_entitlements_program_school_fk",
    columns: [table.programId, table.schoolId], foreignColumns: [programs.id, programs.schoolId] }).onDelete("restrict"),
  intakeProgramFk: foreignKey({ name: "application_fee_entitlements_intake_program_fk",
    columns: [table.programIntakeId, table.programId],
    foreignColumns: [programIntakes.id, programIntakes.programId] }).onDelete("restrict"),
  invoiceScopeFk: foreignKey({ name: "application_fee_entitlements_invoice_scope_fk",
    columns: [table.invoiceId, table.userId, table.applicationSetId],
    foreignColumns: [invoices.id, invoices.userId, invoices.applicationSetId] }).onDelete("restrict"),
  lineEvidenceFk: foreignKey({ name: "application_fee_entitlements_line_evidence_fk",
    columns: [table.invoiceLineId, table.invoiceId, table.userId, table.applicationSetId,
      table.applicationChoiceId, table.schoolId, table.programId, table.programIntakeId,
      table.admissionRouteKey, table.lineFormat, table.lineType, table.feeCode,
      table.amountMinor, table.currency, table.pricingBasisSha256],
    foreignColumns: [invoiceLines.id, invoiceLines.invoiceId, invoiceLines.userId, invoiceLines.applicationSetId,
      invoiceLines.applicationChoiceId, invoiceLines.schoolId, invoiceLines.programId, invoiceLines.programIntakeId,
      invoiceLines.admissionRouteKey, invoiceLines.lineFormat, invoiceLines.lineType, invoiceLines.feeCode,
      invoiceLines.amountMinor, invoiceLines.currency, invoiceLines.pricingBasisSha256] }).onDelete("restrict"),
  paymentScopeFk: foreignKey({ name: "application_fee_entitlements_payment_scope_fk",
    columns: [table.paymentId, table.invoiceId, table.userId],
    foreignColumns: [payments.id, payments.invoiceId, payments.userId] }).onDelete("restrict"),
  paymentEventFk: foreignKey({ name: "application_fee_entitlements_payment_event_fk",
    columns: [table.paymentStatusEventId, table.paymentId, table.sourcePaymentStatus],
    foreignColumns: [paymentStatusEvents.id, paymentStatusEvents.paymentId, paymentStatusEvents.toStatus] }).onDelete("restrict"),
  activeChoiceRouteUnique: uniqueIndex("application_fee_entitlements_active_choice_route_unique")
    .on(table.applicationChoiceId, table.admissionRouteKey).where(sql`${table.status} = 'active'`),
  invoiceLineUnique: uniqueIndex("application_fee_entitlements_invoice_line_unique").on(table.invoiceLineId),
  grantKeyUnique: uniqueIndex("application_fee_entitlements_grant_key_unique").on(table.grantKeySha256),
  submissionScopeUnique: uniqueIndex("application_fee_entitlements_submission_scope_unique").on(table.id,
    table.userId, table.applicationSetId, table.applicationChoiceId, table.schoolId, table.programId,
    table.programIntakeId, table.admissionRouteKey),
  userChoiceIdx: index("application_fee_entitlements_user_choice_idx")
    .on(table.userId, table.applicationChoiceId, table.grantedAt),
  formatCheck: check("application_fee_entitlements_format_check", sql`${table.sourcePaymentStatus} = 'succeeded'
    and ${table.lineFormat} = 'cuac.invoice-line.v2' and ${table.lineType} = 'application_fee'
    and ${table.feeCode} = 'application_submission' and ${table.admissionRouteKey} ~ '^[a-z][a-z0-9_-]{0,63}$'
    and ${table.pricingBasisSha256} ~ '^[a-f0-9]{64}$' and ${table.grantKeySha256} ~ '^[a-f0-9]{64}$'
    and ${table.amountMinor} >= 0 and ${table.currency} ~ '^[A-Z]{3}$'`),
  lifecycleCheck: check("application_fee_entitlements_lifecycle_check", sql`(
      ${table.status} = 'active' and ${table.revokedAt} is null and ${table.revocationReason} is null
      and (${table.expiresAt} is null or ${table.grantedAt} < ${table.expiresAt})
    ) or (
      ${table.status} = 'revoked' and ${table.revokedAt} is not null
      and ${table.grantedAt} <= ${table.revokedAt} and char_length(${table.revocationReason}) between 1 and 128
      and (${table.expiresAt} is null or ${table.grantedAt} < ${table.expiresAt})
    )`),
}));

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: text("request_id").notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    actorType: text("actor_type").notNull().default("user"),
    activeRole: text("active_role"),
    tenantSchoolId: uuid("tenant_school_id").references(() => schools.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id"),
    allowed: boolean("allowed").notNull(),
    policyDecisionId: text("policy_decision_id"),
    dataClasses: jsonb("data_classes").notNull().default([]),
    redactionApplied: boolean("redaction_applied").notNull().default(true),
    metadataJson: jsonb("metadata_json").notNull().default({}),
    ipHash: text("ip_hash"),
    userAgentHash: text("user_agent_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    requestIdx: index("audit_logs_request_idx").on(table.requestId),
    actorCreatedIdx: index("audit_logs_actor_created_idx").on(table.actorUserId, table.createdAt),
    tenantCreatedIdx: index("audit_logs_tenant_created_idx").on(table.tenantSchoolId, table.createdAt),
    resourceIdx: index("audit_logs_resource_idx").on(table.resourceType, table.resourceId),
  }),
);

export const notificationPreferences = pgTable("notification_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  audienceRole: text("audience_role").notNull(),
  tenantSchoolId: uuid("tenant_school_id").references(() => schools.id, { onDelete: "restrict" }),
  scopeKey: text("scope_key").notNull().generatedAlwaysAs(
    sql`"audience_role" || '/' || coalesce("tenant_school_id"::text, 'global')`,
  ),
  topic: text("topic").notNull(),
  inAppEnabled: boolean("in_app_enabled").notNull().default(true),
  emailEnabled: boolean("email_enabled").notNull().default(true),
  smsEnabled: boolean("sms_enabled").notNull().default(false),
  revision: integer("revision").notNull().default(0),
  ...timestamps,
}, table => ({
  userScopeTopicUnique: uniqueIndex("notification_preferences_user_scope_topic_unique")
    .on(table.userId, table.scopeKey, table.topic),
  userScopeIdx: index("notification_preferences_user_scope_idx").on(table.userId, table.scopeKey, table.topic),
  scopeCheck: check("notification_preferences_scope_check", sql`(
      ${table.audienceRole} = 'school_staff' and ${table.tenantSchoolId} is not null
    ) or (
      ${table.audienceRole} in ('student','cuac_ops','cuac_admin') and ${table.tenantSchoolId} is null
    )`),
  topicCheck: check("notification_preferences_topic_check", sql`${table.topic} ~ '^[a-z][a-z0-9_]{0,63}$'`),
  revisionCheck: check("notification_preferences_revision_check", sql`${table.revision} between 0 and 2147483647`),
  securityCheck: check("notification_preferences_security_check", sql`${table.topic} <> 'account_security'
    or (${table.inAppEnabled} and ${table.emailEnabled})`),
}));

export const notificationTemplates = pgTable("notification_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  templateKey: text("template_key").notNull(),
  audienceRole: text("audience_role").notNull(),
  channel: text("channel").notNull(),
  locale: text("locale").notNull(),
  version: integer("version").notNull(),
  titleTemplate: text("title_template").notNull(),
  bodyTemplate: text("body_template").notNull(),
  actionPathTemplate: text("action_path_template"),
  variableKeysJson: jsonb("variable_keys_json").notNull().default([]),
  contentSha256: text("content_sha256").notNull(),
  status: text("status").notNull().default("active"),
  ...timestamps,
}, table => ({
  versionUnique: uniqueIndex("notification_templates_version_unique")
    .on(table.templateKey, table.audienceRole, table.channel, table.locale, table.version),
  idRoleChannelUnique: unique("notification_templates_id_role_channel_unique")
    .on(table.id, table.audienceRole, table.channel),
  activeLookupIdx: index("notification_templates_active_lookup_idx")
    .on(table.templateKey, table.audienceRole, table.channel, table.locale, table.status),
  formatCheck: check("notification_templates_format_check", sql`${table.templateKey} ~ '^[a-z][a-z0-9_.-]{0,127}$'
    and ${table.audienceRole} in ('student','school_staff','cuac_ops','cuac_admin')
    and ${table.channel} in ('in_app','email','sms') and ${table.locale} in ('en','zh-CN')
    and ${table.version} between 1 and 2147483647 and char_length(${table.titleTemplate}) between 1 and 160
    and char_length(${table.bodyTemplate}) between 1 and 2000
    and (${table.actionPathTemplate} is null or (char_length(${table.actionPathTemplate}) between 1 and 512
      and ${table.actionPathTemplate} like '/%'))
    and jsonb_typeof(${table.variableKeysJson}) = 'array' and octet_length(${table.variableKeysJson}::text) <= 2048
    and ${table.contentSha256} ~ '^[a-f0-9]{64}$' and ${table.status} in ('active','retired')`),
}));

export const notificationEvents = pgTable("notification_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  recipientUserId: uuid("recipient_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  audienceRole: text("audience_role").notNull(),
  tenantSchoolId: uuid("tenant_school_id").references(() => schools.id, { onDelete: "restrict" }),
  scopeKey: text("scope_key").notNull().generatedAlwaysAs(
    sql`"audience_role" || '/' || coalesce("tenant_school_id"::text, 'global')`,
  ),
  topic: text("topic").notNull(),
  eventType: text("event_type").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id").notNull(),
  eventKeySha256: text("event_key_sha256").notNull(),
  variablesJson: jsonb("variables_json").notNull().default({}),
  variablesSha256: text("variables_sha256").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => ({
  eventKeyUnique: uniqueIndex("notification_events_event_key_unique").on(table.eventKeySha256),
  idRecipientScopeUnique: unique("notification_events_id_recipient_scope_unique")
    .on(table.id, table.recipientUserId, table.scopeKey),
  recipientScopeCreatedIdx: index("notification_events_recipient_scope_created_idx")
    .on(table.recipientUserId, table.scopeKey, table.createdAt, table.id),
  resourceIdx: index("notification_events_resource_idx").on(table.resourceType, table.resourceId, table.createdAt),
  scopeCheck: check("notification_events_scope_check", sql`(
      ${table.audienceRole} = 'school_staff' and ${table.tenantSchoolId} is not null
    ) or (
      ${table.audienceRole} in ('student','cuac_ops','cuac_admin') and ${table.tenantSchoolId} is null
    )`),
  formatCheck: check("notification_events_format_check", sql`${table.topic} ~ '^[a-z][a-z0-9_]{0,63}$'
    and ${table.eventType} ~ '^[a-z][a-z0-9_.]{0,127}$'
    and ${table.resourceType} ~ '^[a-z][a-z0-9_]{0,63}$' and char_length(${table.resourceId}) between 1 and 128
    and ${table.eventKeySha256} ~ '^[a-f0-9]{64}$' and ${table.variablesSha256} ~ '^[a-f0-9]{64}$'
    and jsonb_typeof(${table.variablesJson}) = 'object' and octet_length(${table.variablesJson}::text) <= 8192
    and isfinite(${table.occurredAt})`),
}));

export const notificationDeliveries = pgTable("notification_deliveries", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").notNull(),
  templateId: uuid("template_id").notNull(),
  recipientUserId: uuid("recipient_user_id").notNull(),
  audienceRole: text("audience_role").notNull(),
  tenantSchoolId: uuid("tenant_school_id").references(() => schools.id, { onDelete: "restrict" }),
  scopeKey: text("scope_key").notNull().generatedAlwaysAs(
    sql`"audience_role" || '/' || coalesce("tenant_school_id"::text, 'global')`,
  ),
  channel: text("channel").notNull(),
  status: text("status").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  actionPath: text("action_path"),
  contentSha256: text("content_sha256").notNull(),
  revision: integer("revision").notNull().default(0),
  attemptCount: integer("attempt_count").notNull().default(0),
  availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
  leaseId: uuid("lease_id"),
  leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
  outcome: text("outcome"),
  providerMessageIdHash: text("provider_message_id_hash"),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  viewedAt: timestamp("viewed_at", { withTimezone: true }),
  actionedAt: timestamp("actioned_at", { withTimezone: true }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  ...timestamps,
}, table => ({
  eventChannelUnique: uniqueIndex("notification_deliveries_event_channel_unique").on(table.eventId, table.channel),
  eventScopeFk: foreignKey({ name: "notification_deliveries_event_scope_fk",
    columns: [table.eventId, table.recipientUserId, table.scopeKey],
    foreignColumns: [notificationEvents.id, notificationEvents.recipientUserId, notificationEvents.scopeKey] }).onDelete("cascade"),
  templateScopeFk: foreignKey({ name: "notification_deliveries_template_scope_fk",
    columns: [table.templateId, table.audienceRole, table.channel],
    foreignColumns: [notificationTemplates.id, notificationTemplates.audienceRole, notificationTemplates.channel] }).onDelete("restrict"),
  recipientScopeStatusIdx: index("notification_deliveries_recipient_scope_status_idx")
    .on(table.recipientUserId, table.scopeKey, table.channel, table.status, table.createdAt, table.id),
  queueIdx: index("notification_deliveries_queue_idx").on(table.channel, table.status, table.availableAt, table.id),
  scopeCheck: check("notification_deliveries_scope_check", sql`(
      ${table.audienceRole} = 'school_staff' and ${table.tenantSchoolId} is not null
    ) or (
      ${table.audienceRole} in ('student','cuac_ops','cuac_admin') and ${table.tenantSchoolId} is null
    )`),
  contentCheck: check("notification_deliveries_content_check", sql`char_length(${table.title}) between 1 and 160
    and char_length(${table.body}) between 1 and 2000
    and (${table.actionPath} is null or (char_length(${table.actionPath}) between 1 and 512 and ${table.actionPath} like '/%'))
    and ${table.contentSha256} ~ '^[a-f0-9]{64}$' and ${table.revision} between 0 and 2147483647
    and ${table.attemptCount} between 0 and 5
    and (${table.providerMessageIdHash} is null or ${table.providerMessageIdHash} ~ '^[a-f0-9]{64}$')
    and isfinite(${table.availableAt})`),
  lifecycleCheck: check("notification_deliveries_lifecycle_check", sql`(
      ${table.channel} = 'in_app' and ${table.status} = 'unread' and ${table.deliveredAt} is not null
      and ${table.viewedAt} is null and ${table.actionedAt} is null and ${table.archivedAt} is null
      and ${table.completedAt} is null and ${table.attemptCount} = 0 and ${table.leaseId} is null
      and ${table.leaseExpiresAt} is null and ${table.outcome} is null and ${table.providerMessageIdHash} is null
    ) or (
      ${table.channel} = 'in_app' and ${table.status} = 'read' and ${table.deliveredAt} is not null
      and ${table.viewedAt} is not null and ${table.actionedAt} is null and ${table.archivedAt} is null
      and ${table.completedAt} is null and ${table.attemptCount} = 0 and ${table.leaseId} is null
      and ${table.leaseExpiresAt} is null and ${table.outcome} is null and ${table.providerMessageIdHash} is null
    ) or (
      ${table.channel} = 'in_app' and ${table.status} = 'archived' and ${table.deliveredAt} is not null
      and ${table.actionedAt} is null and ${table.archivedAt} is not null and ${table.completedAt} is not null
      and ${table.attemptCount} = 0 and ${table.leaseId} is null and ${table.leaseExpiresAt} is null
      and ${table.outcome} is null and ${table.providerMessageIdHash} is null
    ) or (
      ${table.channel} = 'in_app' and ${table.status} = 'actioned' and ${table.deliveredAt} is not null
      and ${table.actionedAt} is not null and ${table.archivedAt} is null and ${table.completedAt} is not null
      and ${table.attemptCount} = 0 and ${table.leaseId} is null and ${table.leaseExpiresAt} is null
      and ${table.outcome} is null and ${table.providerMessageIdHash} is null
    ) or (
      ${table.channel} in ('email','sms') and ${table.status} = 'queued' and ${table.deliveredAt} is null
      and ${table.viewedAt} is null and ${table.actionedAt} is null and ${table.archivedAt} is null
      and ${table.completedAt} is null and ${table.leaseId} is null and ${table.leaseExpiresAt} is null
      and (${table.outcome} is null or ${table.outcome} = 'not_accepted') and ${table.providerMessageIdHash} is null
    ) or (
      ${table.channel} in ('email','sms') and ${table.status} in ('leased','sending') and ${table.deliveredAt} is null
      and ${table.viewedAt} is null and ${table.actionedAt} is null and ${table.archivedAt} is null
      and ${table.completedAt} is null and ${table.leaseId} is not null and ${table.leaseExpiresAt} is not null
      and ${table.outcome} is null and ${table.providerMessageIdHash} is null
    ) or (
      ${table.channel} in ('email','sms') and ${table.status} = 'accepted' and ${table.deliveredAt} is not null
      and ${table.viewedAt} is null and ${table.actionedAt} is null and ${table.archivedAt} is null
      and ${table.completedAt} is not null and ${table.leaseId} is null and ${table.leaseExpiresAt} is null
      and ${table.outcome} = 'accepted'
    ) or (
      ${table.channel} in ('email','sms') and ${table.status} = 'suppressed' and ${table.deliveredAt} is null
      and ${table.viewedAt} is null and ${table.actionedAt} is null and ${table.archivedAt} is null
      and ${table.completedAt} is not null and ${table.leaseId} is null and ${table.leaseExpiresAt} is null
      and ${table.outcome} in ('preference_disabled','destination_unavailable','ineligible')
      and ${table.providerMessageIdHash} is null
    ) or (
      ${table.channel} in ('email','sms') and ${table.status} = 'failed' and ${table.deliveredAt} is null
      and ${table.viewedAt} is null and ${table.actionedAt} is null and ${table.archivedAt} is null
      and ${table.completedAt} is not null and ${table.leaseId} is null and ${table.leaseExpiresAt} is null
      and ${table.outcome} = 'attempt_limit' and ${table.providerMessageIdHash} is null
    ) or (
      ${table.channel} in ('email','sms') and ${table.status} = 'uncertain' and ${table.deliveredAt} is null
      and ${table.viewedAt} is null and ${table.actionedAt} is null and ${table.archivedAt} is null
      and ${table.completedAt} is not null and ${table.leaseId} is null and ${table.leaseExpiresAt} is null
      and ${table.outcome} in ('unknown','lease_expired') and ${table.providerMessageIdHash} is null
    )`),
}));
