(function () {
  const storageKeys = {
    applicationDemoState: "cuacApplicationDemoState",
    schoolPortalDemoState: "cuacSchoolPortalDemoState",
    notificationEvents: "cuacNotificationEventsDemoState",
    notificationCenterState: "cuacNotificationCenterDemoState",
    savedDetailItems: "cuacSavedDetailItemsDemoState",
  };

  const config = {
    extraSchoolFeeUsd: 20,
    defaultSchoolTenant: "Zhejiang University",
    invoiceId: "CUAC-2026-014",
  };

  const agentContextPolicies = {
    guest: {
      authState: "signed-out",
      role: "visitor",
      label: "Guest page context",
      retention: "current-page-session",
      retentionCopy: "Uses only the page you opened and this browser session. Closing the page clears the context.",
      storage: "session",
      storageKey: "cuacGuestAgentPageContext",
      allowedContext: ["current page content", "visible filters", "current Agent prompt"],
      blockedContext: ["student profile", "saved routes", "application set", "school messages", "long-term memory"],
      clearTrigger: "page-close-or-refresh",
      auditLevel: "none",
    },
    student: {
      authState: "signed-in",
      role: "student",
      label: "Student application memory",
      retention: "application-lifecycle",
      retentionCopy: "Can remember study goals, saved routes, application choices, school follow-up, and preferences until the student enrolls or clears memory.",
      storage: "account",
      storageKey: "cuacStudentAgentMemory",
      allowedContext: ["study goal", "saved programs", "saved universities", "saved scholarships", "saved cities", "application choices", "billing receipt status", "school follow-up status", "notification tasks", "student preferences"],
      blockedContext: ["other students", "school-only notes", "cross-school tenant data", "ops audit records"],
      clearTrigger: "student-clears-memory-or-enrollment-archive",
      auditLevel: "student-visible",
    },
    schoolStaff: {
      authState: "signed-in",
      role: "school_staff",
      label: "School tenant context",
      retention: "tenant-work-session",
      retentionCopy: "Uses only this school's visible CUAC records and staff actions. It never inherits the student's private long-term memory.",
      storage: "tenant-session",
      storageKey: "cuacSchoolAgentSession",
      allowedContext: ["tenant-scoped application records", "visible queue filters", "school templates", "school staff action log"],
      blockedContext: ["student's other school choices", "other schools", "student private Agent memory", "platform-wide ops data"],
      clearTrigger: "staff-signout-or-tenant-policy",
      auditLevel: "tenant-audited",
    },
    ops: {
      authState: "signed-in",
      role: "cuac_ops",
      label: "Internal audited context",
      retention: "ops-audit-retention",
      retentionCopy: "Can summarize internal health and audit events, but raw cross-tenant access must be justified and logged.",
      storage: "internal-audit",
      storageKey: "cuacOpsAgentAudit",
      allowedContext: ["catalog quality", "routing health", "payment health", "support queues", "Agent audit summaries"],
      blockedContext: ["unjustified raw student data", "unjustified cross-tenant exports", "school staff private workspace"],
      clearTrigger: "ops-retention-policy",
      auditLevel: "internal-audited",
    },
  };

  const legacyFieldContracts = {
    sourceProject: "D:\\CODE\\CSCAlite",
    sourceFiles: [
      "backend/prisma/schema.prisma",
      "backend/src/schools/schools.types.ts",
      "backend/src/schools/schools.service.ts",
      "backend/src/schools/admin-scholarships.service.ts",
      "backend/src/schools/scholarships.service.ts",
      "backend/src/study-china/study-china.types.ts",
      "frontend/src/pages/AdminSchoolsPage.tsx",
      "frontend/src/pages/AdminScholarshipsPage.tsx",
      "frontend/src/lib/api-admin.ts",
      "frontend/src/lib/api-schools.ts",
      "frontend/src/lib/api-study-china.ts",
      "frontend/src/lib/api-scholarships.ts",
      "frontend/src/lib/api.ts",
      "frontend/src/lib/api-types.ts",
    ],
    sourceModelFields: {
      School: [
        "id",
        "nameZh",
        "nameEn",
        "schoolType",
        "region",
        "city",
        "cityZh",
        "citySlug",
        "regionLabel",
        "rank",
        "cscaRequired",
        "cscaRequirement",
        "cscaSubjects",
        "languageRequirement",
        "applicationLevel",
        "languageOfInstruction",
        "hskRequirement",
        "englishRequirement",
        "deadlineSummary",
        "tuitionSummary",
        "applicationFee",
        "officialWebsiteUrl",
        "admissionsWebsiteUrl",
        "sourceUrl",
        "sourceLabel",
        "sourceNote",
        "qualityScore",
        "missingFields",
        "completenessLabel",
        "featuredPrograms",
        "scholarships",
        "fitNotes",
        "derivedTags",
        "subjectTags",
        "languageTags",
        "tuitionBandLabel",
        "hasEnglishPrograms",
        "hasScholarships",
        "decisionSummary",
        "programCount",
        "undergraduateProgramCount",
        "postgraduateProgramCount",
        "englishProgramCount",
        "programSubjectTags",
        "programTuitionBandLabel",
        "programQualityIssues",
        "programs",
        "cscaRules",
        "scholarshipsDetailed",
        "upcomingDeadlines",
        "requiredSubjectTags",
        "quickFacts",
        "detailDisplay",
        "scholarshipCount",
        "cscScholarshipCount",
        "source",
        "sourceId",
        "lastVerifiedAt",
        "status",
        "version",
        "createdAt",
        "updatedAt",
      ],
      SchoolQuickFacts: [
        "location",
        "region",
        "tuition",
        "livingCost",
        "accommodation",
        "programCount",
        "englishProgramCount",
      ],
      SchoolDetailDisplay: [
        "city",
        "regionLabel",
        "livingCostLabel",
        "displayProgramCount",
        "displayUndergraduateCount",
        "visibleProgramCount",
        "hiddenProgramNote",
        "displaySubjectTags",
        "programFieldTags",
        "programDisplayGroups",
        "applicationTimeline",
      ],
      SchoolProgramDisplayGroup: [
        "key",
        "label",
        "total",
        "visibleCount",
        "hiddenNote",
      ],
      SchoolApplicationTimelineItem: [
        "key",
        "label",
        "dateLabel",
        "startDate",
        "endDate",
        "description",
        "statusLabel",
      ],
      SchoolUpcomingDeadline: [
        "programId",
        "programName",
        "degreeLevel",
        "teachingLanguage",
        "applicationRound",
        "deadlineDate",
        "deadlineLabel",
        "daysUntilDeadline",
        "statusLabel",
      ],
      SchoolDetail: [
        "applicationPortalNotes",
        "campusHighlights",
        "contactNotes",
      ],
      SchoolSearchParams: [
        "locale",
        "keyword",
        "region",
        "schoolType",
        "cscaRequired",
        "applicationLevel",
        "page",
        "pageSize",
        "sort",
        "quality",
        "language",
        "subject",
        "hsk",
        "hasTuition",
        "hasScholarship",
        "hasEnglishPrograms",
        "degreeLevel",
        "teachingLanguage",
        "programSubject",
        "fieldCategory",
        "hasProgramTuition",
        "hasUpcomingDeadline",
        "hasCsc",
        "hasCscaRules",
        "hasDetailedScholarship",
      ],
      SchoolListFacets: [
        "regions",
        "schoolTypes",
        "cscaOptions",
        "applicationLevels",
      ],
      SchoolListResult: [
        "items",
        "pagination",
        "page",
        "pageSize",
        "total",
        "totalPages",
        "facets",
        "appliedFiltersSummary",
      ],
      PublicContentBlock: [
        "key",
        "locale",
        "requestedLocale",
        "isFallback",
        "title",
        "subtitle",
        "body",
        "updatedAt",
      ],
      AdminContentBlock: [
        "key",
        "locale",
        "requestedLocale",
        "isFallback",
        "title",
        "subtitle",
        "body",
        "updatedAt",
        "id",
        "status",
        "sortOrder",
        "version",
      ],
      SavedSchool: [
        "savedAt",
      ],
      CompareSchool: [
        "comparedAt",
      ],
      CompareDetailsResult: [
        "items",
      ],
      AdminSchoolSummary: [
        "id",
        "version",
        "nameZh",
        "nameEn",
        "region",
        "cscaRequired",
        "verificationStatus",
        "status",
        "tuitionSummary",
        "sourceUrl",
        "lastVerifiedAt",
        "completenessLabel",
        "missingFields",
      ],
      AdminSchoolDetail: [
        "id",
        "version",
        "nameZh",
        "nameEn",
        "region",
        "cscaRequired",
        "verificationStatus",
        "status",
        "tuitionSummary",
        "sourceUrl",
        "lastVerifiedAt",
        "completenessLabel",
        "missingFields",
        "rank",
        "schoolType",
        "cscaRequirement",
        "languageRequirement",
        "applicationFee",
        "officialWebsiteUrl",
        "admissionsWebsiteUrl",
        "source",
        "sourceId",
        "derivedTags",
        "languageOfInstruction",
        "scholarships",
        "englishPrograms",
        "programFields",
        "cscaRequirementNote",
        "programs",
        "cscaRules",
        "scholarshipsDetailed",
      ],
      AdminSchoolUpdateInput: [
        "expectedVersion",
        "nameZh",
        "nameEn",
        "schoolType",
        "region",
        "citySlug",
        "cityZh",
        "cscaRequired",
        "cscaRequirement",
        "languageRequirement",
        "tuitionSummary",
        "sourceUrl",
        "source",
        "sourceId",
        "officialWebsiteUrl",
        "admissionsWebsiteUrl",
        "applicationFee",
        "languageOfInstruction",
        "scholarships",
        "englishPrograms",
        "programFields",
        "cscaRequirementNote",
        "programs",
        "cscaRules",
        "scholarshipsDetailed",
        "lastVerifiedAt",
        "status",
      ],
      AdminSchoolCreateInput: [
        "expectedVersion",
        "nameZh",
        "nameEn",
        "schoolType",
        "region",
        "citySlug",
        "cityZh",
        "cscaRequired",
        "cscaRequirement",
        "languageRequirement",
        "tuitionSummary",
        "sourceUrl",
        "source",
        "sourceId",
        "officialWebsiteUrl",
        "admissionsWebsiteUrl",
        "applicationFee",
        "languageOfInstruction",
        "scholarships",
        "englishPrograms",
        "programFields",
        "cscaRequirementNote",
        "programs",
        "cscaRules",
        "scholarshipsDetailed",
        "lastVerifiedAt",
        "status",
      ],
      AdminSchoolImportInput: [
        "items",
      ],
      AdminSchoolProgramInput: [
        "expectedVersion",
        "nameZh",
        "nameEn",
        "degreeLevel",
        "durationYears",
        "fieldCategory",
        "teachingLanguage",
        "cscaSubjects",
        "cscaRequirement",
        "hskRequirement",
        "englishRequirement",
        "tuitionAmount",
        "tuitionCurrency",
        "tuitionPeriod",
        "tuitionText",
        "scholarshipText",
        "openDate",
        "deadlineDate",
        "deadlineLabel",
        "applicationRound",
        "applicationUrl",
        "applicationNote",
        "sourceUrl",
        "sourceLabel",
        "lastVerifiedAt",
        "sortOrder",
        "status",
      ],
      AdminSchoolCscaRuleInput: [
        "expectedVersion",
        "title",
        "category",
        "scope",
        "programId",
        "cscaSubjects",
        "languageCondition",
        "description",
        "importantNote",
        "sourceUrl",
        "sourceLabel",
        "lastVerifiedAt",
        "sortOrder",
        "status",
      ],
      AdminSchoolScholarshipInput: [
        "expectedVersion",
        "name",
        "type",
        "programId",
        "coverage",
        "applicableDegree",
        "applicableProgram",
        "amountText",
        "requirementText",
        "sourceUrl",
        "sourceLabel",
        "lastVerifiedAt",
        "sortOrder",
        "status",
      ],
      SchoolChangeLog: [
        "id",
        "action",
        "actorId",
        "actorEmail",
        "createdAt",
        "before",
        "after",
        "changes",
      ],
      SchoolProgram: [
        "id",
        "schoolId",
        "nameZh",
        "nameEn",
        "degreeLevel",
        "durationYears",
        "fieldCategory",
        "teachingLanguage",
        "cscaSubjects",
        "cscaRequirement",
        "hskRequirement",
        "englishRequirement",
        "tuitionAmount",
        "tuitionCurrency",
        "tuitionPeriod",
        "tuitionText",
        "scholarshipText",
        "openDate",
        "deadlineDate",
        "deadlineLabel",
        "applicationRound",
        "applicationUrl",
        "applicationNote",
        "sourceUrl",
        "sourceLabel",
        "lastVerifiedAt",
        "sortOrder",
        "status",
        "isVerified",
        "hasScholarship",
        "badgeText",
        "displayTuition",
        "displaySubjects",
        "displayGroup",
        "displayGroupLabel",
        "version",
        "createdAt",
        "updatedAt",
        "school",
        "cscaRules",
        "scholarships",
        "scholarshipLinks",
      ],
      SchoolCscaRule: [
        "id",
        "version",
        "schoolId",
        "programId",
        "title",
        "category",
        "scope",
        "cscaSubjects",
        "languageCondition",
        "description",
        "importantNote",
        "applicablePrograms",
        "sourceUrl",
        "sourceLabel",
        "lastVerifiedAt",
        "sortOrder",
        "status",
        "isVerified",
      ],
      SchoolScholarship: [
        "id",
        "schoolId",
        "programId",
        "name",
        "type",
        "coverage",
        "applicableDegree",
        "applicableProgram",
        "amountText",
        "requirementText",
        "deadlineDate",
        "deadlineLabel",
        "applicationRound",
        "scholarshipSlug",
        "sourceUrl",
        "sourceLabel",
        "lastVerifiedAt",
        "sortOrder",
        "status",
        "isCsc",
        "isVerified",
        "version",
        "createdAt",
        "updatedAt",
        "school",
        "program",
      ],
      Scholarship: [
        "id",
        "slug",
        "title",
        "type",
        "typeLabel",
        "fundingLevel",
        "providerName",
        "providerNameEn",
        "providerLocation",
        "summary",
        "coverage",
        "applicableDegree",
        "applicableProgram",
        "schoolId",
        "schoolName",
        "schoolNameEn",
        "schoolRegion",
        "schools",
        "schoolCount",
        "programId",
        "programName",
        "programNameEn",
        "programs",
        "amountText",
        "requirementText",
        "bodySections",
        "benefitItems",
        "eligibilityItems",
        "applicationMaterials",
        "applicationSteps",
        "contactInfo",
        "actionLinks",
        "deadlineDate",
        "deadlineLabel",
        "deadline",
        "applicationRound",
        "targetCountries",
        "targetRegions",
        "benefits",
        "tags",
        "sourceUrl",
        "sourceLabel",
        "lastVerifiedAt",
        "sortOrder",
        "status",
        "version",
        "createdAt",
        "updatedAt",
        "schools",
        "programs",
      ],
      ScholarshipBodySection: [
        "title",
        "body",
        "paragraphs",
        "items",
      ],
      ScholarshipBenefitItem: [
        "key",
        "label",
        "included",
        "note",
      ],
      ScholarshipInfoItem: [
        "label",
        "value",
        "body",
      ],
      ScholarshipContactInfo: [
        "label",
        "name",
        "email",
        "phone",
        "website",
        "address",
        "note",
      ],
      ScholarshipActionLink: [
        "label",
        "url",
        "kind",
      ],
      ScholarshipStats: [
        "total",
        "fullFunding",
        "government",
        "countries",
        "types",
      ],
      ScholarshipListResult: [
        "items",
        "pagination",
        "page",
        "pageSize",
        "total",
        "totalPages",
        "facets",
        "types",
        "countries",
        "regions",
        "fundingLevels",
        "stats",
      ],
      ScholarshipTypeSummary: [
        "key",
        "title",
        "icon",
        "tone",
        "body",
        "coverage",
        "difficulty",
        "count",
        "full",
      ],
      ScholarshipCountrySummary: [
        "code",
        "name",
        "region",
        "count",
      ],
      ScholarshipCountriesResult: [
        "hotCountries",
        "countries",
        "regions",
        "stats",
      ],
      ScholarshipDetailResult: [
        "item",
        "schools",
        "id",
        "nameZh",
        "nameEn",
        "region",
        "programs",
        "schoolId",
        "schoolName",
        "degreeLevel",
        "teachingLanguage",
        "similar",
      ],
      AdminScholarship: [
        "id",
        "version",
        "slug",
        "title",
        "type",
        "fundingLevel",
        "providerName",
        "providerNameEn",
        "providerLocation",
        "summary",
        "coverage",
        "applicableDegree",
        "applicableProgram",
        "amountText",
        "requirementText",
        "bodySections",
        "benefitItems",
        "eligibilityItems",
        "applicationMaterials",
        "applicationSteps",
        "contactInfo",
        "actionLinks",
        "deadlineDate",
        "deadlineLabel",
        "applicationRound",
        "targetCountries",
        "targetRegions",
        "benefits",
        "sourceUrl",
        "sourceLabel",
        "lastVerifiedAt",
        "sortOrder",
        "status",
        "schoolIds",
        "programIds",
        "schools",
        "programs",
        "createdAt",
        "updatedAt",
      ],
      AdminScholarshipInput: [
        "expectedVersion",
        "slug",
        "title",
        "type",
        "fundingLevel",
        "providerName",
        "providerNameEn",
        "providerLocation",
        "summary",
        "coverage",
        "applicableDegree",
        "applicableProgram",
        "amountText",
        "requirementText",
        "bodySections",
        "benefitItems",
        "eligibilityItems",
        "applicationMaterials",
        "applicationSteps",
        "contactInfo",
        "actionLinks",
        "deadlineDate",
        "deadlineLabel",
        "applicationRound",
        "targetCountries",
        "targetRegions",
        "benefits",
        "sourceUrl",
        "sourceLabel",
        "lastVerifiedAt",
        "sortOrder",
        "status",
        "schoolIds",
        "programIds",
      ],
      AdminScholarshipImportInput: [
        "items",
        "expectedVersion",
        "slug",
        "title",
        "type",
        "fundingLevel",
        "schoolIds",
        "programIds",
        "status",
      ],
      CityGuide: [
        "id",
        "slug",
        "nameZh",
        "nameEn",
        "region",
        "monthlyCost",
        "costLevel",
        "density",
        "tags",
        "content",
        "contentJson",
        "nearby",
        "references",
        "schoolCount",
        "programCount",
        "englishProgramCount",
        "scholarshipCount",
        "cscaRequiredSchoolCount",
        "referenceSchoolCount",
        "referenceProgramCount",
        "referenceEnglishProgramCount",
        "referenceScholarshipCount",
        "referenceCscaSchoolCount",
        "status",
        "sortOrder",
        "version",
        "createdAt",
        "updatedAt",
      ],
      CityGuideContent: [
        "summary",
        "overview",
        "bestFor",
        "quickFacts",
        "budgetSummary",
        "costProfiles",
        "why",
        "costBreakdown",
        "lifeSections",
        "transportNotes",
        "applicationTips",
        "applicationAdvice",
        "relatedProgramKeywords",
        "nextSteps",
        "faqs",
        "cityFaqs",
      ],
      CityGuideAggregate: [
        "actualSchoolCount",
        "actualProgramCount",
        "actualEnglishProgramCount",
        "actualScholarshipCount",
        "actualCscaRequiredSchoolCount",
        "visibleSchools",
        "visiblePrograms",
        "visibleScholarships",
      ],
      CityGuideDetail: [
        "city",
        "aggregate",
      ],
      ApplicationTimelineWindow: [
        "id",
        "month",
        "title",
        "applicationWindow",
        "cscaWindow",
        "status",
        "sortOrder",
        "version",
        "updatedAt",
      ],
      ApplicationTimelineProject: [
        "key",
        "schoolId",
        "schoolName",
        "schoolNameEn",
        "schoolRegion",
        "title",
        "degree",
        "language",
        "field",
        "tuition",
        "deadlineDate",
        "deadline",
        "days",
        "status",
        "applicationRound",
        "tags",
      ],
      ApplicationTimelineSchool: [
        "key",
        "school",
        "id",
        "nameZh",
        "nameEn",
        "region",
        "programCount",
        "englishProgramCount",
        "scholarshipCount",
        "cscScholarshipCount",
        "rows",
        "earliest",
      ],
      ApplicationTimelineResponse: [
        "stats",
        "deadlineItemCount",
        "schoolCount",
        "urgent7Count",
        "urgent30Count",
        "scholarshipSchoolCount",
        "englishProgramSchoolCount",
        "windows",
        "schools",
        "programs",
      ],
      SearchItem: [
        "type",
        "title",
        "subtitle",
        "snippet",
        "href",
        "score",
        "metadata",
      ],
      SearchResult: [
        "query",
        "total",
        "degraded",
        "items",
        "groups",
      ],
      User: [
        "id",
        "email",
        "role",
        "displayName",
        "emailVerifiedAt",
        "emailVerificationSentAt",
        "passwordConfigured",
        "googleLinked",
      ],
      AuthResult: [
        "user",
        "tokens",
        "accessToken",
        "refreshToken",
      ],
      StudentProfile: [
        "nationality",
        "nationalityCode",
        "country",
        "countryCode",
        "grade",
        "gradeCode",
        "currentOrganizationId",
        "updatedAt",
      ],
      AdminUser: [
        "id",
        "email",
        "role",
        "status",
        "agentAccessStatus",
        "agentMemoryState",
        "agentMemoryUntil",
        "createdAt",
        "updatedAt",
      ],
      AdminAIOrganization: [
        "id",
        "slug",
        "name",
        "type",
        "status",
        "createdAt",
        "updatedAt",
        "aiCreditPool",
        "availableCredits",
        "reservedCredits",
        "expiresAt",
        "perUserDailyLimit",
        "members",
        "userId",
        "cohortId",
        "cohortName",
        "role",
        "email",
        "cohorts",
        "memberCount",
        "pendingSeatCount",
        "seatLimit",
        "remainingSeats",
        "invites",
        "maxUses",
        "usedCount",
        "createdBy",
        "createdByEmail",
        "acceptedBy",
        "acceptedByEmail",
        "acceptedAt",
        "inviteAttempts",
        "userEmail",
        "inviteId",
        "inviteEmail",
        "inviteRole",
        "lookupMode",
        "reason",
        "llmProviderConfigs",
        "provider",
        "model",
        "baseUrl",
        "usagePolicy",
        "apiKeyConfigured",
      ],
      AdminAIOrganizationInviteCreateResult: [
        "organization",
        "invite",
        "id",
        "email",
        "role",
        "cohortId",
        "maxUses",
        "expiresAt",
        "token",
        "shortCode",
        "acceptPath",
      ],
      AdminAIOrganizationAdminAssignmentResult: [
        "organization",
        "assignment",
        "email",
        "status",
        "userId",
        "inviteId",
        "acceptPath",
      ],
      AdminAIOrganizationInviteBulkReissueResult: [
        "organization",
        "invites",
        "sourceInviteId",
        "id",
        "email",
        "token",
        "shortCode",
        "acceptPath",
      ],
      AdminAIOrganizationInviteHistory: [
        "items",
        "id",
        "email",
        "role",
        "status",
        "effectiveStatus",
        "cohortId",
        "cohortName",
        "cohortSlug",
        "maxUses",
        "usedCount",
        "expiresAt",
        "createdBy",
        "createdByEmail",
        "acceptedBy",
        "acceptedByEmail",
        "acceptedAt",
        "createdAt",
        "updatedAt",
        "canRevealToken",
        "limit",
      ],
      OrganizationInviteAcceptResult: [
        "accepted",
        "organization",
        "id",
        "slug",
        "name",
        "membership",
        "role",
        "status",
        "cohortId",
        "cohortName",
        "invite",
        "usedCount",
        "maxUses",
      ],
      PricingLine: [
        "type",
        "title",
        "quantity",
        "unitAmountCents",
        "originalAmountCents",
        "discountAmountCents",
        "payableAmountCents",
        "schoolId",
        "aiCreditUnits",
      ],
      PricingSummary: [
        "currency",
        "itemsTotalCents",
        "discountTotalCents",
        "payableTotalCents",
        "pricingBreakdown",
      ],
      CartItem: [
        "id",
        "type",
        "schoolId",
        "schoolName",
        "title",
        "quantity",
        "createdAt",
      ],
      CartResult: [
        "items",
        "pricing",
      ],
      CommerceOrder: [
        "id",
        "status",
        "createdAt",
        "updatedAt",
        "payment",
        "providerTxnId",
        "amountCents",
        "currency",
        "items",
        "itemsTotalCents",
        "discountTotalCents",
        "payableTotalCents",
        "pricingBreakdown",
      ],
      PaymentCreateResult: [
        "provider",
        "paymentId",
        "orderId",
        "providerTxnId",
        "amountCents",
        "currency",
        "status",
        "checkoutUrl",
        "callbackSignaturePayload",
        "testCallbackSignature",
      ],
      AuditItem: [
        "id",
        "title",
        "status",
        "detail",
      ],
      AdminAuditSummary: [
        "schoolsTotal",
        "schoolsVerified",
        "schoolsPending",
        "adminAuditEventCount",
        "latestAdminAuditEventAt",
        "schoolChangeCount",
        "latestSchoolChangeAt",
        "mockExamAttemptCount",
        "specialPracticeSessionCount",
      ],
      AdminAuditEvent: [
        "id",
        "actorId",
        "actorEmail",
        "organizationId",
        "organizationName",
        "organizationSlug",
        "relatedUserId",
        "relatedUserEmail",
        "targetEmail",
        "module",
        "resourceType",
        "resourceId",
        "action",
        "before",
        "after",
        "createdAt",
      ],
      AdminReadinessEvidenceFile: [
        "name",
        "kind",
        "phase",
        "source",
        "status",
        "generatedAt",
        "sizeBytes",
        "modifiedAt",
      ],
      AdminReadinessEvidenceDetail: [
        "file",
        "content",
      ],
    },
    displayAliases: {
      "Program.name": "SchoolProgram.nameEn",
      "Program.university": "School.nameEn",
      "Program.degree": "SchoolProgram.degreeLevel",
      "Program.language": "SchoolProgram.teachingLanguage",
      "Program.deadline": "SchoolProgram.deadlineDate",
      "Scholarship.name": "Scholarship.title",
      "City.id": "CityGuide.slug",
      "City.name": "CityGuide.nameEn",
    },
    auditEvidence: {
      checkedAt: "2026-08-20",
      checkedSourceProject: "D:\\CODE\\CSCAlite",
      schemaFile: "backend/prisma/schema.prisma",
      backendTypes: ["backend/src/schools/schools.types.ts", "backend/src/study-china/study-china.types.ts"],
      frontendTypes: ["frontend/src/lib/api-types.ts", "frontend/src/lib/api.ts", "frontend/src/lib/api-schools.ts", "frontend/src/lib/api-scholarships.ts", "frontend/src/lib/api-study-china.ts"],
      verifiedModels: ["School", "SchoolDetail", "SchoolQuickFacts", "SchoolDetailDisplay", "SchoolProgramDisplayGroup", "SchoolApplicationTimelineItem", "SchoolUpcomingDeadline", "SchoolSearchParams", "SchoolListFacets", "SchoolListResult", "PublicContentBlock", "AdminContentBlock", "SavedSchool", "CompareSchool", "CompareDetailsResult", "AdminSchoolSummary", "AdminSchoolDetail", "AdminSchoolUpdateInput", "AdminSchoolCreateInput", "AdminSchoolImportInput", "AdminSchoolProgramInput", "AdminSchoolCscaRuleInput", "AdminSchoolScholarshipInput", "SchoolChangeLog", "SchoolProgram", "SchoolCscaRule", "SchoolScholarship", "Scholarship", "ScholarshipBodySection", "ScholarshipBenefitItem", "ScholarshipInfoItem", "ScholarshipContactInfo", "ScholarshipActionLink", "ScholarshipStats", "ScholarshipListResult", "ScholarshipTypeSummary", "ScholarshipCountrySummary", "ScholarshipCountriesResult", "ScholarshipDetailResult", "AdminScholarship", "AdminScholarshipInput", "AdminScholarshipImportInput", "ScholarshipSchool", "ScholarshipProgram", "CityGuide", "CityGuideContent", "CityGuideAggregate", "CityGuideDetail", "ApplicationTimelineWindow", "ApplicationTimelineProject", "ApplicationTimelineSchool", "ApplicationTimelineResponse", "SearchItem", "SearchResult", "User", "AuthResult", "StudentProfile", "AdminUser", "AdminAIOrganization", "AdminAIOrganizationInviteCreateResult", "AdminAIOrganizationAdminAssignmentResult", "AdminAIOrganizationInviteBulkReissueResult", "AdminAIOrganizationInviteHistory", "OrganizationInviteAcceptResult", "PricingLine", "PricingSummary", "CartItem", "CartResult", "CommerceOrder", "PaymentCreateResult", "AuditItem", "AdminAuditSummary", "AdminAuditEvent", "AdminReadinessEvidenceFile", "AdminReadinessEvidenceDetail"],
      currentBaseline: {
        School: {
          prismaModel: "School",
          backendType: "SchoolRecord",
          frontendType: "School",
          requiredFamilies: ["identity", "city", "admissions", "language", "costDeadlines", "sourceGovernance", "relations"],
          mustPreserveFields: ["citySlug", "cityZh", "officialWebsiteUrl", "admissionsWebsiteUrl", "cscaSubjects", "languageRequirement", "hskRequirement", "englishRequirement", "deadlineSummary", "tuitionSummary", "applicationFee", "quickFacts", "detailDisplay", "upcomingDeadlines", "scholarshipsDetailed", "qualityScore", "missingFields", "completenessLabel", "lastVerifiedAt"],
        },
        SchoolDisplaySurface: {
          prismaModel: "School",
          backendType: "SchoolQuickFacts + SchoolDetailDisplay + SchoolApplicationTimelineItem + SchoolUpcomingDeadline",
          frontendType: "SchoolQuickFacts + SchoolDetailDisplay + SchoolProgramDisplayGroup + SchoolApplicationTimelineItem + SchoolUpcomingDeadline",
          requiredFamilies: ["studentReadableFacts", "programGrouping", "applicationTimeline", "deadlineSignals"],
          mustPreserveFields: ["location", "tuition", "livingCost", "programCount", "englishProgramCount", "city", "regionLabel", "displayProgramCount", "visibleProgramCount", "hiddenProgramNote", "displaySubjectTags", "programFieldTags", "programDisplayGroups", "applicationTimeline", "key", "label", "dateLabel", "startDate", "endDate", "description", "programName", "deadlineDate", "deadlineLabel", "daysUntilDeadline", "statusLabel"],
        },
        SchoolCatalog: {
          prismaModel: "School",
          backendType: "SchoolSearchParams + SchoolListFacets + SchoolListResult",
          frontendType: "SchoolSearchParams + SchoolListFacets + SchoolListResult",
          requiredFamilies: ["searchFilters", "pagination", "facets", "appliedFilterSummary", "schoolItems"],
          mustPreserveFields: ["keyword", "region", "schoolType", "cscaRequired", "applicationLevel", "page", "pageSize", "sort", "language", "subject", "hsk", "hasScholarship", "hasEnglishPrograms", "degreeLevel", "teachingLanguage", "hasUpcomingDeadline", "hasCsc", "hasCscaRules", "hasDetailedScholarship", "items", "pagination", "facets", "total", "totalPages", "regions", "schoolTypes", "cscaOptions", "applicationLevels", "appliedFiltersSummary"],
        },
        ContentDiscovery: {
          prismaModel: "PublicContentBlock + AdminContentBlock + Search index",
          backendType: "PublicContentBlock + SearchResult",
          frontendType: "PublicContentBlock + AdminContentBlock + SearchItem + SearchResult",
          requiredFamilies: ["contentIdentity", "localizedContent", "adminStatus", "searchResultItems", "agentCitationMetadata"],
          mustPreserveFields: ["key", "locale", "requestedLocale", "isFallback", "title", "subtitle", "body", "updatedAt", "id", "status", "sortOrder", "version", "type", "snippet", "href", "score", "metadata", "query", "total", "degraded", "items", "groups"],
        },
        SavedCompare: {
          prismaModel: "School + User saved/compare relations",
          backendType: "SavedSchool + CompareSchool + CompareDetailsResult",
          frontendType: "SavedSchool + CompareSchool + CompareDetailsResult",
          requiredFamilies: ["savedSchoolTimestamp", "compareTimestamp", "compareItems", "schoolIdentity"],
          mustPreserveFields: ["id", "nameZh", "nameEn", "citySlug", "cityZh", "programs", "savedAt", "comparedAt", "items"],
        },
        AdminSchool: {
          prismaModel: "School",
          backendType: "AdminSchoolSummary + AdminSchoolDetail + AdminSchoolUpdateInput + AdminSchoolCreateInput + AdminSchoolImportInput",
          frontendType: "AdminSchoolSummary + AdminSchoolDetail + AdminSchoolUpdateInput + AdminSchoolCreateInput + AdminSchoolImportInput + AdminSchoolProgramInput + AdminSchoolCscaRuleInput + AdminSchoolScholarshipInput",
          requiredFamilies: ["adminIdentity", "statusGovernance", "sourceGovernance", "detailRelations", "createUpdateInputs", "bulkImportInput", "subrecordInputs", "changeLogs"],
          mustPreserveFields: ["id", "version", "expectedVersion", "nameZh", "nameEn", "verificationStatus", "status", "completenessLabel", "missingFields", "schoolType", "source", "sourceId", "sourceUrl", "sourceLabel", "citySlug", "cityZh", "officialWebsiteUrl", "admissionsWebsiteUrl", "languageOfInstruction", "programs", "cscaRules", "scholarshipsDetailed", "items", "degreeLevel", "teachingLanguage", "deadlineDate", "applicationUrl", "programId", "cscaSubjects", "languageCondition", "importantNote", "applicableDegree", "applicableProgram", "sortOrder"],
        },
        SchoolChangeLog: {
          prismaModel: "SchoolChangeLog",
          backendType: "SchoolChangeLogRecord",
          frontendType: "SchoolChangeLog",
          requiredFamilies: ["auditTrail", "actor", "beforeAfter", "changeList"],
          mustPreserveFields: ["id", "action", "actorId", "actorEmail", "createdAt", "before", "after", "changes"],
        },
        SchoolProgram: {
          prismaModel: "SchoolProgram",
          backendType: "SchoolProgramRecord",
          frontendType: "SchoolProgram",
          requiredFamilies: ["identity", "programProfile", "requirements", "tuition", "timing", "applicationLinks", "sourceGovernance"],
          mustPreserveFields: ["schoolId", "nameZh", "nameEn", "degreeLevel", "durationYears", "fieldCategory", "teachingLanguage", "tuitionAmount", "tuitionCurrency", "openDate", "deadlineDate", "deadlineLabel", "applicationRound", "applicationUrl", "applicationNote", "sourceUrl", "lastVerifiedAt", "version"],
        },
        SchoolCscaRule: {
          prismaModel: "SchoolCscaRule",
          backendType: "SchoolCscaRuleRecord",
          frontendType: "SchoolCscaRule",
          requiredFamilies: ["schoolScopedRule", "optionalProgramLink", "subjects", "languageCondition", "sourceGovernance"],
          mustPreserveFields: ["schoolId", "programId", "title", "category", "scope", "cscaSubjects", "applicablePrograms", "languageCondition", "description", "importantNote", "sourceUrl", "lastVerifiedAt", "version"],
        },
        SchoolScholarship: {
          prismaModel: "SchoolScholarship",
          backendType: "SchoolScholarshipRecord",
          frontendType: "SchoolScholarship",
          requiredFamilies: ["schoolScopedFunding", "optionalProgramLink", "requirements", "sourceGovernance"],
          mustPreserveFields: ["schoolId", "programId", "name", "type", "coverage", "applicableDegree", "applicableProgram", "amountText", "requirementText", "sourceUrl", "lastVerifiedAt", "version"],
        },
        PublicScholarship: {
          prismaModel: "Scholarship",
          backendType: "PublicScholarship + ScholarshipListResult + ScholarshipDetailResult",
          frontendType: "PublicScholarship + ScholarshipBodySection + ScholarshipBenefitItem + ScholarshipInfoItem + ScholarshipContactInfo + ScholarshipActionLink",
          requiredFamilies: ["identity", "provider", "funding", "richContent", "structuredBenefits", "structuredEligibility", "schoolProgramLinks", "targeting", "listStats", "sourceGovernance"],
          mustPreserveFields: ["id", "slug", "title", "type", "typeLabel", "fundingLevel", "providerName", "providerNameEn", "providerLocation", "summary", "coverage", "applicableDegree", "applicableProgram", "schoolId", "schoolName", "schoolNameEn", "schoolRegion", "schoolCount", "programId", "programName", "programNameEn", "amountText", "requirementText", "bodySections", "benefitItems", "eligibilityItems", "applicationMaterials", "applicationSteps", "contactInfo", "actionLinks", "deadlineDate", "deadlineLabel", "applicationRound", "targetCountries", "targetRegions", "benefits", "tags", "sourceUrl", "sourceLabel", "lastVerifiedAt", "sortOrder", "schools", "programs", "paragraphs", "items", "included", "email", "website", "url", "kind", "stats", "facets", "similar", "pagination", "totalPages", "fundingLevels", "hotCountries"],
        },
        AdminScholarship: {
          prismaModel: "Scholarship",
          backendType: "AdminScholarship + AdminScholarshipInput + importAdminScholarships",
          frontendType: "AdminScholarship + AdminScholarshipInput + AdminScholarshipImportInput",
          requiredFamilies: ["identity", "provider", "funding", "richContent", "schoolProgramLinks", "statusGovernance", "sourceGovernance", "createUpdateInput", "bulkImportInput", "versionGuard"],
          mustPreserveFields: ["expectedVersion", "items", "slug", "title", "fundingLevel", "providerName", "providerNameEn", "providerLocation", "bodySections", "benefitItems", "eligibilityItems", "applicationMaterials", "applicationSteps", "contactInfo", "actionLinks", "deadlineDate", "targetCountries", "targetRegions", "schoolIds", "programIds", "status", "sortOrder", "version", "createdAt", "updatedAt"],
        },
        City: {
          prismaModel: "CityGuide",
          backendType: "CityGuideRecord + CityGuideAggregate",
          frontendType: "CityGuide + CityGuideAggregate",
          requiredFamilies: ["identity", "costDensity", "contentJson", "references", "aggregate"],
          mustPreserveFields: ["slug", "nameZh", "nameEn", "region", "monthlyCost", "costLevel", "density", "tags", "content", "contentJson", "nearby", "references", "schoolCount", "programCount", "englishProgramCount", "scholarshipCount", "cscaRequiredSchoolCount", "referenceSchoolCount", "referenceProgramCount", "referenceEnglishProgramCount", "referenceScholarshipCount", "referenceCscaSchoolCount", "summary", "overview", "bestFor", "quickFacts", "budgetSummary", "costProfiles", "why", "costBreakdown", "lifeSections", "transportNotes", "applicationTips", "applicationAdvice", "relatedProgramKeywords", "nextSteps", "faqs", "cityFaqs", "actualSchoolCount", "actualProgramCount", "actualEnglishProgramCount", "actualScholarshipCount", "actualCscaRequiredSchoolCount", "visibleSchools", "visiblePrograms", "visibleScholarships"],
        },
        TimelineWindow: {
          prismaModel: "ApplicationTimelineWindow",
          backendType: "ApplicationTimelineWindow + ApplicationTimelineResponse",
          frontendType: "ApplicationTimelineWindow + ApplicationTimelineProject + ApplicationTimelineSchool + ApplicationTimelineResponse",
          requiredFamilies: ["identity", "applicationPlanning", "cscaPlanning", "deadlinePrograms", "schoolGrouping", "stats"],
          mustPreserveFields: ["id", "month", "title", "applicationWindow", "cscaWindow", "status", "sortOrder", "version", "updatedAt", "schoolId", "schoolName", "deadlineDate", "days", "applicationRound", "tags", "rows", "earliest", "stats", "programs"],
        },
        StudentProfile: {
          prismaModel: "StudentProfile",
          backendType: "StudentProfileRecord",
          frontendType: "StudentProfile",
          requiredFamilies: ["studentNationality", "studentCountry", "grade", "organizationLink", "updatedAt"],
          mustPreserveFields: ["nationality", "nationalityCode", "country", "countryCode", "grade", "gradeCode", "currentOrganizationId", "updatedAt"],
        },
        AccessGovernance: {
          prismaModel: "User + OrganizationMember + OrganizationInvite",
          backendType: "AuthResult + User + AdminUser + AdminAIOrganization + OrganizationInviteAcceptResult",
          frontendType: "AuthResult + User + AdminUser + AdminAIOrganization + AdminAIOrganizationInviteCreateResult + AdminAIOrganizationAdminAssignmentResult + AdminAIOrganizationInviteBulkReissueResult + AdminAIOrganizationInviteHistory + OrganizationInviteAcceptResult",
          requiredFamilies: ["authSession", "accountIdentity", "roleStatus", "organizationMembership", "invitationFlow", "assignmentFlow", "auditGovernance"],
          mustPreserveFields: ["id", "email", "role", "status", "displayName", "emailVerifiedAt", "tokens", "accessToken", "refreshToken", "agentAccessStatus", "agentMemoryState", "agentMemoryUntil", "members", "invites", "inviteAttempts", "assignment", "userId", "inviteId", "accepted", "membership", "cohortId", "cohortName", "acceptedAt", "acceptPath", "shortCode", "usedCount", "maxUses", "createdAt", "updatedAt"],
        },
        OpsAuditGovernance: {
          prismaModel: "AdminAuditEvent + readiness evidence files",
          backendType: "AuditItem + AdminAuditSummary + AdminAuditEvent + AdminReadinessEvidenceDetail",
          frontendType: "AuditItem + AdminAuditSummary + AdminAuditEvent + AdminReadinessEvidenceFile + AdminReadinessEvidenceDetail",
          requiredFamilies: ["auditSummary", "auditEventActor", "auditEventTarget", "beforeAfter", "readinessEvidence", "opsActionList"],
          mustPreserveFields: ["id", "title", "detail", "schoolsTotal", "schoolsVerified", "schoolsPending", "adminAuditEventCount", "latestAdminAuditEventAt", "schoolChangeCount", "latestSchoolChangeAt", "actorId", "actorEmail", "organizationId", "organizationSlug", "targetEmail", "module", "resourceType", "resourceId", "action", "before", "after", "createdAt", "name", "kind", "phase", "source", "status", "generatedAt", "sizeBytes", "modifiedAt", "file", "content"],
        },
        CommerceFlow: {
          prismaModel: "CommerceOrder + Payment",
          backendType: "CartResult + CommerceOrder + PaymentCreateResult",
          frontendType: "CartResult + CommerceOrder + PaymentCreateResult",
          requiredFamilies: ["cartItems", "pricing", "orderLifecycle", "paymentProvider", "callbackEvidence"],
          mustPreserveFields: ["items", "pricing", "currency", "itemsTotalCents", "discountTotalCents", "payableTotalCents", "pricingBreakdown", "id", "status", "payment", "providerTxnId", "amountCents", "paymentId", "orderId", "callbackSignaturePayload", "testCallbackSignature"],
        },
      },
    },
    entityContracts: {
      School: {
        legacyModel: "School",
        backendType: "SchoolRecord",
        frontendType: "School",
        cuacUsage: ["universities.html", "university-detail.html", "application.html#add-choice", "school-portal.html"],
        canonicalKeys: ["id", "nameZh", "nameEn", "citySlug", "cityZh", "region", "officialWebsiteUrl", "admissionsWebsiteUrl", "quickFacts", "detailDisplay", "upcomingDeadlines", "qualityScore", "programs"],
        displayAliases: ["university", "schoolName", "officialWebsiteUrl", "admissionsWebsiteUrl", "qualityScore"],
        agentBoundary: "School data can be summarized publicly, but school-staff actions must stay tenant-scoped by schoolId.",
      },
      SchoolDisplaySurface: {
        legacyModel: "SchoolQuickFacts + SchoolDetailDisplay + SchoolProgramDisplayGroup + SchoolApplicationTimelineItem + SchoolUpcomingDeadline",
        backendType: "SchoolQuickFacts + SchoolDetailDisplay + SchoolApplicationTimelineItem + SchoolUpcomingDeadline",
        frontendType: "SchoolQuickFacts + SchoolDetailDisplay + SchoolProgramDisplayGroup + SchoolApplicationTimelineItem + SchoolUpcomingDeadline",
        cuacUsage: ["universities.html", "university-detail.html", "program-detail.html"],
        canonicalKeys: ["location", "tuition", "livingCost", "programCount", "englishProgramCount", "city", "regionLabel", "displayProgramCount", "visibleProgramCount", "programDisplayGroups", "applicationTimeline", "key", "label", "dateLabel", "startDate", "endDate", "description", "programName", "deadlineDate", "deadlineLabel", "statusLabel"],
        displayAliases: ["schoolQuickFacts", "schoolDetailDisplay", "deadlineCards", "programGroups"],
        agentBoundary: "SchoolDisplaySurface is student-readable derived display context; internal source governance fields stay in Ops admin.",
      },
      SchoolCatalog: {
        legacyModel: "SchoolSearchParams + SchoolListFacets + SchoolListResult",
        backendType: "SchoolSearchParams + SchoolListFacets + SchoolListResult",
        frontendType: "SchoolSearchParams + SchoolListFacets + SchoolListResult",
        cuacUsage: ["universities.html", "home-v3.html", "application.html#add-choice"],
        canonicalKeys: ["keyword", "region", "schoolType", "cscaRequired", "applicationLevel", "page", "pageSize", "sort", "language", "subject", "hsk", "hasScholarship", "hasEnglishPrograms", "degreeLevel", "teachingLanguage", "hasUpcomingDeadline", "hasCsc", "hasCscaRules", "hasDetailedScholarship", "items", "pagination", "facets", "total", "totalPages", "regions", "schoolTypes", "cscaOptions", "applicationLevels", "appliedFiltersSummary"],
        displayAliases: ["universitySearch", "schoolFilters", "schoolFacets", "catalogPagination"],
        agentBoundary: "SchoolCatalog supports public discovery and add-choice lookup; it must not imply that any school has received a student record or can see other school choices.",
      },
      ContentDiscovery: {
        legacyModel: "PublicContentBlock + AdminContentBlock + SearchItem + SearchResult",
        backendType: "PublicContentBlock + SearchResult",
        frontendType: "PublicContentBlock + AdminContentBlock + SearchItem + SearchResult",
        cuacUsage: ["guides.html", "guide-detail.html", "shared Agent page references"],
        canonicalKeys: ["key", "locale", "requestedLocale", "isFallback", "title", "subtitle", "body", "updatedAt", "id", "status", "sortOrder", "version", "type", "snippet", "href", "score", "metadata", "query", "total", "degraded", "items", "groups"],
        displayAliases: ["guide", "contentBlock", "guideSearchItem", "agentReference"],
        agentBoundary: "ContentDiscovery gives Guides and Agent references a content/search source structure without restoring a top-nav search entry or exposing admin-only content status to students.",
      },
      SavedCompare: {
        legacyModel: "SavedSchool + CompareSchool + CompareDetailsResult",
        backendType: "SavedSchool + CompareSchool + CompareDetailsResult",
        frontendType: "SavedSchool + CompareSchool + CompareDetailsResult",
        cuacUsage: ["favourites.html", "programs.html", "universities.html", "hub.html"],
        canonicalKeys: ["id", "nameZh", "nameEn", "citySlug", "cityZh", "programs", "savedAt", "comparedAt", "items"],
        displayAliases: ["savedSchool", "compareSchool", "compareTray", "savedRoute"],
        agentBoundary: "Saved and compared schools support student planning, but only a concrete SchoolProgram choice can be sent to a school tenant.",
      },
      AdminSchool: {
        legacyModel: "AdminSchoolSummary + AdminSchoolDetail + AdminSchoolUpdateInput + AdminSchoolCreateInput + AdminSchoolImportInput + AdminSchoolProgramInput + AdminSchoolCscaRuleInput + AdminSchoolScholarshipInput",
        backendType: "AdminSchoolSummary + AdminSchoolDetail + AdminSchoolUpdateInput + AdminSchoolCreateInput + AdminSchoolImportInput",
        frontendType: "AdminSchoolSummary + AdminSchoolDetail + AdminSchoolUpdateInput + AdminSchoolCreateInput + AdminSchoolImportInput + AdminSchoolProgramInput + AdminSchoolCscaRuleInput + AdminSchoolScholarshipInput",
        cuacUsage: ["ops-admin.html"],
        canonicalKeys: ["id", "version", "expectedVersion", "nameZh", "verificationStatus", "status", "programs", "cscaRules", "scholarshipsDetailed", "items", "sourceLabel", "sortOrder", "applicationUrl", "programId", "languageCondition", "applicableDegree"],
        displayAliases: ["schoolEditor", "adminSchoolRecord", "schoolManagement", "schoolImportPayload", "schoolSubrecordInput"],
        agentBoundary: "AdminSchool is an internal management view. It can create, import, and edit school records plus relation inputs, while public university pages render student-safe School copy.",
      },
      SchoolChangeLog: {
        legacyModel: "SchoolChangeLog",
        backendType: "SchoolChangeLogRecord",
        frontendType: "SchoolChangeLog",
        cuacUsage: ["ops-admin.html"],
        canonicalKeys: ["id", "action", "actorId", "actorEmail", "createdAt", "before", "after", "changes"],
        displayAliases: ["changeLog", "auditTrail", "schoolHistory"],
        agentBoundary: "SchoolChangeLog is internal audit evidence for school data changes and must not appear on public student pages.",
      },
      Program: {
        legacyModel: "SchoolProgram",
        backendType: "SchoolProgramRecord",
        frontendType: "SchoolProgram",
        cuacUsage: ["programs.html", "program-detail.html", "application.html#add-choice", "school-portal.html"],
        canonicalKeys: ["id", "schoolId", "nameZh", "nameEn", "degreeLevel", "teachingLanguage", "tuitionAmount", "deadlineDate", "applicationRound"],
        displayAliases: ["name", "university", "degree", "language", "tuition", "deadline", "scholarship"],
        agentBoundary: "Add choice selects schoolId and programId; school-visible details are enriched from the selected SchoolProgram record.",
      },
      SchoolScholarship: {
        legacyModel: "SchoolScholarship",
        backendType: "SchoolScholarshipRecord",
        frontendType: "SchoolScholarship",
        cuacUsage: ["programs.html", "universities.html", "application.html", "school-portal.html"],
        canonicalKeys: ["id", "schoolId", "programId", "name", "type", "coverage", "deadlineDate", "applicationRound", "isCsc"],
        displayAliases: ["fundingSignal", "schoolFunding", "scholarshipSignal"],
        agentBoundary: "SchoolScholarship is school-scoped funding context and must not be flattened into public Scholarship records.",
      },
      SchoolCscaRule: {
        legacyModel: "SchoolCscaRule",
        backendType: "SchoolCscaRuleRecord",
        frontendType: "SchoolCscaRule",
        cuacUsage: ["programs.html", "universities.html", "ops-admin.html", "school-portal.html"],
        canonicalKeys: ["id", "schoolId", "programId", "title", "category", "cscaSubjects", "applicablePrograms", "isVerified"],
        displayAliases: ["cscaRule", "subjectRequirement", "academicCheck"],
        agentBoundary: "SchoolCscaRule informs eligibility and document planning, but school-specific rules must remain scoped to the selected school and program.",
      },
      PublicScholarship: {
        legacyModel: "Scholarship + ScholarshipBodySection + ScholarshipBenefitItem + ScholarshipInfoItem + ScholarshipContactInfo + ScholarshipActionLink + ScholarshipListResult + ScholarshipDetailResult",
        backendType: "PublicScholarship + ScholarshipListResult + ScholarshipDetailResult",
        frontendType: "PublicScholarship + ScholarshipBodySection + ScholarshipBenefitItem + ScholarshipInfoItem + ScholarshipContactInfo + ScholarshipActionLink",
        cuacUsage: ["scholarships.html", "scholarship-detail.html", "programs.html"],
        canonicalKeys: ["id", "slug", "title", "fundingLevel", "providerName", "bodySections", "paragraphs", "benefitItems", "included", "eligibilityItems", "applicationMaterials", "contactInfo", "email", "actionLinks", "url", "deadlineDate", "schools", "programs", "stats", "facets", "similar"],
        displayAliases: ["name", "coverageLabel", "deadline", "benefitRows", "eligibilityRows", "contactCard", "actionLinks"],
        agentBoundary: "Public scholarship analysis can cross schools, but application handoff must only include school/program-linked funding signals.",
      },
      AdminScholarship: {
        legacyModel: "AdminScholarship + AdminScholarshipInput + importAdminScholarships",
        backendType: "AdminScholarship + AdminScholarshipInput",
        frontendType: "AdminScholarship + AdminScholarshipInput + AdminScholarshipImportInput",
        cuacUsage: ["ops-admin.html"],
        canonicalKeys: ["id", "expectedVersion", "items", "slug", "title", "fundingLevel", "providerName", "bodySections", "benefitItems", "schoolIds", "programIds", "status", "version", "updatedAt"],
        displayAliases: ["publicScholarshipRecord", "scholarshipEditor", "contentScholarship", "scholarshipImportPayload"],
        agentBoundary: "AdminScholarship is an internal management view. It can create, update, archive, and import scholarship records with expectedVersion, schoolIds, and programIds, but student-facing pages must still render PublicScholarship copy.",
      },
      City: {
        legacyModel: "CityGuide",
        backendType: "CityGuideRecord + CityGuideAggregate",
        frontendType: "CityGuide + CityGuideAggregate",
        cuacUsage: ["cities.html", "city-detail.html", "home-v3.html", "programs.html"],
        canonicalKeys: ["slug", "nameZh", "nameEn", "region", "monthlyCost", "content", "contentJson", "references", "visiblePrograms"],
        displayAliases: ["id", "name", "budgetSummary", "costProfiles"],
        agentBoundary: "City analysis can combine public cost and aggregate counts, but should cite CityGuide.contentJson and derived aggregate fields separately.",
      },
      TimelineWindow: {
        legacyModel: "ApplicationTimelineWindow + ApplicationTimelineProject + ApplicationTimelineSchool + ApplicationTimelineResponse",
        backendType: "ApplicationTimelineWindow + ApplicationTimelineResponse",
        frontendType: "ApplicationTimelineWindow + ApplicationTimelineProject + ApplicationTimelineSchool + ApplicationTimelineResponse",
        cuacUsage: ["ops-admin.html", "hub.html", "notifications.html"],
        canonicalKeys: ["id", "month", "title", "applicationWindow", "cscaWindow", "schoolId", "schoolName", "deadlineDate", "days", "applicationRound", "rows", "earliest", "stats", "programs"],
        displayAliases: ["applicationTimeline", "deadlineWindow", "deadlineProject", "schoolDeadlineGroup", "cscaWindow"],
        agentBoundary: "Timeline windows and deadline projects guide planning and notifications, but do not create school-visible application records.",
      },
      StudentProfile: {
        legacyModel: "StudentProfile",
        backendType: "StudentProfileRecord",
        frontendType: "StudentProfile",
        cuacUsage: ["auth.html", "hub.html", "application.html", "school-portal.html"],
        canonicalKeys: ["nationality", "nationalityCode", "country", "countryCode", "grade", "gradeCode", "currentOrganizationId", "updatedAt"],
        displayAliases: ["studentCountry", "studentGrade", "studentOrganization", "schoolVisibleProfile"],
        agentBoundary: "StudentProfile can continue a student's logged-in application context, but school portals only receive the selected school's scoped handoff fields.",
      },
      AccessGovernance: {
        legacyModel: "AuthResult + User + AdminUser + AdminAIOrganization + AdminAIOrganizationInviteCreateResult + AdminAIOrganizationAdminAssignmentResult + AdminAIOrganizationInviteBulkReissueResult + AdminAIOrganizationInviteHistory + OrganizationInviteAcceptResult",
        backendType: "AuthResult + User + AdminUser + AdminAIOrganization + OrganizationInviteAcceptResult",
        frontendType: "AuthResult + User + AdminUser + AdminAIOrganization + AdminAIOrganizationInviteCreateResult + AdminAIOrganizationAdminAssignmentResult + AdminAIOrganizationInviteBulkReissueResult + AdminAIOrganizationInviteHistory + OrganizationInviteAcceptResult",
        cuacUsage: ["auth.html", "ops-admin.html", "school-portal.html", "hub.html"],
        canonicalKeys: ["id", "email", "role", "status", "displayName", "emailVerifiedAt", "tokens", "accessToken", "refreshToken", "agentAccessStatus", "agentMemoryState", "agentMemoryUntil", "members", "invites", "inviteAttempts", "assignment", "userId", "inviteId", "accepted", "membership", "cohortId", "cohortName", "acceptPath", "shortCode", "usedCount", "maxUses"],
        displayAliases: ["account", "authSession", "accessGrant", "schoolStaffInvite", "organizationMember", "userRole", "inviteAcceptance"],
        agentBoundary: "Access governance determines which signed-in account can use student, school-staff, or CUAC internal Agent context; tenant and role checks must be revalidated server-side.",
      },
      OpsAuditGovernance: {
        legacyModel: "AuditItem + AdminAuditSummary + AdminAuditEvent + AdminReadinessEvidenceFile + AdminReadinessEvidenceDetail",
        backendType: "AuditItem + AdminAuditSummary + AdminAuditEvent + AdminReadinessEvidenceDetail",
        frontendType: "AuditItem + AdminAuditSummary + AdminAuditEvent + AdminReadinessEvidenceFile + AdminReadinessEvidenceDetail",
        cuacUsage: ["ops-admin.html", "shared Agent high-risk confirmations"],
        canonicalKeys: ["id", "title", "detail", "schoolsTotal", "schoolsVerified", "schoolsPending", "adminAuditEventCount", "latestAdminAuditEventAt", "actorId", "actorEmail", "organizationId", "organizationSlug", "targetEmail", "module", "resourceType", "resourceId", "action", "before", "after", "createdAt", "name", "kind", "phase", "source", "status", "generatedAt", "sizeBytes", "modifiedAt", "file", "content"],
        displayAliases: ["opsAudit", "auditSummary", "auditEvent", "readinessEvidence", "agentAudit"],
        agentBoundary: "OpsAuditGovernance is CUAC-internal evidence for actions, readiness, and Agent audit. It must stay out of public student and school-tenant views except for scoped explanations.",
      },
      CommerceFlow: {
        legacyModel: "CartResult + CommerceOrder + PaymentCreateResult",
        backendType: "CartResult + CommerceOrder + PaymentCreateResult",
        frontendType: "CartResult + CommerceOrder + PaymentCreateResult",
        cuacUsage: ["application.html", "billing.html", "ops-admin.html"],
        canonicalKeys: ["items", "pricing", "currency", "payableTotalCents", "pricingBreakdown", "id", "status", "payment", "providerTxnId", "paymentId", "orderId", "callbackSignaturePayload"],
        displayAliases: ["cartResult", "commerceOrder", "paymentCreateResult", "invoice", "receipt"],
        agentBoundary: "Commerce state gates school sending: CUAC must not create school-visible records until a paid, free, or verified payment callback state is present.",
      },
    },
    school: [
      "id",
      "nameZh",
      "nameEn",
      "schoolType",
      "region",
      "city",
      "cityZh",
      "citySlug",
      "regionLabel",
      "rank",
      "cscaRequired",
      "cscaRequirement",
      "cscaSubjects",
      "languageRequirement",
      "applicationLevel",
      "languageOfInstruction",
      "hskRequirement",
      "englishRequirement",
      "deadlineSummary",
      "tuitionSummary",
      "applicationFee",
      "officialWebsiteUrl",
      "admissionsWebsiteUrl",
      "sourceUrl",
      "sourceLabel",
      "sourceNote",
      "source",
      "sourceId",
      "lastVerifiedAt",
      "verificationStatus",
      "qualityScore",
      "missingFields",
      "completenessLabel",
      "featuredPrograms",
      "scholarships",
      "derivedTags",
      "subjectTags",
      "fitNotes",
      "languageTags",
      "tuitionBandLabel",
      "hasEnglishPrograms",
      "hasScholarships",
      "decisionSummary",
      "programCount",
      "undergraduateProgramCount",
      "postgraduateProgramCount",
      "englishProgramCount",
      "programSubjectTags",
      "programTuitionBandLabel",
      "programQualityIssues",
      "scholarshipCount",
      "cscScholarshipCount",
      "programs",
      "cscaRules",
      "scholarshipsDetailed",
      "upcomingDeadlines",
      "requiredSubjectTags",
      "quickFacts",
      "detailDisplay",
      "status",
      "createdAt",
      "updatedAt",
      "version",
    ],
    schoolProgram: [
      "id",
      "schoolId",
      "nameZh",
      "nameEn",
      "degreeLevel",
      "durationYears",
      "fieldCategory",
      "teachingLanguage",
      "cscaSubjects",
      "cscaRequirement",
      "hskRequirement",
      "englishRequirement",
      "tuitionAmount",
      "tuitionCurrency",
      "tuitionPeriod",
      "tuitionText",
      "scholarshipText",
      "openDate",
      "deadlineDate",
      "deadlineLabel",
      "applicationRound",
      "applicationUrl",
      "applicationNote",
      "sourceUrl",
      "sourceLabel",
      "lastVerifiedAt",
      "sortOrder",
      "status",
      "isVerified",
      "hasScholarship",
      "badgeText",
      "displayTuition",
      "displaySubjects",
      "displayGroup",
      "displayGroupLabel",
    ],
    schoolScholarship: [
      "id",
      "schoolId",
      "programId",
      "name",
      "type",
      "coverage",
      "applicableDegree",
      "applicableProgram",
      "amountText",
      "requirementText",
      "deadlineDate",
      "deadlineLabel",
      "applicationRound",
      "scholarshipSlug",
      "sourceUrl",
      "sourceLabel",
      "lastVerifiedAt",
      "sortOrder",
      "status",
      "isCsc",
      "isVerified",
    ],
    publicScholarship: [
      "id",
      "slug",
      "title",
      "type",
      "typeLabel",
      "fundingLevel",
      "providerName",
      "providerNameEn",
      "providerLocation",
      "coverage",
      "applicableDegree",
      "applicableProgram",
      "schoolId",
      "schoolName",
      "schoolNameEn",
      "schools",
      "programId",
      "programName",
      "programNameEn",
      "programs",
      "amountText",
      "requirementText",
      "bodySections",
      "benefitItems",
      "eligibilityItems",
      "applicationMaterials",
      "applicationSteps",
      "contactInfo",
      "actionLinks",
      "deadlineDate",
      "deadlineLabel",
      "applicationRound",
      "targetCountries",
      "targetRegions",
      "benefits",
      "sourceUrl",
      "sourceLabel",
      "lastVerifiedAt",
      "sortOrder",
      "tags",
      "summary",
    ],
    cityGuide: [
      "slug",
      "nameZh",
      "nameEn",
      "region",
      "monthlyCost",
      "costLevel",
      "density",
      "tags",
      "content",
      "nearby",
      "references",
      "referenceSchoolCount",
      "referenceProgramCount",
      "referenceEnglishProgramCount",
      "referenceScholarshipCount",
      "referenceCscaSchoolCount",
      "aggregate",
      "actualSchoolCount",
      "actualProgramCount",
      "actualEnglishProgramCount",
      "actualScholarshipCount",
      "actualCscaRequiredSchoolCount",
      "visibleSchools",
      "visiblePrograms",
      "visibleScholarships",
      "status",
      "sortOrder",
      "version",
      "updatedAt",
    ],
    addChoiceInformationSources: {
      selectedByStudent: ["schoolId", "programId", "degreeLevel", "intake", "teachingLanguage", "studentChoiceNote"],
      fromProgramRecord: ["nameZh", "nameEn", "degreeLevel", "durationYears", "fieldCategory", "teachingLanguage", "cscaSubjects", "cscaRequirement", "hskRequirement", "englishRequirement", "tuitionAmount", "tuitionText", "deadlineDate", "applicationRound", "applicationUrl", "applicationNote", "sourceUrl", "lastVerifiedAt"],
      fromSchoolRecord: ["nameZh", "nameEn", "citySlug", "cityZh", "region", "admissionsWebsiteUrl", "applicationFee"],
      fromStudentProfile: ["legalName", "email", "phone", "country", "countryCode", "nationality", "nationalityCode", "passportNationality", "highestEducation", "grade", "gradeCode", "currentSchool", "currentOrganizationId", "intendedLevel", "fundingIntent", "languageTests", "academicSummary", "guardianStatus", "updatedAt", "consent"],
      notCollectedByCuac: ["transcriptFile", "passportScan", "languageCertificateFile", "recommendationLetters", "physicalExamForm"],
    },
  };

  const routeContracts = [
    {
      route: "home-v3.html",
      surface: "public-student",
      role: "visitor_or_student",
      audience: "International student visitor",
      primaryTask: "Start China study discovery and route toward concrete programs.",
      dataSource: ["shared-client", "static-html"],
      agentMode: "home",
      keyExits: ["programs.html", "onboarding.html", "hub.html"],
      requiredStates: ["loading", "success"],
      permissionRisk: "Low; public content only.",
      productizationStatus: "Started: home categories, featured routes, intakes, cities, and schools read shared discovery summary data.",
    },
    {
      route: "programs.html",
      surface: "public-student",
      role: "visitor_or_student",
      audience: "Program-search student",
      primaryTask: "Search and compare concrete university programs.",
      dataSource: ["shared-client", "fallback"],
      agentMode: "programs",
      keyExits: ["program-detail.html", "university-detail.html", "application.html#add-choice"],
      requiredStates: ["loading", "empty", "success"],
      permissionRisk: "Low; add-choice requires student application context later.",
      productizationStatus: "Catalog list uses CuacDataClient, pagination, filters, compare state, and protected choice entry.",
    },
    {
      route: "program-detail.html",
      surface: "public-student",
      role: "visitor_or_student",
      audience: "Program evaluator",
      primaryTask: "Inspect one concrete program route.",
      dataSource: ["shared-client", "fallback"],
      agentMode: "programs",
      keyExits: ["application.html#add-choice", "university-detail.html"],
      requiredStates: ["loading", "empty", "success"],
      permissionRisk: "Low; must not imply admission guarantee.",
      productizationStatus: "Detail shell uses CuacDataClient completion catalog.",
    },
    {
      route: "universities.html",
      surface: "public-student",
      role: "visitor_or_student",
      audience: "School-comparison student",
      primaryTask: "Compare schools and route counts.",
      dataSource: ["shared-client"],
      agentMode: "universities",
      keyExits: ["university-detail.html", "programs.html"],
      requiredStates: ["loading", "empty", "success"],
      permissionRisk: "Low; school data freshness needs review.",
      productizationStatus: "Catalog list uses CuacDataClient, pagination, filters, favourites, and filtered program exits.",
    },
    {
      route: "university-detail.html",
      surface: "public-student",
      role: "visitor_or_student",
      audience: "School evaluator",
      primaryTask: "Inspect one school profile and related routes.",
      dataSource: ["shared-client", "fallback"],
      agentMode: "universities",
      keyExits: ["program-detail.html", "application.html#add-choice"],
      requiredStates: ["loading", "empty", "success"],
      permissionRisk: "Low; official detail labels must stay student-readable.",
      productizationStatus: "Detail shell uses CuacDataClient completion catalog with student-readable field labels.",
    },
    {
      route: "scholarships.html",
      surface: "public-student",
      role: "visitor_or_student",
      audience: "Funding-sensitive student",
      primaryTask: "Compare scholarship and funding routes.",
      dataSource: ["shared-client"],
      agentMode: "scholarships",
      keyExits: ["scholarship-detail.html", "programs.html"],
      requiredStates: ["loading", "empty", "success"],
      permissionRisk: "Medium; copy must avoid guaranteed-funding claims.",
      productizationStatus: "Discovery scholarships use CuacDataClient with funding filters, student-readable actions, pagination, and matching-program exits.",
    },
    {
      route: "scholarship-detail.html",
      surface: "public-student",
      role: "visitor_or_student",
      audience: "Scholarship evaluator",
      primaryTask: "Inspect coverage, eligibility, timing, and risk.",
      dataSource: ["shared-client", "fallback"],
      agentMode: "scholarships",
      keyExits: ["programs.html", "scholarships.html"],
      requiredStates: ["loading", "empty", "success"],
      permissionRisk: "Medium; funding official notice and deadline must be explicit.",
      productizationStatus: "Detail shell uses CuacDataClient completion catalog with student-readable funding fields.",
    },
    {
      route: "cities.html",
      surface: "public-student",
      role: "visitor_or_student",
      audience: "City-fit student",
      primaryTask: "Compare city cost, route density, and arrival fit.",
      dataSource: ["shared-client"],
      agentMode: "cities",
      keyExits: ["city-detail.html", "programs.html", "universities.html"],
      requiredStates: ["loading", "empty", "success"],
      permissionRisk: "Low; costs are estimates and need official-detail labels.",
      productizationStatus: "Discovery cities use CuacDataClient with city-detail exits and saved context.",
    },
    {
      route: "city-detail.html",
      surface: "public-student",
      role: "visitor_or_student",
      audience: "City evaluator",
      primaryTask: "Inspect cost and study implications for one city.",
      dataSource: ["shared-client", "fallback"],
      agentMode: "cities",
      keyExits: ["programs.html", "universities.html"],
      requiredStates: ["loading", "empty", "success"],
      permissionRisk: "Low; cost data should remain estimate-labeled.",
      productizationStatus: "Detail shell resolves non-default discovery cities with student-readable city fields and route exits.",
    },
    {
      route: "guides.html",
      surface: "public-student",
      role: "visitor_or_student",
      audience: "Application-learning student",
      primaryTask: "Understand China application steps and documents.",
      dataSource: ["static-html", "shared-client"],
      agentMode: "guides",
      keyExits: ["guide-detail.html", "programs.html", "scholarships.html"],
      requiredStates: ["loading", "success"],
      permissionRisk: "Low; guide content should distinguish CUAC vs school actions.",
      productizationStatus: "Guide search references use CuacDataClient with page-context Agent prompts and detail exits.",
    },
    {
      route: "guide-detail.html",
      surface: "public-student",
      role: "visitor_or_student",
      audience: "Checklist-focused student",
      primaryTask: "Follow one focused application checklist.",
      dataSource: ["shared-client", "fallback"],
      agentMode: "guides",
      keyExits: ["application.html", "guides.html"],
      requiredStates: ["loading", "empty", "success"],
      permissionRisk: "Low; should not imply CUAC collects official files.",
      productizationStatus: "Detail shell uses CuacDataClient completion catalog with checklist-style recovery states.",
    },
    {
      route: "auth.html",
      surface: "account",
      role: "visitor",
      audience: "Visitor creating or entering an account",
      primaryTask: "Sign in or register for a CUAC account, then receive role and organization permissions.",
      dataSource: ["static-html"],
      agentMode: "off",
      keyExits: ["onboarding.html", "hub.html"],
      requiredStates: ["empty", "error", "success"],
      permissionRisk: "High later; real auth must separate student, school, and CUAC staff permissions within one account system.",
      productizationStatus: "Demo-only auth state.",
    },
    {
      route: "onboarding.html",
      surface: "authenticated-student",
      role: "student",
      audience: "Student setting first study intent",
      primaryTask: "Capture first study goal and preferences.",
      dataSource: ["local-state"],
      agentMode: "onboarding",
      keyExits: ["hub.html"],
      requiredStates: ["loading", "success"],
      permissionRisk: "Medium; profile data needs account ownership later.",
      productizationStatus: "Onboarding preview feeds Hub local state.",
    },
    {
      route: "hub.html",
      surface: "authenticated-student",
      role: "student",
      audience: "Returning student",
      primaryTask: "Track next actions and start application choices.",
      dataSource: ["shared-client", "local-state"],
      agentMode: "hub",
      keyExits: ["application.html#add-choice", "favourites.html", "notifications.html"],
      requiredStates: ["loading", "empty", "success"],
      permissionRisk: "Medium; must show only the student's own data.",
      productizationStatus: "Hub summary reads shared student profile, onboarding override, routes, documents, application entry, and school follow-up state.",
    },
    {
      route: "favourites.html",
      surface: "authenticated-student",
      role: "student",
      audience: "Student with saved items",
      primaryTask: "Turn saved programs into application-ready choices.",
      dataSource: ["shared-client", "local-state"],
      agentMode: "favourites",
      keyExits: ["application.html#add-choice", "programs.html"],
      requiredStates: ["empty", "success"],
      permissionRisk: "Medium; saved universities should not become choices without a program.",
      productizationStatus: "Saved items, collections, route groups, compare defaults, and choice defaults read from shared saved-items summary data.",
    },
    {
      route: "application.html",
      surface: "authenticated-student",
      role: "student",
      audience: "Applicant student",
      primaryTask: "Build, pay, and submit a multi-school application set.",
      dataSource: ["shared-client", "local-state"],
      agentMode: "application",
      keyExits: ["billing.html", "school-portal.html", "hub.html"],
      requiredStates: ["loading", "empty", "error", "success", "confirmation"],
      permissionRisk: "High; payment and school routing require confirmations and audit later.",
      productizationStatus: "Fee calculation, payment state, consent, selected choices, and school records use CuacDataClient/local state.",
    },
    {
      route: "billing.html",
      surface: "authenticated-student",
      role: "student",
      audience: "Applicant reviewing receipt",
      primaryTask: "Review payment boundary and receipt.",
      dataSource: ["shared-client"],
      agentMode: "application",
      keyExits: ["application.html", "school-portal.html"],
      requiredStates: ["loading", "empty", "success"],
      permissionRisk: "High later; invoices must be account-owned and immutable.",
      productizationStatus: "Billing snapshot uses CuacDataClient and reflects payment failure, preview, paid, or free-submitted state.",
    },
    {
      route: "notifications.html",
      surface: "authenticated-student",
      role: "student",
      audience: "Student checking tasks",
      primaryTask: "Review messages, deadlines, and school-contact tasks.",
      dataSource: ["shared-client", "local-state"],
      agentMode: "notifications",
      keyExits: ["application.html", "hub.html"],
      requiredStates: ["empty", "success"],
      permissionRisk: "Medium; messages must be account-scoped later.",
      productizationStatus: "Base notification items, dynamic school/payment events, default preferences, and group ordering read shared notification summary data.",
    },
    {
      route: "preferences.html",
      surface: "authenticated-student",
      role: "student",
      audience: "Student managing account settings",
      primaryTask: "Manage preferences, notifications, and Agent controls.",
      dataSource: ["shared-client", "local-state"],
      agentMode: "preferences",
      keyExits: ["billing.html", "hub.html"],
      requiredStates: ["error", "success"],
      permissionRisk: "High; security and Agent permissions need real account controls.",
      productizationStatus: "Section copy, profile summary, workspace health, notification preferences, and Agent memory controls read shared preference summary data.",
    },
    {
      route: "school-portal.html",
      surface: "school-staff",
      role: "school_staff",
      audience: "School admissions teacher",
      primaryTask: "Triage tenant-scoped CUAC application records.",
      dataSource: ["shared-client", "local-state"],
      agentMode: "school",
      keyExits: ["school-settings.html", "mailto:"],
      requiredStates: ["loading", "empty", "success", "confirmation"],
      permissionRisk: "Critical; must show only this school's own records.",
      productizationStatus: "Tenant records, analytics loading, owner workload, export confirmation, and student feedback loop use CuacDataClient/local state.",
    },
    {
      route: "school-settings.html",
      surface: "school-staff",
      role: "school_owner_or_staff",
      audience: "School owner or admissions staff",
      primaryTask: "Manage staff, templates, and tenant settings.",
      dataSource: ["shared-client"],
      agentMode: "school",
      keyExits: ["school-portal.html"],
      requiredStates: ["loading", "success", "confirmation"],
      permissionRisk: "Critical; staff changes and exports must be audited.",
      productizationStatus: "Frontend settings preview covers staff seats, owner routing, templates, response targets, and local save; needs production settings API shape.",
    },
    {
      route: "ops-admin.html",
      surface: "cuac-internal",
      role: "cuac_ops",
      audience: "Internal CUAC operations",
      primaryTask: "Monitor catalog quality, routing, payments, support, and Agent audit.",
      dataSource: ["shared-client"],
      agentMode: "ops",
      keyExits: ["home-v3.html"],
      requiredStates: ["loading", "empty", "success", "confirmation"],
      permissionRisk: "Critical; cross-tenant access must be internal-only and audited.",
      productizationStatus: "Frontend Ops preview covers audit actions, support lookup, and high-risk confirmation; needs production ops data and internal auth boundary.",
    },
  ];

  const backendAdapterContract = {
    status: "frontend-demo-contract",
    principle: "Pages call CuacDataClient methods; production can replace the method bodies with API calls without changing page code.",
    authBoundary: {
      current: "localStorage demo session plus role-aware shared shell",
      production: "session API with role, tenant membership, invitation or approval grants, and continuation replay checks",
      mustRecheck: ["role", "surface", "tenantSchoolId", "actionKey", "continuationToken"],
    },
    domains: [
      {
        domain: "catalog",
        ownerSurface: "public-student",
        currentMethods: ["getDiscoveryPrograms", "getDiscoverySchools", "getDiscoveryScholarships", "getDiscoveryCities", "getDiscoveryGuides", "getCompletionDetail"],
        productionEndpoints: ["GET /api/catalog/programs", "GET /api/catalog/schools", "GET /api/catalog/scholarships", "GET /api/catalog/cities", "GET /api/catalog/details/:type/:id"],
        requiredScopes: ["public_catalog"],
        adapterNotes: "Preserve CSCAlite-compatible fields and sourceFieldLineage while rendering student-readable labels.",
      },
      {
        domain: "student_profile",
        ownerSurface: "authenticated-student",
        currentMethods: ["getStudentHubSummary", "getPreferenceCenterSummary", "writeApplicationDemoState"],
        productionEndpoints: ["GET /api/me/profile", "PATCH /api/me/profile", "GET /api/me/preferences", "PATCH /api/me/preferences"],
        requiredScopes: ["student_account"],
        adapterNotes: "Signed-in student context may persist until the application lifecycle or enrollment archive ends.",
      },
      {
        domain: "applications_payments",
        ownerSurface: "authenticated-student",
        currentMethods: ["calculateFee", "buildSubmittedRecords", "getBillingSnapshot", "writeApplicationDemoState", "CartResult", "CommerceOrder", "PaymentCreateResult"],
        productionEndpoints: ["POST /api/applications/sets", "POST /api/applications/sets/:id/choices", "POST /api/payments/intents", "POST /api/applications/sets/:id/send", "GET /api/billing/:invoiceId"],
        requiredScopes: ["student_account", "payment_confirmation"],
        adapterNotes: "Payment failure keeps choices saved and must not create school-visible records; successful payment/free entitlement writes one tenant record per selected school. The frontend demo stores CSCAlite-shaped CartResult, CommerceOrder, and PaymentCreateResult objects for handoff QA.",
      },
      {
        domain: "school_portal",
        ownerSurface: "school-staff",
        currentMethods: ["getTenantSubmittedRecords", "getSampleSchoolApplications", "writeSchoolPortalDemoState"],
        productionEndpoints: ["GET /api/school/applications", "PATCH /api/school/applications/:id/status", "POST /api/school/exports", "GET /api/school/analytics"],
        requiredScopes: ["school_tenant"],
        adapterNotes: "Every request must resolve tenantSchoolId server-side; school staff cannot see other-school choices or student private Agent memory.",
      },
      {
        domain: "school_settings",
        ownerSurface: "school-staff",
        currentMethods: ["getCompletionDetail"],
        productionEndpoints: ["GET /api/school/settings", "PATCH /api/school/settings", "POST /api/school/staff-invitations", "PATCH /api/school/templates/:id"],
        requiredScopes: ["school_tenant", "school_owner_or_staff"],
        adapterNotes: "Staff seats, owner routing, templates, and response targets need audited tenant-scoped writes.",
      },
      {
        domain: "notifications",
        ownerSurface: "authenticated-student",
        currentMethods: ["getNotificationCenterSummary", "addNotificationEvent", "writeNotificationCenterState"],
        productionEndpoints: ["GET /api/notifications", "PATCH /api/notifications/:id", "POST /api/notifications/preferences"],
        requiredScopes: ["student_account"],
        adapterNotes: "School-contact and payment events should be account-scoped and deduplicated across reloads.",
      },
      {
        domain: "agent_actions",
        ownerSurface: "student-school-ops",
        currentMethods: ["getAgentContextPolicy", "getRouteContract"],
        productionEndpoints: ["POST /api/agent/respond", "POST /api/agent/actions/preview", "POST /api/agent/actions/execute", "POST /api/agent/memory/clear"],
        requiredScopes: ["guest_page", "student_account", "school_tenant", "ops_audit"],
        adapterNotes: "Guest uses current-page context only; signed-in student uses lifecycle memory; school uses tenant work-session context; Ops requires audit.",
      },
      {
        domain: "ops_admin",
        ownerSurface: "cuac-internal",
        currentMethods: ["getCompletionDetail"],
        productionEndpoints: ["GET /api/ops/dashboard", "POST /api/ops/retry", "GET /api/ops/audit", "POST /api/ops/support/lookup"],
        requiredScopes: ["ops_audit"],
        adapterNotes: "Cross-tenant support and payment/internal actions require role checks, reason capture, and audit logs.",
      },
    ],
  };

  const programCatalog = {
    "Zhejiang University": [
      { program: "Computer Science BSc", city: "Hangzhou", degree: "Undergraduate", intake: "Fall 2026", language: "English-taught", tuition: "RMB 32k", deadline: "Oct 15", signal: "Strong foundation" },
      { program: "Computer Science MSc", city: "Hangzhou", degree: "Master", intake: "Fall 2026", language: "English-taught", tuition: "RMB 42k", deadline: "Oct 15", signal: "CSC possible" },
      { program: "Biomedical Engineering MSc", city: "Hangzhou", degree: "Master", intake: "Fall 2026", language: "English-taught", tuition: "RMB 45k", deadline: "Oct 15", signal: "Lab route" },
    ],
    "Nanjing University": [
      { program: "International Economics BA", city: "Nanjing", degree: "Undergraduate", intake: "Fall 2026", language: "English-taught", tuition: "RMB 30k", deadline: "Dec 20", signal: "Lower cost" },
      { program: "Software Engineering MSc", city: "Nanjing", degree: "Master", intake: "Fall 2026", language: "English-taught", tuition: "RMB 39k", deadline: "Dec 20", signal: "Lower cost" },
      { program: "Data Science MSc", city: "Nanjing", degree: "Master", intake: "Fall 2026", language: "English-taught", tuition: "RMB 40k", deadline: "Dec 20", signal: "Tech route" },
    ],
    UIBE: [
      { program: "International Business BA", city: "Beijing", degree: "Undergraduate", intake: "Fall 2026", language: "English-taught", tuition: "RMB 28k", deadline: "Nov 10", signal: "Business route" },
      { program: "International Trade MSc", city: "Beijing", degree: "Master", intake: "Fall 2026", language: "English-taught", tuition: "RMB 36k", deadline: "Nov 10", signal: "Funding-sensitive" },
      { program: "Finance MSc", city: "Beijing", degree: "Master", intake: "Fall 2026", language: "English-taught", tuition: "RMB 38k", deadline: "Nov 10", signal: "Business fit" },
    ],
    "Fudan University": [
      { program: "Data Science MSc", city: "Shanghai", degree: "Master", intake: "Fall 2026", language: "English-taught", tuition: "RMB 52k", deadline: "Sep 12", signal: "Selective" },
      { program: "Economics BA", city: "Shanghai", degree: "Undergraduate", intake: "Fall 2026", language: "Chinese-taught", tuition: "RMB 26k", deadline: "Sep 12", signal: "HSK required" },
    ],
    "Tongji University": [
      { program: "Architecture BArch", city: "Shanghai", degree: "Undergraduate", intake: "Fall 2026", language: "Chinese-taught", tuition: "RMB 34k", deadline: "Nov 20", signal: "Portfolio" },
      { program: "Architecture MSc", city: "Shanghai", degree: "Master", intake: "Fall 2026", language: "English-taught", tuition: "RMB 46k", deadline: "Nov 20", signal: "Portfolio" },
      { program: "Civil Engineering MSc", city: "Shanghai", degree: "Master", intake: "Fall 2026", language: "English-taught", tuition: "RMB 39k", deadline: "Nov 20", signal: "Strong route" },
    ],
  };

  const schoolCatalogDefaults = {
    schoolType: "regular",
    guaranteedAdmission: false,
    tierEn: "Project 985 / Double First-Class signal",
    logoUrl: "",
    officialWebsite: "Confirm official website",
    applicationSystemUrl: "School admissions portal",
    applicationLevel: ["Bachelor", "Master"],
    admissionLevel: ["Bachelor", "Master"],
    hskRequirement: "Program-specific; Chinese-taught routes usually require HSK.",
    hskNotes: "Confirm latest HSK rule by school and program.",
    cscaRequirement: "Confirm by school and program.",
    cscaRequired: false,
    cscaRequirementNote: "CSCA applicability can vary by route and policy year.",
    undergradRequirements: "High school graduation certificate, transcript, passport, language proof, and school-requested materials.",
    postgradRequirements: "Bachelor degree certificate, transcript, passport, language proof, study plan, and school-requested materials.",
    preparatoryRequirements: "Confirm preparatory route availability with the school.",
    languageOfInstruction: ["Chinese-taught", "English-taught"],
    hskMinLevel: 4,
    hskChineseMinLevel: 5,
    hskChineseMinListening: 60,
    hskChineseMinReading: 60,
    hskChineseMinWriting: 60,
    hskChineseConditional: "Some programs may review conditional language routes.",
    hskEnglishRequired: false,
    hskkRequired: false,
    hskkChineseMinLevel: "",
    hskkChineseConditional: "Confirm if oral Chinese proof is required.",
    englishRequired: true,
    englishMinIelts: 6,
    englishMinToefl: 80,
    englishRequirement: "IELTS / TOEFL or school-approved waiver for English-taught routes.",
    englishRequirementNote: "Exact English proof depends on program and prior education language.",
    round1OpenDate: "2026-03-01",
    round1CloseDate: "2026-06-30",
    round1Deadline: "2026-06-30",
    round2OpenDate: "2026-07-01",
    round2CloseDate: "2026-10-15",
    round2Deadline: "2026-10-15",
    applicationSteps: "Student chooses a concrete school and program route in CUAC; CUAC sends school-scoped non-document information after payment; school contacts student for official materials.",
    tuitionSummary: "RMB 26k-52k / year by program",
    tuitionByCategory: { bachelor: "RMB 26k-34k / year", master: "RMB 36k-52k / year" },
    applicationFee: "School confirms during official application",
    insurance: "Approx. RMB 800 / year",
    accommodationCost: "Approx. RMB 8k-18k / year",
    accommodationType: "On-campus or nearby student housing, subject to availability",
    scholarships: ["CSC or university/provincial scholarship routes where eligible"],
    englishPrograms: "Selected English-taught undergraduate and postgraduate routes.",
    notablePrograms: "Engineering, Computer Science, Business, Economics, Medicine",
    campusFacilities: "International office, library, dormitory, canteen, student services",
    programFields: "Engineering, Computer Science, Business, Economics, Medicine",
    contactTel: "Confirm school contact",
    contactEmail: "Confirm international office email",
    contactAddress: "Confirm international student office address",
    yearEstablished: 1896,
    studentCount: "Large comprehensive university",
    studentsServed: 0,
    under18GuardianRequired: false,
    under18RequirementNote: "Under-18 applicants should confirm guardian requirements with the school.",
    status: "published",
    version: 1,
    source: "cscalite",
    sourceUrl: "",
    dataQualityScore: 88,
    createdAt: "2026-08-14",
    updatedAt: "2026-08-14",
    changeLogs: [],
    snapshots: [],
    cscaRules: [],
    detailedScholarships: [],
    scholarshipLinks: [],
    savedByUsers: [],
    compareByUsers: [],
    cartItems: [],
    orderItems: [],
  };

  const schoolCatalog = {
    "Zhejiang University": { ...schoolCatalogDefaults, id: 101, nameZh: "浙江大学", nameEn: "Zhejiang University", rank: 3, citySlug: "hangzhou", cityZh: "杭州", region: "Zhejiang", officialWebsite: "https://www.zju.edu.cn/", applicationSystemUrl: "https://isinfosys.zju.edu.cn", sourceId: "zhejiang-university", sourceLabel: "CSCAlite school record", lastVerifiedAt: "2026-08-14", dataQualityScore: 94, englishPrograms: "Computer Science MSc, Biomedical Engineering MSc, and selected English-taught routes.", notablePrograms: "Computer Science, Biomedical Engineering, Medicine, International Business", programFields: "Engineering, Computer Science, Medicine, Business", contactEmail: "iso@zju.edu.cn" },
    "Tsinghua University": { ...schoolCatalogDefaults, id: 106, nameZh: "清华大学", nameEn: "Tsinghua University", rank: 1, citySlug: "beijing", cityZh: "北京", region: "Beijing", sourceId: "tsinghua-university", sourceLabel: "CSCAlite school record", lastVerifiedAt: "2026-08-14", dataQualityScore: 95, englishPrograms: "Selected English-taught graduate routes.", notablePrograms: "Engineering, Computer Science, Architecture, Public Policy", programFields: "Engineering, Computer Science, Architecture, Policy", contactEmail: "grad@tsinghua.edu.cn" },
    "Nanjing University": { ...schoolCatalogDefaults, id: 102, nameZh: "南京大学", nameEn: "Nanjing University", rank: 6, citySlug: "nanjing", cityZh: "南京", region: "Jiangsu", applicationSystemUrl: "https://istudy.nju.edu.cn", sourceId: "nanjing-university", sourceLabel: "CSCAlite school record", lastVerifiedAt: "2026-08-14", dataQualityScore: 91, round2Deadline: "2026-12-20", englishPrograms: "Software Engineering MSc, Data Science MSc, and selected English-taught routes.", notablePrograms: "Software Engineering, Data Science, International Economics", programFields: "Computer Science, Business, International Relations", contactEmail: "international@nju.edu.cn" },
    UIBE: { ...schoolCatalogDefaults, id: 103, nameZh: "对外经济贸易大学", nameEn: "UIBE", rank: 45, citySlug: "beijing", cityZh: "北京", region: "Beijing", applicationSystemUrl: "https://sie.uibe.edu.cn", tierEn: "Finance and business specialist", sourceId: "uibe", sourceLabel: "CSCAlite school record", lastVerifiedAt: "2026-08-14", dataQualityScore: 89, round2Deadline: "2026-11-10", englishPrograms: "International Business BA, International Trade MSc, Finance MSc.", notablePrograms: "International Business, International Trade, Finance", programFields: "Business, Economics, Finance", contactEmail: "sie@uibe.edu.cn" },
    "Fudan University": { ...schoolCatalogDefaults, id: 104, nameZh: "复旦大学", nameEn: "Fudan University", rank: 4, citySlug: "shanghai", cityZh: "上海", region: "Shanghai", sourceId: "fudan-university", sourceLabel: "CSCAlite school record", lastVerifiedAt: "2026-08-14", dataQualityScore: 93, round2Deadline: "2026-09-12", hskMinLevel: 5, hskChineseMinLevel: 5, englishPrograms: "Data Science MSc and selected English-taught postgraduate routes.", notablePrograms: "Economics, Data Science, Medicine, Business", programFields: "Economics, Data Science, Business, Medicine", contactEmail: "iso@fudan.edu.cn" },
    "Tongji University": { ...schoolCatalogDefaults, id: 105, nameZh: "同济大学", nameEn: "Tongji University", rank: 17, citySlug: "shanghai", cityZh: "上海", region: "Shanghai", sourceId: "tongji-university", sourceLabel: "CSCAlite school record", lastVerifiedAt: "2026-08-14", dataQualityScore: 86, round2Deadline: "2026-11-20", englishPrograms: "Architecture MSc, Civil Engineering MSc, and selected English-taught routes.", notablePrograms: "Architecture, Civil Engineering, Design", programFields: "Engineering, Architecture, Design", contactEmail: "study@tongji.edu.cn" },
  };

  const schoolScholarshipCatalog = [
    { id: 501, schoolId: 101, programId: 10102, name: "Zhejiang University International Student Scholarship", type: "university", coverage: "Partial tuition or merit review", applicableDegree: "Master", applicableProgram: "Computer Science MSc", amountText: "School confirms current award amount", requirementText: "Strong transcript, study plan, and school review.", deadlineDate: "2026-10-15", deadlineLabel: "Oct 15", applicationRound: "Fall 2026", scholarshipSlug: "zju-international-student-scholarship", sourceUrl: "", sourceLabel: "CSCAlite SchoolScholarship record", lastVerifiedAt: "2026-08-14", sortOrder: 1, status: "published", isCsc: false, isVerified: true },
    { id: 502, schoolId: 101, programId: 10102, name: "CSC possible through university channel", type: "government", coverage: "Full funding route if nominated", applicableDegree: "Master / Doctoral", applicableProgram: "Computer Science MSc", amountText: "Full funding route; final coverage follows CSC notice", requirementText: "CSC eligibility, nomination route, study plan, and recommendation letters.", deadlineDate: "2026-10-15", deadlineLabel: "Oct 15", applicationRound: "Fall 2026", scholarshipSlug: "csc-university-channel", sourceUrl: "", sourceLabel: "CSCAlite SchoolScholarship record", lastVerifiedAt: "2026-08-14", sortOrder: 2, status: "published", isCsc: true, isVerified: true },
    { id: 503, schoolId: 101, programId: 10103, name: "ZJU lab-route merit review", type: "university", coverage: "Supervisor or school merit review", applicableDegree: "Master", applicableProgram: "Biomedical Engineering MSc", amountText: "School confirms current lab route support", requirementText: "Research fit and supervisor availability should be checked by school.", deadlineDate: "2026-10-15", deadlineLabel: "Oct 15", applicationRound: "Fall 2026", scholarshipSlug: "zju-lab-route-merit", sourceUrl: "", sourceLabel: "CSCAlite SchoolScholarship record", lastVerifiedAt: "2026-08-14", sortOrder: 3, status: "published", isCsc: false, isVerified: true },
    { id: 504, schoolId: 102, programId: 10202, name: "Jiangsu Jasmine Scholarship signal", type: "province", coverage: "Provincial funding route", applicableDegree: "Master", applicableProgram: "Software Engineering MSc", amountText: "Coverage follows Jiangsu notice", requirementText: "Confirm school nomination and provincial eligibility.", deadlineDate: "2026-12-20", deadlineLabel: "Dec 20", applicationRound: "Fall 2026", scholarshipSlug: "jiangsu-jasmine-scholarship", sourceUrl: "", sourceLabel: "CSCAlite SchoolScholarship record", lastVerifiedAt: "2026-08-14", sortOrder: 4, status: "published", isCsc: false, isVerified: true },
    { id: 505, schoolId: 103, programId: 10302, name: "UIBE business merit award", type: "university", coverage: "Partial university award", applicableDegree: "Master", applicableProgram: "International Trade MSc", amountText: "Partial tuition route", requirementText: "Business background, transcript strength, and school review.", deadlineDate: "2026-11-10", deadlineLabel: "Nov 10", applicationRound: "Fall 2026", scholarshipSlug: "uibe-business-merit-award", sourceUrl: "", sourceLabel: "CSCAlite SchoolScholarship record", lastVerifiedAt: "2026-08-14", sortOrder: 5, status: "published", isCsc: false, isVerified: true },
  ];

  const discoveryPrograms = [

        {
          id: "zju-cs-msc",
          name: "Computer Science MSc",
          nameZh: "计算机科学硕士",
          university: "Zhejiang University",
          city: "Hangzhou",
          province: "Zhejiang",
          degree: "master",
          subject: "Computer Science",
          language: "english",
          intake: "Fall 2026",
          term: "fall",
          duration: "2 years",
          deadline: "2026-10-15",
          deadlineStatus: "closes-soon",
          tuition: 42000,
          scholarship: true,
          scholarshipType: "CSC + university",
          langReq: "IELTS 6.5",
          hsk: "No HSK first",
          documents: "heavy",
          documentCount: 7,
          source: "verified",
          verified: "Aug 1",
          readiness: "Needs IELTS",
          readinessType: "warn",
          fit: "English route, Hangzhou, scholarship options, but documents are heavy.",
        },
        {
          id: "fudan-econ-ba",
          name: "Economics BA",
          nameZh: "经济学本科",
          university: "Fudan University",
          city: "Shanghai",
          province: "Shanghai",
          degree: "undergraduate",
          subject: "Economics",
          language: "chinese",
          intake: "Fall 2026",
          term: "fall",
          duration: "4 years",
          deadline: "2026-09-12",
          deadlineStatus: "urgent",
          tuition: 26000,
          scholarship: true,
          scholarshipType: "Shanghai Government",
          langReq: "HSK 5",
          hsk: "HSK required",
          documents: "medium",
          documentCount: 5,
          source: "verified",
          verified: "Jul 28",
          readiness: "HSK blocker",
          readinessType: "risk",
          fit: "Strong Shanghai option, but Chinese-taught route requires HSK.",
        },
        {
          id: "tongji-civil-msc",
          name: "Civil Engineering MSc",
          university: "Tongji University",
          city: "Shanghai",
          province: "Shanghai",
          degree: "master",
          subject: "Engineering",
          language: "english",
          intake: "Fall 2026",
          term: "fall",
          duration: "2 years",
          deadline: "2026-11-20",
          deadlineStatus: "open",
          tuition: 39000,
          scholarship: true,
          scholarshipType: "CSC + city",
          langReq: "IELTS 6.0",
          hsk: "No HSK first",
          documents: "medium",
          documentCount: 6,
          source: "stale",
          verified: "Apr 18",
          readiness: "Review before applying",
          readinessType: "warn",
          fit: "Engineering strength and scholarship signal, but key details should be confirmed before choosing.",
        },
        {
          id: "blcu-language",
          name: "Chinese Language Non-degree",
          university: "Beijing Language and Culture University",
          city: "Beijing",
          province: "Beijing",
          degree: "non-degree",
          subject: "Chinese Language",
          language: "chinese",
          intake: "Spring 2027",
          term: "spring",
          duration: "1 year",
          deadline: "2026-12-20",
          deadlineStatus: "open",
          tuition: 22000,
          scholarship: false,
          scholarshipType: "No scholarship listed",
          langReq: "Placement after arrival",
          hsk: "No HSK first",
          documents: "light",
          documentCount: 3,
          source: "verified",
          verified: "Aug 3",
          readiness: "Light documents",
          readinessType: "good",
          fit: "Good preparatory language path with low document effort.",
        },
        {
          id: "hitsz-ai-msc",
          name: "Artificial Intelligence MSc",
          university: "Harbin Institute of Technology Shenzhen",
          city: "Shenzhen",
          province: "Guangdong",
          degree: "master",
          subject: "Computer Science",
          language: "english",
          intake: "Fall 2026",
          term: "fall",
          duration: "2 years",
          deadline: "2026-10-05",
          deadlineStatus: "closes-soon",
          tuition: 45000,
          scholarship: true,
          scholarshipType: "STEM grant",
          langReq: "IELTS 6.5",
          hsk: "No HSK first",
          documents: "heavy",
          documentCount: 6,
          source: "pending",
          verified: "Pending",
          readiness: "Review before applying",
          readinessType: "warn",
          fit: "Strong tech-city fit, but admissions page needs confirmation.",
        },
        {
          id: "uibe-trade-msc",
          name: "International Trade MSc",
          university: "University of International Business and Economics",
          city: "Beijing",
          province: "Beijing",
          degree: "master",
          subject: "Business",
          language: "english",
          intake: "Late Fall 2026",
          term: "fall",
          duration: "2 years",
          deadline: "2026-11-10",
          deadlineStatus: "late",
          tuition: 36000,
          scholarship: true,
          scholarshipType: "Merit waiver",
          langReq: "English proof flexible",
          hsk: "No HSK first",
          documents: "medium",
          documentCount: 5,
          source: "verified",
          verified: "Aug 5",
          readiness: "Late option",
          readinessType: "good",
          fit: "Useful late-intake business route with flexible English proof.",
        },
        {
          id: "nju-data-msc",
          name: "Data Science MSc",
          university: "Nanjing University",
          city: "Nanjing",
          province: "Jiangsu",
          degree: "master",
          subject: "Computer Science",
          language: "english",
          intake: "Fall 2026",
          term: "fall",
          duration: "2 years",
          deadline: "2026-10-30",
          deadlineStatus: "open",
          tuition: 38000,
          scholarship: true,
          scholarshipType: "University award",
          langReq: "IELTS 6.0",
          hsk: "No HSK first",
          documents: "medium",
          documentCount: 6,
          source: "verified",
          verified: "Jul 30",
          readiness: "Likely fit",
          readinessType: "good",
          fit: "Lower-cost city than Shanghai with English-taught data route.",
        },
        {
          id: "scu-medicine-mbbs",
          name: "Clinical Medicine MBBS",
          university: "Sichuan University",
          city: "Chengdu",
          province: "Sichuan",
          degree: "undergraduate",
          subject: "Medicine",
          language: "english",
          intake: "Fall 2026",
          term: "fall",
          duration: "6 years",
          deadline: "2026-09-25",
          deadlineStatus: "urgent",
          tuition: 45000,
          scholarship: false,
          scholarshipType: "No scholarship listed",
          langReq: "IELTS or interview",
          hsk: "HSK after study",
          documents: "heavy",
          documentCount: 8,
          source: "stale",
          verified: "May 12",
          readiness: "Deadline rescue",
          readinessType: "risk",
          fit: "Medicine route needs careful document and deadline review.",
        },
        {
          id: "xjtu-mech-phd",
          name: "Mechanical Engineering PhD",
          university: "Xi'an Jiaotong University",
          city: "Xi'an",
          province: "Shaanxi",
          degree: "phd",
          subject: "Engineering",
          language: "english",
          intake: "Fall 2026",
          term: "fall",
          duration: "4 years",
          deadline: "2026-12-01",
          deadlineStatus: "open",
          tuition: 34000,
          scholarship: true,
          scholarshipType: "CSC possible",
          langReq: "IELTS 6.0",
          hsk: "No HSK first",
          documents: "heavy",
          documentCount: 7,
          source: "verified",
          verified: "Aug 2",
          readiness: "Funding route",
          readinessType: "good",
          fit: "Affordable engineering PhD route with scholarship signal.",
        },
        {
          id: "whu-ir-ba",
          name: "International Relations BA",
          university: "Wuhan University",
          city: "Wuhan",
          province: "Hubei",
          degree: "undergraduate",
          subject: "International Relations",
          language: "english",
          intake: "Fall 2026",
          term: "fall",
          duration: "4 years",
          deadline: "2026-11-05",
          deadlineStatus: "open",
          tuition: 28000,
          scholarship: true,
          scholarshipType: "Provincial award",
          langReq: "English proof flexible",
          hsk: "No HSK first",
          documents: "medium",
          documentCount: 5,
          source: "pending",
          verified: "Pending",
          readiness: "Needs review",
          readinessType: "warn",
          fit: "Lower tuition and English route, but review the application page before sending.",
        },
        {
          id: "sysu-business-msc",
          name: "Business Analytics MSc",
          university: "Sun Yat-sen University",
          city: "Guangzhou",
          province: "Guangdong",
          degree: "master",
          subject: "Business",
          language: "bilingual",
          intake: "Spring 2027",
          term: "spring",
          duration: "2 years",
          deadline: "2026-12-15",
          deadlineStatus: "open",
          tuition: 41000,
          scholarship: true,
          scholarshipType: "Partial award",
          langReq: "English + Chinese interview",
          hsk: "HSK helpful",
          documents: "medium",
          documentCount: 6,
          source: "verified",
          verified: "Jul 25",
          readiness: "Language review",
          readinessType: "warn",
          fit: "Good southern China option if bilingual study is acceptable.",
        },
        {
          id: "hust-biomed-msc",
          name: "Biomedical Engineering MSc",
          university: "Huazhong University of Science and Technology",
          city: "Wuhan",
          province: "Hubei",
          degree: "master",
          subject: "Engineering",
          language: "english",
          intake: "Late Fall 2026",
          term: "fall",
          duration: "2 years",
          deadline: "2026-11-18",
          deadlineStatus: "late",
          tuition: 33000,
          scholarship: true,
          scholarshipType: "University award",
          langReq: "IELTS 6.0",
          hsk: "No HSK first",
          documents: "light",
          documentCount: 4,
          source: "verified",
          verified: "Aug 6",
          readiness: "Light documents",
          readinessType: "good",
          fit: "Late intake with lower tuition and lighter document burden.",
        },
  ];


  const discoverySchools = [
        {
          name: "Zhejiang University",
          city: "Hangzhou",
          province: "Zhejiang",
          subjects: ["Engineering", "Computer Science", "Medicine"],
          tags: ["English routes", "Verified", "Fall 2026"],
          note: "Research city with strong engineering, medicine, and computer science routes.",
          programs: 26,
          tuition: "RMB 32k",
          routes: 14,
          cost: 3600,
          scholarship: true,
          verified: true,
          image: "https://www.ehangzhou.gov.cn/img/attachement/jpg/site48/20250527/17483419485411.jpg",
        },
        {
          name: "Tsinghua University",
          city: "Beijing",
          province: "Beijing",
          subjects: ["Engineering", "Computer Science"],
          tags: ["Scholarship", "Verified", "Fall 2026"],
          note: "Highly selective engineering and technology university with scholarship options.",
          programs: 18,
          tuition: "RMB 40k",
          routes: 9,
          cost: 4800,
          scholarship: true,
          verified: true,
          image: "https://images.unsplash.com/photo-1508804185872-d7badad00f7d?auto=format&fit=crop&w=900&q=80",
        },
        {
          name: "Fudan University",
          city: "Shanghai",
          province: "Shanghai",
          subjects: ["Business", "Medicine", "Economics"],
          tags: ["English routes", "Scholarship", "Verified"],
          note: "Strong business, medicine, and sciences routes in a fast-moving city.",
          programs: 22,
          tuition: "RMB 45k",
          routes: 11,
          cost: 5200,
          scholarship: true,
          verified: true,
          image: "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=900&q=80",
        },
        {
          name: "Tongji University",
          city: "Shanghai",
          province: "Shanghai",
          subjects: ["Engineering", "Architecture", "Design"],
          tags: ["English routes", "Fall 2026"],
          note: "Architecture and engineering strengths with several international program routes.",
          programs: 19,
          tuition: "RMB 39k",
          routes: 8,
          cost: 5200,
          scholarship: false,
          verified: false,
          image: "https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?auto=format&fit=crop&w=900&q=80",
        },
        {
          name: "Nanjing University",
          city: "Nanjing",
          province: "Jiangsu",
          subjects: ["Computer Science", "Business", "International Relations"],
          tags: ["Verified", "Affordable", "Scholarship"],
          note: "Balanced academic reputation with lower living cost than Shanghai.",
          programs: 16,
          tuition: "RMB 30k",
          routes: 7,
          cost: 3900,
          scholarship: true,
          verified: true,
          image: "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=900&q=80",
        },
        {
          name: "Wuhan University",
          city: "Wuhan",
          province: "Hubei",
          subjects: ["Medicine", "Engineering", "Chinese Language"],
          tags: ["Affordable", "Fall 2026"],
          note: "Large campus setting with medicine and engineering options in a lower-cost city.",
          programs: 20,
          tuition: "RMB 28k",
          routes: 6,
          cost: 3300,
          scholarship: false,
          verified: false,
          image: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=900&q=80",
        },
        {
          name: "Xi'an Jiaotong University",
          city: "Xi'an",
          province: "Shaanxi",
          subjects: ["Engineering", "Computer Science", "Medicine"],
          tags: ["Affordable", "Scholarship", "Verified"],
          note: "Strong engineering and research profile with affordable city living.",
          programs: 17,
          tuition: "RMB 29k",
          routes: 8,
          cost: 3000,
          scholarship: true,
          verified: true,
          image: "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=900&q=80",
        },
        {
          name: "Sun Yat-sen University",
          city: "Guangzhou",
          province: "Guangdong",
          subjects: ["Medicine", "Business", "Economics"],
          tags: ["English routes", "Scholarship"],
          note: "Southern China route with medicine, business, and economics options.",
          programs: 21,
          tuition: "RMB 34k",
          routes: 10,
          cost: 4300,
          scholarship: true,
          verified: false,
          image: "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&w=900&q=80",
        },
        {
          name: "Harbin Institute of Technology",
          city: "Harbin",
          province: "Heilongjiang",
          subjects: ["Engineering", "Computer Science"],
          tags: ["Scholarship", "Verified", "Affordable"],
          note: "Engineering-focused university with strong scholarship and research signals.",
          programs: 15,
          tuition: "RMB 26k",
          routes: 5,
          cost: 2800,
          scholarship: true,
          verified: true,
          image: "https://images.unsplash.com/photo-1519452575417-564c1401ecc0?auto=format&fit=crop&w=900&q=80",
        },
        {
          name: "Shanghai Jiao Tong University",
          city: "Shanghai",
          province: "Shanghai",
          subjects: ["Engineering", "Medicine", "Business"],
          tags: ["English routes", "Verified"],
          note: "Selective Shanghai university with engineering, medicine, and business strengths.",
          programs: 24,
          tuition: "RMB 46k",
          routes: 12,
          cost: 5200,
          scholarship: false,
          verified: true,
          image: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80",
        },
        {
          name: "Sichuan University",
          city: "Chengdu",
          province: "Sichuan",
          subjects: ["Medicine", "Engineering", "Chinese Language"],
          tags: ["Affordable", "Fall 2026"],
          note: "Chengdu option with medicine and engineering routes in a relaxed city.",
          programs: 19,
          tuition: "RMB 27k",
          routes: 6,
          cost: 3200,
          scholarship: false,
          verified: false,
          image: "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=900&q=80",
        },
        {
          name: "Beijing Language and Culture University",
          city: "Beijing",
          province: "Beijing",
          subjects: ["Chinese Language", "International Relations"],
          tags: ["Verified", "Fall 2026"],
          note: "Focused language and China studies route for students building Chinese skills.",
          programs: 12,
          tuition: "RMB 24k",
          routes: 4,
          cost: 4800,
          scholarship: false,
          verified: true,
          image: "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=900&q=80",
        },
      
  ];

  const discoveryScholarships = [
  { id: 1, slug: "csc", title: "Chinese Government Scholarship / CSC", type: "government", typeLabel: "CSC", funding: "full", school: "Multiple universities", summary: "Full-funding route for strong applicants through CSC or university channels.", coverage: ["Tuition", "Stipend", "Accommodation", "Insurance"], degree: "Master / PhD", deadline: "Mar 31", source: "verified", verified: "Jul 14", tags: ["Full funding", "CSC", "Official notice"] },
  { id: 2, title: "Zhejiang University International Student Scholarship", type: "university", typeLabel: "University", funding: "partial", school: "Zhejiang University", summary: "School-level award for selected international degree applicants in Hangzhou.", coverage: ["Tuition waiver", "Merit review"], degree: "Bachelor / Master", deadline: "Oct 15", source: "verified", verified: "Jul 14", tags: ["University award", "Hangzhou", "Official notice"] },
  {
    id: 3,
    slug: "shanghai-government-scholarship",
    title: "Shanghai Government Scholarship",
    type: "provincial",
    typeLabel: "Municipal",
    funding: "full",
    fundingLevel: "full",
    school: "Shanghai universities",
    schoolName: "Shanghai universities",
    schoolCount: 2,
    schools: [
      { id: 1002, nameZh: "复旦大学", nameEn: "Fudan University", region: "Shanghai" },
      { id: 1003, nameZh: "同济大学", nameEn: "Tongji University", region: "Shanghai" },
    ],
    programs: [
      { id: 2002, schoolId: 1002, schoolName: "Fudan University", nameZh: "经济学本科", nameEn: "Economics BA", degreeLevel: "Bachelor", teachingLanguage: "English-taught" },
      { id: 2003, schoolId: 1003, schoolName: "Tongji University", nameZh: "土木工程硕士", nameEn: "Civil Engineering MSc", degreeLevel: "Master", teachingLanguage: "English-taught" },
    ],
    summary: "Municipal scholarship route with university-specific application rules.",
    coverage: "Full or partial tuition support, living allowance, and insurance may vary by university notice.",
    amountText: "Coverage and stipend level must be confirmed against the current Shanghai university notice.",
    degree: "Bachelor / Master",
    applicableDegree: "Bachelor / Master",
    applicableProgram: "Shanghai university degree programs that list this scholarship route",
    deadline: "Sep 12",
    deadlineDate: "2026-09-12",
    deadlineLabel: "Sep 12",
    applicationRound: "Fall 2026",
    source: "pending",
    sourceUrl: "https://edu.sh.gov.cn",
    sourceLabel: "Shanghai education scholarship notice",
    verified: "Check deadline",
    lastVerifiedAt: "2026-07-14",
    bodySections: [
      {
        title: "How to use this route",
        body: "Treat this scholarship as a city-level funding signal first, then confirm the exact school and program notice before preparing documents.",
        items: ["Match a Shanghai university and program.", "Check whether the current intake lists this funding route.", "Let the school confirm documents after CUAC handoff."],
      },
    ],
    benefitItems: [
      { key: "tuition", label: "Tuition support", included: true, note: "Full or partial coverage depends on the university notice." },
      { key: "living", label: "Living allowance", included: true, note: "Amount must be confirmed before budgeting." },
      { key: "insurance", label: "Medical insurance", included: true, note: "Usually listed in municipal scholarship notices." },
    ],
    eligibilityItems: [
      { label: "Nationality", body: "Non-Chinese international applicants." },
      { label: "Academic fit", body: "Degree level and program must match the current university notice." },
      { label: "School nomination", body: "Some routes require school-side review before final award decisions." },
    ],
    applicationMaterials: [
      { label: "Passport", body: "Valid passport scan requested by the receiving school." },
      { label: "Academic record", body: "Transcript or study record, translated if required." },
      { label: "Language proof", body: "English or Chinese proof follows the selected program route." },
    ],
    applicationSteps: [
      { label: "Choose program", body: "Select a concrete Shanghai school and program before relying on this scholarship." },
      { label: "Send CUAC record", body: "CUAC sends non-document information to the selected school after payment." },
      { label: "School follow-up", body: "The school contacts the student for documents and scholarship-specific requirements." },
    ],
    contactInfo: {
      label: "Scholarship contact",
      name: "International student admissions office",
      email: "scholarship@example.edu",
      website: "https://edu.sh.gov.cn",
      note: "Use the current school notice as the final source before preparing documents.",
    },
    actionLinks: [
      { label: "Open official notice", url: "https://edu.sh.gov.cn", kind: "source" },
      { label: "Compare Shanghai programs", url: "programs.html?q=Shanghai", kind: "secondary" },
      { label: "Check CSCA readiness", url: "guides.html", kind: "exam" },
    ],
    targetCountries: ["Malaysia", "Pakistan", "Ghana"],
    targetRegions: ["Global"],
    tags: ["Full funding", "Shanghai", "Deadline soon"],
  },
  { id: 4, title: "Beijing Government Scholarship", type: "province", typeLabel: "City", funding: "partial", school: "Beijing universities", summary: "Local government award that may reduce tuition for international students.", coverage: ["Tuition waiver"], degree: "All levels", deadline: "May 30", source: "verified", verified: "Jul 10", tags: ["City award", "Beijing", "Partial"] },
  { id: 5, title: "Jiangsu Jasmine Scholarship", type: "province", typeLabel: "Province", funding: "full", school: "Jiangsu universities", summary: "Province-level route for students considering Nanjing, Suzhou, and nearby cities.", coverage: ["Tuition", "Stipend", "Insurance"], degree: "Bachelor / Master", deadline: "Apr 20", source: "verified", verified: "Jul 14", tags: ["Full funding", "Province", "Affordable city"] },
  { id: 6, title: "Tianjin Government Scholarship", type: "province", typeLabel: "City", funding: "full", school: "Tianjin universities", summary: "Local funding route with different coverage by university and degree level.", coverage: ["Tuition", "Accommodation"], degree: "Master / PhD", deadline: "Jun 15", source: "pending", verified: "Check funding notice", tags: ["City award", "Full funding"] },
  { id: 7, title: "International Chinese Language Teachers Scholarship", type: "partner", typeLabel: "Language", funding: "full", school: "Language partner universities", summary: "Best for students pursuing Chinese language or teaching-related routes.", coverage: ["Tuition", "Stipend", "Accommodation", "Insurance"], degree: "Non-degree / BA / MA", deadline: "May 10", source: "verified", verified: "Jul 14", tags: ["Language route", "Full funding"] },
  { id: 8, title: "ASEAN-China Young Leaders Scholarship", type: "partner", typeLabel: "Partner", funding: "full", school: "Multiple universities", summary: "Partner route for eligible ASEAN-region applicants and leadership programs.", coverage: ["Tuition", "Stipend", "Travel", "Insurance"], degree: "Master / PhD", deadline: "Mar 20", source: "check", verified: "Check funding notice", tags: ["ASEAN", "Partner route"] },
  { id: 9, title: "Fudan University Freshman Scholarship", type: "university", typeLabel: "University", funding: "partial", school: "Fudan University", summary: "Merit award for new international undergraduate applicants in Shanghai.", coverage: ["Tuition waiver"], degree: "Undergraduate", deadline: "Sep 12", source: "verified", verified: "Jul 14", tags: ["Undergraduate", "Shanghai", "Deadline soon"] },
  { id: 10, title: "Engineering Excellence Scholarship", type: "university", typeLabel: "Subject", funding: "partial", school: "Harbin Institute of Technology", summary: "Subject-focused route for engineering applicants with strong transcripts.", coverage: ["Tuition waiver", "Merit review"], degree: "Master", deadline: "Nov 20", source: "verified", verified: "Jul 12", tags: ["Engineering", "University award"] },
  { id: 11, title: "Coastal Sustainability Scholarship", type: "partner", typeLabel: "Subject", funding: "full", school: "Xiamen University", summary: "Subject route for sustainability or coastal research applicants.", coverage: ["Tuition", "Stipend", "Insurance"], degree: "Master / PhD", deadline: "Dec 10", source: "pending", verified: "Deadline pending", tags: ["Subject route", "Full funding"] },
  { id: 12, title: "Provincial International Student Tuition Award", type: "province", typeLabel: "Province", funding: "partial", school: "Multiple provincial universities", summary: "Partial tuition support that can pair with lower living-cost cities.", coverage: ["Tuition waiver"], degree: "All levels", deadline: "Rolling", source: "check", verified: "Confirm locally", tags: ["Partial", "Lower cost"] },

  ];

  const discoveryCities = [
  {
    id: "hangzhou",
    name: "Hangzhou",
    province: "Zhejiang",
    region: "East China",
    image: "https://www.ehangzhou.gov.cn/img/attachement/jpg/site48/20250527/17483419485411.jpg",
    monthlyCostRmb: 3600,
    costLevel: "medium",
    pace: "balanced",
    climate: "Mild, humid, and green.",
    summary: "A strong tech and university city with calmer daily life than Shanghai.",
    bestFor: ["tech", "calmer pace", "medium cost"],
    tags: ["Tech city", "Medium cost", "Good first city"],
    universities: 12,
    programs: 31,
    englishRoutes: 18,
    scholarships: 9,
    industry: "Tech and digital economy",
    language: "English routes plus useful Chinese exposure",
    arrival: "Easy high-speed rail links with Shanghai.",
    representative: ["Zhejiang University", "China Academy of Art"],
    costBreakdown: { accommodation: 1500, food: 1050, transport: 220, personal: 830 },
  },
  {
    id: "shanghai",
    name: "Shanghai",
    province: "Shanghai",
    region: "East China",
    image: "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1000&q=80",
    monthlyCostRmb: 5200,
    costLevel: "high",
    pace: "fast",
    climate: "Humid summers and cool winters.",
    summary: "International, fast moving, and rich in internships, but budget pressure is higher.",
    bestFor: ["international", "internships", "business"],
    tags: ["International", "High cost", "Internships"],
    universities: 18,
    programs: 42,
    englishRoutes: 26,
    scholarships: 12,
    industry: "Finance, business, design, tech",
    language: "Easier English daily life than smaller cities",
    arrival: "Most international arrival options.",
    representative: ["Fudan University", "Tongji University"],
    costBreakdown: { accommodation: 2450, food: 1350, transport: 320, personal: 1080 },
  },
  {
    id: "beijing",
    name: "Beijing",
    province: "Beijing",
    region: "North China",
    image: "https://images.unsplash.com/photo-1508804185872-d7badad00f7d?auto=format&fit=crop&w=1000&q=80",
    monthlyCostRmb: 4800,
    costLevel: "high",
    pace: "fast",
    climate: "Cold winters, dry springs, warm summers.",
    summary: "Academic, cultural, and policy-centered with many top universities.",
    bestFor: ["research", "culture", "language"],
    tags: ["Academic", "Culture", "High cost"],
    universities: 22,
    programs: 39,
    englishRoutes: 20,
    scholarships: 14,
    industry: "Research, policy, technology",
    language: "Strong Mandarin environment",
    arrival: "Major arrival hub with broad transport links.",
    representative: ["Tsinghua University", "Beijing Language and Culture University"],
    costBreakdown: { accommodation: 2200, food: 1280, transport: 300, personal: 1020 },
  },
  {
    id: "shenzhen",
    name: "Shenzhen",
    province: "Guangdong",
    region: "South China",
    image: "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1000&q=80",
    monthlyCostRmb: 4600,
    costLevel: "high",
    pace: "fast",
    climate: "Warm and subtropical.",
    summary: "Young, startup-heavy, and technology-focused with a warmer daily rhythm.",
    bestFor: ["tech", "internships", "warm climate"],
    tags: ["Startups", "Warm climate", "High cost"],
    universities: 8,
    programs: 19,
    englishRoutes: 11,
    scholarships: 5,
    industry: "Hardware, AI, startups",
    language: "International pockets but Chinese useful",
    arrival: "Good links through Shenzhen and Hong Kong.",
    representative: ["Harbin Institute of Technology Shenzhen", "Shenzhen University"],
    costBreakdown: { accommodation: 2150, food: 1220, transport: 260, personal: 970 },
  },
  {
    id: "nanjing",
    name: "Nanjing",
    province: "Jiangsu",
    region: "East China",
    image: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1000&q=80",
    monthlyCostRmb: 3400,
    costLevel: "medium",
    pace: "balanced",
    climate: "Hot summers and cool winters.",
    summary: "A university-dense city with lower living pressure than Shanghai.",
    bestFor: ["lower cost", "research", "student city"],
    tags: ["University dense", "Medium cost", "Student city"],
    universities: 16,
    programs: 28,
    englishRoutes: 15,
    scholarships: 10,
    industry: "Research, software, culture",
    language: "Good campus support; Chinese helpful",
    arrival: "Convenient rail links across East China.",
    representative: ["Nanjing University", "Southeast University"],
    costBreakdown: { accommodation: 1400, food: 980, transport: 220, personal: 800 },
  },
  {
    id: "chengdu",
    name: "Chengdu",
    province: "Sichuan",
    region: "Southwest China",
    image: "https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?auto=format&fit=crop&w=1000&q=80",
    monthlyCostRmb: 3200,
    costLevel: "low",
    pace: "calm",
    climate: "Humid and mild with less winter cold.",
    summary: "Lower cost, relaxed daily life, and growing medical and engineering routes.",
    bestFor: ["lower cost", "calmer pace", "medicine"],
    tags: ["Lower cost", "Relaxed", "Southwest"],
    universities: 13,
    programs: 24,
    englishRoutes: 12,
    scholarships: 8,
    industry: "Biomedicine, gaming, manufacturing",
    language: "Chinese daily life matters more",
    arrival: "Major western China hub.",
    representative: ["Sichuan University", "University of Electronic Science and Technology of China"],
    costBreakdown: { accommodation: 1250, food: 930, transport: 200, personal: 820 },
  },
  {
    id: "wuhan",
    name: "Wuhan",
    province: "Hubei",
    region: "Central China",
    image: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1000&q=80",
    monthlyCostRmb: 3300,
    costLevel: "low",
    pace: "balanced",
    climate: "Hot summers and cool winters.",
    summary: "Large student population, strong engineering and medicine routes, and lower cost.",
    bestFor: ["lower cost", "engineering", "student city"],
    tags: ["Student city", "Lower cost", "Engineering"],
    universities: 18,
    programs: 27,
    englishRoutes: 13,
    scholarships: 9,
    industry: "Optics, engineering, health science",
    language: "Campus support important",
    arrival: "Central China transport hub.",
    representative: ["Wuhan University", "Huazhong University of Science and Technology"],
    costBreakdown: { accommodation: 1320, food: 960, transport: 210, personal: 810 },
  },
  {
    id: "xian",
    name: "Xi'an",
    province: "Shaanxi",
    region: "Northwest China",
    image: "https://images.unsplash.com/photo-1508804185872-d7badad00f7d?auto=format&fit=crop&w=1000&q=80",
    monthlyCostRmb: 3100,
    costLevel: "low",
    pace: "calm",
    climate: "Dry, cold winters and warm summers.",
    summary: "Historic, affordable, and strong for engineering, language, and culture-oriented students.",
    bestFor: ["lower cost", "culture", "engineering"],
    tags: ["Affordable", "Culture", "Engineering"],
    universities: 14,
    programs: 22,
    englishRoutes: 10,
    scholarships: 7,
    industry: "Aerospace, engineering, culture",
    language: "Good Chinese immersion context",
    arrival: "Good domestic links; fewer direct international routes.",
    representative: ["Xi'an Jiaotong University", "Northwestern Polytechnical University"],
    costBreakdown: { accommodation: 1200, food: 900, transport: 190, personal: 810 },
  },

  ];

  const discoveryGuides = [
    {
      type: "content",
      title: "China Application Timeline",
      subtitle: "Fall, spring, late intake",
      snippet: "Plan application windows, notice review, document readiness, CUAC submission, school follow-up, and arrival steps.",
      href: "guides.html#timeline",
      score: 96,
      metadata: { category: "timeline", icon: "calendar", audience: "student", status: "published" },
    },
    {
      type: "content",
      title: "China Application Document Checklist",
      subtitle: "Reusable, translated, checked",
      snippet: "Separate CUAC application information from the official files schools request directly after receiving the record.",
      href: "guide-detail.html?guide=documents",
      score: 98,
      metadata: { category: "documents", icon: "document", audience: "student", status: "published" },
    },
    {
      type: "content",
      title: "English and Chinese Language Routes",
      subtitle: "HSK, IELTS, TOEFL, waiver",
      snippet: "Check teaching language separately from proof requirements, interviews, placement routes, and school-specific waivers.",
      href: "guides.html#language",
      score: 92,
      metadata: { category: "language", icon: "language", audience: "student", status: "published" },
    },
    {
      type: "content",
      title: "Scholarship Planning Guide",
      subtitle: "Coverage, source, deadline",
      snippet: "Compare funding level, eligibility, official notices, materials, and realistic backup routes.",
      href: "guides.html#scholarships",
      score: 90,
      metadata: { category: "scholarships", icon: "award", audience: "student", status: "published" },
    },
    {
      type: "content",
      title: "Visa and Arrival Steps",
      subtitle: "Admission notice, JW form, X visa",
      snippet: "Understand the post-offer checklist after the school confirms admission and requests official documents.",
      href: "guides.html#visa",
      score: 86,
      metadata: { category: "arrival", icon: "passport", audience: "student", status: "published" },
    },
  ];

  const completionDetailCatalog = {
    programs: {
      "zju-cs-msc": {
        title: "Computer Science MSc",
        school: "Zhejiang University",
        city: "Hangzhou",
        image: "https://www.ehangzhou.gov.cn/img/attachement/jpg/site48/20250527/17483419485411.jpg",
        summary: "English-taught master route with strong program fit, scholarship signal, and an Oct 15 deadline that needs early document planning.",
        status: ["Application ready", "Closes Oct 15", "CSC possible"],
        metrics: [["2 years", "duration"], ["RMB 42k", "tuition / year"], ["English", "teaching"], ["7 docs", "expected effort"]],
        facts: [["Degree", "Master"], ["Subject", "Computer Science"], ["Intake", "Fall 2026"], ["Language proof", "IELTS 6.5 or waiver"], ["Application page", "Application ready"], ["Fit", "Strong route"]],
        routes: [["ZJU admissions", "School will request official materials after CUAC sends the record.", "university-detail.html?university=zhejiang-university"], ["Add to application", "Use this exact program as a CUAC choice.", "application.html#add-choice"]],
        checklist: ["Confirm transcript translation timing", "Prepare language proof or waiver note", "Check scholarship study plan", "Keep passport scan ready for school request"],
        timeline: ["Now: add program to application set", "Before payment: confirm contact and study profile", "After send: school contacts student directly", "By Oct 15: school-side official materials should be ready"],
      },
    },
    universities: {
      "zhejiang-university": {
        title: "Zhejiang University",
        city: "Hangzhou",
        image: "https://www.ehangzhou.gov.cn/img/attachement/jpg/site48/20250527/17483419485411.jpg",
        summary: "High-fit research university route for students who want Hangzhou, English-taught STEM options, and scholarship-sensitive planning.",
        status: ["University profile", "Application route", "Clear routes"],
        metrics: [["3", "program routes"], ["Hangzhou", "city"], ["English routes", "available"], ["Oct 15", "earliest date"]],
        facts: [["Province", "Zhejiang"], ["International office", "Admissions team"], ["Application page", "Review before applying"], ["School follow-up", "Only this school's record"], ["Best fit", "Computer Science MSc"], ["Follow-up", "School contacts student"]],
        routes: [["Computer Science MSc", "English-taught, Fall 2026, CSC possible.", "program-detail.html?program=zju-cs-msc"], ["Biomedical Engineering MSc", "Lab route that needs supervisor and scholarship review.", "programs.html?q=Biomedical%20Engineering"]],
        checklist: ["Confirm selected program route", "Review deadline and application page", "Prepare school-specific document request", "Use school portal for teacher follow-up"],
        timeline: ["Student adds a ZJU program choice", "CUAC sends ZJU-only school record", "ZJU admissions views tenant queue", "School contacts student directly"],
      },
    },
    scholarships: {
      csc: {
        title: "CSC Scholarship Route",
        city: "China-wide",
        image: "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=900&q=80",
        summary: "High-value funding route that should run in parallel with realistic self-funded or university-award options.",
        status: ["Funding route", "Competitive", "Review notice"],
        metrics: [["Full/partial", "coverage"], ["Master/PhD", "common fit"], ["Study plan", "usually needed"], ["Early", "timing"]],
        facts: [["Coverage", "Tuition or stipend possible"], ["Eligibility", "Varies by program"], ["Documents", "Study plan and recommendations"], ["Risk", "Competitive"], ["Best use", "Parallel route"], ["Guarantee", "Never guaranteed"]],
        routes: [["Find funded programs", "Filter programs with scholarship signal.", "programs.html?scholarship=true"], ["Compare funding risk", "Use CUAC Agent to separate funding-sensitive choices.", "scholarships.html"]],
        checklist: ["Check degree eligibility", "Prepare study plan", "Confirm recommendation timeline", "Keep one realistic non-scholarship route"],
        timeline: ["Shortlist funded programs", "Review notice and deadline", "Add concrete choices", "School requests official scholarship materials"],
      },
    },
    cities: {
      hangzhou: {
        title: "Hangzhou",
        city: "Zhejiang",
        image: "https://www.ehangzhou.gov.cn/img/attachement/jpg/site48/20250527/17483419485411.jpg",
        summary: "Balanced city for students who want a strong university route, lower pressure than Shanghai, and a technology-focused study environment.",
        status: ["City guide", "Student-friendly", "Tech route"],
        metrics: [["RMB 3.8k", "monthly estimate"], ["Medium", "cost level"], ["ZJU", "anchor school"], ["CS", "route fit"]],
        facts: [["Province", "Zhejiang"], ["Lifestyle", "Calm but active"], ["Best fit", "STEM and business"], ["Transport", "Strong rail access"], ["Budget", "Lower than Shanghai"], ["Climate", "Humid subtropical"]],
        routes: [["Programs in Hangzhou", "Open city-filtered program results.", "programs.html?city=hangzhou"], ["Universities", "Review university context.", "universities.html?city=hangzhou"]],
        checklist: ["Compare tuition plus monthly cost", "Check campus location", "Review internship expectations", "Keep deadline pressure visible"],
        timeline: ["Pick city preference", "Compare matching programs", "Add concrete school route", "Prepare arrival and school follow-up"],
      },
    },
    guides: {
      documents: {
        title: "China Application Document Checklist",
        city: "Student guide",
        image: "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=900&q=80",
        summary: "A practical guide for understanding which documents CUAC tracks as readiness signals and which documents schools request directly.",
        status: ["Guide", "No CUAC upload", "School follows up"],
        metrics: [["Passport", "common"], ["Transcript", "common"], ["Language proof", "route-specific"], ["Study plan", "funding-sensitive"]],
        facts: [["CUAC role", "Routes application info"], ["School role", "Requests official files"], ["Student role", "Prepares documents"], ["Timing", "Before deadline"], ["Translation", "Often needed"], ["Upload", "Not in MVP"]],
        routes: [["Open application", "Review what schools receive first.", "application.html#info"], ["Back to guides", "Browse other China application guides.", "guides.html"]],
        checklist: ["Passport scan ready", "Transcript translated if needed", "Language proof or waiver note", "Study plan for scholarship route"],
        timeline: ["Before CUAC submit: confirm profile fields", "After CUAC submit: school requests files", "Before school deadline: send official materials", "After school review: follow official process"],
      },
    },
  };

  const defaultStudentProfile = {
    fullName: "Maya Chen",
    email: "maya@example.com",
    phone: "+60 12 000 0000",
    country: "Malaysia",
    countryCode: "MY",
    nationality: "Malaysia",
    nationalityCode: "MY",
    passportNationality: "Malaysia",
    educationStage: "Final-year undergraduate",
    grade: "Final-year undergraduate",
    gradeCode: "UG_FINAL",
    currentSchool: "Taylor's University",
    currentOrganizationId: 7001,
    intendedLevel: "Master",
    fundingIntent: "Scholarship possible",
    languageStatus: "IELTS / waiver noted",
    guardianStatus: "Not required",
    academicSummary: "Final-year undergraduate with software and biology coursework; GPA summary available on request.",
    readinessNote: "Transcript translation may need follow-up.",
    updatedAt: "2026-08-24T09:00:00.000Z",
  };

  const defaultApplicationRoutes = [
    {
      university: "Zhejiang University",
      program: "Computer Science MSc",
      programName: "Computer Science",
      degree: "MSc",
      city: "Hangzhou",
      intake: "Fall 2026",
      language: "English-taught",
      tuition: "RMB 42k",
      deadline: "Oct 15",
      signal: "CSC possible",
    },
    {
      university: "Nanjing University",
      program: "Software Engineering MSc",
      programName: "Software Engineering",
      degree: "MSc",
      city: "Nanjing",
      intake: "Fall 2026",
      language: "English-taught",
      tuition: "RMB 39k",
      deadline: "Dec 20",
      signal: "Lower cost",
    },
    {
      university: "UIBE",
      program: "International Trade MSc",
      programName: "International Trade",
      degree: "MSc",
      city: "Beijing",
      intake: "Fall 2026",
      language: "English-taught",
      tuition: "RMB 36k",
      deadline: "Nov 10",
      signal: "Funding-sensitive",
    },
  ];

  const defaultHubDocuments = [
    { label: "Passport", detail: "Ready for profile", status: "Ready", checked: true },
    { label: "Transcript", detail: "Needs translation", status: "Translate", checked: false },
    { label: "IELTS / waiver", detail: "English route", status: "Review", checked: false },
    { label: "Study plan", detail: "Scholarship route", status: "Missing", checked: false },
  ];

  function routeProgramCatalogSnapshot(route = {}) {
    const program = findCatalogProgram(route);
    const school = getSchoolCatalogRecord(route.university || route.school || program.schoolNameEn || config.defaultSchoolTenant);
    return {
      schoolId: program.schoolId || school.id || route.schoolId,
      programId: program.programId || program.id || route.programId,
      university: program.schoolNameEn || school.nameEn || route.university || route.school || "Selected university",
      program: program.nameEn || route.program || "Selected program",
      programName: program.fieldCategory || route.programName || program.nameEn || "Selected program",
      degreeLevel: program.degreeLevel || route.degreeLevel || route.degree || "Route",
      teachingLanguage: program.teachingLanguage || route.teachingLanguage || route.language || "Language check",
      city: program.city || school.cityZh || route.city || "China",
      intake: program.applicationRound || route.intake || "Fall 2026",
      deadlineDate: program.deadlineDate || route.deadlineDate || "",
      deadlineLabel: program.deadlineLabel || route.deadline || "Deadline pending",
      tuitionAmount: program.tuitionAmount,
      tuitionText: program.tuitionText || route.tuition || "Tuition pending",
      scholarshipText: program.scholarshipText || route.signal || "Route signal",
      status: program.status || "published",
      sourceLabel: program.sourceLabel || school.sourceLabel || "Program record",
      lastVerifiedAt: program.lastVerifiedAt || school.lastVerifiedAt || "",
      sourceFieldLineage: program.sourceFieldLineage || sourceFieldLineage("SchoolProgram", "Program"),
    };
  }

  function buildHubRoute(route, index = 0) {
    const catalog = routeProgramCatalogSnapshot(route);
    const labels = ["Main choice", "Lower-cost backup", "Funding backup"];
    const programSlugMap = {
      "Computer Science MSc": "zju-cs-msc",
      "International Trade MSc": "uibe-trade-msc",
      "Software Engineering MSc": "nju-data-msc",
    };
    const programSlug = programSlugMap[catalog.program] || slugify(catalog.program || "selected-program");
    const programHrefMap = {
      "Computer Science MSc": "programs.html?program=zju-cs-msc",
      "International Trade MSc": "programs.html?program=uibe-trade-msc",
      "Software Engineering MSc": "programs.html?program=nju-data-msc",
    };
    const programHref = programHrefMap[catalog.program] || `programs.html?program=${programSlug}`;
    return {
      ...catalog,
      kind: labels[index] || "Saved route",
      deadline: catalog.deadlineLabel,
      tuition: catalog.tuitionText,
      degree: catalog.degreeLevel,
      language: catalog.teachingLanguage,
      status: index === 0 ? "Docs check" : index === 1 ? "Ready" : "Strong",
      signal: route.signal || catalog.scholarshipText || catalog.teachingLanguage,
      compared: index === 0,
      programHref,
      href: programHref,
      sourceHref: `program-detail.html?program=${programSlug}`,
      action: index === 0 ? "Review route" : "Open details",
    };
  }

  function getHomeDiscoverySummary() {
    const programCatalog = getDiscoveryPrograms();
    const schools = getDiscoverySchools();
    const scholarships = getDiscoveryScholarships();
    const cities = getDiscoveryCities();
    const openPrograms = programCatalog.filter((program) => program.status !== "closed");
    const homeProgramPriority = ["Computer Science MSc", "Biomedical Engineering MSc", "International Trade MSc"];
    const seenHomePrograms = new Set();
    const latePrograms = programCatalog
      .filter((program) => program.deadline || program.deadlineDate)
      .sort((a, b) => {
        const aName = a.nameEn || a.name || a.program || "";
        const bName = b.nameEn || b.name || b.program || "";
        const aRank = homeProgramPriority.indexOf(aName);
        const bRank = homeProgramPriority.indexOf(bName);
        return (aRank < 0 ? 99 : aRank) - (bRank < 0 ? 99 : bRank);
      })
      .filter((program) => {
        const key = program.nameEn || program.name || program.program;
        if (seenHomePrograms.has(key)) return false;
        seenHomePrograms.add(key);
        return true;
      })
      .slice(0, 3)
      .map((program) => ({
        title: program.nameEn || program.name || program.program,
        meta: `${program.schoolNameEn || program.schoolName || program.university} · ${program.city || "China"} · ${program.teachingLanguage || program.language || "Language check"}`,
        deadline: program.deadlineLabel || program.deadline || program.deadlineDate || "Check date",
      }));
    const categories = [
      { title: "Programs", value: `${openPrograms.length || programCatalog.length} open`, href: "programs.html", icon: "program" },
      { title: "Universities", value: "Compare city + routes", href: "universities.html", icon: "school" },
      { title: "Scholarships", value: `${scholarships.length} funding routes`, href: "scholarships.html", icon: "funding" },
      { title: "Intakes", value: "Fall + spring", href: "guides.html#timeline", icon: "calendar" },
      { title: "Cities & cost", value: "Budget fit", href: "cities.html", icon: "city" },
      { title: "English-taught", value: "No HSK first", href: "programs.html?language=english&langReq=no-hsk", icon: "language" },
      { title: "Documents", value: "Check early", href: "guides.html#documents", icon: "documents" },
    ];
    const questionRoutes = [
      {
        title: "Study in English",
        copy: "Programs that do not require HSK first.",
        meta: ["English route", "IELTS"],
        icon: "english",
      },
      {
        title: "Lower the cost",
        copy: "Scholarship and affordable-city paths.",
        meta: ["Scholarship", "Budget"],
        icon: "cost",
      },
      {
        title: "Check readiness",
        copy: "Know blockers before you spend weeks applying.",
        meta: ["IELTS", "Transcript"],
        icon: "readiness",
      },
      {
        title: "Catch the intake",
        copy: "See which routes still fit the current cycle.",
        meta: ["Fall 2026", "Dates"],
        icon: "intake",
      },
    ];
    return clone({
      metrics: {
        openPrograms: openPrograms.length || programCatalog.length,
        scholarshipSignals: scholarships.length,
        featuredSchools: schools.length,
      },
      categories,
      questionRoutes,
      openIntakes: latePrograms.length ? latePrograms : defaultApplicationRoutes.slice(0, 3).map((route) => ({
        title: route.program,
        meta: `${route.university} · ${route.city} · ${route.language}`,
        deadline: route.deadline,
      })),
      citySnapshot: cities.slice(0, 3).map((city) => ({
        name: city.name,
        cost: city.content?.budgetSummary?.monthly || city.budgetSummary?.monthly || city.monthlyCost || "Cost check",
      })),
      schools: schools.slice(0, 4).map((school) => ({
        name: school.name,
        meta: [school.city, school.region, compactList(school.programSubjectTags || school.subjects || []).slice(0, 2).join(" / ")].filter(Boolean).join(" · "),
        href: `universities.html?q=${encodeURIComponent(school.name)}`,
        image: school.image || school.heroImage || school.photo || "",
      })),
      featuredRoutes: defaultApplicationRoutes.map(buildHubRoute),
      source: "CuacDataClient home discovery summary fixture",
    });
  }

  function getStudentHubSummary() {
    const routes = defaultApplicationRoutes.slice(0, 3).map(buildHubRoute);
    const documents = clone(defaultHubDocuments);
    const mainRoute = routes[0];
    const missingDocuments = documents.filter((doc) => !doc.checked).length;
    return clone({
      profileLine: "Master · CS · Fall 2026 · English route",
      currentRoute: {
        title: `${mainRoute.university} · ${mainRoute.program}`,
        copy: "Good first choice for an English-taught CS route in Hangzhou. Confirm the exact program, then clear the document blockers.",
        checks: [mainRoute.deadline, `${mainRoute.tuition}/year`, "IELTS or waiver", "Transcript translation"],
        readiness: 68,
        agentPrompt: "Check whether my Zhejiang Computer Science MSc route is ready for application",
      },
      applicationEntry: {
        title: "Your China application is in progress",
        subtitle: `First school included · extra schools from USD ${config.extraSchoolFeeUsd} · schools contact you after CUAC sends the record`,
        readiness: "42%",
        next: "Use the application center when you are ready to manage choices, fee review, and school sending in one place.",
      },
      snapshot: {
        savedPrograms: 4,
        compared: routes.filter((route) => route.compared).length,
        choices: 1,
        missingDocuments,
        daysToCheck: 18,
      },
      routes,
      documents,
      source: "CuacDataClient student hub summary fixture",
    });
  }

  const defaultSavedCollections = [
    { type: "program", title: "Programs", purpose: "Concrete routes to compare.", action: "View saved programs", href: "programs.html" },
    { type: "university", title: "Universities", purpose: "Schools that need a program pick.", action: "Find matching programs", href: "universities.html" },
    { type: "scholarship", title: "Scholarships", purpose: "Funding routes to verify.", action: "Review funding", href: "scholarships.html" },
    { type: "city", title: "Cities", purpose: "Cost and lifestyle signals.", action: "Compare cities", href: "cities.html" },
    { type: "guide", title: "Guides", purpose: "Saved explainers and checklists.", action: "Open guides", href: "guides.html" },
  ];

  const savedProgramMeta = {
    "Computer Science MSc": {
      id: "zju-cs",
      body: "Strong route for the student's goal. IELTS or waiver and transcript translation still need review.",
      status: "ready",
      routeRole: "Main route",
      href: "programs.html?program=zju-cs-msc",
    },
    "Software Engineering MSc": {
      id: "nju-se",
      body: "Lower-cost backup with a later deadline and lighter document burden.",
      status: "good",
      routeRole: "Backup",
      href: "programs.html?program=nju-data-msc",
    },
    "International Trade MSc": {
      id: "uibe-trade",
      body: "Useful funding-sensitive route, but scholarship timing should be checked before it becomes a main choice.",
      status: "warning",
      routeRole: "Funding-sensitive",
      href: "programs.html?program=uibe-trade-msc",
    },
  };

  const defaultSavedContextItems = [
    {
      id: "zhejiang-university",
      type: "university",
      title: "Zhejiang University",
      meta: "Hangzhou · research university",
      body: "Saved as a university interest. Choose specific programs before adding application choices.",
      facts: ["26 programs", "English routes", "Scholarship signal"],
      status: "good",
      href: "universities.html?q=Zhejiang%20University",
      primaryHref: "programs.html?university=Zhejiang%20University",
      primaryAction: "Choose a program first",
    },
    {
      id: "csc",
      type: "scholarship",
      title: "Chinese Government Scholarship / CSC",
      meta: "Full-funding route · multiple universities",
      body: "Best treated as a parallel route. Source, channel, and eligibility need checking per program.",
      facts: ["Full funding", "Master / PhD", "Deadline varies"],
      status: "warning",
      href: "scholarships.html",
      primaryHref: "programs.html?scholarship=CSC",
      primaryAction: "Find programs for this scholarship",
    },
    {
      id: "zju-award",
      type: "scholarship",
      title: "ZJU International Student Scholarship",
      meta: "University award · Zhejiang University",
      body: "Useful backup funding route for the saved ZJU program. Coverage may be partial.",
      facts: ["Tuition waiver", "Merit review", "Oct 15"],
      status: "good",
      href: "scholarships.html#zju",
      primaryHref: "scholarships.html#zju",
      primaryAction: "Review funding routes",
    },
    {
      id: "hangzhou",
      type: "city",
      title: "Hangzhou",
      meta: "RMB 3.6k/month estimate",
      body: "Strong first city fit for tech programs with lower daily cost than Shanghai.",
      facts: ["Lower than Shanghai", "ZJU", "Calmer pace"],
      status: "good",
      href: "cities.html#hangzhou",
      primaryHref: "cities.html#hangzhou",
      primaryAction: "Compare cities",
    },
    {
      id: "shanghai",
      type: "city",
      title: "Shanghai",
      meta: "RMB 5.2k/month estimate",
      body: "Strong internship signal but higher spend. Best as a stretch route unless budget is flexible.",
      facts: ["Higher cost", "Internships", "Stretch"],
      status: "warning",
      href: "cities.html#shanghai",
      primaryHref: "cities.html#shanghai",
      primaryAction: "Compare cities",
    },
    {
      id: "documents",
      type: "guide",
      title: "Before Oct 15 document checklist",
      meta: "Guide · documents",
      body: "Turn passport, transcript, language proof, study plan, and translation requirements into tasks.",
      facts: ["IELTS / waiver", "Translation", "Study plan"],
      status: "warning",
      href: "guides.html#documents",
      primaryHref: "guides.html#documents",
      primaryAction: "Open guide",
    },
  ];

  const defaultSavedRouteGroups = [
    {
      title: "English-taught CS in Hangzhou",
      role: "Main decision",
      body: "ZJU is the strongest route if language proof and translation are handled before Oct 15.",
      points: ["ZJU Computer Science MSc", "Hangzhou cost fit", "CSC and university award need confirmation"],
      prompt: "Explain my English-taught CS route in Hangzhou",
      href: "programs.html?program=zju-cs-msc",
      action: "Review related program",
    },
    {
      title: "Lower-cost backup",
      role: "Safer route",
      body: "Nanjing keeps costs lower and deadline pressure lighter while staying close to the study goal.",
      points: ["Nanjing Software Engineering MSc", "Later deadline", "Lower monthly city estimate"],
      prompt: "Compare my lower-cost backup route",
      href: "programs.html?program=nju-data-msc",
      action: "Review backup route",
    },
    {
      title: "Funding-sensitive route",
      role: "Funding check",
      body: "UIBE and CSC are useful if scholarship timing works, but should not block the main application route.",
      points: ["UIBE International Trade MSc", "CSC route parallel check", "Scholarship dates may close earlier"],
      prompt: "Check scholarship fit for my saved programs",
      href: "scholarships.html",
      action: "Review funding context",
    },
  ];

  function buildSavedProgramItem(route) {
    const catalog = routeProgramCatalogSnapshot(route);
    const meta = savedProgramMeta[route.program] || {};
    return {
      id: meta.id || slugify(`${route.university}-${route.program}`),
      type: "program",
      schoolId: catalog.schoolId,
      programId: catalog.programId,
      title: catalog.program,
      meta: `${catalog.university} · ${catalog.city} · ${catalog.teachingLanguage}`,
      body: meta.body || "Saved concrete university-program route from the student's shortlist.",
      facts: [catalog.deadlineLabel, catalog.tuitionText, catalog.degreeLevel, route.signal || catalog.scholarshipText].filter(Boolean),
      status: meta.status || "good",
      routeRole: meta.routeRole || "Saved route",
      href: meta.href || `programs.html?program=${slugify(route.program)}`,
      degreeLevel: catalog.degreeLevel,
      teachingLanguage: catalog.teachingLanguage,
      deadlineDate: catalog.deadlineDate,
      deadlineLabel: catalog.deadlineLabel,
      tuitionAmount: catalog.tuitionAmount,
      tuitionText: catalog.tuitionText,
      sourceFieldLineage: catalog.sourceFieldLineage,
    };
  }

  function readSavedDetailItems() {
    const state = readStoredJson(storageKeys.savedDetailItems);
    return Array.isArray(state?.items) ? clone(state.items) : [];
  }

  function writeSavedDetailItems(items = []) {
    writeStoredJson(storageKeys.savedDetailItems, {
      items: clone(items),
      updatedAt: new Date().toISOString(),
    });
  }

  function addSavedDetailItem(item = {}) {
    if (!item.id) return;
    const items = readSavedDetailItems().filter((saved) => saved.id !== item.id);
    writeSavedDetailItems([{ ...item, savedAt: item.savedAt || new Date().toISOString() }, ...items].slice(0, 30));
  }

  function getSavedItemsSummary() {
    const savedDetailItems = readSavedDetailItems();
    const savedDetailIds = new Set(savedDetailItems.map((item) => item.id));
    return clone({
      items: [
        ...savedDetailItems,
        ...defaultApplicationRoutes.map(buildSavedProgramItem).filter((item) => !savedDetailIds.has(item.id)),
        ...defaultSavedContextItems.filter((item) => !savedDetailIds.has(item.id)),
      ],
      collections: defaultSavedCollections,
      routeGroups: defaultSavedRouteGroups,
      comparedIds: ["zju-cs", "nju-se", "uibe-trade"],
      addedChoiceIds: [],
      source: "CuacDataClient saved items summary fixture",
    });
  }

  const defaultNotificationPreferences = {
    categories: {
      deadline: true,
      document: true,
      funding: true,
      agent: true,
      update: false,
    },
    timing: "balanced",
  };

  const defaultNotificationItems = [
    {
      id: "doc-translation",
      type: "document",
      severity: "urgent",
      group: "Today",
      title: "Transcript translation still needs review",
      body: "ZJU Computer Science MSc is application-ready only after the translated transcript is checked.",
      entity: "ZJU CS MSc",
      time: "2h ago",
      action: "Build checklist",
      href: "guides.html#documents",
      prompt: "Build a document checklist for my ZJU Computer Science MSc route before Oct 15",
    },
    {
      id: "deadline-zju",
      type: "deadline",
      severity: "action",
      group: "Today",
      title: "Oct 15 is the nearest program deadline",
      body: "Your main route has enough signal to start an application draft now.",
      entity: "Zhejiang University",
      time: "Today",
      action: "Start application",
      href: "application.html",
      prompt: "What should I finish first for the Oct 15 ZJU Computer Science MSc deadline?",
    },
    {
      id: "agent-summary",
      type: "agent",
      severity: "agent",
      group: "Today",
      title: "Agent comparison is ready",
      body: "Hangzhou is safer than Shanghai for your current budget; Nanjing remains a good backup.",
      entity: "Route comparison",
      time: "Today",
      action: "Open comparison",
      href: "favourites.html",
      prompt: "Show my latest route comparison and explain the risk order",
    },
    {
      id: "funding-csc",
      type: "funding",
      severity: "action",
      group: "This week",
      title: "CSC route needs source confirmation",
      body: "Treat CSC as a parallel funding route until the exact university channel is verified.",
      entity: "Chinese Government Scholarship",
      time: "Yesterday",
      action: "Review funding",
      href: "scholarships.html",
      prompt: "Check whether CSC fits my saved computer science master routes",
    },
    {
      id: "city-cost",
      type: "city",
      severity: "update",
      group: "This week",
      title: "Hangzhou cost estimate updated",
      body: "The current estimate still keeps Hangzhou below Shanghai for monthly living cost.",
      entity: "Hangzhou",
      time: "Mon",
      action: "Compare cities",
      href: "cities.html#hangzhou",
      prompt: "Compare one year cost in Hangzhou, Nanjing, and Shanghai for my saved routes",
    },
    {
      id: "saved-university",
      type: "update",
      severity: "done",
      group: "Earlier",
      title: "Zhejiang University was saved",
      body: "Saved universities are useful context, but a concrete program choice is required for applications.",
      entity: "University interest",
      time: "Jul 14",
      action: "Choose program",
      href: "programs.html?university=Zhejiang%20University",
      prompt: "Find English-taught programs at Zhejiang University that fit my saved goal",
    },
  ];

  function notificationProgramContext(route = defaultApplicationRoutes[0]) {
    const catalog = routeProgramCatalogSnapshot(route);
    return {
      entityType: "Program",
      entityId: catalog.programId,
      schoolId: catalog.schoolId,
      programId: catalog.programId,
      catalogTitle: catalog.program,
      sourceFieldLineage: catalog.sourceFieldLineage,
    };
  }

  function notificationSchoolContext(schoolName = config.defaultSchoolTenant) {
    const school = getSchoolCatalogRecord(schoolName);
    return {
      entityType: "School",
      entityId: school.id,
      schoolId: school.id,
      catalogTitle: school.nameEn,
      sourceFieldLineage: school.sourceFieldLineage || sourceFieldLineage("School", "School"),
    };
  }

  function notificationScholarshipContext(slugOrTitle = "csc") {
    const scholarship = getDiscoveryScholarships().find((item) => matchesDetailSlug(item, slugOrTitle, ["id", "slug", "title", "name"])) || getDiscoveryScholarships()[0];
    return {
      entityType: "PublicScholarship",
      entityId: scholarship?.slug || scholarship?.id || slugOrTitle,
      catalogTitle: scholarship?.title || scholarship?.name || "Scholarship route",
      sourceFieldLineage: scholarship?.sourceFieldLineage || sourceFieldLineage("Scholarship", "Scholarship"),
    };
  }

  function notificationCityContext(slugOrName = "hangzhou") {
    const city = getDiscoveryCities().find((item) => matchesDetailSlug(item, slugOrName, ["id", "slug", "name", "nameEn"])) || getDiscoveryCities()[0];
    return {
      entityType: "City",
      entityId: city?.slug || city?.id || slugOrName,
      catalogTitle: city?.nameEn || city?.name || "City guide",
      sourceFieldLineage: city?.sourceFieldLineage || sourceFieldLineage("CityGuide", "City"),
    };
  }

  function enrichNotificationItem(item = {}) {
    const contextById = {
      "doc-translation": notificationProgramContext(defaultApplicationRoutes[0]),
      "deadline-zju": notificationProgramContext(defaultApplicationRoutes[0]),
      "agent-summary": {
        entityType: "RouteComparison",
        entityId: "saved-route-comparison",
        catalogTitle: "Saved route comparison",
        sourceFieldLineage: {
          sourceModel: "SchoolProgram",
          sourceFields: legacyFieldContracts.sourceModelFields.SchoolProgram,
          displayAliases: legacyFieldContracts.displayAliases,
        },
      },
      "funding-csc": notificationScholarshipContext("csc"),
      "city-cost": notificationCityContext("hangzhou"),
      "saved-university": notificationSchoolContext("Zhejiang University"),
    };
    const context = contextById[item.id] || {};
    return { ...item, ...context };
  }

  function getNotificationCenterSummary() {
    return clone({
      baseItems: defaultNotificationItems.map(enrichNotificationItem),
      defaultPreferences: defaultNotificationPreferences,
      groups: ["Today", "This week", "Earlier"],
      source: "CuacDataClient notification center summary fixture",
    });
  }

  const defaultPreferenceSections = {
    profile: ["Profile", "Keep account details clear and useful."],
    security: ["Password and security", "Protect sign-in, recovery, and sensitive actions."],
    language: ["Language and region", "Format explanations, dates, cost, and Agent tone."],
    goal: ["Study goal defaults", "Tell CUAC what to prioritize first."],
    budget: ["Budget and funding", "Keep cost and scholarship expectations realistic."],
    readiness: ["Document readiness", "Turn blockers into useful reminders."],
    notifications: ["Notification rules", "Decide what deserves attention."],
    agent: ["Agent memory", "Control what Agent can use and when it must ask."],
    privacy: ["Privacy and access", "Keep personalization scoped and reversible."],
  };

  const defaultPreferenceProfile = {
    chips: ["Master", "Computer Science", "Fall 2026", "English-taught", "Scholarship interested"],
    workspaceHealth: [
      ["Account", "Profile ready"],
      ["Security", "Password active"],
      ["Agent", "Use saved routes"],
      ["Language", "English · RMB"],
    ],
  };

  const defaultAgentMemoryState = {
    status: "active",
    clearCount: 0,
    retention: "application-lifecycle",
    storageKey: "cuacStudentAgentMemory",
    clearTrigger: "student-clears-memory-or-enrollment-archive",
  };

  function getPreferenceCenterSummary() {
    return clone({
      sections: defaultPreferenceSections,
      profile: defaultPreferenceProfile,
      defaultNotificationPreferences,
      defaultAgentMemoryState,
      storageKeys: {
        preferences: "cuacPreferencesDemoState",
        agentMemory: "cuacStudentAgentMemory",
      },
      source: "CuacDataClient preference center summary fixture",
    });
  }

  const sampleSchoolApplications = {
    maya: {
      school: "Zhejiang University",
      name: "Maya Chen",
      status: "New",
      source: "Prepared",
      programName: "Computer Science",
      degree: "MSc",
      intake: "Fall 2026",
      languageRoute: "English-taught",
      city: "Hangzhou",
      country: "Malaysia",
      email: "maya@example.com",
      phone: "+60 12 000 0000",
      stage: "Final-year undergraduate",
      funding: "Scholarship possible",
      language: "IELTS / waiver noted",
      deadline: "Scholarship window closing",
      fit: "Strong route fit",
      owner: "International Office",
      priority: "High",
      receivedAt: "2026-08-14T09:10:00",
      due: "Due: today",
      nextAction: "Contact student and request transcript, passport scan, language proof, and program-specific checklist.",
      note: "Interested in a realistic English-taught CS route in Hangzhou. Transcript translation may need follow-up.",
      timeline: ["CUAC received student route choice", "Routed to Zhejiang University tenant scope", "First contact not started"],
    },
    amir: {
      school: "Zhejiang University",
      name: "Amir Khan",
      status: "Needs review",
      source: "Prepared",
      programName: "Biomedical Engineering",
      degree: "MSc",
      intake: "Fall 2026",
      languageRoute: "English-taught",
      city: "Hangzhou",
      country: "Pakistan",
      email: "amir@example.com",
      phone: "+92 300 000 0000",
      stage: "Bachelor graduate",
      funding: "CSC route requested",
      language: "IELTS ready",
      deadline: "Lab fit needs confirmation",
      fit: "Review supervisor availability",
      owner: "Faculty Coordinator",
      priority: "High",
      receivedAt: "2026-08-13T15:40:00",
      due: "Due: tomorrow",
      nextAction: "Assign faculty review, confirm lab availability, then contact student for official material list.",
      note: "Strong engineering interest. The school should confirm lab availability and scholarship fit.",
      timeline: ["Prepared record created", "Scholarship signal detected", "Faculty fit pending"],
    },
    lina: {
      school: "Zhejiang University",
      name: "Lina Santos",
      status: "Contacted",
      source: "Prepared",
      programName: "Computer Science",
      degree: "BSc",
      intake: "Fall 2026",
      languageRoute: "English-taught",
      city: "Hangzhou",
      country: "Brazil",
      email: "lina@example.com",
      phone: "+55 11 0000 0000",
      stage: "High school graduate",
      funding: "Self-funded",
      language: "English-taught route",
      deadline: "Normal intake timing",
      fit: "Contact-ready",
      owner: "Admissions Desk",
      priority: "Normal",
      receivedAt: "2026-08-12T10:25:00",
      due: "Due: this week",
      nextAction: "Wait for transcript and passport scan through the school process.",
      note: "School contacted student and is waiting for transcript and passport scan through its own process.",
      timeline: ["Prepared record created", "School contacted student", "Waiting for transcript"],
    },
    noah: {
      school: "Zhejiang University",
      name: "Noah Mensah",
      status: "Waiting for documents",
      source: "Prepared",
      programName: "International Business",
      degree: "BSc",
      intake: "Spring 2027",
      languageRoute: "English-taught",
      city: "Hangzhou",
      country: "Ghana",
      email: "noah@example.com",
      phone: "+233 24 000 0000",
      stage: "High school final year",
      funding: "Self-funded",
      language: "English interview suggested",
      deadline: "Low deadline risk",
      fit: "Needs document check",
      owner: "Admissions Desk",
      priority: "Normal",
      receivedAt: "2026-08-10T08:20:00",
      due: "Due: next week",
      nextAction: "Follow up once the student sends high school transcript and passport scan.",
      note: "Student is comparing spring options and needs a clear document checklist before official school application.",
      timeline: ["Prepared record created", "Contact queued", "Document request sent"],
    },
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function readStoredJson(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || "null");
    } catch {
      return null;
    }
  }

  function writeStoredJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function plainRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value);
  }

  function readOpsPreviewList(key) {
    const state = readStoredJson("cuacOpsAdminDemoState");
    const value = plainRecord(state) ? state[key] : null;
    if (Array.isArray(value)) return value.filter(plainRecord);
    if (plainRecord(value)) return Object.values(value).filter(plainRecord);
    return [];
  }

  function recordStatusKey(value) {
    const status = String(value || "").toLowerCase();
    if (["archived", "已归档"].includes(status)) return "archived";
    if (["draft", "草稿"].includes(status)) return "draft";
    if (["published", "已发布"].includes(status)) return "published";
    return status;
  }

  function publicPreviewRecords(key) {
    return readOpsPreviewList(key).filter((record) => recordStatusKey(record.status) !== "archived");
  }

  function opsProgramPreviewRecords() {
    return publicPreviewRecords("schoolRecords").flatMap((school) => {
      const programs = Array.isArray(school.programs) ? school.programs.filter(plainRecord) : [];
      const schoolId = school.id || school.sourceId || "";
      const schoolNameEn = school.nameEn || school.name || school.nameZh || "School to confirm";
      const schoolNameZh = school.nameZh || schoolNameEn;
      return programs
        .filter((program) => recordStatusKey(program.status) !== "archived")
        .map((program, index) => ({
          ...program,
          id: program.id || `${schoolId || slugify(schoolNameEn)}-program-${index + 1}`,
          schoolId: program.schoolId || schoolId,
          schoolNameZh: program.schoolNameZh || schoolNameZh,
          schoolNameEn: program.schoolNameEn || schoolNameEn,
          university: program.university || schoolNameEn,
          city: program.city || school.cityZh || school.city || "",
          cityZh: program.cityZh || school.cityZh || school.city || "",
          province: program.province || school.region || school.province || "",
          applicationUrl: program.applicationUrl || school.applicationSystemUrl || school.admissionsWebsiteUrl || "",
          sourceLabel: program.sourceLabel || school.sourceLabel || "School program record",
          lastVerifiedAt: program.lastVerifiedAt || school.lastVerifiedAt || "",
        }));
    });
  }

  function opsSchoolScholarshipPreviewRecords() {
    return publicPreviewRecords("schoolRecords").flatMap((school) => {
      const schoolId = school.id || school.sourceId || "";
      const schoolNameEn = school.nameEn || school.name || school.nameZh || "School to confirm";
      const schoolNameZh = school.nameZh || schoolNameEn;
      const detailed = [
        ...(Array.isArray(school.scholarshipsDetailed) ? school.scholarshipsDetailed : []),
        ...(Array.isArray(school.detailedScholarships) ? school.detailedScholarships : []),
      ].filter(plainRecord);
      const seen = new Set();
      return detailed
        .filter((record) => recordStatusKey(record.status) !== "archived")
        .map((record, index) => ({
          ...record,
          id: record.id || `${schoolId || slugify(schoolNameEn)}-scholarship-${index + 1}`,
          schoolId: record.schoolId || schoolId,
          schoolNameZh: record.schoolNameZh || schoolNameZh,
          schoolNameEn: record.schoolNameEn || schoolNameEn,
          sourceLabel: record.sourceLabel || school.sourceLabel || "School scholarship record",
          lastVerifiedAt: record.lastVerifiedAt || school.lastVerifiedAt || "",
        }))
        .filter((record) => {
          const key = [record.id || "", record.schoolId || "", record.programId || "", record.name || "", record.scholarshipSlug || ""].join("|");
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
    });
  }

  function mergePreviewRecords(baseRecords = [], previewRecords = [], identityKeys = ["id", "slug"]) {
    const merged = clone(baseRecords || []);
    previewRecords.forEach((record) => {
      const index = merged.findIndex((item) => identityKeys.some((key) => item?.[key] && record?.[key] && String(item[key]) === String(record[key])));
      if (index >= 0) merged[index] = { ...merged[index], ...record };
      else merged.unshift(record);
    });
    return merged;
  }

  function slugify(value) {
    return String(value || "record").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }

  function titleCase(value) {
    return String(value || "")
      .split(/[\s-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  function sourceFieldLineage(modelName, displayAliasPrefix) {
    const prefix = displayAliasPrefix ? `${displayAliasPrefix}.` : "";
    const displayAliases = Object.fromEntries(
      Object.entries(legacyFieldContracts.displayAliases || {})
        .filter(([alias]) => alias.startsWith(prefix))
        .map(([alias, source]) => [alias.slice(prefix.length), source]),
    );
    return {
      sourceProject: legacyFieldContracts.sourceProject,
      sourceModel: modelName,
      sourceFields: legacyFieldContracts.sourceModelFields?.[modelName] || [],
      displayAliases,
    };
  }

  function normalizeDegreeLevel(value) {
    const degree = String(value || "").toLowerCase();
    if (degree.includes("under") || degree.includes("bachelor")) return "Bachelor";
    if (degree.includes("master")) return "Master";
    if (degree.includes("phd") || degree.includes("doctor")) return "Doctoral";
    if (degree.includes("non")) return "Non-degree";
    return value || "Program";
  }

  function normalizeTeachingLanguage(value) {
    const language = String(value || "").toLowerCase();
    if (language.includes("english")) return "English-taught";
    if (language.includes("chinese")) return "Chinese-taught";
    return value || "Teaching language pending";
  }

  function inferCscaSubjects(program = {}) {
    const subject = String(program.subject || program.fieldCategory || "").toLowerCase();
    if (subject.includes("medicine")) return ["Biology", "Chemistry"];
    if (subject.includes("engineering") || subject.includes("computer") || subject.includes("ai")) return ["Mathematics", "Physics"];
    if (subject.includes("business") || subject.includes("economics")) return ["Mathematics"];
    return [];
  }

  function inferProgramDuration(degreeLevel = "") {
    const degree = String(degreeLevel || "").toLowerCase();
    if (degree.includes("bachelor") || degree.includes("under")) return "4 years";
    if (degree.includes("master")) return "2-3 years";
    if (degree.includes("doctor")) return "3-4 years";
    return "";
  }

  function defaultHskRequirement(teachingLanguage = "") {
    return String(teachingLanguage || "").toLowerCase().includes("english")
      ? "English-taught routes usually do not require HSK; confirm by school."
      : "Chinese-taught routes usually require HSK 5-6; confirm by program.";
  }

  function defaultEnglishRequirement(teachingLanguage = "") {
    return String(teachingLanguage || "").toLowerCase().includes("english")
      ? "IELTS / TOEFL or school-approved proof."
      : "English proof depends on program language; confirm by school.";
  }

  function inferSourceStatus(source) {
    if (source === "verified") return "verified";
    if (source === "pending") return "pending";
    return "sample";
  }

  function normalizeDiscoveryProgram(program = {}, index = 0) {
    const schoolName = program.university || program.schoolNameEn || "School to confirm";
    const catalogSchool = schoolCatalog[schoolName] || schoolCatalog[program.schoolNameEn] || schoolCatalog[program.schoolNameZh] || {};
    const schoolId = program.schoolId || catalogSchool.id || index + 1001;
    const catalogPrograms = programCatalog[schoolName] || [];
    const catalogIndex = catalogPrograms.findIndex((item) => {
      const itemName = item.nameEn || item.name || item.program;
      return itemName && [program.nameEn, program.name, program.program, program.nameZh].filter(Boolean).some((name) => String(name) === String(itemName));
    });
    const catalogProgram = catalogIndex >= 0 ? catalogPrograms[catalogIndex] : {};
    const programId = program.programId || program.catalogProgramId || (catalogSchool.id && catalogIndex >= 0 ? catalogSchool.id * 100 + catalogIndex + 1 : program.id);
    const degreeLevel = program.degreeLevel || normalizeDegreeLevel(program.degree);
    const teachingLanguage = program.teachingLanguage || normalizeTeachingLanguage(program.language);
    const fieldCategory = program.fieldCategory || program.subject || "General";
    const cscaSubjects = Array.isArray(program.cscaSubjects) ? program.cscaSubjects : inferCscaSubjects(program);
    const deadlineDate = program.deadlineDate || catalogDeadlineDate(catalogProgram.deadline) || program.deadline || "";
    const deadlineLabel = program.deadlineLabel || catalogProgram.deadline || program.deadline || deadlineDate || "Deadline pending";
    const displayTuitionAmount = parseCatalogTuition(program.displayTuition);
    const tuitionAmount = Number.isFinite(Number(program.tuitionAmount ?? program.tuition))
      ? Number(program.tuitionAmount ?? program.tuition)
      : displayTuitionAmount;
    const tuitionText = program.tuitionText || program.displayTuition || catalogProgram.tuition || (tuitionAmount ? `RMB ${tuitionAmount.toLocaleString()}/year` : "Tuition pending");
    const nameEn = program.nameEn || program.name || program.nameZh || "Program to confirm";

    return {
      ...program,
      schoolId,
      programId,
      schoolNameEn: schoolName,
      schoolNameZh: program.schoolNameZh || catalogSchool.nameZh || schoolName,
      nameEn,
      nameZh: program.nameZh || nameEn,
      degreeLevel,
      durationYears: program.durationYears || program.duration || inferProgramDuration(degreeLevel),
      fieldCategory,
      teachingLanguage,
      cscaSubjects,
      cscaRequirement: program.cscaRequirement || (cscaSubjects.length ? `CSCA: ${cscaSubjects.join(" + ")}; confirm by school and program.` : "School confirms whether CSCA applies to this program."),
      hskRequirement: program.hskRequirement || program.hsk || defaultHskRequirement(teachingLanguage),
      englishRequirement: program.englishRequirement || program.langReq || defaultEnglishRequirement(teachingLanguage),
      tuitionAmount,
      tuitionCurrency: program.tuitionCurrency || "RMB",
      tuitionPeriod: program.tuitionPeriod || "year",
      tuitionText,
      scholarshipText: program.scholarshipText || program.scholarshipType || (program.scholarship ? "Scholarship route listed" : "No scholarship listed"),
      openDate: program.openDate || "",
      deadlineDate,
      deadlineLabel,
      applicationRound: program.applicationRound || program.intake || catalogProgram.intake || "",
      applicationUrl: program.applicationUrl || program.applicationSystemUrl || "School admissions portal",
      applicationNote: program.applicationNote || "CUAC keeps program selection metadata only; schools request official documents directly.",
      sourceUrl: program.sourceUrl || "",
      sourceLabel: program.sourceLabel || "Program record",
      lastVerifiedAt: program.lastVerifiedAt || program.verified || "",
      sortOrder: program.sortOrder ?? index + 1,
      status: program.status || "published",
      version: program.version || 1,
      createdAt: program.createdAt || "",
      updatedAt: program.updatedAt || "",
      cscaRules: program.cscaRules || [],
      scholarships: program.scholarships || [],
      scholarshipLinks: program.scholarshipLinks || [],
      verificationStatus: program.verificationStatus || inferSourceStatus(program.source),
      isVerified: program.isVerified ?? program.source === "verified",
      hasScholarship: program.hasScholarship ?? Boolean(program.scholarship),
      badgeText: program.badgeText || program.readiness,
      displayTuition: program.displayTuition || tuitionText,
      displaySubjects: program.displaySubjects || cscaSubjects,
      displayGroup: program.displayGroup || slugify(fieldCategory),
      displayGroupLabel: program.displayGroupLabel || titleCase(fieldCategory),
      sourceFieldLineage: sourceFieldLineage("SchoolProgram", "Program"),
      school: {
        id: schoolId,
        nameZh: program.schoolNameZh || catalogSchool.nameZh || schoolName,
        nameEn: schoolName,
        region: program.province || program.region || catalogSchool.region || "",
        cityZh: program.city || catalogSchool.cityZh || "",
        citySlug: slugify(program.city || catalogSchool.cityZh || ""),
        sourceFieldLineage: sourceFieldLineage("School", "School"),
      },
    };
  }

  function parseCatalogTuition(value) {
    const normalized = String(value || "").toLowerCase();
    const amount = Number(normalized.match(/\d+(?:\.\d+)?/)?.[0] || 0);
    if (!amount) return undefined;
    return normalized.includes("k") ? Math.round(amount * 1000) : Math.round(amount);
  }

  function catalogDeadlineDate(value) {
    const normalized = String(value || "").trim();
    const match = normalized.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})$/i);
    if (!match) return "";
    const month = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(match[1].toLowerCase()) + 1;
    return `2026-${String(month).padStart(2, "0")}-${String(match[2]).padStart(2, "0")}`;
  }

  function getSchoolCatalogRecord(schoolName = config.defaultSchoolTenant) {
    const fallback = { id: 199, nameZh: schoolName, nameEn: schoolName, citySlug: "", cityZh: "", region: "", admissionsWebsiteUrl: "School admissions portal", applicationFee: "School confirms during official application", sourceLabel: "CSCAlite school record", lastVerifiedAt: "2026-08-14" };
    return { ...fallback, ...(schoolCatalog[schoolName] || {}) };
  }

  function getSchoolCatalogRecordById(schoolId, fallbackName = config.defaultSchoolTenant) {
    const matched = Object.values(schoolCatalog).find((school) => Number(school.id) === Number(schoolId));
    if (matched) return { ...matched };
    const preview = publicPreviewRecords("schoolRecords").find((school) => String(school.id || school.sourceId || "") === String(schoolId));
    if (preview) {
      return {
        ...getSchoolCatalogRecord(fallbackName),
        ...preview,
        id: preview.id || preview.sourceId || schoolId,
        nameZh: preview.nameZh || preview.nameEn || fallbackName,
        nameEn: preview.nameEn || preview.name || preview.nameZh || fallbackName,
        admissionsWebsiteUrl: preview.admissionsWebsiteUrl || preview.applicationSystemUrl || "",
      };
    }
    return getSchoolCatalogRecord(fallbackName);
  }

  function mixedIdList(value) {
    if (Array.isArray(value)) return value.map((item) => String(plainRecord(item) ? item.id || item.value || "" : item ?? "").trim()).filter(Boolean);
    if (plainRecord(value)) return mixedIdList(Object.values(value));
    return String(value || "").split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);
  }

  function scholarshipLinkedSchools(item = {}) {
    const explicit = Array.isArray(item.schools) ? item.schools.filter(plainRecord) : [];
    if (explicit.length) return explicit;
    const ids = mixedIdList(item.schoolIds);
    if (!ids.length) return [];
    const seen = new Set();
    return ids.map((id) => getSchoolCatalogRecordById(id, item.schoolName || item.providerName || "Applicable school"))
      .filter((school) => {
        const key = String(school.id || school.sourceId || school.nameEn || school.nameZh || "");
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((school) => ({
        id: school.id || school.sourceId,
        nameZh: school.nameZh || school.name || school.nameEn,
        nameEn: school.nameEn || school.name || school.nameZh,
        region: school.region || school.cityZh || school.province || "",
      }));
  }

  function scholarshipLinkedPrograms(item = {}) {
    const explicit = Array.isArray(item.programs) ? item.programs.filter(plainRecord) : [];
    if (explicit.length) return explicit;
    const ids = mixedIdList(item.programIds);
    if (!ids.length) return [];
    const programs = [...discoveryPrograms, ...programCatalogDiscoveryRecords(), ...opsProgramPreviewRecords()].map(normalizeDiscoveryProgram);
    const seen = new Set();
    return ids.map((id) => programs.find((program) => String(program.id || program.programId || "") === String(id))).filter(Boolean)
      .filter((program) => {
        const key = String(program.id || program.programId || program.nameEn || program.name || "");
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((program) => ({
        id: program.id || program.programId,
        schoolId: program.schoolId,
        schoolName: program.schoolNameEn || program.university || program.schoolNameZh || "",
        nameZh: program.nameZh || program.name || program.nameEn,
        nameEn: program.nameEn || program.name || program.nameZh,
        degreeLevel: program.degreeLevel || program.degree,
        teachingLanguage: program.teachingLanguage || program.language,
      }));
  }

  function normalizeSchoolScholarship(record = {}) {
    return {
      ...record,
      sourceFieldLineage: sourceFieldLineage("SchoolScholarship", "SchoolScholarship"),
    };
  }

  function getSchoolScholarshipRecords(program = {}) {
    const degree = String(program.degreeLevel || "").toLowerCase();
    const programName = String(program.nameEn || program.program || "").toLowerCase();
    const programIds = new Set([program.id, program.programId, program.catalogProgramId].filter((value) => value !== undefined && value !== null && value !== "").map((value) => String(value)));
    const scholarshipRecords = [...schoolScholarshipCatalog, ...opsSchoolScholarshipPreviewRecords()];
    const seen = new Set();
    return scholarshipRecords
      .filter((record) => {
        const recordDegree = String(record.applicableDegree || "").toLowerCase();
        const recordProgram = String(record.applicableProgram || "").toLowerCase();
        const recordProgramId = record.programId === undefined || record.programId === null || record.programId === "" ? "" : String(record.programId);
        const matchesSchool = String(record.schoolId || "") === String(program.schoolId || "");
        const matchesProgram = !recordProgramId || programIds.has(recordProgramId) || recordProgram === programName;
        const matchesDegree = !recordDegree || !degree || recordDegree.includes(degree.toLowerCase()) || degree.includes(recordDegree);
        return matchesSchool && matchesProgram && matchesDegree && recordStatusKey(record.status) !== "archived";
      })
      .filter((record) => {
        const key = [record.id || "", record.schoolId || "", record.programId || "", record.name || "", record.scholarshipSlug || ""].join("|");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
      .map(normalizeSchoolScholarship);
  }

  function enrichProgramScholarshipContext(program = {}) {
    const schoolScholarships = Array.isArray(program.schoolScholarships) && program.schoolScholarships.length
      ? program.schoolScholarships.map(normalizeSchoolScholarship)
      : getSchoolScholarshipRecords(program);
    if (!schoolScholarships.length) return { ...program, schoolScholarships: [] };
    return {
      ...program,
      schoolScholarships,
      scholarshipText: program.scholarshipText && program.scholarshipText !== "No scholarship listed"
        ? program.scholarshipText
        : schoolScholarships.map((record) => record.name).filter(Boolean).join(" + "),
      hasScholarship: true,
    };
  }

  function normalizeCatalogProgram(program = {}, schoolName = config.defaultSchoolTenant, index = 0) {
    const school = getSchoolCatalogRecord(schoolName);
    const nameEn = program.nameEn || program.program || "Selected program";
    const fieldCategory = program.fieldCategory || nameEn.replace(/\s+(BSc|MSc|BA|BArch)$/i, "");
    const tuitionAmount = program.tuitionAmount ?? parseCatalogTuition(program.tuition);
    const deadlineDate = program.deadlineDate || catalogDeadlineDate(program.deadline);
    const normalized = normalizeDiscoveryProgram(
      {
        ...program,
        id: program.id || school.id * 100 + index + 1,
        schoolId: school.id,
        schoolNameZh: school.nameZh,
        schoolNameEn: school.nameEn,
        university: school.nameEn,
        name: nameEn,
        nameEn,
        fieldCategory,
        subject: fieldCategory,
        degreeLevel: program.degreeLevel || normalizeDegreeLevel(program.degree),
        teachingLanguage: program.teachingLanguage || normalizeTeachingLanguage(program.language),
        tuitionAmount,
        tuitionText: program.tuitionText || program.tuition || "",
        deadlineDate,
        deadlineLabel: program.deadlineLabel || program.deadline || deadlineDate,
        applicationRound: program.applicationRound || program.intake || "",
        applicationUrl: program.applicationUrl || school.applicationSystemUrl || school.admissionsWebsiteUrl,
        sourceLabel: program.sourceLabel || school.sourceLabel,
        lastVerifiedAt: program.lastVerifiedAt || school.lastVerifiedAt,
        source: program.source || "sample",
        province: school.region,
        city: program.city || school.cityZh,
      },
      index,
    );
    return enrichProgramScholarshipContext(normalized);
  }

  function getNormalizedProgramCatalog() {
    return Object.fromEntries(
      Object.entries(programCatalog).map(([schoolName, programs]) => [
        schoolName,
        programs.map((program, index) => normalizeCatalogProgram(program, schoolName, index)),
      ]),
    );
  }

  function programCatalogDiscoveryRecords() {
    return Object.entries(getNormalizedProgramCatalog()).flatMap(([, programs]) => programs);
  }

  function findCatalogProgram(route = {}) {
    const discoveryMatch = getDiscoveryPrograms().find((program) => {
      const sameProgramId = route.programId && (String(program.id) === String(route.programId) || String(program.programId) === String(route.programId));
      const sameSchool = !route.schoolId || String(program.schoolId) === String(route.schoolId);
      const sameProgramName = program.program === route.program || program.nameEn === route.program || program.nameEn === route.programName;
      return sameProgramId || (sameSchool && sameProgramName);
    });
    if (discoveryMatch) return discoveryMatch;
    const schoolRecord = route.schoolId
      ? getSchoolCatalogRecordById(route.schoolId, route.university || route.school || config.defaultSchoolTenant)
      : getSchoolCatalogRecord(route.university || route.school || config.defaultSchoolTenant);
    const schoolName = schoolRecord.nameEn || route.university || route.school || config.defaultSchoolTenant;
    const normalizedPrograms = (getNormalizedProgramCatalog()[schoolName] || []);
    return normalizedPrograms.find((program) => {
      if (route.programId && Number(program.id) === Number(route.programId)) return true;
      const sameSchool = !route.schoolId || Number(program.schoolId) === Number(route.schoolId);
      const sameProgram = program.program === route.program || program.nameEn === route.program || program.nameEn === route.programName;
      return sameSchool && sameProgram;
    }) || normalizedPrograms[0] || normalizeCatalogProgram(route, schoolName, 0);
  }

  function buildChoiceHandoffSnapshot(route = {}, student = defaultStudentProfile, index = 0) {
    const school = route.schoolId
      ? getSchoolCatalogRecordById(route.schoolId, route.university || route.school || config.defaultSchoolTenant)
      : getSchoolCatalogRecord(route.university || route.school || config.defaultSchoolTenant);
    const program = findCatalogProgram(route);
    const schoolScholarships = program.schoolScholarships || getSchoolScholarshipRecords(program);
    const selectedByStudent = {
      schoolId: school.id,
      programId: program.programId || program.id,
      degreeLevel: route.degree || program.degreeLevel,
      intake: route.intake || program.applicationRound,
      teachingLanguage: route.language || program.teachingLanguage,
      studentChoiceNote: route.choiceNote || "",
    };
    return {
      recordId: `${slugify(school.nameEn)}-${program.id}-${index}`,
      selectedByStudent,
      fromProgramRecord: {
        id: program.programId || program.id,
        schoolId: program.schoolId,
        nameZh: program.nameZh,
        nameEn: program.nameEn,
        degreeLevel: program.degreeLevel,
        durationYears: program.durationYears,
        fieldCategory: program.fieldCategory,
        teachingLanguage: program.teachingLanguage,
        cscaSubjects: program.cscaSubjects,
        cscaRequirement: program.cscaRequirement,
        hskRequirement: program.hskRequirement,
        englishRequirement: program.englishRequirement,
        tuitionAmount: program.tuitionAmount,
        tuitionCurrency: program.tuitionCurrency,
        tuitionPeriod: program.tuitionPeriod,
        tuitionText: program.tuitionText,
        scholarshipText: program.scholarshipText,
        deadlineDate: program.deadlineDate,
        deadlineLabel: program.deadlineLabel,
        applicationRound: program.applicationRound,
        applicationUrl: program.applicationUrl,
        applicationNote: program.applicationNote,
        sourceUrl: program.sourceUrl,
        sourceLabel: program.sourceLabel,
        lastVerifiedAt: program.lastVerifiedAt,
        sourceFieldLineage: program.sourceFieldLineage || sourceFieldLineage("SchoolProgram", "Program"),
      },
      fromSchoolScholarshipRecords: schoolScholarships.map((record) => ({
        id: record.id,
        schoolId: record.schoolId,
        programId: record.programId,
        name: record.name,
        type: record.type,
        coverage: record.coverage,
        applicableDegree: record.applicableDegree,
        applicableProgram: record.applicableProgram,
        amountText: record.amountText,
        requirementText: record.requirementText,
        deadlineDate: record.deadlineDate,
        deadlineLabel: record.deadlineLabel,
        applicationRound: record.applicationRound,
        scholarshipSlug: record.scholarshipSlug,
        sourceLabel: record.sourceLabel,
        lastVerifiedAt: record.lastVerifiedAt,
        isCsc: record.isCsc,
        isVerified: record.isVerified,
        sourceFieldLineage: record.sourceFieldLineage || sourceFieldLineage("SchoolScholarship", "SchoolScholarship"),
      })),
      fromSchoolRecord: {
        id: school.id,
        nameZh: school.nameZh,
        nameEn: school.nameEn,
        citySlug: school.citySlug,
        cityZh: school.cityZh,
        region: school.region,
        admissionsWebsiteUrl: school.admissionsWebsiteUrl,
        applicationFee: school.applicationFee,
        sourceLabel: school.sourceLabel,
        lastVerifiedAt: school.lastVerifiedAt,
        sourceFieldLineage: school.sourceFieldLineage || sourceFieldLineage("School", "School"),
      },
      fromStudentProfile: {
        legalName: student.fullName,
        email: student.email,
        phone: student.phone,
        country: student.country,
        countryCode: student.countryCode,
        nationality: student.nationality || student.passportNationality,
        nationalityCode: student.nationalityCode,
        passportNationality: student.passportNationality || student.nationality,
        highestEducation: student.educationStage,
        grade: student.grade || student.educationStage,
        gradeCode: student.gradeCode,
        currentSchool: student.currentSchool,
        currentOrganizationId: student.currentOrganizationId,
        intendedLevel: student.intendedLevel,
        fundingIntent: student.fundingIntent,
        languageTests: student.languageStatus,
        academicSummary: student.academicSummary,
        guardianStatus: student.guardianStatus,
        updatedAt: student.updatedAt,
        consent: "Student submits CUAC non-document application record to selected schools.",
      },
      sourceFieldLineage: {
        selectedByStudent: "Student-selected route fields constrained by School and SchoolProgram catalog IDs.",
        fromProgramRecord: program.sourceFieldLineage || sourceFieldLineage("SchoolProgram", "Program"),
        fromSchoolScholarshipRecords: sourceFieldLineage("SchoolScholarship", "SchoolScholarship"),
        fromSchoolRecord: school.sourceFieldLineage || sourceFieldLineage("School", "School"),
        fromStudentProfile: {
          sourceModel: "StudentProfile",
          sourceFields: legacyFieldContracts.sourceModelFields.StudentProfile,
          displayAliases: {},
        },
      },
      notCollectedByCuac: clone(legacyFieldContracts.addChoiceInformationSources.notCollectedByCuac),
    };
  }

  function normalizeDiscoverySchool(school = {}, index = 0) {
    const catalogMatch = schoolCatalog[school.nameEn] || schoolCatalog[school.name] || Object.values(schoolCatalog).find((item) => (
      item.sourceId && item.sourceId === school.sourceId
    )) || {};
    school = { ...catalogMatch, ...school };
    const id = school.id || index + 2001;
    const nameEn = school.nameEn || school.name || "School to confirm";
    const cityZh = school.cityZh || school.city || "";
    const subjectTags = Array.isArray(school.subjectTags) ? school.subjectTags : school.subjects || [];
    const languageOfInstruction = school.languageOfInstruction || ((school.tags || []).some((tag) => String(tag).toLowerCase().includes("english")) ? ["English-taught"] : []);
    const tuitionSummary = school.tuitionSummary || school.tuition || "Tuition pending";
    const programCount = school.programCount ?? school.programs ?? 0;
    const englishProgramCount = school.englishProgramCount ?? school.routes ?? 0;
    const scholarshipCount = school.scholarshipCount ?? (school.scholarship ? 1 : 0);
    const schoolRegion = school.region || school.province || "";
    const officialWebsiteUrl = school.officialWebsiteUrl || school.officialWebsite || "Confirm official website";
    const admissionsWebsiteUrl = school.admissionsWebsiteUrl || school.applicationSystemUrl || "Confirm application system URL";
    const dataQualityScore = school.dataQualityScore ?? school.qualityScore ?? (school.verified ? 92 : 72);
    const admissionLevel = school.applicationLevel || school.admissionLevel || ["Bachelor", "Master"];
    const hskRequirement = school.hskRequirement || "Confirm by program";
    const englishRequirement = school.englishRequirement || "Confirm by program";
    return {
      ...school,
      id,
      nameEn,
      nameZh: school.nameZh || catalogMatch.nameZh || nameEn,
      schoolType: school.schoolType || "regular",
      region: schoolRegion,
      city: cityZh,
      cityZh,
      citySlug: school.citySlug || slugify(cityZh),
      regionLabel: school.regionLabel || schoolRegion,
      rank: school.rank,
      guaranteedAdmission: school.guaranteedAdmission ?? false,
      tierEn: school.tierEn || school.tier || "",
      logoUrl: school.logoUrl || "",
      cscaRequired: school.cscaRequired ?? false,
      cscaRequirement: school.cscaRequirement || "Confirm by school and program",
      cscaRequirementNote: school.cscaRequirementNote || "",
      cscaSubjects: school.cscaSubjects || [],
      languageRequirement: school.languageRequirement || "Confirm by teaching language",
      admissionLevel,
      applicationLevel: school.applicationLevel || admissionLevel,
      languageOfInstruction,
      hskRequirement,
      hskNotes: school.hskNotes || "",
      undergradRequirements: school.undergradRequirements || "Confirm undergraduate route with school source",
      postgradRequirements: school.postgradRequirements || "Confirm postgraduate route with school source",
      preparatoryRequirements: school.preparatoryRequirements || "Confirm preparatory route with school source",
      hskMinLevel: school.hskMinLevel ?? null,
      hskChineseMinLevel: school.hskChineseMinLevel ?? school.hskMinLevel ?? null,
      hskChineseMinListening: school.hskChineseMinListening ?? null,
      hskChineseMinReading: school.hskChineseMinReading ?? null,
      hskChineseMinWriting: school.hskChineseMinWriting ?? null,
      hskChineseConditional: school.hskChineseConditional || "",
      hskEnglishRequired: school.hskEnglishRequired ?? false,
      hskkRequired: school.hskkRequired ?? false,
      hskkChineseMinLevel: school.hskkChineseMinLevel || "",
      hskkChineseConditional: school.hskkChineseConditional || "",
      englishRequired: school.englishRequired ?? Boolean(String(englishRequirement).toLowerCase().includes("ielts") || String(englishRequirement).toLowerCase().includes("toefl")),
      englishMinIelts: school.englishMinIelts ?? null,
      englishMinToefl: school.englishMinToefl ?? null,
      englishRequirement,
      englishRequirementNote: school.englishRequirementNote || "",
      deadlineSummary: school.deadlineSummary || "Check program deadlines",
      round1OpenDate: school.round1OpenDate || "",
      round1CloseDate: school.round1CloseDate || "",
      round1Deadline: school.round1Deadline || school.deadlineSummary || "",
      round2OpenDate: school.round2OpenDate || "",
      round2CloseDate: school.round2CloseDate || "",
      round2Deadline: school.round2Deadline || "",
      applicationSteps: school.applicationSteps || "Student selects a concrete school and program in CUAC; after payment CUAC sends a school-scoped record; school contacts the student for official materials.",
      tuitionSummary,
      tuitionByCategory: school.tuitionByCategory || {},
      applicationFee: school.applicationFee || "Confirm by school",
      insurance: school.insurance || "Confirm by school",
      accommodationCost: school.accommodationCost || "Confirm by school",
      accommodationType: school.accommodationType || "Confirm by school",
      officialWebsite: officialWebsiteUrl,
      applicationSystemUrl: admissionsWebsiteUrl,
      officialWebsiteUrl,
      admissionsWebsiteUrl,
      sourceUrl: school.sourceUrl || "",
      sourceLabel: school.sourceLabel || "School record",
      sourceNote: school.sourceNote || "",
      source: school.source || "cuac-demo",
      sourceId: school.sourceId || slugify(nameEn),
      verificationStatus: school.verificationStatus || (school.verified ? "verified" : "sample"),
      lastVerifiedAt: school.lastVerifiedAt || (school.verified ? "Verified" : ""),
      createdAt: school.createdAt || "",
      updatedAt: school.updatedAt || "",
      qualityScore: dataQualityScore,
      dataQualityScore,
      missingFields: school.missingFields || (school.verified ? [] : ["sourceUrl", "lastVerifiedAt"]),
      completenessLabel: school.completenessLabel || (school.verified ? "Application ready" : "Review before applying"),
      featuredPrograms: school.featuredPrograms || subjectTags,
      scholarships: school.scholarships || (school.scholarship ? ["Scholarship route listed"] : []),
      englishPrograms: school.englishPrograms || (languageOfInstruction.length ? `${englishProgramCount || "Some"} English-taught route signals` : ""),
      notablePrograms: school.notablePrograms || compactList(subjectTags).join(", "),
      campusFacilities: school.campusFacilities || "",
      programFields: school.programFields || compactList(subjectTags).join(", "),
      contactTel: school.contactTel || "",
      contactEmail: school.contactEmail || "",
      contactAddress: school.contactAddress || "",
      yearEstablished: school.yearEstablished ?? null,
      studentCount: school.studentCount || "",
      studentsServed: school.studentsServed ?? null,
      under18GuardianRequired: school.under18GuardianRequired ?? false,
      under18RequirementNote: school.under18RequirementNote || "",
      fitNotes: school.fitNotes || [],
      derivedTags: school.derivedTags || school.tags || [],
      subjectTags,
      languageTags: school.languageTags || languageOfInstruction,
      tuitionBandLabel: school.tuitionBandLabel || tuitionSummary,
      hasEnglishPrograms: school.hasEnglishPrograms ?? languageOfInstruction.length > 0,
      hasScholarships: school.hasScholarships ?? Boolean(school.scholarship),
      isVerified: school.isVerified ?? Boolean(school.verified),
      decisionSummary: school.decisionSummary || school.note || "",
      programCount,
      undergraduateProgramCount: school.undergraduateProgramCount ?? 0,
      postgraduateProgramCount: school.postgraduateProgramCount ?? programCount,
      englishProgramCount,
      programSubjectTags: school.programSubjectTags || subjectTags,
      programTuitionBandLabel: school.programTuitionBandLabel || tuitionSummary,
      programQualityIssues: school.programQualityIssues || [],
      scholarshipCount,
      cscScholarshipCount: school.cscScholarshipCount ?? (school.scholarship ? 1 : 0),
      programs: Array.isArray(school.programs) ? school.programs.length : programCount,
      programRecords: Array.isArray(school.programs) ? school.programs : [],
      changeLogs: school.changeLogs || [],
      snapshots: school.snapshots || [],
      cscaRules: school.cscaRules || [],
      detailedScholarships: school.detailedScholarships || school.scholarshipsDetailed || [],
      scholarshipsDetailed: school.scholarshipsDetailed || school.detailedScholarships || [],
      scholarshipLinks: school.scholarshipLinks || [],
      savedByUsers: school.savedByUsers || [],
      compareByUsers: school.compareByUsers || [],
      cartItems: school.cartItems || [],
      orderItems: school.orderItems || [],
      upcomingDeadlines: school.upcomingDeadlines || [],
      requiredSubjectTags: school.requiredSubjectTags || [],
      quickFacts: school.quickFacts || {
        location: [cityZh, schoolRegion].filter(Boolean).join(", "),
        region: schoolRegion,
        tuition: tuitionSummary,
        programCount,
        englishProgramCount,
      },
      detailDisplay: school.detailDisplay || {
        city: cityZh,
        regionLabel: schoolRegion,
        displayProgramCount: programCount,
        visibleProgramCount: programCount,
        displaySubjectTags: subjectTags,
        programFieldTags: subjectTags,
      },
      applicationPortalNotes: school.applicationPortalNotes || "School receives tenant-scoped CUAC records only.",
      campusHighlights: school.campusHighlights || subjectTags,
      contactNotes: school.contactNotes || [],
      status: school.status || "published",
      version: school.version || 1,
      sourceFieldLineage: sourceFieldLineage("School", "School"),
    };
  }

  function normalizeFundingLevel(value) {
    const funding = String(value || "").toLowerCase();
    if (funding.includes("full")) return "full";
    if (funding.includes("partial")) return "partial";
    return "unknown";
  }

  function normalizeDiscoveryScholarship(item = {}, index = 0) {
    const slug = item.slug || slugify(item.title || `scholarship-${index + 1}`);
    const fundingLevel = item.fundingLevel || normalizeFundingLevel(item.funding);
    const coverage = Array.isArray(item.coverage) ? item.coverage.join(", ") : item.coverage || "";
    const benefits = Array.isArray(item.benefits) ? item.benefits : Array.isArray(item.coverage) ? item.coverage : [];
    const schoolName = item.schoolName || item.school || "Multiple universities";
    const programName = item.programName || item.applicableProgram || "";
    const linkedSchools = scholarshipLinkedSchools(item);
    const linkedPrograms = scholarshipLinkedPrograms(item);
    return {
      ...item,
      id: item.id || index + 3001,
      slug,
      schoolId: item.schoolId || 0,
      schoolName,
      schoolNameEn: item.schoolNameEn || schoolName,
      schools: linkedSchools,
      schoolCount: item.schoolCount || linkedSchools.length || (schoolName.includes("Multiple") ? 0 : 1),
      programId: item.programId,
      programName,
      programNameEn: item.programNameEn || programName,
      programs: linkedPrograms,
      type: item.type || "other",
      typeLabel: item.typeLabel || titleCase(item.type || "Scholarship"),
      fundingLevel,
      providerName: item.providerName || schoolName,
      providerNameEn: item.providerNameEn || schoolName,
      providerLocation: item.providerLocation || "",
      coverage,
      applicableDegree: item.applicableDegree || item.degree || "All levels",
      applicableProgram: item.applicableProgram || "Confirm by scholarship notice",
      amountText: item.amountText || (fundingLevel === "full" ? "Full or broad funding route" : "Partial funding route"),
      requirementText: item.requirementText || "Eligibility follows the current official scholarship notice.",
      bodySections: item.bodySections || [{ title: "Scholarship overview", body: item.summary || "" }],
      benefitItems: item.benefitItems || benefits.map((label) => ({ label, included: true })),
      eligibilityItems: item.eligibilityItems || [],
      applicationMaterials: item.applicationMaterials || ["Confirm official scholarship form", "Transcript or study record", "Passport copy"],
      applicationSteps: item.applicationSteps || [],
      contactInfo: item.contactInfo,
      actionLinks: item.actionLinks || [],
      deadlineDate: item.deadlineDate || item.deadline || item.deadlineLabel || "Confirm current deadline",
      deadlineLabel: item.deadlineLabel || item.deadline || "Deadline pending",
      applicationRound: item.applicationRound || "Confirm current round",
      targetCountries: item.targetCountries || [],
      targetRegions: item.targetRegions || [],
      benefits,
      deadline: item.deadline || item.deadlineLabel || "Deadline pending",
      sourceUrl: item.sourceUrl || "",
      sourceLabel: item.sourceLabel || "Scholarship record",
      lastVerifiedAt: item.lastVerifiedAt || item.verified || "",
      sortOrder: item.sortOrder ?? index + 1,
      status: item.status || "published",
      version: item.version || 1,
      createdAt: item.createdAt || "",
      updatedAt: item.updatedAt || "",
      tags: item.tags || [],
      summary: item.summary || "",
      sourceFieldLineage: sourceFieldLineage("Scholarship", "Scholarship"),
    };
  }

  function buildDiscoveryCityAggregate(city = {}, references = {}) {
    const slug = city.slug || city.id || slugify(city.nameEn || city.name || "");
    const cityName = city.nameEn || city.name || city.nameZh || slug;
    const matchedSchools = discoverySchools
      .map((school, index) => normalizeDiscoverySchool(school, index))
      .filter((school) => cityMatchValue(school.city, city) || cityMatchValue(school.cityZh, city) || cityMatchValue(school.province, city) || cityMatchValue(school.region, city))
      .slice(0, 8);
    const matchedPrograms = discoveryPrograms
      .filter((program) => cityMatchValue(program.city, city) || cityMatchValue(program.province, city))
      .slice(0, 12);
    const schoolNames = new Set(matchedSchools.map((school) => String(school.nameEn || school.name || "").toLowerCase()).filter(Boolean));
    const matchedScholarships = discoveryScholarships
      .filter((scholarship) => (
        cityMatchValue(scholarship.providerLocation, city)
        || cityMatchValue(scholarship.school, city)
        || cityMatchValue(scholarship.schoolName, city)
        || cityMatchValue(scholarship.title, city)
        || compactList(scholarship.tags).some((tag) => cityMatchValue(tag, city))
        || Array.from(schoolNames).some((name) => String(scholarship.school || scholarship.schoolName || scholarship.title || "").toLowerCase().includes(name))
      ))
      .slice(0, 8);
    const visibleSchools = matchedSchools.map((school) => ({
      key: `city-school-${school.id || slugify(school.nameEn || school.name || "")}`,
      id: school.id || slugify(school.nameEn || school.name || ""),
      nameZh: school.nameZh || school.name || school.nameEn || "University",
      nameEn: school.nameEn || school.name || "",
      region: school.cityZh || school.region || city.province || cityName,
      programCount: school.programCount || school.programs || 0,
      englishProgramCount: school.englishProgramCount || school.routes || 0,
      scholarshipCount: school.scholarshipCount || (school.scholarship ? 1 : 0),
    }));
    const visiblePrograms = matchedPrograms.map((program) => ({
      key: `city-program-${program.id || slugify(program.name || program.program || "")}`,
      id: program.id || slugify(program.name || program.program || ""),
      schoolId: program.schoolId || program.university || "",
      schoolName: program.university || program.schoolName || "University",
      schoolNameEn: program.university || program.schoolNameEn || "",
      title: program.nameEn || program.name || program.program || "Program route",
      titleZh: program.nameZh && program.nameZh !== (program.nameEn || program.name || program.program) ? program.nameZh : "",
      meta: [program.degreeLevel || program.degree, program.teachingLanguage || program.language, program.subject || program.fieldCategory].filter(Boolean).join(" · "),
      tuition: rmbLabel(program.tuitionAmount ?? program.tuition),
      deadline: program.deadlineLabel || program.deadline || "Confirm deadline",
      tags: compactList([program.scholarship ? "Funding signal" : "", program.hsk, program.readiness]).slice(0, 3),
    }));
    const visibleScholarships = matchedScholarships.map((scholarship) => ({
      key: `city-scholarship-${scholarship.slug || scholarship.id || slugify(scholarship.title || "")}`,
      id: scholarship.slug || scholarship.id || slugify(scholarship.title || ""),
      schoolId: scholarship.schoolId || "",
      schoolName: scholarship.schoolName || scholarship.school || "Multiple universities",
      title: scholarship.title || scholarship.name || "Funding route",
      meta: [scholarship.typeLabel || titleCase(scholarship.type), scholarship.fundingLevel || scholarship.funding, scholarship.deadlineLabel || scholarship.deadline].filter(Boolean).join(" · "),
      tags: compactList(scholarship.tags || [scholarship.applicableDegree || scholarship.degree]).slice(0, 3),
    }));
    return {
      actualSchoolCount: visibleSchools.length,
      actualProgramCount: visiblePrograms.length,
      actualEnglishProgramCount: visiblePrograms.filter((program) => String(program.meta || "").toLowerCase().includes("english")).length,
      actualScholarshipCount: visibleScholarships.length,
      actualCscaRequiredSchoolCount: matchedSchools.filter((school) => school.cscaRequired).length,
      visibleSchools,
      visiblePrograms,
      visibleScholarships,
      referenceSchoolCount: references.schoolCount,
      referenceProgramCount: references.programCount,
      referenceEnglishProgramCount: references.englishProgramCount,
      referenceScholarshipCount: references.scholarshipCount,
      referenceCscaSchoolCount: references.cscaRequiredSchoolCount,
    };
  }

  function normalizeDiscoveryCity(city = {}, index = 0) {
    const slug = city.slug || city.id || slugify(city.nameEn || city.name || "");
    const nameEn = city.nameEn || city.name || "City to confirm";
    const cityContentJson = city.contentJson || city.content || {};
    const monthlyCost = city.monthlyCost ?? city.monthlyCostRmb;
    const references = city.references || {
      schoolCount: city.universities || 0,
      programCount: city.programs || 0,
      englishProgramCount: city.englishRoutes || 0,
      scholarshipCount: city.scholarships || 0,
      cscaRequiredSchoolCount: city.cscaRequiredSchoolCount || 0,
    };
    const derivedAggregate = buildDiscoveryCityAggregate({ ...city, slug, nameEn }, references);
    const aggregateSource = city.aggregate || {};
    const aggregate = {
      actualSchoolCount: aggregateSource.actualSchoolCount ?? derivedAggregate.actualSchoolCount,
      actualProgramCount: aggregateSource.actualProgramCount ?? derivedAggregate.actualProgramCount,
      actualEnglishProgramCount: aggregateSource.actualEnglishProgramCount ?? derivedAggregate.actualEnglishProgramCount,
      actualScholarshipCount: aggregateSource.actualScholarshipCount ?? derivedAggregate.actualScholarshipCount,
      actualCscaRequiredSchoolCount: aggregateSource.actualCscaRequiredSchoolCount ?? derivedAggregate.actualCscaRequiredSchoolCount,
      visibleSchools: compactList(aggregateSource.visibleSchools).length ? aggregateSource.visibleSchools : derivedAggregate.visibleSchools,
      visiblePrograms: compactList(aggregateSource.visiblePrograms).length ? aggregateSource.visiblePrograms : derivedAggregate.visiblePrograms,
      visibleScholarships: compactList(aggregateSource.visibleScholarships).length ? aggregateSource.visibleScholarships : derivedAggregate.visibleScholarships,
    };
    const content = {
      ...cityContentJson,
      summary: cityContentJson.summary || city.summary || "",
      overview: cityContentJson.overview || city.overview || city.summary || "",
      bestFor: cityContentJson.bestFor || city.bestFor || [],
      quickFacts: cityContentJson.quickFacts || city.quickFacts || [
        { label: "Monthly cost", value: monthlyCost ? `RMB ${monthlyCost.toLocaleString("en-US")}` : "Pending" },
        { label: "Universities", value: String(city.universities || 0) },
        { label: "English routes", value: String(city.englishRoutes || 0) },
      ],
      budgetSummary: cityContentJson.budgetSummary || city.budgetSummary || {
        monthly: monthlyCost ? `RMB ${monthlyCost.toLocaleString("en-US")}` : "Pending",
        yearly: monthlyCost ? `RMB ${(monthlyCost * 10).toLocaleString("en-US")}` : "Pending",
        note: "Current estimate; confirm city costs before budgeting.",
      },
      costProfiles: cityContentJson.costProfiles || city.costProfiles || [],
      why: cityContentJson.why || city.bestFor || [],
      costBreakdown: cityContentJson.costBreakdown || Object.entries(city.costBreakdown || {}).map(([label, value]) => ({ label, value: `RMB ${Number(value).toLocaleString("en-US")}` })),
      lifeSections: cityContentJson.lifeSections || city.lifeSections || [],
      transportNotes: cityContentJson.transportNotes || city.transportNotes || [],
      applicationTips: cityContentJson.applicationTips || city.bestFor || [],
      applicationAdvice: cityContentJson.applicationAdvice || city.applicationAdvice || [],
      relatedProgramKeywords: cityContentJson.relatedProgramKeywords || city.tags || [],
      nextSteps: cityContentJson.nextSteps || city.nextSteps || [],
      faqs: cityContentJson.faqs || city.faqs || [],
      cityFaqs: cityContentJson.cityFaqs || city.cityFaqs || [],
    };
    return {
      ...city,
      slug,
      id: city.id || slug,
      name: city.name || nameEn,
      nameEn,
      nameZh: city.nameZh || cityChineseName(slug || nameEn) || nameEn,
      region: city.region || "",
      province: city.province || city.region || "",
      monthlyCost,
      monthlyCostRmb: monthlyCost,
      costLevel: city.costLevel || "medium",
      density: city.density || city.pace || "",
      pace: city.pace || city.density || "balanced",
      tags: city.tags || [],
      content,
      contentJson: content,
      nearby: city.nearby || [],
      references,
      schoolCount: city.schoolCount ?? references.schoolCount,
      programCount: city.programCount ?? references.programCount,
      englishProgramCount: city.englishProgramCount ?? references.englishProgramCount,
      scholarshipCount: city.scholarshipCount ?? references.scholarshipCount,
      cscaRequiredSchoolCount: city.cscaRequiredSchoolCount ?? references.cscaRequiredSchoolCount,
      referenceSchoolCount: city.referenceSchoolCount ?? references.schoolCount,
      referenceProgramCount: city.referenceProgramCount ?? references.programCount,
      referenceEnglishProgramCount: city.referenceEnglishProgramCount ?? references.englishProgramCount,
      referenceScholarshipCount: city.referenceScholarshipCount ?? references.scholarshipCount,
      referenceCscaSchoolCount: city.referenceCscaSchoolCount ?? references.cscaRequiredSchoolCount ?? 0,
      status: city.status || "published",
      sortOrder: city.sortOrder ?? index + 1,
      version: city.version || 1,
      createdAt: city.createdAt || "",
      updatedAt: city.updatedAt || "2026-08-14",
      aggregate,
      actualSchoolCount: city.actualSchoolCount ?? aggregate.actualSchoolCount,
      actualProgramCount: city.actualProgramCount ?? aggregate.actualProgramCount,
      actualEnglishProgramCount: city.actualEnglishProgramCount ?? aggregate.actualEnglishProgramCount,
      actualScholarshipCount: city.actualScholarshipCount ?? aggregate.actualScholarshipCount,
      actualCscaRequiredSchoolCount: city.actualCscaRequiredSchoolCount ?? aggregate.actualCscaRequiredSchoolCount,
      visibleSchools: city.visibleSchools || aggregate.visibleSchools,
      visiblePrograms: city.visiblePrograms || aggregate.visiblePrograms,
      visibleScholarships: city.visibleScholarships || aggregate.visibleScholarships,
      universities: city.universities ?? references.schoolCount,
      programs: city.programs ?? references.programCount,
      englishRoutes: city.englishRoutes ?? references.englishProgramCount,
      scholarships: city.scholarships ?? references.scholarshipCount,
      bestFor: city.bestFor || content.bestFor || [],
      summary: city.summary || content.summary || "",
      costBreakdown: city.costBreakdown || Object.fromEntries((content.costBreakdown || []).map((item) => [
        slugify(item.label || "cost"),
        Number(String(item.value || "").replace(/[^0-9]/g, "")) || 0,
      ])),
      sourceFieldLineage: sourceFieldLineage("CityGuide", "City"),
    };
  }

  function normalizeDiscoveryGuide(item = {}, index = 0) {
    return {
      type: item.type || "content",
      title: item.title || "CUAC guide",
      subtitle: item.subtitle || "",
      snippet: item.snippet || "",
      href: item.href || "guides.html",
      score: item.score ?? 80 - index,
      metadata: {
        category: item.metadata?.category || slugify(item.title || `guide-${index + 1}`),
        icon: item.metadata?.icon || "document",
        audience: item.metadata?.audience || "student",
        status: item.metadata?.status || "published",
        ...(item.metadata || {}),
      },
    };
  }

  function getCompletionDetailCatalog() {
    return clone(completionDetailCatalog);
  }

  function rmbLabel(value) {
    if (typeof value === "number" && Number.isFinite(value)) return `RMB ${value.toLocaleString("en-US")}`;
    return value || "Confirm current fee";
  }

  function compactList(items = []) {
    if (Array.isArray(items)) return items.filter(Boolean).slice(0, 4);
    if (typeof items === "string") {
      return items
        .split(/\r?\n|,/)
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 4);
    }
    if (plainRecord(items)) return Object.values(items).filter(Boolean).slice(0, 4);
    return items ? [items].slice(0, 4) : [];
  }

  function cityChineseName(slugOrName = "") {
    const names = {
      hangzhou: "杭州",
      shanghai: "上海",
      beijing: "北京",
      shenzhen: "深圳",
      nanjing: "南京",
      chengdu: "成都",
      wuhan: "武汉",
      xian: "西安",
      "xi-an": "西安",
      tianjin: "天津",
      qingdao: "青岛",
      guangzhou: "广州",
    };
    return names[slugify(slugOrName)] || "";
  }

  function resolveCityReference(value, currentCity = {}) {
    const raw = typeof value === "object" && value
      ? value.slug || value.id || value.nameEn || value.name || value.nameZh || value.title || ""
      : value;
    const label = String(raw || "").trim();
    if (!label) return null;
    const labelSlug = slugify(label);
    const currentSlug = slugify(currentCity.slug || currentCity.id || currentCity.nameEn || currentCity.name || "");
    const matched = discoveryCities.find((city) => {
      const citySlug = slugify(city.slug || city.id || city.nameEn || city.name || "");
      const tokens = [
        city.id,
        city.slug,
        city.name,
        city.nameEn,
        city.nameZh,
        cityChineseName(citySlug),
      ].filter(Boolean);
      return tokens.some((token) => {
        const tokenText = String(token).trim();
        return tokenText === label || slugify(tokenText) === labelSlug;
      });
    });
    const resolvedSlug = slugify(matched?.slug || matched?.id || matched?.nameEn || matched?.name || label);
    if (!resolvedSlug || resolvedSlug === currentSlug) return null;
    return {
      slug: resolvedSlug,
      title: matched?.nameEn || matched?.name || titleCase(labelSlug || label),
      body: matched
        ? `${rmbLabel(cityMonthlyValue(matched))}/month reference · ${titleCase(matched.costLevel || "cost to confirm")}`
        : "Useful as a backup city or comparison point when cost, deadline, or program fit changes.",
    };
  }

  function cityReadableList(items = [], fallback = "Compare with your route") {
    const values = Array.isArray(items) ? items : String(items || "").split(",");
    const labels = values
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .map((item) => ({
        "lower cost": "budget-conscious students",
        "medium cost": "students balancing budget and city resources",
        "high cost": "students with a higher housing budget",
        tech: "technology-focused students",
        internships: "students looking for internships",
        business: "business and finance routes",
        research: "research-focused students",
        culture: "students who want strong cultural context",
        language: "students building Chinese language exposure",
        "calmer pace": "students who prefer a calmer daily rhythm",
        "warm climate": "students who prefer warm weather",
        medicine: "medicine and health-science routes",
        engineering: "engineering routes",
        "student city": "students who want a strong campus atmosphere",
      }[item.toLowerCase()] || item));
    return labels.length ? labels.slice(0, 4).join(", ") : fallback;
  }

  function cityMonthlyValue(city = {}) {
    return city.monthlyCost || city.monthlyCostRmb;
  }

  function cityContent(city = {}) {
    return city.contentJson || city.content || {};
  }

  function cityStructuredList(value = []) {
    if (Array.isArray(value)) return value.filter(hasSourceValue).slice(0, 4);
    if (typeof value === "string") return compactList(value);
    if (plainRecord(value)) return [value];
    return compactList(value);
  }

  function cityBudgetSummary(city = {}) {
    const content = cityContent(city);
    const monthly = cityMonthlyValue(city);
    return content.budgetSummary || city.budgetSummary || {
      monthly: monthly ? `RMB ${Math.max(900, monthly - 600).toLocaleString("en-US")}-${(monthly + 700).toLocaleString("en-US")}/month` : "Confirm monthly budget",
      yearly: monthly ? `About RMB ${((monthly + 100) * 10).toLocaleString("en-US")}-${((monthly + 900) * 10).toLocaleString("en-US")}/year` : "Estimate after housing check",
      note: `${city.nameEn || city.name || "This city"} budget depends most on housing type, campus location, and commute.`,
    };
  }

  function cityCostBreakdownItems(city = {}) {
    const content = cityContent(city);
    const source = content.costBreakdown || city.costBreakdown || [];
    const entries = Array.isArray(source) ? source : Object.entries(source).map(([label, value]) => ({ label, value }));
    return entries
      .filter((item) => hasSourceValue(item?.label) || hasSourceValue(item?.value))
      .map((item) => ({
        label: titleCase(item.label || "Cost"),
        value: typeof item.value === "number" ? `RMB ${item.value.toLocaleString("en-US")}/month` : sourceDisplayValue(item.value, "Confirm"),
      }));
  }

  function cityLifeNotes(city = {}) {
    const content = cityContent(city);
    const notes = cityStructuredList(content.lifeSections || city.lifeSections || []);
    if (notes.length) return notes.map((item) => {
      if (item && typeof item === "object") {
        return `${sourceDisplayValue(item.title || item.label, "City life")}: ${sourceDisplayValue(item.body || item.note || item.value, "Confirm student-life context.")}`;
      }
      return String(item || "").trim();
    }).filter(Boolean).slice(0, 4);
    const name = city.nameEn || city.name || "this city";
    return [
      `Campus and commute: confirm the exact campus before estimating daily travel in ${name}.`,
      `Study environment: ${city.density === "high" || city.density === "fast" ? "more routes and city resources, but more comparison work." : "a clearer shortlist can be easier to manage."}`,
      `Daily adaptation: ${city.climate || "check climate and seasonal comfort before arrival."}`,
      `Arrival planning: ${city.arrival || "confirm airport or train arrival routes with the school."}`,
    ];
  }

  function cityApplicationAdviceItems(city = {}) {
    const content = cityContent(city);
    const nextSteps = cityStructuredList(content.nextSteps || city.nextSteps || []);
    if (nextSteps.length) return nextSteps.map((item) => {
      if (item && typeof item === "object") return `${item.title || "Next step"}: ${item.body || "Connect the city to concrete schools and programs."}`;
      return String(item || "").trim();
    }).filter(Boolean).slice(0, 4);
    const advice = cityStructuredList(content.applicationAdvice || city.applicationAdvice || []);
    if (advice.length) return advice.map((item) => {
      if (item && typeof item === "object") return `${item.title || "Application step"}: ${item.body || "Connect the city to concrete schools and programs."}`;
      return String(item || "").trim();
    }).filter(Boolean).slice(0, 4);
    const name = city.nameEn || city.name || "this city";
    return [
      `Shortlist schools in ${name} first, then compare concrete programs.`,
      "Check tuition, housing, language proof, scholarship route, and deadline together.",
      "If a school requires CSCA, leave time for one diagnostic and one focused practice cycle.",
    ];
  }

  function cityFaqItems(city = {}) {
    const content = cityContent(city);
    const faqSources = [
      ...cityStructuredList(content.cityFaqs),
      ...cityStructuredList(content.faqs),
      ...cityStructuredList(city.cityFaqs),
      ...cityStructuredList(city.faqs),
    ];
    const seen = new Set();
    const faqs = faqSources.map((item) => {
      if (item && typeof item === "object") {
        return {
          question: sourceDisplayValue(item.question, "Student question"),
          answer: sourceDisplayValue(item.answer, "Confirm with the school before deciding."),
        };
      }
      const [question, answer] = splitCityGuidanceRow(String(item || "").trim(), "Student question");
      return {
        question,
        answer: answer || "Confirm with the school before deciding.",
      };
    }).filter((item) => {
      const key = `${item.question}::${item.answer}`;
      if (!item.question || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (faqs.length) return faqs.slice(0, 4);
    const name = city.nameEn || city.name || "this city";
    return [
      {
        question: `Is ${name} affordable?`,
        answer: "Compare monthly housing, meals, transport, and the exact campus before deciding.",
      },
      {
        question: "How should I choose?",
        answer: "Start from program fit, then use city cost and arrival comfort as tie-breakers.",
      },
    ];
  }

  function cityQuickFacts(city = {}) {
    const content = cityContent(city);
    const monthly = cityMonthlyValue(city);
    const facts = content.quickFacts || city.quickFacts || [];
    const aggregateLabels = new Set(["universities", "schools", "programs", "english routes", "english programs", "scholarships", "scholarship routes", "csca schools"]);
    const generated = [
      { label: "Monthly cost", value: monthly ? `RMB ${monthly.toLocaleString("en-US")}` : "Pending", note: "Living-cost reference" },
      { label: "Budget style", value: titleCase(city.costLevel || "Confirm"), note: "Budget planning" },
      { label: "Study rhythm", value: titleCase(city.density || city.pace || "Confirm"), note: "Daily rhythm" },
      { label: "Best use", value: "Program-fit tie-breaker", note: "Choose school and program first" },
    ];
    if (Array.isArray(facts) && facts.length) {
      const mapped = facts.map((fact) => ({
        label: sourceDisplayValue(fact.label, "Fact"),
        value: sourceDisplayValue(fact.value, "Confirm"),
        note: sourceDisplayValue(fact.note, ""),
      })).filter((fact) => !aggregateLabels.has(String(fact.label || "").toLowerCase()));
      const existing = new Set(mapped.map((fact) => String(fact.label || "").toLowerCase()));
      return [
        ...mapped,
        ...generated.filter((fact) => !existing.has(fact.label.toLowerCase())),
      ].slice(0, 5);
    }
    return generated;
  }

  function cityAggregateMetricValue(city = {}, actualKey = "", referenceKey = "", legacyKey = "", suffix = "") {
    const aggregate = city.aggregate || {};
    const candidates = [city[actualKey], aggregate[actualKey], city[referenceKey], city.references?.[referenceKey.replace(/^reference/, "").replace(/Count$/, "Count")], city[legacyKey]];
    const value = candidates.find((item) => item !== undefined && item !== null && item !== "");
    const normalized = Number(value);
    if (Number.isFinite(normalized)) return `${normalized.toLocaleString("en-US")}${suffix}`;
    return "0";
  }

  function cityResourceFacts(city = {}) {
    return [
      {
        label: "Universities",
        value: cityAggregateMetricValue(city, "actualSchoolCount", "referenceSchoolCount", "universities"),
        note: "Current CUAC school options",
      },
      {
        label: "Programs",
        value: cityAggregateMetricValue(city, "actualProgramCount", "referenceProgramCount", "programs", "+"),
        note: "Specific degree routes",
      },
      {
        label: "English routes",
        value: cityAggregateMetricValue(city, "actualEnglishProgramCount", "referenceEnglishProgramCount", "englishRoutes"),
        note: "English-taught options",
      },
      {
        label: "Scholarship routes",
        value: cityAggregateMetricValue(city, "actualScholarshipCount", "referenceScholarshipCount", "scholarships"),
        note: "Funding routes to verify",
      },
      {
        label: "CSCA schools",
        value: cityAggregateMetricValue(city, "actualCscaRequiredSchoolCount", "referenceCscaSchoolCount", "cscaRequiredSchoolCount"),
        note: "Planning requirement check",
      },
    ];
  }

  function cityAggregateCards(city = {}) {
    const aggregate = city.aggregate || {};
    const slug = city.slug || city.id || slugify(city.nameEn || city.name || "");
    const cityParam = encodeURIComponent(slug);
    const card = (label, actual, reference, note, href, action) => ({
      label,
      actual: actual ?? 0,
      reference: reference ?? 0,
      note,
      href,
      action,
    });
    return [
      card("Schools", city.actualSchoolCount ?? aggregate.actualSchoolCount, city.referenceSchoolCount ?? city.references?.schoolCount, "current school options to open and compare", `universities.html?city=${cityParam}`, "Compare schools"),
      card("Programs", city.actualProgramCount ?? aggregate.actualProgramCount, city.referenceProgramCount ?? city.references?.programCount, "specific degree routes connected to schools", `programs.html?city=${cityParam}`, "Compare programs"),
      card("English routes", city.actualEnglishProgramCount ?? aggregate.actualEnglishProgramCount, city.referenceEnglishProgramCount ?? city.references?.englishProgramCount, "English-taught routes to check by program", `programs.html?city=${cityParam}&language=english`, "Open English routes"),
      card("Scholarships", city.actualScholarshipCount ?? aggregate.actualScholarshipCount, city.referenceScholarshipCount ?? city.references?.scholarshipCount, "funding routes that still need school-program fit", `scholarships.html?city=${cityParam}`, "Compare funding"),
      card("CSCA schools", city.actualCscaRequiredSchoolCount ?? aggregate.actualCscaRequiredSchoolCount, city.referenceCscaSchoolCount ?? city.references?.cscaRequiredSchoolCount, "schools where CSCA timing may affect planning", "guides.html#csca", "Check CSCA timing"),
    ];
  }

  function cityCostProfiles(city = {}) {
    const content = cityContent(city);
    const profiles = content.costProfiles || city.costProfiles || [];
    if (Array.isArray(profiles) && profiles.length) {
      return profiles.slice(0, 4).map((profile) => ({
        label: sourceDisplayValue(profile.label, "Budget profile"),
        value: sourceDisplayValue(profile.value, "Confirm"),
        note: sourceDisplayValue(profile.note, ""),
      }));
    }
    const budget = cityBudgetSummary(city);
    return [
      { label: "Budget-sensitive", value: budget.monthly, note: "Prioritize school housing and shorter commute." },
      { label: "Comfortable student budget", value: budget.yearly, note: "Use this for a first-year planning range." },
    ];
  }

  function cityLifeSectionsDisplay(city = {}) {
    const content = cityContent(city);
    const sections = content.lifeSections || city.lifeSections || [];
    if (Array.isArray(sections) && sections.length) {
      return sections.slice(0, 4).map((section) => ({
        title: sourceDisplayValue(section.title, "City life"),
        body: sourceDisplayValue(section.body, "Confirm student-life context"),
      }));
    }
    return cityLifeNotes(city).map((item, index) => {
      const [title, body] = splitCityGuidanceRow(item, [
        "Campus and commute",
        "Study environment",
        "Daily adaptation",
        "Arrival planning",
      ][index] || "City life");
      return { title, body };
    });
  }

  function cityWhyDisplay(city = {}) {
    const content = cityContent(city);
    const whyItems = compactList(content.why || city.why || content.bestFor || city.bestFor || []);
    if (whyItems.length) {
      return whyItems.slice(0, 4).map((item, index) => {
        if (item && typeof item === "object") {
          return {
            title: sourceDisplayValue(item.title || item.label, `Reason ${index + 1}`),
            body: sourceDisplayValue(item.body || item.note || item.value, "Use this as one comparison signal, not the only decision factor."),
          };
        }
        const [title, body] = splitCityGuidanceRow(String(item || ""), [
          "School options",
          "Program fit",
          "Student life",
          "Planning risk",
        ][index] || `Reason ${index + 1}`);
        return { title, body };
      });
    }
    const name = city.nameEn || city.name || "this city";
    return [
      { title: "Program fit first", body: `${name} should be compared after checking concrete schools, degree routes, language requirements, and deadlines.` },
      { title: "Budget signal", body: "Use living cost, housing, and commute as tie-breakers between otherwise similar program choices." },
    ];
  }

  function cityTransportNotesDisplay(city = {}) {
    const content = cityContent(city);
    const notes = cityStructuredList(content.transportNotes || city.transportNotes);
    if (notes.length) {
      return notes.slice(0, 3).map((item, index) => {
        if (item && typeof item === "object") {
          return {
            title: sourceDisplayValue(item.title || item.label, [
              "Campus commute",
              "Arrival transport",
              "Daily movement",
            ][index] || "Transport note"),
            body: sourceDisplayValue(item.body || item.note || item.value, "Confirm transport details with the school."),
          };
        }
        const [title, body] = splitCityGuidanceRow(item, [
          "Campus commute",
          "Arrival transport",
          "Daily movement",
        ][index] || "Transport note");
        return { title, body };
      });
    }
    const name = city.nameEn || city.name || "this city";
    return [
      { title: "Campus commute", body: `Check the exact campus location in ${name} before judging living cost or daily travel time.` },
      { title: "Arrival transport", body: "Plan airport or station arrival together with school registration timing and accommodation check-in." },
    ];
  }

  function cityProgramKeywords(city = {}) {
    const content = cityContent(city);
    const raw = content.relatedProgramKeywords || city.relatedProgramKeywords || [];
    const values = Array.isArray(raw) ? raw : String(raw || "").split(/[,\n、/]+/);
    return values
      .map((item) => sourceDisplayValue(item, ""))
      .filter(Boolean)
      .slice(0, 8);
  }

  function cityNearbyCards(city = {}) {
    const slug = city.slug || city.id || slugify(city.nameEn || city.name || "");
    const explicit = compactList(city.nearby || []);
    const fallback = discoveryCities
      .filter((item) => String(item.id || item.slug || "").toLowerCase() !== String(slug).toLowerCase())
      .filter((item) => (
        city.region && item.region === city.region
      ) || (
        city.province && item.province === city.province
      ))
      .map((item) => item.nameEn || item.name || item.id);
    const items = (explicit.length ? explicit : fallback)
      .map((item) => resolveCityReference(item, city))
      .filter(Boolean)
      .slice(0, 4);
    if (!items.length) return [];
    return items.map((item) => ({
      title: item.title,
      body: item.body,
      href: `city-detail.html?city=${encodeURIComponent(item.slug)}`,
    }));
  }

  function cityApplicationAdviceDisplay(city = {}) {
    const content = cityContent(city);
    const advice = content.applicationAdvice || city.applicationAdvice || [];
    if (Array.isArray(advice) && advice.length) {
      return advice.slice(0, 4).map((item) => ({
        title: sourceDisplayValue(item.title, "Application step"),
        body: sourceDisplayValue(item.body, "Connect the city to concrete schools and programs."),
      }));
    }
    return cityApplicationAdviceItems(city).map((item, index) => {
      const [title, body] = splitCityGuidanceRow(item, [
        "Start with real schools",
        "Compare full cost",
        "Leave time for requirements",
      ][index] || "Application step");
      return { title, body };
    });
  }

  function cityNextStepsDisplay(city = {}) {
    const content = cityContent(city);
    const nextSteps = content.nextSteps || city.nextSteps;
    const items = cityStructuredList(hasSourceValue(nextSteps)
      ? nextSteps
      : (content.applicationTips || city.applicationTips || cityApplicationAdviceItems(city)));
    return items.map((item, index) => {
      if (item && typeof item === "object") {
        return {
          title: sourceDisplayValue(item.title, `Step ${index + 1}`),
          body: sourceDisplayValue(item.body, "Turn the city preference into a concrete school and program choice."),
        };
      }
      const [title, body] = splitCityGuidanceRow(String(item || ""), [
        "Open city schools",
        "Compare concrete programs",
        "Check cost and deadline",
        "Save a realistic route",
      ][index] || `Step ${index + 1}`);
      return { title, body };
    });
  }

  function cityFaqDisplay(city = {}) {
    return cityFaqItems(city).map((item) => ({
      question: item.question,
      answer: item.answer,
    }));
  }

  function cityDisplayGuide(city = {}) {
    const content = cityContent(city);
    const monthly = cityMonthlyValue(city);
    const budget = cityBudgetSummary(city);
    const bestFor = cityReadableList(content.bestFor || city.bestFor || city.tags)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const slug = city.slug || city.id || slugify(city.nameEn || city.name || "");
    const nearby = compactList(city.nearby || []).map((item) => titleCase(item));
    const relatedSchools = cityRelatedSchools(city);
    const relatedPrograms = cityRelatedPrograms(city);
    const relatedScholarships = cityRelatedScholarships(city, relatedSchools);
    const programKeywords = cityProgramKeywords(city);
    const fieldSummary = [
      { label: "Chinese name", value: city.nameZh || cityChineseName(slug || city.nameEn) },
      { label: "Region", value: city.region || city.province || "Confirm" },
      { label: "Monthly cost", value: monthly ? `RMB ${monthly.toLocaleString("en-US")}` : "Pending" },
      { label: "Cost level", value: titleCase(city.costLevel || "Confirm") },
      { label: "City pace", value: titleCase(city.density || city.pace || "Confirm") },
      { label: "Nearby cities", value: nearby.length ? nearby.join(", ") : "Confirm after shortlist" },
    ];
    return {
      chineseName: city.nameZh || cityChineseName(slug || city.nameEn),
      overview: content.overview || content.summary || city.summary,
      budget,
      monthlyCost: monthly ? `RMB ${monthly.toLocaleString("en-US")}` : "Pending",
      fieldSummary,
      resourceFacts: cityResourceFacts(city),
      quickFacts: cityQuickFacts(city),
      aggregateCards: cityAggregateCards(city),
      bestFor,
      why: cityWhyDisplay(city),
      costProfiles: cityCostProfiles(city),
      costBreakdown: cityCostBreakdownItems(city),
      lifeSections: cityLifeSectionsDisplay(city),
      transportNotes: cityTransportNotesDisplay(city),
      applicationAdvice: cityApplicationAdviceDisplay(city),
      nextSteps: cityNextStepsDisplay(city),
      applicationTips: content.applicationTips || city.applicationTips || [
        `Shortlist schools in ${city.nameEn || city.name || "this city"} before choosing a program.`,
        "Compare tuition, housing, language proof, scholarship route, and deadline together.",
        "Use city fit as a tie-breaker after program fit is clear.",
      ],
      faqs: cityFaqDisplay(city),
      relatedSchools,
      relatedPrograms,
      relatedScholarships,
      programKeywords,
      nearby,
      nearbyCards: cityNearbyCards(city),
      routes: [
        { label: "Programs in this city", href: `programs.html?city=${slug}`, body: "Turn the city choice into specific school-program routes." },
        { label: "Universities in this city", href: `universities.html?city=${slug}`, body: "Compare school options before saving a route." },
        { label: "Scholarships by city", href: `scholarships.html?city=${slug}`, body: "Check funding options alongside living cost." },
      ],
    };
  }

  function cityMatchValue(value, city = {}) {
    const haystack = String(value || "").toLowerCase();
    if (!haystack) return false;
    return [city.slug, city.id, city.nameEn, city.name, city.nameZh, city.province, city.region]
      .filter(Boolean)
      .some((needle) => haystack.includes(String(needle).toLowerCase()));
  }

  function cityRelatedSchools(city = {}) {
    const fromAggregate = compactList(city.visibleSchools || city.aggregate?.visibleSchools).map((school) => ({
      title: school.nameEn || school.name || school.nameZh || "University",
      meta: [school.nameZh && school.nameEn ? school.nameZh : "", school.region || city.province].filter(Boolean).join(" · ") || "University option",
      body: school.note || `${school.programCount || school.englishProgramCount || "Several"} program routes connected to ${city.nameEn || city.name || "this city"}.`,
      href: school.id ? `university-detail.html?university=${encodeURIComponent(String(school.id))}` : `universities.html?city=${slugify(city.nameEn || city.name || city.slug || "")}`,
      tags: compactList([school.programCount ? `${school.programCount} programs` : "", school.englishProgramCount ? `${school.englishProgramCount} English` : ""]),
    }));
    const fromCatalog = discoverySchools
      .filter((school) => cityMatchValue(school.city, city) || cityMatchValue(school.cityZh, city) || cityMatchValue(school.province, city) || cityMatchValue(school.region, city))
      .slice(0, 4)
      .map((school) => ({
        title: school.nameEn || school.name || "University",
        meta: [school.nameZh, school.province || school.region || city.province].filter(Boolean).join(" · "),
        body: school.note || school.englishPrograms || "Compare concrete programs before adding a choice.",
        href: `university-detail.html?university=${encodeURIComponent(slugify(school.nameEn || school.name || ""))}`,
        tags: compactList([school.programs ? `${school.programs} programs` : "", school.routes ? `${school.routes} routes` : "", school.scholarship ? "Scholarship options" : ""]),
      }));
    const fromRepresentatives = compactList(city.representative || city.representativeSchoolNames).map((name) => ({
      title: name,
      meta: city.province || city.region || "Representative university",
      body: `Use ${name} as a starting point, then compare exact programs and deadlines.`,
      href: `universities.html?city=${slugify(city.nameEn || city.name || city.slug || "")}`,
      tags: ["Representative"],
    }));
    return (fromAggregate.length ? fromAggregate : fromCatalog.length ? fromCatalog : fromRepresentatives).slice(0, 4);
  }

  function cityRelatedPrograms(city = {}) {
    const fromAggregate = compactList(city.visiblePrograms || city.aggregate?.visiblePrograms).map((program) => {
      const tags = compactList(program.tags || []);
      const textParts = String(program.meta || "").split("·").map((part) => part.trim()).filter(Boolean);
      const degree = program.degree || program.degreeLevel || textParts.find((part) => /^(undergraduate|bachelor|master|phd|doctoral)$/i.test(part)) || "";
      const language = program.language || program.teachingLanguage || textParts.find((part) => /^(english|chinese|english-taught|chinese-taught)$/i.test(part)) || (tags.some((tag) => /english/i.test(tag)) ? "English-taught" : "");
      const funding = program.funding || program.scholarship || (tags.some((tag) => /funding|scholarship/i.test(tag)) ? "Funding signal" : "");
      return {
        title: program.title || program.nameEn || program.name || "Program route",
        titleZh: program.titleZh || (program.nameZh && program.nameZh !== (program.title || program.nameEn || program.name) ? program.nameZh : ""),
        meta: [program.schoolNameEn || program.schoolName, program.degree || program.degreeLevel].filter(Boolean).join(" · "),
        body: [program.meta, program.tuition, program.deadline].filter(Boolean).join(" · ") || "Check tuition, language, and deadline before adding.",
        href: program.id || program.key ? `program-detail.html?program=${encodeURIComponent(String(program.id || program.key))}` : `programs.html?city=${slugify(city.nameEn || city.name || city.slug || "")}`,
        tags,
        degree,
        language,
        funding,
        deadline: program.deadline || program.deadlineDate || "",
      };
    });
    const fromCatalog = discoveryPrograms
      .filter((program) => cityMatchValue(program.city, city) || cityMatchValue(program.province, city))
      .slice(0, 4)
      .map((program) => ({
        title: program.nameEn || program.name || "Program route",
        titleZh: program.nameZh && program.nameZh !== (program.nameEn || program.name) ? program.nameZh : "",
        meta: [program.university || program.schoolNameEn, program.degreeLevel || program.degree].filter(Boolean).join(" · "),
        body: [program.teachingLanguage || program.language, rmbLabel(program.tuitionAmount ?? program.tuition), program.deadlineLabel || program.deadline].filter(Boolean).join(" · "),
        href: `program-detail.html?program=${encodeURIComponent(program.id || slugify(program.nameEn || program.name || ""))}`,
        tags: compactList([program.subject || program.fieldCategory, program.scholarship ? "Funding signal" : ""]),
        degree: program.degreeLevel || program.degree || "",
        language: program.teachingLanguage || program.language || "",
        funding: program.scholarship ? "Funding signal" : "",
        deadline: program.deadlineLabel || program.deadline || program.deadlineDate || "",
      }));
    return (fromAggregate.length ? fromAggregate : fromCatalog).slice(0, 4);
  }

  function cityRelatedScholarships(city = {}, relatedSchools = []) {
    const schoolNames = relatedSchools.map((school) => school.title).filter(Boolean);
    const fromAggregate = compactList(city.visibleScholarships || city.aggregate?.visibleScholarships).map((scholarship) => ({
      title: scholarship.title || scholarship.name || "Funding route",
      meta: scholarship.schoolNameEn || scholarship.schoolName || scholarship.meta || "Scholarship route",
      body: scholarship.meta || scholarship.body || "Match this funding route to a concrete school and program.",
      href: scholarship.id || scholarship.key ? `scholarship-detail.html?scholarship=${encodeURIComponent(String(scholarship.id || scholarship.key))}` : `scholarships.html?city=${slugify(city.nameEn || city.name || city.slug || "")}`,
      tags: compactList(scholarship.tags || []),
    }));
    const fromCatalog = discoveryScholarships
      .filter((scholarship) => (
        cityMatchValue(scholarship.providerLocation, city)
        || cityMatchValue(scholarship.school, city)
        || cityMatchValue(scholarship.title, city)
        || compactList(scholarship.tags).some((tag) => cityMatchValue(tag, city))
        || schoolNames.some((name) => String(scholarship.school || scholarship.title || "").toLowerCase().includes(name.toLowerCase()))
      ))
      .slice(0, 4)
      .map((scholarship) => ({
        title: scholarship.title || scholarship.name || "Funding route",
        meta: [scholarship.typeLabel || titleCase(scholarship.type), scholarship.fundingLevel || scholarship.funding].filter(Boolean).join(" · "),
        body: scholarship.summary || "Scholarship timing and eligibility depend on the exact school-program route.",
        href: `scholarship-detail.html?scholarship=${encodeURIComponent(scholarship.slug || scholarship.id || slugify(scholarship.title || ""))}`,
        tags: compactList([scholarship.deadline || scholarship.deadlineLabel, scholarship.degree || scholarship.applicableDegree]),
      }));
    return (fromAggregate.length ? fromAggregate : fromCatalog).slice(0, 4);
  }

  function splitCityGuidanceRow(value, fallbackLabel = "Student note") {
    const text = String(value || "").trim();
    if (!text) return [fallbackLabel, ""];
    const questionIndex = text.indexOf("?");
    if (questionIndex > 0 && questionIndex < 90) {
      return [text.slice(0, questionIndex + 1), text.slice(questionIndex + 1).trim()];
    }
    const colonIndex = text.indexOf(":");
    if (colonIndex > 0 && colonIndex < 42) {
      return [text.slice(0, colonIndex), text.slice(colonIndex + 1).trim()];
    }
    return [fallbackLabel, text];
  }

  function matchesDetailSlug(item, slug, fields = []) {
    const target = slugify(slug || "");
    if (!target) return false;
    return fields.some((field) => {
      const value = item?.[field];
      return value != null && (String(value) === String(slug) || slugify(value) === target);
    });
  }

  function hasSourceValue(value) {
    if (value === null || value === undefined) return false;
    if (typeof value === "string") return value.trim().length > 0;
    if (Array.isArray(value)) return value.some(hasSourceValue);
    if (typeof value === "object") return Object.values(value).some(hasSourceValue);
    return true;
  }

  function sourceDisplayValue(value, fallback = "Confirm from school source") {
    if (!hasSourceValue(value)) return fallback;
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (Array.isArray(value)) return value.filter(hasSourceValue).map((item) => sourceDisplayValue(item, fallback)).join(", ");
    if (typeof value === "object") {
      return Object.entries(value)
        .filter(([, item]) => hasSourceValue(item))
        .map(([key, item]) => `${titleCase(key)}: ${sourceDisplayValue(item, fallback)}`)
        .join("; ");
    }
    return String(value);
  }

  const publicFieldLabels = {
    nameZh: "Chinese name",
    nameEn: "English name",
    rank: "Rank cue",
    schoolType: "School type",
    guaranteedAdmission: "Admission guarantee",
    tierEn: "Tier",
    logoUrl: "Logo",
    citySlug: "City",
    cityZh: "City",
    region: "Region",
    officialWebsite: "Official website",
    applicationSystemUrl: "Admissions entry",
    applicationLevel: "Application levels",
    admissionLevel: "Admission levels",
    cscaRequired: "CSCA required",
    cscaRequirement: "CSCA requirement",
    cscaRequirementNote: "CSCA note",
    undergradRequirements: "Undergraduate requirements",
    postgradRequirements: "Postgraduate requirements",
    languageOfInstruction: "Teaching language",
    hskRequirement: "HSK requirement",
    englishRequirement: "English proof route",
    deadlineSummary: "Deadline summary",
    tuitionSummary: "Tuition summary",
    applicationFee: "Application fee",
    scholarships: "Scholarship options",
    englishPrograms: "English-taught programs",
    programFields: "Program fields",
    programRecords: "Program records",
    cscaRules: "CSCA rules",
    detailedScholarships: "Detailed scholarships",
    scholarshipsDetailed: "Detailed scholarships",
    scholarshipLinks: "Scholarship links",
    isVerified: "Information status",
    hasScholarship: "Funding signal",
    badgeText: "Route label",
    displayTuition: "Displayed tuition",
    displaySubjects: "Subject tags",
    displayGroup: "Route group",
    displayGroupLabel: "Route group",
    durationYears: "Duration",
    fieldCategory: "Subject area",
    teachingLanguage: "Teaching language",
    cscaSubjects: "CSCA subjects",
    englishRequirement: "English requirement",
    tuitionAmount: "Tuition amount",
    tuitionCurrency: "Tuition currency",
    tuitionPeriod: "Tuition period",
    tuitionText: "Tuition note",
    scholarshipText: "Scholarship note",
    openDate: "Application opens",
    deadlineDate: "Deadline",
    deadlineLabel: "Deadline note",
    applicationRound: "Intake",
    applicationUrl: "Application entry",
    applicationNote: "Application note",
    sourceUrl: "Official notice link",
    sourceLabel: "Official notice",
    lastVerifiedAt: "Last information check",
    contactInfo: "Contact information",
    actionLinks: "Action links",
    schoolIds: "School IDs",
    programIds: "Program IDs",
    title: "Title",
    type: "Type",
    fundingLevel: "Funding level",
    providerName: "Provider",
    providerNameEn: "Provider in English",
    providerLocation: "Provider location",
    coverage: "Coverage",
    amountText: "Amount",
    applicableDegree: "Degree fit",
    applicableProgram: "Program fit",
    targetCountries: "Eligible countries",
    targetRegions: "Eligible regions",
    benefits: "Benefits",
    benefitItems: "Benefit items",
    summary: "Summary",
    requirementText: "Eligibility requirements",
    bodySections: "Details",
    eligibilityItems: "Eligibility checklist",
    applicationMaterials: "Application materials",
    monthlyCost: "Monthly cost",
    costLevel: "Cost level",
    density: "City pace",
    budgetSummary: "Budget summary",
    costProfiles: "Cost profiles",
    costBreakdown: "Cost breakdown",
    overview: "Overview",
    bestFor: "Best for",
    lifeSections: "Student life",
    transportNotes: "Transport and arrival",
    applicationTips: "Application tips",
    applicationAdvice: "Application advice",
    nextSteps: "Next steps",
    relatedProgramKeywords: "Recommended program directions",
    faqs: "Common questions",
    cityFaqs: "City questions",
    referenceSchoolCount: "Available schools",
    referenceProgramCount: "Program routes",
    referenceEnglishProgramCount: "English-taught programs",
    referenceScholarshipCount: "Scholarship routes",
    referenceCscaSchoolCount: "CSCA-related schools",
    actualSchoolCount: "Current school options",
    actualProgramCount: "Current program routes",
    actualEnglishProgramCount: "Current English-taught routes",
    actualScholarshipCount: "Current scholarship routes",
    actualCscaRequiredSchoolCount: "Current CSCA-related schools",
    visibleSchools: "Visible schools",
    visiblePrograms: "Visible programs",
    visibleScholarships: "Visible scholarships",
  };
  const publicFieldPathLabels = {
    "School.citySlug": "City slug",
    "School.cityZh": "City name",
    "School.nameEn": "University English name",
    "School.nameZh": "University Chinese name",
    "SchoolProgram.nameEn": "Program English name",
    "SchoolProgram.nameZh": "Program Chinese name",
    "SchoolProgram.displayGroup": "Route group key",
    "SchoolProgram.displayGroupLabel": "Route group label",
    "CityGuide.nameEn": "City English name",
    "CityGuide.nameZh": "City Chinese name",
    "Scholarship.title": "Scholarship title",
  };

  const hiddenPublicFieldKeys = new Set([
    "id",
    "slug",
    "schoolId",
    "source",
    "sourceId",
    "status",
    "version",
    "createdAt",
    "updatedAt",
    "sortOrder",
    "dataQualityScore",
    "changeLogs",
    "snapshots",
    "savedByUsers",
    "compareByUsers",
    "cartItems",
    "orderItems",
  ]);

  function publicFieldKey(label = "") {
    const parts = String(label).split(".");
    return parts[parts.length - 1] || label;
  }

  function publicFieldLabel(label = "") {
    if (publicFieldPathLabels[label]) return publicFieldPathLabels[label];
    const key = publicFieldKey(label);
    return publicFieldLabels[key] || titleCase(key);
  }

  function publicInformationRows(rows = []) {
    return rows
      .filter(([label]) => !hiddenPublicFieldKeys.has(publicFieldKey(label)))
      .map(([label, value, fallback]) => [publicFieldLabel(label), sourceDisplayValue(value, fallback || "Confirm on official notice")]);
  }

  function schoolSourceSections(school = {}) {
    const section = (title, rows) => ({
      title,
      rows: publicInformationRows(rows),
    });
    return [
      section("University basics", [
        ["School.nameZh", school.nameZh],
        ["School.nameEn", school.nameEn],
        ["School.rank", school.rank],
        ["School.schoolType", school.schoolType],
        ["School.citySlug", school.citySlug],
        ["School.cityZh", school.cityZh],
        ["School.region", school.region || school.province],
        ["School.officialWebsiteUrl", school.officialWebsiteUrl || school.officialWebsite],
        ["School.admissionsWebsiteUrl", school.admissionsWebsiteUrl || school.applicationSystemUrl],
        ["School.source", school.source],
        ["School.sourceId", school.sourceId],
        ["School.sourceUrl", school.sourceUrl],
        ["School.sourceLabel", school.sourceLabel],
        ["School.sourceNote", school.sourceNote],
        ["School.qualityScore", school.qualityScore ?? school.dataQualityScore],
        ["School.missingFields", school.missingFields],
        ["School.completenessLabel", school.completenessLabel],
        ["School.lastVerifiedAt", school.lastVerifiedAt],
        ["School.version", school.version],
        ["School.createdAt", school.createdAt],
        ["School.updatedAt", school.updatedAt],
      ]),
      section("Admissions and language", [
        ["School.applicationLevel", school.applicationLevel || school.admissionLevel],
        ["School.cscaRequired", school.cscaRequired],
        ["School.cscaRequirement", school.cscaRequirement],
        ["School.languageOfInstruction", school.languageOfInstruction],
        ["School.hskRequirement", school.hskRequirement],
        ["School.englishRequirement", school.englishRequirement],
      ]),
      section("Rounds and cost", [
        ["School.deadlineSummary", school.deadlineSummary],
        ["School.tuitionSummary", school.tuitionSummary],
        ["School.applicationFee", school.applicationFee],
        ["School.scholarships", school.scholarships],
      ]),
      section("Programs and contact", [
        ["School.englishPrograms", school.englishPrograms],
        ["School.programFields", school.programFields],
      ]),
      section("Related records", [
        ["School.programs", school.programRecords || school.programs, "Program rows render as student-facing route comparisons"],
        ["School.cscaRules", school.cscaRules, "Rule rows render as student-facing CSCA check cards"],
        ["School.scholarshipsDetailed", school.scholarshipsDetailed || school.detailedScholarships, "SchoolScholarship rows render as school funding checks"],
        ["School.changeLogs", school.changeLogs, "Internal audit relation not shown to students"],
        ["School.snapshots", school.snapshots, "Historical snapshots not expanded in demo"],
        ["School.savedByUsers", school.savedByUsers, "User relation hidden"],
        ["School.compareByUsers", school.compareByUsers, "User relation hidden"],
        ["School.cartItems", school.cartItems, "Order/cart relation hidden"],
        ["School.orderItems", school.orderItems, "Order/cart relation hidden"],
      ]),
    ];
  }

  function programSourceSections(program = {}) {
    const section = (title, rows) => ({
      title,
      rows: publicInformationRows(rows),
    });
    return [
      section("Identity and school", [
        ["SchoolProgram.id", program.id],
        ["SchoolProgram.schoolId", program.schoolId],
        ["SchoolProgram.nameZh", program.nameZh],
        ["SchoolProgram.nameEn", program.nameEn],
        ["SchoolProgram.degreeLevel", program.degreeLevel],
        ["SchoolProgram.durationYears", program.durationYears],
        ["SchoolProgram.fieldCategory", program.fieldCategory],
        ["SchoolProgram.displayGroup", program.displayGroup],
        ["SchoolProgram.displayGroupLabel", program.displayGroupLabel],
        ["SchoolProgram.badgeText", program.badgeText],
        ["School.nameEn", program.schoolNameEn || program.university],
        ["School.cityZh", program.city],
      ]),
      section("Admissions and language", [
        ["SchoolProgram.teachingLanguage", program.teachingLanguage],
        ["SchoolProgram.cscaSubjects", program.cscaSubjects],
        ["SchoolProgram.displaySubjects", program.displaySubjects],
        ["SchoolProgram.cscaRequirement", program.cscaRequirement],
        ["SchoolProgram.hskRequirement", program.hskRequirement],
        ["SchoolProgram.englishRequirement", program.englishRequirement],
        ["SchoolProgram.cscaRules", program.cscaRules],
      ]),
      section("Tuition and timing", [
        ["SchoolProgram.tuitionAmount", program.tuitionAmount],
        ["SchoolProgram.tuitionCurrency", program.tuitionCurrency],
        ["SchoolProgram.tuitionPeriod", program.tuitionPeriod],
        ["SchoolProgram.tuitionText", program.tuitionText],
        ["SchoolProgram.displayTuition", program.displayTuition],
        ["SchoolProgram.scholarshipText", program.scholarshipText],
        ["SchoolProgram.openDate", program.openDate],
        ["SchoolProgram.deadlineDate", program.deadlineDate],
        ["SchoolProgram.deadlineLabel", program.deadlineLabel],
        ["SchoolProgram.applicationRound", program.applicationRound],
      ]),
      section("Application links and status", [
        ["SchoolProgram.applicationUrl", program.applicationUrl],
        ["SchoolProgram.applicationNote", program.applicationNote],
        ["SchoolProgram.sourceUrl", program.sourceUrl],
        ["SchoolProgram.sourceLabel", program.sourceLabel],
        ["SchoolProgram.lastVerifiedAt", program.lastVerifiedAt],
        ["SchoolProgram.isVerified", program.isVerified],
        ["SchoolProgram.hasScholarship", program.hasScholarship],
        ["SchoolProgram.sortOrder", program.sortOrder],
        ["SchoolProgram.status", program.status],
        ["SchoolProgram.version", program.version],
        ["SchoolProgram.createdAt", program.createdAt],
        ["SchoolProgram.updatedAt", program.updatedAt],
        ["SchoolProgram.scholarships", program.scholarships],
        ["SchoolProgram.scholarshipLinks", program.scholarshipLinks],
      ]),
    ];
  }

  function scholarshipSourceSections(item = {}) {
    const section = (title, rows) => ({
      title,
      rows: publicInformationRows(rows),
    });
    return [
      section("Scholarship basics", [
        ["Scholarship.id", item.id],
        ["Scholarship.slug", item.slug],
        ["Scholarship.title", item.title || item.name],
        ["Scholarship.type", item.type],
        ["Scholarship.fundingLevel", item.fundingLevel || item.funding],
        ["Scholarship.providerName", item.providerName],
        ["Scholarship.providerNameEn", item.providerNameEn],
        ["Scholarship.providerLocation", item.providerLocation],
      ]),
      section("Scope and benefits", [
        ["Scholarship.coverage", item.coverage],
        ["Scholarship.amountText", item.amountText],
        ["Scholarship.applicableDegree", item.applicableDegree || item.degree],
        ["Scholarship.applicableProgram", item.applicableProgram],
        ["Scholarship.targetCountries", item.targetCountries],
        ["Scholarship.targetRegions", item.targetRegions],
        ["Scholarship.benefits", item.benefits],
        ["Scholarship.benefitItems", item.benefitItems],
      ]),
      section("Eligibility and application", [
        ["Scholarship.summary", item.summary],
        ["Scholarship.requirementText", item.requirementText],
        ["Scholarship.bodySections", item.bodySections],
        ["Scholarship.eligibilityItems", item.eligibilityItems],
        ["Scholarship.applicationMaterials", item.applicationMaterials],
        ["Scholarship.applicationSteps", item.applicationSteps],
        ["Scholarship.applicationRound", item.applicationRound],
        ["Scholarship.deadlineDate", item.deadlineDate],
        ["Scholarship.deadlineLabel", item.deadlineLabel || item.deadline],
      ]),
      section("Contacts and official links", [
        ["Scholarship.contactInfo", item.contactInfo],
        ["Scholarship.actionLinks", item.actionLinks],
        ["Scholarship.sourceUrl", item.sourceUrl],
        ["Scholarship.sourceLabel", item.sourceLabel],
        ["Scholarship.lastVerifiedAt", item.lastVerifiedAt],
        ["Scholarship.status", item.status],
        ["Scholarship.version", item.version],
        ["Scholarship.createdAt", item.createdAt],
        ["Scholarship.updatedAt", item.updatedAt],
        ["Scholarship.schoolIds", item.schoolIds, "AdminScholarship relation IDs resolve into linked school cards"],
        ["Scholarship.programIds", item.programIds, "AdminScholarship relation IDs resolve into linked program cards"],
        ["Scholarship.schools", item.schools, "Linked school rows summarized in public detail"],
        ["Scholarship.programs", item.programs, "Linked program rows summarized in public detail"],
      ]),
    ];
  }

  function citySourceSections(city = {}) {
    const section = (title, rows) => ({
      title,
      rows: publicInformationRows(rows),
    });
    return [
      section("City basics", [
        ["CityGuide.id", city.id],
        ["CityGuide.slug", city.slug],
        ["CityGuide.nameZh", city.nameZh],
        ["CityGuide.nameEn", city.nameEn || city.name],
        ["CityGuide.region", city.region || city.province],
        ["CityGuide.tags", city.tags],
        ["CityGuide.nearby", city.nearby],
      ]),
      section("Cost and density", [
        ["CityGuide.monthlyCost", city.monthlyCost || city.monthlyCostRmb],
        ["CityGuide.costLevel", city.costLevel],
        ["CityGuide.density", city.density || city.pace],
        ["CityGuide.contentJson.budgetSummary", city.contentJson?.budgetSummary || city.content?.budgetSummary],
        ["CityGuide.contentJson.costProfiles", city.contentJson?.costProfiles || city.content?.costProfiles],
        ["CityGuide.contentJson.costBreakdown", city.contentJson?.costBreakdown || city.content?.costBreakdown],
      ]),
      section("Guidance content", [
        ["CityGuide.contentJson.summary", city.contentJson?.summary || city.content?.summary || city.summary],
        ["CityGuide.contentJson.overview", city.contentJson?.overview || city.content?.overview],
        ["CityGuide.contentJson.bestFor", city.contentJson?.bestFor || city.content?.bestFor || city.bestFor],
        ["CityGuide.contentJson.relatedProgramKeywords", city.contentJson?.relatedProgramKeywords || city.content?.relatedProgramKeywords],
        ["CityGuide.contentJson.lifeSections", city.contentJson?.lifeSections || city.content?.lifeSections],
        ["CityGuide.contentJson.transportNotes", city.contentJson?.transportNotes || city.content?.transportNotes],
        ["CityGuide.contentJson.applicationTips", city.contentJson?.applicationTips || city.content?.applicationTips],
        ["CityGuide.contentJson.applicationAdvice", city.contentJson?.applicationAdvice || city.content?.applicationAdvice],
        ["CityGuide.contentJson.nextSteps", city.contentJson?.nextSteps || city.content?.nextSteps],
        ["CityGuide.contentJson.faqs", city.contentJson?.faqs || city.content?.faqs],
        ["CityGuide.contentJson.cityFaqs", city.contentJson?.cityFaqs || city.content?.cityFaqs],
      ]),
      section("Related CUAC coverage", [
        ["CityGuide.referenceSchoolCount", city.referenceSchoolCount],
        ["CityGuide.referenceProgramCount", city.referenceProgramCount],
        ["CityGuide.referenceEnglishProgramCount", city.referenceEnglishProgramCount],
        ["CityGuide.referenceScholarshipCount", city.referenceScholarshipCount],
        ["CityGuide.referenceCscaSchoolCount", city.referenceCscaSchoolCount],
        ["CityGuide.status", city.status],
        ["CityGuide.version", city.version],
        ["CityGuide.createdAt", city.createdAt],
        ["CityGuide.updatedAt", city.updatedAt],
      ]),
    ];
  }

  function userDetailSections(sections = []) {
    return sections.map((section) => ({
      title: section.title,
      summary: section.summary || "",
      rows: (section.rows || [])
        .filter(([, value, fallback]) => hasSourceValue(value) || hasSourceValue(fallback))
        .map(([label, value, fallback]) => [label, sourceDisplayValue(value, fallback || "Confirm with the school")]),
    })).filter((section) => section.rows.length);
  }

  function programProfileSections(program = {}) {
    const programTitle = program.nameEn || program.name;
    const chineseTitle = program.nameZh && program.nameZh !== programTitle ? program.nameZh : "";
    const subjectTags = program.displaySubjects || program.cscaSubjects;
    const tuition = program.displayTuition || program.tuitionText || rmbLabel(program.tuitionAmount ?? program.tuition);
    return userDetailSections([
      {
        title: "Course basics",
        summary: "The concrete route a student would add to an application set.",
        rows: [
          ["University", program.schoolNameEn || program.university],
          ["Program", programTitle],
          ["Chinese program name", chineseTitle],
          ["Degree level", program.degreeLevel || program.degree],
          ["Route group", program.displayGroupLabel || program.fieldCategory || program.subject],
          ["Subject area", program.fieldCategory || program.subject],
          ["Duration", program.durationYears || program.duration],
          ["City", program.city],
        ],
      },
      {
        title: "Admissions requirements",
        summary: "Check these before treating the route as realistic.",
        rows: [
          ["Teaching language", program.teachingLanguage || program.language],
          ["English requirement", program.englishRequirement || program.langReq],
          ["Chinese / HSK requirement", program.hskRequirement || program.hsk],
          ["Subject tags", subjectTags],
          ["CSCA requirement", program.cscaRequirement],
        ],
      },
      {
        title: "Tuition and timing",
        summary: "The cost and deadline details that affect planning.",
        rows: [
          ["Tuition", tuition],
          ["Intake", program.applicationRound || program.intake],
          ["Deadline", program.deadlineLabel || program.deadlineDate || program.deadline],
          ["Opens", program.openDate],
        ],
      },
      {
        title: "CUAC application handoff",
        summary: "After the student adds this route, CUAC sends non-document information and the school follows up directly.",
        rows: [
          ["Scholarship route", program.scholarshipText || program.scholarshipType],
          ["Application entry", program.applicationUrl],
          ["CUAC handoff", program.applicationNote],
        ],
      },
    ]);
  }

  function detailCardItems(rows = [], fallbackBody = "Confirm this before adding the route.") {
    return rows
      .filter(([, value, fallback]) => hasSourceValue(value) || hasSourceValue(fallback))
      .map(([title, value, fallback]) => ({
        title,
        body: sourceDisplayValue(value, fallback || fallbackBody),
      }));
  }

  function programOfficialCards(program = {}) {
    const scholarshipLinks = Array.isArray(program.scholarshipLinks)
      ? program.scholarshipLinks.map((item) => plainRecord(item) ? item : { title: String(item || "").trim() }).filter((item) => item.title || item.name || item.href || item.url || item.slug)
      : mixedIdList(program.scholarshipLinks).map((item) => ({ title: item }));
    const schoolScholarshipCards = getSchoolScholarshipRecords(program).map((record) => ({
      title: record.name || "School scholarship route",
      body: [record.coverage || record.amountText, record.deadlineLabel || record.deadlineDate || record.applicationRound].filter(Boolean).join(" · ") || "Check this funding route against the exact program.",
      href: record.scholarshipSlug ? `scholarship-detail.html?scholarship=${encodeURIComponent(record.scholarshipSlug)}` : "scholarships.html",
    }));
    const explicitScholarshipCards = scholarshipLinks.map((item) => ({
      title: item.title || item.name || item.label || "Scholarship route",
      body: item.body || item.summary || item.note || "Review whether this funding route fits the selected program.",
      href: item.href || item.url || (item.slug ? `scholarship-detail.html?scholarship=${encodeURIComponent(item.slug)}` : "scholarships.html"),
    }));
    return [
      program.applicationUrl ? {
        title: "School application page",
        body: "Use this when the university asks you to continue on its official system.",
        href: program.applicationUrl,
      } : null,
      program.sourceUrl ? {
        title: "Official program notice",
        body: program.sourceLabel || "Check current tuition, deadline, language, and application requirements.",
        href: program.sourceUrl,
      } : null,
      ...explicitScholarshipCards,
      ...schoolScholarshipCards,
    ].filter(Boolean);
  }

  function programDisplayGuide(program = {}) {
    const tuition = program.displayTuition || program.tuitionText || rmbLabel(program.tuitionAmount ?? program.tuition);
    const deadline = program.deadlineLabel || program.deadlineDate || program.deadline || "Deadline pending";
    const university = program.schoolNameEn || program.university || "Confirm university";
    const universityZh = program.schoolNameZh || program.school?.nameZh || "";
    const programName = program.nameEn || program.name || "Program route";
    const programNameZh = program.nameZh && program.nameZh !== programName ? program.nameZh : "";
    const subjectTags = program.displaySubjects || program.cscaSubjects || [];
    const groupLabel = program.displayGroupLabel || program.fieldCategory || program.subject || "";
    const schoolNoticeCheck = "Confirm dates and requirements on the school admissions notice before deciding.";
    return {
      schoolChineseName: universityZh && universityZh !== university ? universityZh : "",
      programChineseName: programNameZh,
      routeBadge: program.badgeText || "",
      fieldSummary: [
        { label: "University", value: university },
        { label: "Degree", value: program.degreeLevel || program.degree || "Confirm" },
        { label: "Teaching", value: program.teachingLanguage || program.language || "Confirm" },
        { label: "Tuition", value: tuition },
        { label: "Deadline", value: deadline },
        { label: "Intake", value: program.applicationRound || program.intake || "Confirm" },
      ].filter(Boolean),
      routeCards: detailCardItems([
        ["University", universityZh && universityZh !== university ? `${university} · ${universityZh}` : university],
        ["Program", programNameZh ? `${programName} · ${programNameZh}` : programName],
        ["Subject area", program.fieldCategory || program.subject],
        ["Duration", program.durationYears || program.duration],
        ["City", program.city],
      ]),
      routeSignalCards: detailCardItems([
        ["Program group", groupLabel, "Confirm the school program group."],
        ["Subjects to prepare", subjectTags, "Confirm the academic subject tags."],
        ["Tuition planning", tuition, "Confirm tuition on the school notice."],
        ["Funding option", program.badgeText || program.scholarshipText, program.hasScholarship ? "Funding route available" : "Check funding separately."],
        ["Deadline planning", deadline, schoolNoticeCheck],
      ]),
      compareCards: detailCardItems([
        ["Academic fit", [groupLabel, sourceDisplayValue(subjectTags, "")].filter(Boolean).join(" · "), "Confirm whether the subject area matches your study plan."],
        ["Cost planning", tuition, "Use tuition with city living cost before saving the route."],
        ["Funding context", program.scholarshipText || program.scholarshipType || program.badgeText, "Check funding separately from admission eligibility."],
        ["Deadline planning", deadline, schoolNoticeCheck],
      ]),
      requirementCards: detailCardItems([
        ["Teaching language", program.teachingLanguage || program.language],
        ["English requirement", program.englishRequirement || program.langReq],
        ["Chinese / HSK requirement", program.hskRequirement || program.hsk],
        ["CSCA requirement", program.cscaRequirement || subjectTags],
      ]),
      timingCards: detailCardItems([
        ["Tuition", tuition],
        ["Application round", program.applicationRound || program.intake],
        ["Opens", program.openDate],
        ["Deadline", deadline],
      ]),
      nextCards: detailCardItems([
        ["Scholarship route", program.scholarshipText || program.scholarshipType, "Confirm scholarship timing separately."],
        ["Application entry", program.applicationUrl ? "School admissions page" : "", "Confirm on the university admissions page."],
        ["CUAC handoff", program.applicationNote, "CUAC sends school-scoped non-document information after payment or free entitlement."],
      ]),
      readinessCards: detailCardItems([
        ["Language readiness", program.englishRequirement || program.hskRequirement || program.langReq || program.hsk, "Confirm language proof for this exact teaching route."],
        ["School follow-up", program.applicationNote, "Check how this school handles materials after CUAC sends the route."],
        ["Funding route", program.scholarshipText || program.scholarshipType || program.badgeText, "Confirm funding separately before relying on it."],
      ]),
      officialCards: programOfficialCards(program),
    };
  }

  function schoolProfileSections(school = {}) {
    return userDetailSections([
      {
        title: "Identity and school",
        summary: "Confirm the exact school record before comparing programs.",
        rows: [
          ["Chinese name", school.nameZh],
          ["English name", school.nameEn],
          ["School type", titleCase(school.schoolType || "")],
          ["Tier", school.tierEn],
          ["Rank cue", school.rank ? `#${school.rank}` : ""],
        ],
      },
      {
        title: "Degree fit",
        summary: "Use school-level eligibility only as a first filter; final checks depend on the exact program.",
        rows: [
          ["Application levels", school.applicationLevel || school.admissionLevel],
          ["Undergraduate route", school.undergradRequirements],
          ["Postgraduate route", school.postgradRequirements],
          ["Preparatory route", school.preparatoryRequirements],
          ["Under-18 guardian", school.under18GuardianRequired ? school.under18RequirementNote || "Required" : "Usually not required; confirm if applicant is under 18"],
        ],
      },
      {
        title: "Language and CSCA",
        summary: "Language and subject checks should be confirmed again on the selected program route.",
        rows: [
          ["Teaching language", school.languageOfInstruction],
          ["HSK requirement", school.hskRequirement],
          ["English requirement", school.englishRequirement],
          ["CSCA requirement", school.cscaRequirement || school.cscaRequirementNote],
        ],
      },
      {
        title: "Dates and official entry",
        summary: "Plan from school dates, then verify the live admissions page before acting.",
        rows: [
          ["Round 1", [school.round1OpenDate, school.round1Deadline].filter(Boolean).join(" to ")],
          ["Round 2", [school.round2OpenDate, school.round2Deadline].filter(Boolean).join(" to ")],
          ["Official website", school.officialWebsite],
          ["Admissions entry", school.applicationSystemUrl],
          ["CUAC handoff", school.applicationSteps],
        ],
      },
      {
        title: "Costs and funding",
        summary: "Budget beyond tuition before choosing a city and program.",
        rows: [
          ["Tuition summary", school.tuitionSummary],
          ["Application fee", school.applicationFee],
          ["Insurance", school.insurance],
          ["Accommodation", [school.accommodationCost, school.accommodationType].filter(Boolean).join(" · ")],
          ["Scholarship options", school.scholarships],
        ],
      },
      {
        title: "Programs and support",
        summary: "Use the university profile to move into concrete program choices.",
        rows: [
          ["English-taught routes", school.englishPrograms],
          ["Notable programs", school.notablePrograms],
          ["Program fields", school.programFields],
          ["Campus support", school.campusFacilities],
          ["International office email", school.contactEmail],
        ],
      },
    ]);
  }

  function schoolReadableItems(value) {
    if (Array.isArray(value)) return value.filter(hasSourceValue).map((item) => sourceDisplayValue(item, "")).filter(Boolean);
    if (!hasSourceValue(value)) return [];
    return String(value)
      .split(/[,;；、]|\band\b/i)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function schoolProgramPreviewCards(school = {}) {
    const schoolName = String(school.nameEn || school.name || "").toLowerCase();
    const matched = getDiscoveryPrograms().filter((program) => (
      (school.id && Number(program.schoolId) === Number(school.id))
      || String(program.schoolNameEn || program.university || "").toLowerCase() === schoolName
    ));
    if (matched.length) {
      return matched.slice(0, 6).map((program) => {
        const name = program.nameEn || program.name || "Program route";
        const nameZh = program.nameZh && program.nameZh !== name ? program.nameZh : "";
        const routeFacts = [nameZh, program.degreeLevel, program.teachingLanguage, program.deadlineLabel || program.deadlineDate].filter(Boolean);
        return {
          title: name,
          body: routeFacts.join(" · ") || "Review this concrete program route.",
          href: `program-detail.html?program=${encodeURIComponent(program.id || slugify(name))}`,
        };
      });
    }
    return schoolReadableItems(school.programFields || school.notablePrograms || school.englishPrograms || school.featuredPrograms || school.subjectTags)
      .slice(0, 6)
      .map((field) => ({
        title: field,
        body: "Program area to verify in the school catalog before applying.",
        href: `programs.html?university=${encodeURIComponent(slugify(school.nameEn || school.name || ""))}&q=${encodeURIComponent(field)}`,
      }));
  }

  function schoolProgramCompareRows(school = {}) {
    const schoolName = String(school.nameEn || school.name || "").toLowerCase();
    const matched = getDiscoveryPrograms().filter((program) => (
      (school.id && Number(program.schoolId) === Number(school.id))
      || String(program.schoolNameEn || program.university || "").toLowerCase() === schoolName
    ));
    if (matched.length) {
      return matched.slice(0, 8).map((program) => {
        const name = program.nameEn || program.name || "Program route";
        const nameZh = program.nameZh && program.nameZh !== name ? program.nameZh : "";
        return {
          title: name,
          titleZh: nameZh,
          meta: [program.degreeLevel, program.durationYears, program.fieldCategory].filter(Boolean).join(" · ") || "Program route",
          degree: program.degreeLevel || "",
          field: program.fieldCategory || "",
          subjects: Array.isArray(program.cscaSubjects) ? program.cscaSubjects.filter(Boolean) : schoolReadableItems(program.cscaSubjects),
          teaching: program.teachingLanguage || "Confirm teaching language",
          csca: sourceDisplayValue(program.cscaSubjects, program.cscaRequirement || "Confirm CSCA subjects"),
          language: program.hskRequirement || program.englishRequirement || "Confirm language proof",
          tuition: program.tuitionText || [program.tuitionCurrency, program.tuitionAmount, program.tuitionPeriod].filter(Boolean).join(" ") || "Confirm tuition",
          deadline: program.deadlineLabel || program.deadlineDate || "Confirm deadline",
          scholarship: program.scholarshipText || "Check school scholarship route",
          note: program.applicationNote || "Confirm application notes before choosing.",
          languageRequirement: program.hskRequirement || program.englishRequirement || "",
          applicationNote: program.applicationNote || "",
          sourceLabel: program.sourceLabel || "",
          sourceUrl: program.sourceUrl || "",
          applicationUrl: program.applicationUrl || "",
          href: `program-detail.html?program=${encodeURIComponent(program.id || slugify(name))}`,
        };
      });
    }
    return schoolProgramPreviewCards(school).map((card) => ({
      title: card.title,
      titleZh: "",
      meta: card.body,
      degree: "",
      field: "",
      subjects: [],
      teaching: "Confirm teaching language",
      csca: "Confirm CSCA subjects",
      language: "Confirm language proof",
      tuition: "Confirm tuition",
      deadline: "Confirm deadline",
      scholarship: "Check school scholarship route",
      note: "Open the program catalog to verify this route.",
      languageRequirement: "",
      applicationNote: "Open the program catalog to verify this route.",
      sourceLabel: "",
      sourceUrl: "",
      applicationUrl: "",
      href: card.href,
    }));
  }

  function schoolScholarshipPreviewCards(school = {}) {
    const direct = schoolScholarshipCatalog
      .filter((record) => Number(record.schoolId) === Number(school.id) && record.status !== "archived")
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    const detailed = Array.isArray(school.scholarshipsDetailed) ? school.scholarshipsDetailed : [];
    const linkRows = Array.isArray(school.scholarshipLinks)
      ? school.scholarshipLinks.map((item) => plainRecord(item) ? item : { title: String(item || "").trim() }).filter((item) => item.title || item.name || item.href || item.url || item.slug)
      : schoolReadableItems(school.scholarshipLinks).map((item) => ({ title: item }));
    const source = direct.length ? direct : detailed.length ? detailed : linkRows.length ? linkRows : schoolReadableItems(school.scholarships);
    return (Array.isArray(source) ? source : [])
      .slice(0, 6)
      .map((item, index) => {
        if (typeof item === "string") {
          return {
            title: item,
            body: "Confirm the current school scholarship notice before relying on it.",
            href: `scholarships.html#${encodeURIComponent(slugify(school.nameEn || school.name || item))}`,
          };
        }
        const title = item.name || item.title || `Scholarship route ${index + 1}`;
        return {
          title,
          body: [item.coverage || item.amountText, item.applicableDegree || item.degree, item.deadlineLabel || item.deadlineDate].filter(Boolean).join(" · ") || "Confirm coverage, degree fit, and deadline with the school.",
          href: item.href || item.url || (item.scholarshipSlug ? `scholarship-detail.html?scholarship=${encodeURIComponent(item.scholarshipSlug)}` : `scholarships.html#${encodeURIComponent(slugify(title))}`),
        };
      });
  }

  function schoolScholarshipCompareRows(school = {}) {
    const direct = schoolScholarshipCatalog
      .filter((record) => Number(record.schoolId) === Number(school.id) && record.status !== "archived")
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    const detailed = Array.isArray(school.scholarshipsDetailed) ? school.scholarshipsDetailed : [];
    const linkRows = Array.isArray(school.scholarshipLinks)
      ? school.scholarshipLinks.map((item) => plainRecord(item) ? item : { title: String(item || "").trim() }).filter((item) => item.title || item.name || item.href || item.url || item.slug)
      : schoolReadableItems(school.scholarshipLinks).map((item) => ({ title: item }));
    const source = direct.length ? direct : detailed.length ? detailed : linkRows.length ? linkRows : schoolReadableItems(school.scholarships);
    return (Array.isArray(source) ? source : [])
      .slice(0, 8)
      .map((item, index) => {
        if (typeof item === "string") {
          return {
            title: item,
            meta: "Confirm the current school scholarship notice.",
            coverage: "Confirm coverage",
            degree: "Confirm degree fit",
            program: "Confirm program scope",
            requirement: "Confirm school requirements",
            href: `scholarships.html#${encodeURIComponent(slugify(school.nameEn || school.name || item))}`,
          };
        }
        const title = item.name || item.title || `Scholarship route ${index + 1}`;
        return {
          title,
          meta: [item.type, item.deadlineLabel || item.deadlineDate].filter(Boolean).join(" · ") || "School funding route",
          coverage: item.coverage || item.amountText || "Confirm coverage",
          degree: item.applicableDegree || item.degree || "Confirm degree fit",
          program: item.applicableProgram || "Confirm program scope",
          requirement: item.requirementText || "Confirm school requirements",
          href: item.href || item.url || (item.scholarshipSlug ? `scholarship-detail.html?scholarship=${encodeURIComponent(item.scholarshipSlug)}` : `scholarships.html#${encodeURIComponent(slugify(title))}`),
        };
      });
  }

  function schoolCscaRuleCategoryLabel(category = "") {
    const labels = {
      humanities: "Humanities route",
      science: "Science route",
      language_policy: "Language policy",
      notice: "Important notice",
      other: "School rule",
      "文科/人文类": "Humanities route",
      "理工科类": "Science route",
      "HSK 免考政策": "Language policy",
      "重要提示": "Important notice",
    };
    return labels[category] || titleCase(category || "School rule");
  }

  function schoolCscaRuleTone(category = "") {
    const normalized = String(category || "").toLowerCase();
    if (/science|理工|engineering|stem/.test(normalized)) return "science";
    if (/human|文科|business|economics/.test(normalized)) return "humanities";
    if (/language|hsk|english|语言/.test(normalized)) return "language";
    if (/notice|提示|important/.test(normalized)) return "notice";
    return "general";
  }

  function schoolCscaRuleCards(school = {}) {
    const explicitRules = Array.isArray(school.cscaRules)
      ? school.cscaRules.filter((rule) => plainRecord(rule) && rule.status !== "archived")
      : [];
    const fallbackRules = explicitRules.length ? [] : detailCardItems([
      ["School-level CSCA check", school.cscaRequirement || school.cscaRequirementNote || school.cscaSubjects, "Confirm whether CSCA applies before choosing a program."],
      ["Chinese / HSK route", school.hskRequirement, "Confirm HSK expectations for Chinese-taught or mixed-language routes."],
      ["English proof route", school.englishRequirement || school.englishRequirementNote, "Confirm whether IELTS, TOEFL, or a waiver is accepted."],
    ]).map((item, index) => ({
      id: `school-rule-fallback-${index + 1}`,
      title: item.title,
      category: index === 0 ? "notice" : index === 1 ? "language_policy" : "other",
      description: item.body,
      cscaSubjects: index === 0 ? school.cscaSubjects : [],
      applicablePrograms: [],
      languageCondition: "",
      importantNote: index === 0 ? "Final requirements depend on the exact program route." : "",
    }));
    return (explicitRules.length ? explicitRules : fallbackRules).slice(0, 6).map((rule, index) => {
      const subjects = Array.isArray(rule.cscaSubjects) ? rule.cscaSubjects.filter(Boolean).join(" + ") : sourceDisplayValue(rule.cscaSubjects, "");
      const primary = subjects && Array.isArray(rule.cscaSubjects) && rule.cscaSubjects.length > 1
        ? subjects
        : rule.description || rule.scope || subjects || "Confirm the current school rule before applying.";
      return {
        id: rule.id || `school-rule-${index + 1}`,
        title: rule.title || schoolCscaRuleCategoryLabel(rule.category),
        category: schoolCscaRuleCategoryLabel(rule.category),
        tone: schoolCscaRuleTone(rule.category),
        body: primary,
        subjects,
        applicablePrograms: Array.isArray(rule.applicablePrograms) ? rule.applicablePrograms.filter(Boolean).slice(0, 8) : schoolReadableItems(rule.applicablePrograms).slice(0, 8),
        languageCondition: rule.languageCondition || "",
        importantNote: rule.importantNote || "",
      };
    });
  }

  function schoolQuickFactItems(school = {}) {
    const quickFacts = school.quickFacts || {};
    const detailDisplay = school.detailDisplay || {};
    const programCount = detailDisplay.displayProgramCount ?? school.programCount ?? school.programs ?? quickFacts.programCount;
    const englishProgramCount = school.englishProgramCount ?? quickFacts.englishProgramCount;
    return [
      { label: "Location", value: detailDisplay.city || quickFacts.location || [school.cityZh || school.city, school.region || school.province].filter(Boolean).join(", ") },
      { label: "Region", value: detailDisplay.regionLabel || quickFacts.region || school.regionLabel || school.region || school.province },
      { label: "Tuition", value: quickFacts.tuition || school.tuitionBandLabel || school.tuitionSummary || school.tuition },
      { label: "Living cost", value: detailDisplay.livingCostLabel || quickFacts.livingCost },
      { label: "Accommodation", value: quickFacts.accommodation || [school.accommodationCost, school.accommodationType].filter(Boolean).join(" · ") },
      { label: "Programs", value: programCount ? `${programCount} programs` : "" },
      { label: "English-taught", value: englishProgramCount !== undefined && englishProgramCount !== null ? `${englishProgramCount} routes` : "" },
    ].filter((item) => hasSourceValue(item.value)).slice(0, 7);
  }

  function schoolProgramDisplayGroups(school = {}) {
    const detailDisplay = school.detailDisplay || {};
    if (Array.isArray(detailDisplay.programDisplayGroups) && detailDisplay.programDisplayGroups.length) {
      return detailDisplay.programDisplayGroups
        .filter((group) => hasSourceValue(group?.label) || hasSourceValue(group?.total))
        .map((group) => ({
          label: group.label || group.key || "Program group",
          count: group.visibleCount !== undefined ? `${group.visibleCount}/${group.total}` : String(group.total || 0),
          note: group.hiddenNote || "",
        }));
    }
    const rows = schoolProgramCompareRows(school);
    const grouped = rows.reduce((groups, row) => {
      const label = row.meta?.split(" · ")?.[0] || row.teaching || "Program routes";
      groups[label] = (groups[label] || 0) + 1;
      return groups;
    }, {});
    return Object.entries(grouped).slice(0, 4).map(([label, count]) => ({ label, count: `${count}`, note: "" }));
  }

  function schoolApplicationTimeline(school = {}) {
    const timeline = school.detailDisplay?.applicationTimeline;
    if (Array.isArray(timeline) && timeline.length) {
      return timeline
        .filter((item) => hasSourceValue(item?.label) || hasSourceValue(item?.dateLabel))
        .map((item) => `${item.label || item.key || "Application step"}: ${[item.dateLabel, item.statusLabel, item.description].filter(Boolean).join(" · ")}`);
    }
    return compactList([
      school.round1Deadline ? `Round 1 deadline: ${school.round1Deadline}` : null,
      school.round2Deadline ? `Round 2 deadline: ${school.round2Deadline}` : null,
      school.deadlineSummary ? `Deadline summary: ${school.deadlineSummary}` : null,
      school.applicationSteps ? `School handoff: ${school.applicationSteps}` : null,
    ]);
  }

  function schoolUpcomingDeadlineRows(school = {}) {
    const sourceRows = Array.isArray(school.upcomingDeadlines) ? school.upcomingDeadlines : [];
    const rows = sourceRows
      .filter((item) => hasSourceValue(item?.programName) || hasSourceValue(item?.deadlineDate) || hasSourceValue(item?.deadlineLabel))
      .map((item) => ({
        title: item.programName || "Program route",
        meta: [item.degreeLevel, item.teachingLanguage, item.applicationRound].filter(Boolean).join(" · "),
        deadline: item.deadlineDate || item.deadlineLabel || "Deadline pending",
        status: item.statusLabel || "",
      }));
    if (rows.length) return rows.slice(0, 4);
    return schoolProgramCompareRows(school)
      .filter((row) => row?.deadline && !/^(confirm|pending|deadline pending)$/i.test(String(row.deadline).trim()))
      .slice(0, 4)
      .map((row) => ({
        title: row.title || "Program route",
        meta: [row.degree, row.teaching].filter(Boolean).join(" · ") || row.meta || "Program route",
        deadline: row.deadline,
        status: row.round || "Program deadline",
      }));
  }

  function schoolDisplayGuide(school = {}) {
    return {
      quickFacts: schoolQuickFactItems(school),
      officialActions: schoolOfficialActions(school),
      programGroups: schoolProgramDisplayGroups(school),
      hiddenProgramNote: school.detailDisplay?.hiddenProgramNote || "",
      fieldTags: school.detailDisplay?.programFieldTags || school.programSubjectTags || school.subjectTags || [],
      applicationTimeline: schoolApplicationTimeline(school),
      upcomingDeadlines: schoolUpcomingDeadlineRows(school),
      programCards: schoolProgramPreviewCards(school),
      programRows: schoolProgramCompareRows(school),
      cscaRuleCards: schoolCscaRuleCards(school),
      scholarshipCards: schoolScholarshipPreviewCards(school),
      scholarshipRows: schoolScholarshipCompareRows(school),
    };
  }

  function schoolOfficialActions(school = {}) {
    const isUrl = (value) => /^https?:\/\//i.test(String(value || "").trim());
    const links = [
      isUrl(school.officialWebsiteUrl || school.officialWebsite)
        ? {
            title: "Official website",
            body: "Use this to confirm the university identity and current school notices.",
            href: school.officialWebsiteUrl || school.officialWebsite,
          }
        : null,
      isUrl(school.admissionsWebsiteUrl || school.applicationSystemUrl)
        ? {
            title: "Admissions entry",
            body: "Use the school admissions page to verify deadlines, fees, and official application requirements.",
            href: school.admissionsWebsiteUrl || school.applicationSystemUrl,
          }
        : null,
    ].filter(Boolean);
    return {
      applicationFee: sourceDisplayValue(school.applicationFee, "Confirm application fee in the school admissions system."),
      links,
    };
  }

  function scholarshipProfileSections(item = {}) {
    return userDetailSections([
      {
        title: "Funding route",
        summary: "Understand what this route may cover before linking it to a program.",
        rows: [
          ["Provider", item.providerName || item.schoolName || item.school],
          ["Coverage", item.coverage],
          ["Amount", item.amountText],
          ["Applicable degree", item.applicableDegree || item.degree],
          ["Applicable program", item.applicableProgram],
        ],
      },
      {
        title: "Eligibility fit",
        summary: "Use this to decide whether the route is realistic for the student.",
        rows: [
          ["Eligibility", item.requirementText],
          ["Target countries", item.targetCountries],
          ["Target regions", item.targetRegions],
          ["Benefits", item.benefits],
        ],
      },
      {
        title: "Preparation",
        summary: "Plan the work before spending time on a funding route.",
        rows: [
          ["Application round", item.applicationRound],
          ["Materials", item.applicationMaterials],
          ["Steps", item.applicationSteps],
          ["Contact", item.contactInfo],
        ],
      },
      {
        title: "Use it with programs",
        summary: "Scholarships matter only after they connect to real schools and degree routes.",
        rows: [
          ["Next step", "Find concrete programs where this funding route can matter."],
          ["Linked schools", item.schools],
          ["Linked programs", item.programs],
          ["Useful link", item.sourceUrl],
        ],
      },
    ]);
  }

  function scholarshipListCards(values = [], fallbackItems = [], fallbackBody = "Check the current scholarship notice.") {
    const source = Array.isArray(values) && values.length ? values : fallbackItems;
    return (Array.isArray(source) ? source : [source])
      .filter(hasSourceValue)
      .slice(0, 5)
      .map((item, index) => {
        if (typeof item === "object") {
          const title = sourceDisplayValue(item.title || item.label || item.name || `Item ${index + 1}`, `Item ${index + 1}`);
          const body = sourceDisplayValue(item.body || item.value || item.note || item.description || (item.included === false ? "Not included" : ""), fallbackBody);
          const state = item.included === true ? "Included" : item.included === false ? "Not included" : "";
          return { title, body, state };
        }
        return { title: sourceDisplayValue(item, `Item ${index + 1}`), body: fallbackBody };
      });
  }

  function isRichScholarshipNoticeText(text = "") {
    const lines = String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    return lines.length >= 8 || lines.join(" ").length >= 650;
  }

  function isScholarshipNoticeHeading(line = "") {
    return /^(第[一二三四五六七八九十]+)\s+/.test(line)
      || /^[一二三四五六七八九十]、/.test(line)
      || /^Part\s+[IVX]+\./i.test(line)
      || /^(?:[1-9]|10)\.\s+(Funding categories|Funding coverage|Application channel|Eligibility|Application process|Application materials|Program universities|Admission and notification|Admission timeline|Changes to)/i.test(line)
      || /^.+[：:]$/.test(line);
  }

  function stripScholarshipNoticeMarker(line = "") {
    return String(line || "").replace(/^\s*(?:\d+[.、]|[-*•●])\s*/, "").trim();
  }

  function splitScholarshipOfficialNotice(text = "") {
    if (!isRichScholarshipNoticeText(text)) return [];
    const sections = [];
    let current = { title: "Official notice summary", paragraphs: [], items: [], schools: [] };
    String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).forEach((line) => {
      if (isScholarshipNoticeHeading(line)) {
        if (current.title || current.paragraphs.length || current.items.length || current.schools.length) sections.push(current);
        current = { title: line.replace(/[：:]$/, ""), paragraphs: [], items: [], schools: [] };
        return;
      }
      const schoolMatch = line.match(/^\s*(\d+)[.、]\s*(.+?)[｜|](.+)$/);
      if (schoolMatch) {
        current.schools.push({ index: schoolMatch[1], name: schoolMatch[2].trim(), meta: schoolMatch[3].trim() });
        return;
      }
      if (/^\s*(?:\d+[.、]|[-*•●])\s+/.test(line)) {
        const item = stripScholarshipNoticeMarker(line);
        if (item) current.items.push(item);
        return;
      }
      current.paragraphs.push(line);
    });
    if (current.title || current.paragraphs.length || current.items.length || current.schools.length) sections.push(current);
    return sections.filter((section) => section.paragraphs.length || section.items.length || section.schools.length);
  }

  function scholarshipNoticeSections(item = {}) {
    const noticeTextList = (value) => {
      if (Array.isArray(value)) return value.filter(hasSourceValue).map((entry) => sourceDisplayValue(entry, ""));
      if (typeof value === "string") return value.split(/\n{2,}|\r?\n/).map((entry) => entry.trim()).filter(Boolean);
      if (hasSourceValue(value)) return [sourceDisplayValue(value, "")];
      return [];
    };
    const sections = Array.isArray(item.bodySections) ? item.bodySections : [];
    const mapped = sections
      .filter(hasSourceValue)
      .slice(0, 5)
      .map((section, index) => {
        if (typeof section === "string") {
          return {
            title: `Notice section ${index + 1}`,
            paragraphs: [section],
            items: [],
          };
        }
        return {
          title: sourceDisplayValue(section.title || section.label, `Notice section ${index + 1}`),
          paragraphs: noticeTextList(section.paragraphs || section.body || section.value).slice(0, 4),
          items: noticeTextList(section.items || section.points || []).slice(0, 6),
        };
      })
      .filter((section) => section.paragraphs.length || section.items.length);
    if (mapped.length) return mapped;
    return [{
      title: "Scholarship overview",
      paragraphs: compactList([item.summary || (isRichScholarshipNoticeText(item.requirementText) ? "Read the structured notice below before preparing materials." : item.requirementText) || "Use the scholarship route together with school and program fit before relying on it."]),
      items: [],
    }];
  }

  function scholarshipProgramMatches(item = {}, program = {}) {
    const haystack = [
      item.slug,
      item.title,
      item.type,
      item.typeLabel,
      item.school,
      item.schoolName,
      item.providerName,
      item.providerLocation,
      item.applicableProgram,
      sourceDisplayValue(item.targetRegions, ""),
      sourceDisplayValue(item.tags, ""),
    ].filter(Boolean).join(" ").toLowerCase();
    const schoolName = String(program.schoolNameEn || program.university || "").toLowerCase();
    const region = String(program.province || program.region || "").toLowerCase();
    const city = String(program.city || "").toLowerCase();
    const programName = String(program.nameEn || program.name || program.program || "").toLowerCase();
    const field = String(program.fieldCategory || program.subject || "").toLowerCase();
    if (haystack.includes("shanghai")) return city.includes("shanghai") || region.includes("shanghai");
    if (haystack.includes("jiangsu")) return city.includes("nanjing") || region.includes("jiangsu");
    if (haystack.includes("beijing")) return city.includes("beijing") || region.includes("beijing");
    if (haystack.includes("zhejiang") || haystack.includes("hangzhou")) return schoolName.includes("zhejiang") || city.includes("hangzhou");
    if (haystack.includes("uibe")) return schoolName.includes("uibe");
    if (haystack.includes("fudan")) return schoolName.includes("fudan");
    if (haystack.includes("engineering")) return field.includes("engineering") || programName.includes("engineering");
    if (haystack.includes("business")) return field.includes("business") || programName.includes("business") || programName.includes("trade");
    if (haystack.includes("csc") || haystack.includes("government") || item.fundingLevel === "full" || item.funding === "full") {
      return Boolean(program.hasScholarship || String(program.scholarshipText || program.signal || "").toLowerCase().includes("csc"));
    }
    return false;
  }

  function scholarshipRelatedPrograms(item = {}) {
    const explicit = Array.isArray(item.programs) ? item.programs : [];
    if (explicit.length) return explicit.slice(0, 6);
    const matched = getDiscoveryPrograms().filter((program) => scholarshipProgramMatches(item, program));
    return (matched.length ? matched : getDiscoveryPrograms().filter((program) => program.hasScholarship)).slice(0, 6);
  }

  function scholarshipRelatedSchools(item = {}, programs = scholarshipRelatedPrograms(item)) {
    const explicit = Array.isArray(item.schools) ? item.schools : [];
    if (explicit.length) return explicit.slice(0, 6);
    const byId = new Map();
    programs.forEach((program) => {
      const school = program.schoolId
        ? getSchoolCatalogRecordById(program.schoolId, program.schoolNameEn || program.university || "")
        : getSchoolCatalogRecord(program.schoolNameEn || program.university || "");
      if (!byId.has(school.id)) byId.set(school.id, school);
    });
    if (byId.size) return Array.from(byId.values()).slice(0, 6);
    const schoolName = item.schoolNameEn || item.schoolName || item.school || item.providerName;
    if (schoolName && !/multiple|universities/i.test(schoolName)) return [getSchoolCatalogRecord(schoolName)];
    return Object.values(schoolCatalog).slice(0, 3);
  }

  function scholarshipSchoolCards(item = {}) {
    return scholarshipRelatedSchools(item).map((school) => {
      const name = school.nameEn || school.nameZh || school.name || "Applicable school";
      const location = [school.cityZh, school.region].filter(Boolean).join(", ");
      return {
        title: name,
        body: [location, school.tierEn || school.schoolType].filter(Boolean).join(" · ") || "Review this university before using the funding route.",
        href: `university-detail.html?university=${encodeURIComponent(slugify(name))}`,
      };
    });
  }

  function scholarshipProgramCards(item = {}) {
    return scholarshipRelatedPrograms(item).map((program) => {
      const name = program.nameEn || program.name || program.program || "Program route";
      return {
        title: name,
        body: [program.schoolNameEn || program.university, program.degreeLevel || program.degree, program.teachingLanguage || program.language].filter(Boolean).join(" · ") || "Check this program with the funding route.",
        href: `program-detail.html?program=${encodeURIComponent(program.id || slugify(name))}`,
      };
    });
  }

  function scholarshipDisplayGuide(item = {}) {
    const deadline = item.deadlineLabel || item.deadline || item.deadlineDate || "Deadline pending";
    const benefits = item.benefitItems?.length ? item.benefitItems : item.benefits?.length ? item.benefits.map((label) => ({ label, included: true })) : [];
    const materials = item.applicationMaterials?.length ? item.applicationMaterials : ["Scholarship form", "Transcript or study record", "Passport copy"];
    const steps = item.applicationSteps?.length ? item.applicationSteps : [
      "Match this funding route to concrete programs.",
      "Check the current notice and school deadline.",
      "Prepare documents only when the school or notice asks for them.",
    ];
    const officialCards = [
      {
        title: "Deadline and route fit",
        body: "Check the intake, degree level, and program scope before preparing funding materials.",
      },
      {
        title: "Contact channel",
        body: sourceDisplayValue(item.contactInfo, item.providerName || item.schoolName || "Use the school or scholarship provider contact channel."),
      },
      ...scholarshipListCards(item.actionLinks, [], "Use this link only after checking degree and program fit.").slice(0, 3),
    ];
    const primaryAction = Array.isArray(item.actionLinks) ? (item.actionLinks.find((link) => link.kind === "primary") || item.actionLinks[0]) : null;
    const sourceAction = Array.isArray(item.actionLinks) ? item.actionLinks.find((link) => link.kind === "source") : null;
    const contactInfo = item.contactInfo && typeof item.contactInfo === "object" && !Array.isArray(item.contactInfo) ? item.contactInfo : {};
    const contactRows = [
      contactInfo.name ? { label: contactInfo.label || "Contact", value: contactInfo.name } : null,
      contactInfo.email ? { label: "Email", value: contactInfo.email, href: `mailto:${contactInfo.email}` } : null,
      contactInfo.phone ? { label: "Phone", value: contactInfo.phone } : null,
      contactInfo.website ? { label: "Website", value: contactInfo.website, href: contactInfo.website } : null,
      contactInfo.address ? { label: "Address", value: contactInfo.address } : null,
      contactInfo.note ? { label: "Note", value: contactInfo.note } : null,
    ].filter(Boolean);
    const actionCards = Array.isArray(item.actionLinks)
      ? item.actionLinks.map((link) => ({
          title: link.label || link.title || "Scholarship link",
          body: link.kind === "source" ? "Scholarship notice" : link.kind === "exam" ? "Readiness check" : "Related action",
          href: link.url || link.href || "",
        })).filter((link) => link.title || link.href)
      : [];
    return {
      fieldSummary: [
        { label: "Provider", value: item.providerNameEn || item.providerName || item.schoolName || item.school || "Multiple universities" },
        { label: "Route type", value: item.typeLabel || titleCase(item.type || "Scholarship") },
        { label: "Funding level", value: titleCase(item.fundingLevel || item.funding || "Confirm") },
        { label: "Degree fit", value: item.applicableDegree || item.degree || "All levels" },
        { label: "Deadline", value: deadline },
        { label: "Country scope", value: sourceDisplayValue(item.targetCountries, item.targetRegions?.length ? sourceDisplayValue(item.targetRegions) : "Check notice") },
      ],
      coverageCards: scholarshipListCards(benefits, item.coverage ? String(item.coverage).split(/,\s*|、/) : [], "Included or partially covered depending on the notice."),
      eligibilityCards: scholarshipListCards(item.eligibilityItems, [item.requirementText || "Eligibility depends on degree, program, nationality, and the current scholarship route."], "Use this as an initial fit check before preparing documents."),
      materialCards: scholarshipListCards(materials, [], "Prepare only after the school or scholarship route asks for it."),
      stepCards: scholarshipListCards(steps, [], "Do this after matching the scholarship to a real school-program route."),
      noticeSections: scholarshipNoticeSections(item),
      officialNoticeSections: splitScholarshipOfficialNotice(item.requirementText || ""),
      officialCards,
      contactRows,
      actionCards,
      schoolCards: scholarshipSchoolCards(item),
      programCards: scholarshipProgramCards(item),
      sidebarCards: [
        { title: "Apply window", body: item.applicationRound || deadline },
        { title: "Scope", body: [item.applicableDegree || item.degree || "All levels", item.applicableProgram || "Program fit varies", sourceDisplayValue(item.targetCountries, item.targetRegions?.length ? sourceDisplayValue(item.targetRegions) : "")].filter(Boolean).join(" · ") },
        { title: "Planning link", body: item.sourceLabel || (item.sourceUrl ? "Scholarship notice" : "Confirm with school") },
      ],
      primaryAction: primaryAction ? {
        label: primaryAction.label || primaryAction.title || "Open scholarship route",
        href: primaryAction.url || primaryAction.href || item.sourceUrl || "scholarships.html",
      } : null,
      sourceAction: sourceAction || item.sourceUrl ? {
        label: sourceAction?.label && !/source/i.test(sourceAction.label) ? sourceAction.label : "Open official notice",
        href: sourceAction?.url || sourceAction?.href || item.sourceUrl || "",
      } : null,
      sourceNote: "Use this as planning information, then connect it to a concrete school and program.",
    };
  }

  function cityProfileSections(city = {}) {
    const monthly = cityMonthlyValue(city);
    const content = cityContent(city);
    const budget = cityBudgetSummary(city);
    const costBreakdown = cityCostBreakdownItems(city);
    const costRows = costBreakdown.length
      ? costBreakdown.map((item) => [item.label, item.value])
      : [["Housing and meals", "Confirm with school and city guide"], ["Transport", "Confirm campus location first"]];
    const bestFor = cityReadableList(content.bestFor || city.bestFor || city.tags);
    const representative = city.representative || city.representativeSchoolNames || [];
    const lifeRows = cityLifeNotes(city).map((item, index) => splitCityGuidanceRow(item, [
      "Campus and commute",
      "Study environment",
      "Daily adaptation",
      "Arrival planning",
    ][index] || "Student note"));
    const transportRows = cityTransportNotesDisplay(city).map((item) => [item.title, item.body]);
    const adviceRows = cityApplicationAdviceItems(city).map((item, index) => splitCityGuidanceRow(item, [
      "Start with real schools",
      "Compare full cost",
      "Leave time for requirements",
    ][index] || "Application note"));
    const faqRows = cityFaqItems(city).map((item) => [item.question, item.answer]);
    return userDetailSections([
      {
        title: "At a glance",
        summary: "A quick city read before comparing individual universities and programs.",
        rows: [
          ["Chinese name", city.nameZh || cityChineseName(city.slug || city.nameEn)],
          ["Region", city.region || city.province],
          ["Cost level", city.costLevel],
          ["City pace", city.pace || city.density],
          ["Best first read", content.summary || city.summary],
        ],
      },
      {
        title: "Student fit",
        summary: "Use this to judge whether the city's rhythm and opportunity mix fit the student.",
        rows: [
          ["Good fit for", bestFor],
          ["Language environment", city.language],
          ["Industry context", city.industry],
          ["Watch before choosing", content.overview || city.summary],
        ],
      },
      {
        title: "Budget planning",
        summary: "Living cost is an estimate; housing and campus location usually create the biggest difference.",
        rows: [
          ["Monthly budget", budget.monthly || (monthly ? `RMB ${monthly.toLocaleString("en-US")}` : "")],
          ["Yearly planning range", budget.yearly],
          ["Budget note", budget.note],
          ...costRows,
        ],
      },
      {
        title: "Schools and programs",
        summary: "City choice should stay connected to real schools, English routes, and scholarship options.",
        rows: [
          ["Available schools", city.referenceSchoolCount ?? city.universities],
          ["Program routes", city.referenceProgramCount ?? city.programs],
          ["English-taught programs", city.referenceEnglishProgramCount ?? city.englishRoutes],
          ["Scholarship routes", city.referenceScholarshipCount ?? city.scholarships],
          ["CSCA-related schools", city.referenceCscaSchoolCount ?? city.cscaRequiredSchoolCount],
          ["Recommended program directions", cityProgramKeywords(city)],
          ["Current school options", city.actualSchoolCount ?? city.aggregate?.actualSchoolCount],
          ["Current program routes", city.actualProgramCount ?? city.aggregate?.actualProgramCount],
          ["Current English-taught routes", city.actualEnglishProgramCount ?? city.aggregate?.actualEnglishProgramCount],
          ["Current scholarship routes", city.actualScholarshipCount ?? city.aggregate?.actualScholarshipCount],
          ["Current CSCA-related schools", city.actualCscaRequiredSchoolCount ?? city.aggregate?.actualCscaRequiredSchoolCount],
          ["Representative schools", representative],
        ],
      },
      {
        title: "Life and arrival",
        summary: "Practical context for campus location, commute, climate, and first-month adjustment.",
        rows: [...lifeRows, ...transportRows],
      },
      {
        title: "Application planning",
        summary: "A city is useful only after it is tied to concrete school and program choices.",
        rows: adviceRows,
      },
      {
        title: "Common questions",
        summary: "Quick answers students normally need before saving a city.",
        rows: faqRows,
      },
    ]);
  }

  function programDecisionPanels(program = {}, deadline = "Deadline pending") {
    return [
      {
        title: "Program fit",
        value: program.degreeLevel || program.degree || "Confirm",
        body: [program.fieldCategory || program.subject, program.durationYears || program.duration, program.city].filter(Boolean).join(" · "),
      },
      {
        title: "Language route",
        value: program.teachingLanguage || program.language || "Confirm",
        body: program.englishRequirement || program.hskRequirement || program.langReq || "Check language proof or waiver.",
      },
      {
        title: "Cost planning",
        value: program.tuitionText || rmbLabel(program.tuitionAmount ?? program.tuition),
        body: program.scholarshipText || program.scholarshipType || "Confirm scholarship route separately.",
      },
      {
        title: "Timing",
        value: deadline,
        body: program.applicationRound || program.intake || "Confirm current application round.",
      },
    ];
  }

  function schoolDecisionPanels(school = {}, sourceStatus = "Application review") {
    const nextDeadline = school.round1Deadline || school.round2Deadline || school.deadlineSummary || "Confirm";
    return [
      {
        title: "Can I apply?",
        value: sourceDisplayValue(school.applicationLevel || school.admissionLevel),
        body: school.cscaRequired ? school.cscaRequirement : "Choose a concrete program, then confirm school/program requirements.",
      },
      {
        title: "Language route",
        value: sourceDisplayValue(school.languageOfInstruction),
        body: [school.hskRequirement, school.englishRequirement].filter(Boolean).join(" · ") || "Confirm by program.",
      },
      {
        title: "Cost range",
        value: school.tuitionSummary || "Confirm",
        body: [school.applicationFee, school.insurance, school.accommodationCost].filter(Boolean).join(" · "),
      },
      {
        title: "Next timing",
        value: nextDeadline,
        body: "Use this for planning, then confirm the exact program deadline before submitting.",
      },
    ];
  }

  function scholarshipDecisionPanels(item = {}, sourceStatus = "Deadline planning") {
    return [
      {
        title: "Funding level",
        value: item.fundingLevel || item.funding || "Confirm",
        body: item.coverage || item.amountText || "Check what the funding may cover before relying on it.",
      },
      {
        title: "Who can use it?",
        value: item.applicableDegree || item.degree || "Confirm",
        body: [item.applicableProgram, sourceDisplayValue(item.targetCountries, "")].filter(Boolean).join(" · ") || "Check degree, program, and country scope.",
      },
      {
        title: "Application effort",
        value: item.applicationRound || "Confirm round",
        body: sourceDisplayValue(item.applicationMaterials, "Check materials and steps after matching a real program."),
      },
      {
        title: "Timing",
        value: item.deadlineLabel || item.deadline || item.deadlineDate || "Pending",
        body: "Funding timing can differ from program admission timing, so keep a non-scholarship backup route.",
      },
    ];
  }

  function cityDecisionPanels(city = {}) {
    const monthly = cityMonthlyValue(city);
    const budget = cityBudgetSummary(city);
    return [
      {
        title: "Monthly budget",
        value: monthly ? `RMB ${monthly.toLocaleString("en-US")}` : "Pending",
        body: budget.note || `${sourceDisplayValue(city.costLevel, "Cost level pending")} cost level. Confirm actual housing and campus location.`,
      },
      {
        title: "Schools and programs",
        value: String(city.referenceProgramCount ?? city.programs ?? 0),
        body: `${city.referenceSchoolCount ?? city.universities ?? 0} schools · ${city.referenceEnglishProgramCount ?? city.englishRoutes ?? 0} English routes`,
      },
      {
        title: "Funding options",
        value: String(city.referenceScholarshipCount ?? city.scholarships ?? 0),
        body: `${city.referenceCscaSchoolCount ?? 0} CSCA-linked school routes. Confirm by school/program.`,
      },
      {
        title: "City fit",
        value: city.density || city.pace || "Compare",
        body: cityReadableList(city.bestFor || city.content?.bestFor || city.tags, "Balance city fit with program fit."),
      },
    ];
  }

  function buildProgramCompletionDetail(program) {
    if (!program) return null;
    program = enrichProgramScholarshipContext(program);
    const applicationReadiness = program.source === "verified" || program.isVerified ? "Application ready" : "Review before applying";
    const deadline = program.deadlineLabel || program.deadline || program.deadlineDate || "Deadline pending";
    const schoolNameEn = program.schoolNameEn || program.university || "Confirm";
    const schoolNameZh = program.schoolNameZh || program.school?.nameZh || "";
    const schoolNameFacts = [["University", schoolNameEn]];
    if (schoolNameZh && schoolNameZh !== schoolNameEn) schoolNameFacts.push(["Chinese school name", schoolNameZh]);
    return {
      entityType: "Program",
      entityId: program.id,
      schoolId: program.schoolId,
      programId: program.programId || program.id,
      schoolNameEn,
      schoolNameZh,
      degreeLevel: program.degreeLevel || program.degree || "",
      fieldCategory: program.fieldCategory || program.subject || "",
      applicationRound: program.applicationRound || program.intake || "",
      teachingLanguage: program.teachingLanguage || program.language || "",
      sourceFieldLineage: program.sourceFieldLineage || sourceFieldLineage("SchoolProgram", "Program"),
      title: program.nameEn || program.name || "Program route",
      city: [program.city, program.province].filter(Boolean).join(", ") || "China",
      image: program.image || "https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?auto=format&fit=crop&w=900&q=80",
      summary: program.fit || `${program.schoolNameEn || program.university || "School"} route with ${program.applicationRound || program.intake || "current intake"} timing, ${program.teachingLanguage || program.language || "teaching language"} requirements, and application planning details.`,
      status: [applicationReadiness, deadline, program.scholarshipText || program.scholarshipType || program.readiness || "Route review"],
      decisionPanels: programDecisionPanels(program, deadline),
      metrics: [[program.durationYears || program.duration || "Confirm", "duration"], [rmbLabel(program.tuitionAmount ?? program.tuition), "tuition / year"], [program.teachingLanguage || program.language || "Confirm", "teaching"], [deadline, "deadline"]],
      facts: [...schoolNameFacts, ["Degree level", program.degreeLevel || program.degree || "Confirm"], ["Subject area", program.fieldCategory || program.subject || "Confirm"], ["Intake", program.applicationRound || program.intake || "Confirm"], ["Language requirement", program.englishRequirement || program.hskRequirement || program.langReq || "Confirm"], ["Scholarship route", program.scholarshipText || program.scholarshipType || "Confirm"], ["Application entry", program.applicationUrl || "Confirm"], ["Application page", applicationReadiness]],
      hideSnapshot: true,
      profileTitle: "Program information",
      profileSections: programProfileSections(program),
      programGuide: programDisplayGuide(program),
      schemaTitle: "Program information guide",
      schemaSections: programSourceSections(program),
      routes: [["University profile", "Review the school context before adding the route.", `university-detail.html?university=${slugify(program.university || program.schoolNameEn || "")}`], ["Add to application", "Use this exact school and program as a CUAC choice.", `application.html#add-choice`]],
      checklist: compactList(["Confirm official deadline against the university page", program.langReq ? `Prepare ${program.langReq}` : "Check language requirements", program.scholarship ? "Review scholarship timing" : "Confirm self-funded route", "Keep passport and transcript readiness visible for school follow-up"]),
      timeline: ["Now: review route facts", "Next: add concrete school + program choice", "Before send: confirm contact and study profile", "After send: school contacts student directly for official materials"],
    };
  }

  function buildSchoolCompletionDetail(school) {
    if (!school) return null;
    const applicationReadiness = school.isVerified || school.verified ? "Application ready" : "Review before applying";
    const quickFacts = school.quickFacts || {};
    const detailDisplay = school.detailDisplay || {};
    const city = detailDisplay.city || quickFacts.location || school.city || school.cityZh || "";
    const admissionsUrl = school.applicationSystemUrl || school.admissionsWebsiteUrl || "Confirm from school source";
    return {
      entityType: "School",
      entityId: school.id || school.sourceId,
      schoolId: school.id,
      sourceFieldLineage: school.sourceFieldLineage || sourceFieldLineage("School", "School"),
      title: school.nameEn || school.name || "University profile",
      city: [city, school.region || school.province].filter(Boolean).join(", ") || "China",
      image: school.image || "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=900&q=80",
      summary: school.decisionSummary || school.note || `${school.nameEn || school.name} profile with program, language, tuition, scholarship, and application planning context.`,
      status: [applicationReadiness, school.hasEnglishPrograms || school.routes ? "English-taught routes" : "Language check needed", school.hasScholarships || school.scholarship ? "Scholarship options" : "Funding check"],
      decisionPanels: schoolDecisionPanels(school, applicationReadiness),
      metrics: [[school.rank ? `#${school.rank}` : "Confirm", "rank cue"], [city || "City", "city"], [String(school.englishProgramCount || school.routes || 0), "English routes"], [school.tuitionSummary || school.tuition || "Confirm", "tuition band"]],
      facts: [["Chinese name", school.nameZh || "Confirm"], ["Location", [city, school.region || school.province].filter(Boolean).join(", ") || "Confirm"], ["Application levels", sourceDisplayValue(school.applicationLevel || school.admissionLevel)], ["Language route", sourceDisplayValue(school.languageOfInstruction)], ["Tuition", school.tuitionSummary || school.tuition || "Confirm"], ["Next deadline", school.round1Deadline || school.round2Deadline || school.deadlineSummary || "Confirm"]],
      hideSnapshot: true,
      profileTitle: "University information",
      profileSections: schoolProfileSections(school),
      schoolGuide: schoolDisplayGuide(school),
      schemaTitle: "University information guide",
      schemaSections: schoolSourceSections(school),
      routes: [["Programs at this university", "Open programs filtered to this university.", `programs.html?university=${slugify(school.nameEn || school.name || "")}`], ["City context", "Review cost and arrival implications.", `city-detail.html?city=${slugify(city)}`]],
      checklist: ["Choose a concrete program before applying", "Review deadlines and language requirements", "Check scholarship route realism", "Remember: school staff sees only this school's CUAC record"],
      timeline: ["Student saves or compares the school", "Student adds a concrete program choice", "CUAC sends school-only record after confirmation", "School staff follow up directly"],
    };
  }

  function buildScholarshipCompletionDetail(item) {
    if (!item) return null;
    const sourceStatus = item.deadlineLabel || item.deadline || item.deadlineDate ? "Deadline planning" : "Funding route";
    return {
      entityType: "PublicScholarship",
      entityId: item.slug || item.id,
      sourceFieldLineage: item.sourceFieldLineage || sourceFieldLineage("Scholarship", "Scholarship"),
      title: item.title || item.name || "Scholarship route",
      city: item.providerLocation || item.schoolName || item.school || "Funding route",
      image: "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=900&q=80",
      summary: item.summary || `${item.typeLabel || "Scholarship"} route with ${item.fundingLevel || item.funding || "funding"} coverage and program-specific eligibility checks.`,
      status: [item.typeLabel || "Scholarship", item.fundingLevel || item.funding || "Funding route", item.deadlineLabel || item.deadline || "Deadline pending"],
      decisionPanels: scholarshipDecisionPanels(item, sourceStatus),
      metrics: [[item.fundingLevel || item.funding || "Confirm", "funding"], [item.applicableDegree || item.degree || "All levels", "degree"], [item.deadlineLabel || item.deadline || "Pending", "deadline"], [item.providerName || item.schoolName || item.school || "Multiple universities", "provider"]],
      facts: [["Provider", item.providerName || item.schoolName || item.school || "Multiple universities"], ["Coverage", item.coverage || "Confirm by notice"], ["Eligibility", item.requirementText || "Confirm official rules"], ["Degree", item.applicableDegree || item.degree || "Confirm"], ["Deadline timing", item.deadlineLabel || item.deadlineDate || sourceStatus], ["Guarantee", "Never guaranteed"]],
      hideSnapshot: true,
      profileTitle: "Scholarship information",
      profileSections: scholarshipProfileSections(item),
      scholarshipGuide: scholarshipDisplayGuide(item),
      schemaTitle: "Scholarship information guide",
      schemaSections: scholarshipSourceSections(item),
      routes: [["Find programs", "Find programs where this funding route can matter.", `programs.html?scholarship=${encodeURIComponent(item.slug || item.id || "true")}`], ["Scholarship browser", "Compare with other funding routes.", "scholarships.html"]],
      checklist: ["Degree + program fit", "Study plan ready", "Funding deadline", "Backup route"],
      timeline: ["Shortlist route", "Match programs", "Add choices", "School follow-up"],
    };
  }

  function buildCityCompletionDetail(city) {
    if (!city) return null;
    const monthly = city.monthlyCost || city.monthlyCostRmb;
    return {
      entityType: "City",
      entityId: city.slug || city.id,
      sourceFieldLineage: city.sourceFieldLineage || sourceFieldLineage("CityGuide", "City"),
      title: city.nameEn || city.name || "City guide",
      city: city.region || city.province || "China",
      image: city.image || "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80",
      summary: city.summary || city.content?.summary || "City profile with cost, university density, English-taught routes, scholarships, and arrival fit context.",
      status: ["City guide", city.costLevel ? `${city.costLevel} cost` : "Cost check", city.density || city.pace || "Student route"],
      decisionPanels: cityDecisionPanels(city),
      metrics: [[monthly ? `RMB ${monthly.toLocaleString("en-US")}` : "Pending", "monthly estimate"], [String(city.referenceProgramCount || city.programs || 0), "programs"], [String(city.referenceEnglishProgramCount || city.englishRoutes || 0), "English routes"], [String(city.referenceScholarshipCount || city.scholarships || 0), "funding routes"]],
      facts: [["Province", city.province || city.region || "Confirm"], ["Best for", compactList(city.bestFor || city.content?.bestFor || []).join(", ") || "Compare route fit"], ["Industry", city.industry || "Confirm locally"], ["Climate", city.climate || "Confirm"], ["Pace", city.pace || city.density || "Confirm"], ["Budget", city.content?.budgetSummary?.monthly || (monthly ? `RMB ${monthly.toLocaleString("en-US")}` : "Pending")]],
      hideSnapshot: true,
      profileTitle: "City information",
      profileSections: cityProfileSections(city),
      cityGuide: cityDisplayGuide(city),
      schemaTitle: "City information guide",
      schemaSections: citySourceSections(city),
      routes: [["Programs in city", "Open city-filtered program results.", `programs.html?city=${city.id || city.slug}`], ["Universities in city", "Review school options in this city.", `universities.html?city=${city.id || city.slug}`]],
      checklist: ["Compare tuition plus monthly cost", "Check campus location", "Review deadline pressure", "Balance city fit with program fit"],
      timeline: ["Pick city preference", "Compare matching programs", "Add concrete school route", "Prepare arrival and school follow-up"],
    };
  }

  function buildGuideCompletionDetail(guide) {
    if (!guide) return null;
    return {
      entityType: "ContentDiscovery",
      entityId: guide.metadata?.category || slugify(guide.title || guide.href || "guide"),
      sourceFieldLineage: guide.sourceFieldLineage || {
        sourceModel: "PublicContentBlock + SearchItem",
        sourceFields: legacyFieldContracts.sourceModelFields.PublicContentBlock.concat(legacyFieldContracts.sourceModelFields.SearchItem),
        displayAliases: {
          title: "PublicContentBlock.title",
          subtitle: "PublicContentBlock.subtitle",
          snippet: "SearchItem.snippet",
          href: "SearchItem.href",
          metadata: "SearchItem.metadata",
        },
      },
      title: guide.title || "CUAC guide",
      city: guide.subtitle || "Student guide",
      image: "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=900&q=80",
      summary: guide.snippet || "Focused guide for understanding what CUAC tracks, what schools request directly, and which next action keeps the application moving.",
      status: ["Guide", guide.metadata?.status || "Published", guide.metadata?.category || "Checklist"],
      metrics: [[guide.metadata?.category || "Guide", "topic"], [String(guide.score || 80), "relevance"], ["No upload", "MVP boundary"], ["School follow-up", "next step"]],
      facts: [["Topic", guide.subtitle || guide.title || "Guide"], ["CUAC role", "Organizes application information"], ["School role", "Requests official materials"], ["Student role", "Prepares and verifies"], ["Guide status", guide.metadata?.status || "Published"], ["Agent", "Can summarize next step"]],
      schemaTitle: "Guide information source",
      schemaSections: [
        {
          title: "Content source",
          rows: [
            ["Title", guide.title || "CUAC guide"],
            ["Subtitle", guide.subtitle || "Student guide"],
            ["Guide body", guide.snippet || "Focused guide"],
            ["Updated", guide.updatedAt || "Static preview"],
          ],
        },
        {
          title: "Discovery reference",
          rows: [
            ["Type", guide.type || "content"],
            ["Relevance", String(guide.score || 80)],
            ["Link", guide.href || "guides.html"],
            ["Category", guide.metadata?.category || "guide"],
          ],
        },
      ],
      routes: [["Open related guide", "Return to the relevant guide section.", guide.href || "guides.html"], ["Open application", "Review what schools receive first.", "application.html#info"]],
      checklist: ["Read the relevant step", "Confirm which school/program it affects", "Review the route-specific summary in Hub", "Review official pages before acting"],
      timeline: ["Read guide", "Apply it to saved route", "Add or review application choice", "School follows up after CUAC send"],
    };
  }

  function buildDynamicCompletionDetail(mode, slug) {
    if (mode === "program") {
      return buildProgramCompletionDetail(getDiscoveryPrograms().find((item) => matchesDetailSlug(item, slug, ["id", "name", "nameEn"])));
    }
    if (mode === "university") {
      return buildSchoolCompletionDetail(getDiscoverySchools().find((item) => matchesDetailSlug(item, slug, ["id", "sourceId", "name", "nameEn", "nameZh"])));
    }
    if (mode === "scholarship") {
      return buildScholarshipCompletionDetail(getDiscoveryScholarships().find((item) => matchesDetailSlug(item, slug, ["id", "slug", "title", "name"])));
    }
    if (mode === "city") {
      return buildCityCompletionDetail(getDiscoveryCities().find((item) => matchesDetailSlug(item, slug, ["id", "slug", "name", "nameEn"])));
    }
    if (mode === "guide") {
      return buildGuideCompletionDetail(getDiscoveryGuides().find((item) => matchesDetailSlug({ ...item, category: item.metadata?.category }, slug, ["category", "title", "href"])));
    }
    return null;
  }

  function normalizeCompletionDetail(mode, slug, detail, dynamicDetail = null) {
    if (!detail) return null;
    const fallbackLineage = {
      program: sourceFieldLineage("SchoolProgram", "Program"),
      university: sourceFieldLineage("School", "School"),
      scholarship: sourceFieldLineage("Scholarship", "Scholarship"),
      city: sourceFieldLineage("CityGuide", "City"),
      guide: {
        sourceModel: "PublicContentBlock + SearchItem",
        sourceFields: legacyFieldContracts.sourceModelFields.PublicContentBlock.concat(legacyFieldContracts.sourceModelFields.SearchItem),
        displayAliases: {
          title: "PublicContentBlock.title",
          subtitle: "PublicContentBlock.subtitle",
          snippet: "SearchItem.snippet",
          href: "SearchItem.href",
          metadata: "SearchItem.metadata",
        },
      },
    }[mode] || null;
    const fallbackType = {
      program: "Program",
      university: "School",
      scholarship: "PublicScholarship",
      city: "City",
      guide: "ContentDiscovery",
    }[mode] || mode;
    const sourceBackedFields = Array.isArray(dynamicDetail?.schemaSections) && dynamicDetail.schemaSections.length > 0;
    return {
      ...(dynamicDetail || {}),
      ...detail,
      entityType: detail.entityType || dynamicDetail?.entityType || fallbackType,
      entityId: detail.entityId || dynamicDetail?.entityId || detail.id || slug || detail.title,
      schoolId: detail.schoolId || dynamicDetail?.schoolId,
      programId: detail.programId || dynamicDetail?.programId,
      metrics: sourceBackedFields ? dynamicDetail.metrics : detail.metrics || dynamicDetail?.metrics,
      facts: sourceBackedFields ? dynamicDetail.facts : detail.facts || dynamicDetail?.facts,
      decisionPanels: sourceBackedFields ? dynamicDetail.decisionPanels : detail.decisionPanels || dynamicDetail?.decisionPanels,
      hideSnapshot: sourceBackedFields ? dynamicDetail.hideSnapshot : detail.hideSnapshot || dynamicDetail?.hideSnapshot,
      profileTitle: sourceBackedFields ? dynamicDetail.profileTitle : detail.profileTitle || dynamicDetail?.profileTitle,
      profileSections: sourceBackedFields ? dynamicDetail.profileSections : detail.profileSections || dynamicDetail?.profileSections,
      cityGuide: sourceBackedFields ? dynamicDetail.cityGuide : detail.cityGuide || dynamicDetail?.cityGuide,
      schemaTitle: dynamicDetail?.schemaTitle || detail.schemaTitle,
      schemaSections: dynamicDetail?.schemaSections || detail.schemaSections,
      sourceFieldLineage: detail.sourceFieldLineage || dynamicDetail?.sourceFieldLineage || fallbackLineage,
    };
  }

  function getCompletionDetail(mode, slug) {
    const collectionKey = {
      program: "programs",
      university: "universities",
      scholarship: "scholarships",
      city: "cities",
      guide: "guides",
    }[mode];
    if (!collectionKey) return null;
    const defaults = { scholarship: "csc", guide: "documents" };
    const collection = completionDetailCatalog[collectionKey] || {};
    const dynamicDetail = buildDynamicCompletionDetail(mode, slug);
    const detail = collection[slug] || dynamicDetail || collection[defaults[mode]] || null;
    return clone(normalizeCompletionDetail(mode, slug, detail, dynamicDetail));
  }

  function deriveSchoolPriority(route, student = defaultStudentProfile) {
    const funding = String(student.fundingIntent || "").toLowerCase();
    const signal = String(route.signal || "").toLowerCase();
    const deadline = String(route.deadline || "").toLowerCase();
    if (signal.includes("csc") || funding.includes("scholarship")) return "High";
    if (deadline.includes("sep") || signal.includes("selective")) return "High";
    return "Normal";
  }

  function priorityRankValue(priority) {
    return { High: 0, Normal: 1, Low: 2 }[priority] ?? 1;
  }

  function calculateFee(routes = defaultApplicationRoutes) {
    const schools = [...new Set(routes.map((route) => route.university).filter(Boolean))];
    const paidSchools = Math.max(0, schools.length - 1);
    return {
      routes: clone(routes),
      schools,
      schoolCount: schools.length,
      paidSchools,
      extraSchoolFee: config.extraSchoolFeeUsd,
      total: paidSchools * config.extraSchoolFeeUsd,
    };
  }

  function formatFee(amount) {
    return amount ? `USD ${amount}` : "USD 0";
  }

  function buildSubmittedRecords({ routes = defaultApplicationRoutes, student = defaultStudentProfile, submittedAt = new Date().toISOString() } = {}) {
    const grouped = new Map();
    routes.forEach((route, index) => {
      const handoff = buildChoiceHandoffSnapshot(route, student, index);
      const programRecord = handoff.fromProgramRecord;
      const schoolRecord = handoff.fromSchoolRecord;
      const scholarshipRecords = handoff.fromSchoolScholarshipRecords || [];
      const interest = {
        id: handoff.recordId,
        schoolId: handoff.selectedByStudent.schoolId,
        programId: handoff.selectedByStudent.programId,
        programName: route.programName || programRecord.fieldCategory || programRecord.nameEn,
        programFullName: programRecord.nameEn,
        degree: route.degree || programRecord.degreeLevel,
        degreeLevel: programRecord.degreeLevel,
        durationYears: programRecord.durationYears,
        fieldCategory: programRecord.fieldCategory,
        intake: handoff.selectedByStudent.intake,
        teachingLanguage: handoff.selectedByStudent.teachingLanguage,
        languageRoute: handoff.selectedByStudent.teachingLanguage,
        cscaSubjects: programRecord.cscaSubjects,
        cscaRequirement: programRecord.cscaRequirement,
        hskRequirement: programRecord.hskRequirement,
        englishRequirement: programRecord.englishRequirement,
        city: route.city || schoolRecord.cityZh,
        deadline: programRecord.deadlineLabel || route.deadline,
        deadlineDate: programRecord.deadlineDate,
        tuition: programRecord.tuitionText,
        applicationRound: programRecord.applicationRound,
        applicationUrl: programRecord.applicationUrl,
        applicationNote: programRecord.applicationNote,
        studentChoiceNote: handoff.selectedByStudent.studentChoiceNote,
        fit: route.signal || programRecord.scholarshipText || "Selected by student",
        sourceUrl: programRecord.sourceUrl,
        sourceLabel: programRecord.sourceLabel,
        lastVerifiedAt: programRecord.lastVerifiedAt,
        scholarshipSignals: scholarshipRecords,
        informationSources: handoff,
        sourceFieldLineage: handoff.sourceFieldLineage,
        notCollectedByCuac: handoff.notCollectedByCuac,
      };
      const key = schoolRecord.nameEn;
      if (!grouped.has(key)) {
        grouped.set(key, {
          id: `${slugify(schoolRecord.nameEn)}-${submittedAt.slice(0, 10)}`,
          schoolId: handoff.selectedByStudent.schoolId,
          programId: handoff.selectedByStudent.programId,
          school: schoolRecord.nameEn,
          name: student.fullName,
          status: "New",
          source: "Live CUAC submission",
          country: student.country,
          countryCode: student.countryCode,
          nationality: student.nationality || student.passportNationality,
          nationalityCode: student.nationalityCode,
          passportNationality: student.passportNationality,
          email: student.email,
          phone: student.phone,
          stage: student.educationStage,
          grade: student.grade || student.educationStage,
          gradeCode: student.gradeCode,
          currentSchool: student.currentSchool,
          currentOrganizationId: student.currentOrganizationId,
          intendedLevel: student.intendedLevel,
          funding: student.fundingIntent,
          language: student.languageStatus,
          guardianStatus: student.guardianStatus,
          academicSummary: student.academicSummary,
          studentProfileUpdatedAt: student.updatedAt,
          owner: "International Office",
          priority: "Normal",
          receivedAt: submittedAt,
          due: "Due: today",
          nextAction: "Contact student and request the school document checklist directly.",
          timeline: ["CUAC application record submitted", `Routed to ${schoolRecord.nameEn} tenant scope`, "First contact not started"],
          programInterests: [],
          scholarshipSignals: [],
          notCollectedByCuac: handoff.notCollectedByCuac,
          sourceFieldLineage: handoff.sourceFieldLineage,
          informationSources: handoff,
        });
      }
      const record = grouped.get(key);
      record.programInterests.push(interest);
      record.scholarshipSignals.push(...scholarshipRecords);
      record.priority = priorityRankValue(deriveSchoolPriority(route, student)) < priorityRankValue(record.priority)
        ? deriveSchoolPriority(route, student)
        : record.priority;
    });
    return [...grouped.values()].map((record) => {
      const primary = record.programInterests[0];
      const notes = record.programInterests.map((interest) => interest.studentChoiceNote).filter(Boolean);
      return {
        ...record,
        programId: primary.programId,
        programName: primary.programName,
        programFullName: primary.programFullName,
        degree: primary.degree,
        degreeLevel: primary.degreeLevel,
        durationYears: primary.durationYears,
        fieldCategory: primary.fieldCategory,
        intake: primary.intake,
        teachingLanguage: primary.teachingLanguage,
        languageRoute: primary.languageRoute,
        cscaSubjects: primary.cscaSubjects,
        cscaRequirement: primary.cscaRequirement,
        hskRequirement: primary.hskRequirement,
        englishRequirement: primary.englishRequirement,
        city: primary.city,
        deadline: primary.deadline,
        deadlineDate: primary.deadlineDate,
        tuition: primary.tuition,
        applicationRound: primary.applicationRound,
        applicationUrl: primary.applicationUrl,
        applicationNote: primary.applicationNote,
        studentChoiceNote: primary.studentChoiceNote,
        fit: primary.fit,
        sourceUrl: primary.sourceUrl,
        sourceLabel: primary.sourceLabel,
        lastVerifiedAt: primary.lastVerifiedAt,
        schoolScholarshipSummary: record.scholarshipSignals.length
          ? record.scholarshipSignals.map((item) => item.name).join("; ")
          : "No school-specific scholarship record attached",
        programInterestSummary: `${record.programInterests.length} program interest${record.programInterests.length === 1 ? "" : "s"}`,
        note: [...notes, student.readinessNote].filter(Boolean).join(" "),
      };
    });
  }

  function normalizeSchoolRecord(record = {}, index = 0, schoolName = config.defaultSchoolTenant) {
    const programInterests = Array.isArray(record.programInterests) && record.programInterests.length
      ? clone(record.programInterests)
      : [{
        programId: record.programId || record.informationSources?.selectedByStudent?.programId || "",
        programName: record.programName || "Selected program",
        programFullName: record.programFullName || record.informationSources?.fromProgramRecord?.nameEn || record.programName || "Selected program",
        degree: record.degree || record.degreeLevel || "Route",
        degreeLevel: record.degreeLevel || record.degree || "Route",
        durationYears: record.durationYears || record.informationSources?.fromProgramRecord?.durationYears || "",
        fieldCategory: record.fieldCategory || record.informationSources?.fromProgramRecord?.fieldCategory || "",
        intake: record.intake || "Fall 2026",
        teachingLanguage: record.teachingLanguage || record.languageRoute || "English-taught",
        languageRoute: record.languageRoute || record.teachingLanguage || "English-taught",
        cscaSubjects: record.cscaSubjects || record.informationSources?.fromProgramRecord?.cscaSubjects || [],
        cscaRequirement: record.cscaRequirement || record.informationSources?.fromProgramRecord?.cscaRequirement || "",
        hskRequirement: record.hskRequirement || record.informationSources?.fromProgramRecord?.hskRequirement || "",
        englishRequirement: record.englishRequirement || record.informationSources?.fromProgramRecord?.englishRequirement || "",
        deadline: record.deadline || "School to confirm",
        deadlineDate: record.deadlineDate || record.informationSources?.fromProgramRecord?.deadlineDate || "",
        tuition: record.tuition || record.informationSources?.fromProgramRecord?.tuitionText || "",
        applicationRound: record.applicationRound || record.informationSources?.fromProgramRecord?.applicationRound || "",
        applicationUrl: record.applicationUrl || record.informationSources?.fromProgramRecord?.applicationUrl || "",
        applicationNote: record.applicationNote || record.informationSources?.fromProgramRecord?.applicationNote || "",
        studentChoiceNote: record.studentChoiceNote || record.informationSources?.selectedByStudent?.studentChoiceNote || "",
        informationSources: record.informationSources || null,
      }];
    return {
      ...record,
      school: schoolName,
      name: record.name || "CUAC student",
      status: record.status || "New",
      source: record.source || "Live CUAC submission",
      programName: record.programName || "Selected program",
      degree: record.degree || "Route",
      degreeLevel: record.degreeLevel || record.informationSources?.fromProgramRecord?.degreeLevel || record.degree || "Route",
      durationYears: record.durationYears || record.informationSources?.fromProgramRecord?.durationYears || "",
      fieldCategory: record.fieldCategory || record.informationSources?.fromProgramRecord?.fieldCategory || "",
      intake: record.intake || "Fall 2026",
      teachingLanguage: record.teachingLanguage || record.languageRoute || record.informationSources?.selectedByStudent?.teachingLanguage || "English-taught",
      languageRoute: record.languageRoute || "English-taught",
      cscaSubjects: record.cscaSubjects || record.informationSources?.fromProgramRecord?.cscaSubjects || [],
      cscaRequirement: record.cscaRequirement || record.informationSources?.fromProgramRecord?.cscaRequirement || "",
      hskRequirement: record.hskRequirement || record.informationSources?.fromProgramRecord?.hskRequirement || "",
      englishRequirement: record.englishRequirement || record.informationSources?.fromProgramRecord?.englishRequirement || "",
      city: record.city || "Hangzhou",
      country: record.country || "Not provided",
      passportNationality: record.passportNationality || record.informationSources?.fromStudentProfile?.passportNationality || record.country || "Not provided",
      email: record.email || "student@example.com",
      phone: record.phone || "Not provided",
      stage: record.stage || "Not provided",
      currentSchool: record.currentSchool || record.informationSources?.fromStudentProfile?.currentSchool || "Not provided",
      intendedLevel: record.intendedLevel || record.informationSources?.fromStudentProfile?.intendedLevel || record.degreeLevel || record.degree || "Not provided",
      funding: record.funding || "Not provided",
      scholarshipSignals: record.scholarshipSignals || record.informationSources?.fromSchoolScholarshipRecords || [],
      schoolScholarshipSummary: record.schoolScholarshipSummary || (
        (record.scholarshipSignals || record.informationSources?.fromSchoolScholarshipRecords || []).length
          ? (record.scholarshipSignals || record.informationSources?.fromSchoolScholarshipRecords).map((item) => item.name).join("; ")
          : "No school-specific scholarship record attached"
      ),
      programInterests,
      programInterestSummary: record.programInterestSummary || `${programInterests.length} program interest${programInterests.length === 1 ? "" : "s"}`,
      language: record.language || "Not provided",
      guardianStatus: record.guardianStatus || record.informationSources?.fromStudentProfile?.guardianStatus || "Not provided",
      academicSummary: record.academicSummary || record.informationSources?.fromStudentProfile?.academicSummary || "Not provided",
      deadline: record.deadline || "School to confirm",
      deadlineDate: record.deadlineDate || record.informationSources?.fromProgramRecord?.deadlineDate || "",
      tuition: record.tuition || record.informationSources?.fromProgramRecord?.tuitionText || "",
      applicationRound: record.applicationRound || record.informationSources?.fromProgramRecord?.applicationRound || "",
      applicationUrl: record.applicationUrl || record.informationSources?.fromProgramRecord?.applicationUrl || "",
      applicationNote: record.applicationNote || record.informationSources?.fromProgramRecord?.applicationNote || "",
      studentChoiceNote: record.studentChoiceNote || record.informationSources?.selectedByStudent?.studentChoiceNote || "",
      fit: record.fit || "Selected by student",
      sourceUrl: record.sourceUrl || record.informationSources?.fromProgramRecord?.sourceUrl || "",
      sourceLabel: record.sourceLabel || record.informationSources?.fromProgramRecord?.sourceLabel || "",
      lastVerifiedAt: record.lastVerifiedAt || record.informationSources?.fromProgramRecord?.lastVerifiedAt || "",
      owner: record.owner || "International Office",
      priority: record.priority || "Normal",
      receivedAt: record.receivedAt || new Date().toISOString(),
      due: record.due || "Due: today",
      nextAction: record.nextAction || "Contact student and request the school document checklist directly.",
      note: record.note || "CUAC sent non-document application information for school follow-up.",
      timeline: Array.isArray(record.timeline) && record.timeline.length ? clone(record.timeline) : ["CUAC application record submitted", "Routed to school tenant scope", "First contact not started"],
      informationSources: record.informationSources || null,
      sourceFieldLineage: record.sourceFieldLineage || record.informationSources?.sourceFieldLineage || null,
      notCollectedByCuac: record.notCollectedByCuac || legacyFieldContracts.addChoiceInformationSources.notCollectedByCuac,
      id: record.id || `live-${index}`,
    };
  }

  function getTenantSubmittedRecords(schoolName = config.defaultSchoolTenant) {
    const state = readStoredJson(storageKeys.applicationDemoState);
    if (!state?.submittedToSchools || !Array.isArray(state.submittedRecords)) return [];
    return state.submittedRecords.filter((record) => record?.school === schoolName);
  }

  function getBillingSnapshot() {
    const state = readStoredJson(storageKeys.applicationDemoState);
    const routes = Array.isArray(state?.routes) && state.routes.length ? state.routes : defaultApplicationRoutes;
    const fee = calculateFee(routes);
    const paymentStatus = state?.paymentStatus || (state?.submittedToSchools ? "paid-demo" : "preview");
    const commerceOrder = state?.commerceOrder || null;
    const paymentCreateResult = state?.paymentCreateResult || null;
    const cartResult = state?.cartResult || null;
    const statusLabels = {
      "paid-demo": "Paid",
      "free-submitted": "Free submission sent",
      "failed-preview": "Payment issue",
      "processing-demo": "Payment pending",
      preview: "Preview",
    };
    return {
      invoiceId: config.invoiceId,
      status: statusLabels[paymentStatus] || "Preview",
      paymentStatus,
      paymentUpdatedAt: state?.paymentUpdatedAt || state?.submittedAt || "",
      submittedAt: state?.submittedAt || "",
      cartResult,
      commerceOrder,
      paymentCreateResult,
      orderId: commerceOrder?.id || paymentCreateResult?.orderId || null,
      orderStatus: commerceOrder?.status || (paymentStatus === "paid-demo" || paymentStatus === "free-submitted" ? "PAID" : paymentStatus === "failed-preview" ? "FAILED" : "PENDING"),
      paymentId: paymentCreateResult?.paymentId || commerceOrder?.payment?.id || null,
      paymentProvider: paymentCreateResult?.provider || "mock",
      providerTxnId: paymentCreateResult?.providerTxnId || commerceOrder?.payment?.providerTxnId || "",
      paymentProviderStatus: paymentCreateResult?.status || commerceOrder?.payment?.status || "PENDING",
      callbackSignaturePayload: paymentCreateResult?.callbackSignaturePayload || "",
      testCallbackSignature: paymentCreateResult?.testCallbackSignature || "",
      ...fee,
      totalLabel: formatFee(fee.total),
      payableTotalCents: cartResult?.pricing?.payableTotalCents ?? commerceOrder?.payableTotalCents ?? fee.total * 100,
      pricingBreakdown: cartResult?.pricing?.pricingBreakdown || commerceOrder?.pricingBreakdown || [],
      lines: fee.schools.map((school, index) => ({
        school,
        programs: fee.routes.filter((route) => route.university === school).map((route) => route.program).join(", ") || "Selected program",
        fee: index === 0 ? "Included" : `USD ${config.extraSchoolFeeUsd}`,
      })),
    };
  }

  function getSampleSchoolApplications(schoolName = config.defaultSchoolTenant) {
    return Object.fromEntries(Object.entries(clone(sampleSchoolApplications)).filter(([, record]) => record.school === schoolName));
  }

  function getProgramCatalog() {
    return clone(getDiscoveryPrograms().reduce((groups, program) => {
      const schoolName = program.schoolNameEn || program.university || program.school?.nameEn || "School to confirm";
      if (!groups[schoolName]) groups[schoolName] = [];
      groups[schoolName].push(program);
      return groups;
    }, {}));
  }

  function getRouteContracts() {
    return clone(routeContracts);
  }

  function getRouteContract(route) {
    const normalizedRoute = String(route || "").replace(/^\.\//, "");
    return clone(routeContracts.find((contract) => contract.route === normalizedRoute) || null);
  }

  function getBackendAdapterContract() {
    return clone(backendAdapterContract);
  }

  function getLegacyEntityContract(entityName) {
    const normalized = String(entityName || "").replace(/\s+/g, "").toLowerCase();
    const aliases = {
      school: "School",
      university: "School",
      program: "Program",
      schoolprogram: "Program",
      schoolscholarship: "SchoolScholarship",
      fundingsignal: "SchoolScholarship",
      publicscholarship: "PublicScholarship",
      adminscholarship: "AdminScholarship",
      scholarshipeditor: "AdminScholarship",
      scholarship: "PublicScholarship",
      city: "City",
      cityguide: "City",
      studentprofile: "StudentProfile",
      profile: "StudentProfile",
      authresult: "AccessGovernance",
      authsession: "AccessGovernance",
      accessgovernance: "AccessGovernance",
      organizationinviteacceptresult: "AccessGovernance",
      inviteacceptance: "AccessGovernance",
      adminaiorganizationadminassignmentresult: "AccessGovernance",
      adminaiorganizationinvitebulkreissueresult: "AccessGovernance",
      opsaudit: "OpsAuditGovernance",
      opsauditgovernance: "OpsAuditGovernance",
      audititem: "OpsAuditGovernance",
      adminauditsummary: "OpsAuditGovernance",
      adminauditevent: "OpsAuditGovernance",
      adminreadinessevidencefile: "OpsAuditGovernance",
      adminreadinessevidencedetail: "OpsAuditGovernance",
      commerceflow: "CommerceFlow",
      billing: "CommerceFlow",
      payment: "CommerceFlow",
      order: "CommerceFlow",
      schooldisplay: "SchoolDisplaySurface",
      schooldisplaysurface: "SchoolDisplaySurface",
      schoolquickfacts: "SchoolDisplaySurface",
      schooldetaildisplay: "SchoolDisplaySurface",
      schoolapplicationtimelineitem: "SchoolDisplaySurface",
      schooltimeline: "SchoolDisplaySurface",
      schoolcatalog: "SchoolCatalog",
      schoolsearch: "SchoolCatalog",
      schoolsearchparams: "SchoolCatalog",
      schoollist: "SchoolCatalog",
      schoollistfacets: "SchoolCatalog",
      schoollistresult: "SchoolCatalog",
      universitysearch: "SchoolCatalog",
      universitycatalog: "SchoolCatalog",
      contentdiscovery: "ContentDiscovery",
      publiccontentblock: "ContentDiscovery",
      admincontentblock: "ContentDiscovery",
      searchitem: "ContentDiscovery",
      searchresult: "ContentDiscovery",
      guide: "ContentDiscovery",
      guides: "ContentDiscovery",
      savedcompare: "SavedCompare",
      savedschool: "SavedCompare",
      compareschool: "SavedCompare",
      comparedetailsresult: "SavedCompare",
      compare: "SavedCompare",
      favourites: "SavedCompare",
      favorites: "SavedCompare",
    };
    const key = aliases[normalized] || entityName;
    return clone(legacyFieldContracts.entityContracts[key] || null);
  }

  function sourceModelsForBaselineEntity(entity) {
    if (entity === "Program") return "SchoolProgram";
    if (entity === "SchoolDisplaySurface") return ["SchoolQuickFacts", "SchoolDetailDisplay", "SchoolProgramDisplayGroup", "SchoolApplicationTimelineItem", "SchoolUpcomingDeadline"];
    if (entity === "SchoolCatalog") return ["SchoolSearchParams", "SchoolListFacets", "SchoolListResult"];
    if (entity === "ContentDiscovery") return ["PublicContentBlock", "AdminContentBlock", "SearchItem", "SearchResult"];
    if (entity === "SavedCompare") return ["School", "SavedSchool", "CompareSchool", "CompareDetailsResult"];
    if (entity === "PublicScholarship") return ["Scholarship", "ScholarshipBodySection", "ScholarshipBenefitItem", "ScholarshipInfoItem", "ScholarshipContactInfo", "ScholarshipActionLink", "ScholarshipStats", "ScholarshipListResult", "ScholarshipTypeSummary", "ScholarshipCountrySummary", "ScholarshipCountriesResult", "ScholarshipDetailResult"];
    if (entity === "AdminScholarship") return ["AdminScholarship", "AdminScholarshipInput", "AdminScholarshipImportInput"];
    if (entity === "AdminSchool") return ["AdminSchoolSummary", "AdminSchoolDetail", "AdminSchoolUpdateInput", "AdminSchoolCreateInput", "AdminSchoolImportInput", "AdminSchoolProgramInput", "AdminSchoolCscaRuleInput", "AdminSchoolScholarshipInput"];
    if (entity === "City") return ["CityGuide", "CityGuideContent", "CityGuideAggregate", "CityGuideDetail"];
    if (entity === "TimelineWindow") return ["ApplicationTimelineWindow", "ApplicationTimelineProject", "ApplicationTimelineSchool", "ApplicationTimelineResponse"];
    if (entity === "StudentProfile") return "StudentProfile";
    if (entity === "AccessGovernance") return ["AuthResult", "User", "AdminUser", "AdminAIOrganization", "AdminAIOrganizationInviteCreateResult", "AdminAIOrganizationAdminAssignmentResult", "AdminAIOrganizationInviteBulkReissueResult", "AdminAIOrganizationInviteHistory", "OrganizationInviteAcceptResult"];
    if (entity === "OpsAuditGovernance") return ["AuditItem", "AdminAuditSummary", "AdminAuditEvent", "AdminReadinessEvidenceFile", "AdminReadinessEvidenceDetail"];
    if (entity === "CommerceFlow") return ["CartResult", "CartItem", "PricingSummary", "PricingLine", "CommerceOrder", "PaymentCreateResult"];
    return entity;
  }

  function getLegacySourceCoverageAudit() {
    const baseline = legacyFieldContracts.auditEvidence.currentBaseline || {};
    const entities = Object.entries(baseline).map(([entity, rule]) => {
      const sourceModels = [].concat(sourceModelsForBaselineEntity(entity));
      const sourceFields = sourceModels.flatMap((sourceModel) => legacyFieldContracts.sourceModelFields[sourceModel] || []);
      const contract = legacyFieldContracts.entityContracts[entity] || {};
      const allowedFields = new Set([...sourceFields, ...(contract.canonicalKeys || [])]);
      const missingFields = (rule.mustPreserveFields || []).filter((field) => !allowedFields.has(field));
      return {
        entity,
        sourceModel: sourceModels.join(" + "),
        prismaModel: rule.prismaModel,
        backendType: rule.backendType,
        frontendType: rule.frontendType,
        requiredFamilies: clone(rule.requiredFamilies || []),
        checkedFields: clone(rule.mustPreserveFields || []),
        missingFields,
        passed: missingFields.length === 0,
      };
    });
    const issues = entities.flatMap((item) => item.missingFields.map((field) => ({
      entity: item.entity,
      sourceModel: item.sourceModel,
      field,
      message: `${item.entity} baseline field ${field} is not preserved in the CUAC legacy source contract.`,
    })));
    return {
      sourceProject: legacyFieldContracts.sourceProject,
      checkedAt: legacyFieldContracts.auditEvidence.checkedAt,
      schemaFile: legacyFieldContracts.auditEvidence.schemaFile,
      entities,
      issueCount: issues.length,
      issues,
      passed: issues.length === 0 && entities.length >= 5,
    };
  }

  function getAgentContextPolicy({ authState, role, surface } = {}) {
    if (role === "cuac_ops" || surface === "cuac-internal") return clone(agentContextPolicies.ops);
    if (role === "school_staff" || role === "school_owner_or_staff" || role === "school_owner" || surface === "school-staff") return clone(agentContextPolicies.schoolStaff);
    if (authState === "signed-in" || role === "student" || surface === "authenticated-student") return clone(agentContextPolicies.student);
    return clone(agentContextPolicies.guest);
  }

  function readNotificationEvents() {
    const state = readStoredJson(storageKeys.notificationEvents);
    return Array.isArray(state?.events) ? clone(state.events) : [];
  }

  function writeNotificationEvents(events = []) {
    writeStoredJson(storageKeys.notificationEvents, {
      events: clone(events),
      updatedAt: new Date().toISOString(),
    });
  }

  function addNotificationEvent(event = {}) {
    if (!event.id) return;
    const events = readNotificationEvents().filter((item) => item.id !== event.id);
    writeNotificationEvents([{ ...event, createdAt: event.createdAt || new Date().toISOString() }, ...events].slice(0, 20));
  }

  function readNotificationCenterState() {
    const state = readStoredJson(storageKeys.notificationCenterState);
    return {
      readIds: Array.isArray(state?.readIds) ? clone(state.readIds) : [],
      dismissedIds: Array.isArray(state?.dismissedIds) ? clone(state.dismissedIds) : [],
      updatedAt: state?.updatedAt || "",
    };
  }

  function writeNotificationCenterState(value = {}) {
    writeStoredJson(storageKeys.notificationCenterState, {
      readIds: Array.isArray(value.readIds) ? clone(value.readIds) : [],
      dismissedIds: Array.isArray(value.dismissedIds) ? clone(value.dismissedIds) : [],
      updatedAt: new Date().toISOString(),
    });
  }

  function getDiscoveryPrograms() {
    const normalizedDiscovery = discoveryPrograms.map(normalizeDiscoveryProgram);
    const catalogBase = mergePreviewRecords(programCatalogDiscoveryRecords(), normalizedDiscovery, ["programId", "id"]);
    return clone(mergePreviewRecords(catalogBase, opsProgramPreviewRecords(), ["id", "programId"]).map(normalizeDiscoveryProgram).map(enrichProgramScholarshipContext));
  }

  function normalizeDiscoverySchools(items = []) {
    return clone(items.map(normalizeDiscoverySchool));
  }

  function normalizeDiscoveryScholarships(items = []) {
    return clone(items.map(normalizeDiscoveryScholarship));
  }

  function normalizeDiscoveryCities(items = []) {
    return clone(items.map(normalizeDiscoveryCity));
  }

  function getDiscoverySchools(fallback = []) {
    const base = fallback.length ? fallback : discoverySchools;
    return normalizeDiscoverySchools(mergePreviewRecords(base, publicPreviewRecords("schoolRecords"), ["id", "sourceId", "nameEn", "nameZh"]));
  }

  function getDiscoveryScholarships(fallback = []) {
    const base = fallback.length ? fallback : discoveryScholarships;
    return normalizeDiscoveryScholarships(mergePreviewRecords(base, publicPreviewRecords("publicScholarshipRecords"), ["id", "slug", "title"]));
  }

  function getDiscoveryCities(fallback = []) {
    const base = fallback.length ? fallback : discoveryCities;
    return normalizeDiscoveryCities(mergePreviewRecords(base, readOpsPreviewList("cityGuideRecords"), ["id", "slug", "nameEn", "nameZh"]));
  }

  function getDiscoveryGuides(fallback = []) {
    return clone((fallback.length ? fallback : discoveryGuides).map(normalizeDiscoveryGuide));
  }

  const fallbackApplicationTimelineWindows = [
    {
      id: "timeline-jan",
      month: "Jan",
      title: "Early applications and funding",
      applicationWindow: "Use this window if your language proof, transcript, passport, and shortlist are already close to ready.",
      cscaWindow: "Finish first-round CSCA planning before January if a target school requires subject evidence.",
      status: "published",
      sortOrder: 10,
      version: 1,
      updatedAt: "2026-08-20",
    },
    {
      id: "timeline-mar",
      month: "Mar",
      title: "Main spring review",
      applicationWindow: "Many schools begin collecting degree program materials; confirm exact program deadlines before adding choices.",
      cscaWindow: "Use February and March to complete route-specific CSCA mock or subject preparation.",
      status: "published",
      sortOrder: 20,
      version: 1,
      updatedAt: "2026-08-20",
    },
    {
      id: "timeline-apr",
      month: "Apr",
      title: "Regular decision window",
      applicationWindow: "Good moment to compare backup schools, funding realism, and remaining document blockers.",
      cscaWindow: "Keep CSCA requirements visible beside language proof, tuition, and scholarship timing.",
      status: "published",
      sortOrder: 30,
      version: 1,
      updatedAt: "2026-08-20",
    },
    {
      id: "timeline-jun",
      month: "Jun",
      title: "Late applications and backups",
      applicationWindow: "Focus on schools with later deadlines and make sure every selected program is still open.",
      cscaWindow: "Confirm whether a late route still needs CSCA evidence before the school contacts the student.",
      status: "published",
      sortOrder: 40,
      version: 1,
      updatedAt: "2026-08-20",
    },
    {
      id: "timeline-dec",
      month: "Dec",
      title: "Next-year planning",
      applicationWindow: "Start the next intake cycle with school fit, budget, language route, and document readiness together.",
      cscaWindow: "Build the subject preparation plan before the next application season gets crowded.",
      status: "published",
      sortOrder: 50,
      version: 1,
      updatedAt: "2026-08-20",
    },
  ];

  function normalizeApplicationTimelineWindow(item = {}, index = 0) {
    const fallback = fallbackApplicationTimelineWindows[index] || {};
    const merged = { ...fallback, ...(plainRecord(item) ? item : {}) };
    return {
      id: merged.id || `timeline-${index + 1}`,
      month: merged.month || "",
      title: merged.title || "Application window",
      applicationWindow: merged.applicationWindow || "Confirm exact dates with the target university.",
      cscaWindow: merged.cscaWindow || "Confirm whether CSCA is required for this route.",
      status: merged.status || "published",
      sortOrder: Number(merged.sortOrder ?? index + 1),
      version: Number(merged.version || 1),
      updatedAt: merged.updatedAt || "",
    };
  }

  function monthToken(value = "") {
    return String(value || "").trim().slice(0, 3).toLowerCase();
  }

  function monthFromDate(value = "") {
    if (!value) return "";
    const parsed = new Date(`${value}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toLocaleString("en", { month: "short", timeZone: "UTC" }).toLowerCase();
  }

  function timelineDeadlineDays(value = "") {
    if (!value) return null;
    const due = new Date(`${value}T00:00:00Z`).getTime();
    if (Number.isNaN(due)) return null;
    const today = Date.UTC(2026, 7, 24);
    return Math.round((due - today) / 86400000);
  }

  function buildApplicationTimelineProject(program = {}, school = {}) {
    const deadlineDate = program.deadlineDate || catalogDeadlineDate(program.deadline) || "";
    const tags = compactList([
      program.teachingLanguage && String(program.teachingLanguage).toLowerCase().includes("english") ? "english" : "",
      program.scholarship || program.hasScholarship ? "scholarship" : "",
      program.scholarshipText && String(program.scholarshipText).toLowerCase().includes("csc") ? "csc" : "",
      program.applicationRound,
    ]);
    return {
      key: program.id || program.programId || `${school.id || "school"}-${slugify(program.nameEn || program.title || "program")}`,
      schoolId: school.id || program.schoolId || "",
      schoolName: school.nameZh || school.nameEn || program.school || "",
      schoolNameEn: school.nameEn || program.school || "",
      schoolRegion: school.region || school.cityZh || "",
      title: program.nameEn || program.title || "Program deadline",
      degree: program.degreeLevel || program.degree || "",
      language: program.teachingLanguage || program.language || "",
      field: program.fieldCategory || program.subject || "",
      tuition: program.displayTuition || rmbLabel(program.tuitionAmount ?? program.tuition),
      deadlineDate,
      deadline: program.deadlineLabel || program.deadline || deadlineDate || "Confirm deadline",
      days: timelineDeadlineDays(deadlineDate),
      status: program.status || "published",
      applicationRound: program.applicationRound || "",
      month: monthFromDate(deadlineDate),
      tags,
    };
  }

  function getApplicationTimeline() {
    const previewWindows = readOpsPreviewList("timelineWindowRecords");
    const windows = (previewWindows.length ? previewWindows : fallbackApplicationTimelineWindows)
      .map(normalizeApplicationTimelineWindow)
      .filter((item) => item.status !== "archived")
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    const schools = getDiscoverySchools();
    const schoolById = new Map(schools.map((school) => [String(school.id), school]));
    const programs = getDiscoveryPrograms()
      .map((program) => buildApplicationTimelineProject(program, schoolById.get(String(program.schoolId)) || {}))
      .filter((project) => project.deadline || project.deadlineDate)
      .sort((a, b) => (a.days ?? 9999) - (b.days ?? 9999));
    const groupedSchools = Array.from(programs.reduce((map, project) => {
      const key = String(project.schoolId || project.schoolNameEn || project.schoolName || "school");
      const group = map.get(key) || {
        key,
        school: {
          id: project.schoolId,
          nameZh: project.schoolName,
          nameEn: project.schoolNameEn,
          region: project.schoolRegion,
        },
        rows: [],
      };
      group.rows.push(project);
      map.set(key, group);
      return map;
    }, new Map()).values()).map((group) => ({
      ...group,
      earliest: [...group.rows].sort((a, b) => (a.days ?? 9999) - (b.days ?? 9999))[0],
    }));
    return clone({
      windows,
      programs,
      schools: groupedSchools,
      stats: {
        deadlineItemCount: programs.length,
        schoolCount: groupedSchools.length,
        urgent7Count: programs.filter((item) => item.days !== null && item.days >= 0 && item.days <= 7).length,
        urgent30Count: programs.filter((item) => item.days !== null && item.days >= 0 && item.days <= 30).length,
        scholarshipSchoolCount: groupedSchools.filter((group) => group.rows.some((item) => item.tags.includes("scholarship") || item.tags.includes("csc"))).length,
        englishProgramSchoolCount: groupedSchools.filter((group) => group.rows.some((item) => item.tags.includes("english"))).length,
      },
      sourceFieldLineage: {
        sourceModel: "ApplicationTimelineWindow",
        sourceFields: ["month", "title", "applicationWindow", "cscaWindow", "status", "sortOrder"],
        projectSourceModel: "ApplicationTimelineProject",
      },
    });
  }

  const legacyRuntimeReadinessRules = {
    Program: {
      collection: "getDiscoveryPrograms",
      requiredFields: ["id", "schoolId", "nameEn", "degreeLevel", "teachingLanguage", "tuitionAmount", "deadlineDate", "applicationRound", "sourceFieldLineage"],
      lineageModel: "SchoolProgram",
    },
    School: {
      collection: "getDiscoverySchools",
      requiredFields: ["id", "nameEn", "nameZh", "citySlug", "cityZh", "region", "admissionsWebsiteUrl", "qualityScore", "sourceFieldLineage"],
      lineageModel: "School",
    },
    PublicScholarship: {
      collection: "getDiscoveryScholarships",
      requiredFields: ["id", "slug", "title", "fundingLevel", "coverage", "deadlineDate", "applicationMaterials", "sourceFieldLineage"],
      lineageModel: "Scholarship",
    },
    City: {
      collection: "getDiscoveryCities",
      requiredFields: ["slug", "nameZh", "nameEn", "region", "content", "contentJson", "referenceProgramCount", "actualProgramCount", "sourceFieldLineage"],
      lineageModel: "CityGuide",
    },
    TimelineWindow: {
      collection: "getApplicationTimeline",
      requiredFields: ["windows", "programs", "schools", "stats", "sourceFieldLineage"],
      lineageModel: "ApplicationTimelineWindow",
    },
    SchoolHandoff: {
      collection: "buildSubmittedRecords",
      requiredFields: ["schoolId", "programId", "programFullName", "degreeLevel", "teachingLanguage", "deadlineDate", "applicationRound", "informationSources", "informationSources.fromStudentProfile.countryCode", "informationSources.fromStudentProfile.nationalityCode", "informationSources.fromStudentProfile.gradeCode", "informationSources.fromStudentProfile.currentOrganizationId", "informationSources.fromStudentProfile.updatedAt", "sourceFieldLineage", "notCollectedByCuac"],
      lineageModel: "SchoolProgram",
    },
  };

  function hasContractValue(record, path) {
    const parts = String(path).split(".");
    let value = record;
    for (const part of parts) {
      if (!value || !Object.prototype.hasOwnProperty.call(value, part)) return false;
      value = value[part];
    }
    if (value === null || value === undefined) return false;
    if (typeof value === "string") return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "object") return Object.keys(value).length > 0;
    return true;
  }

  function getLegacyRuntimeRecords(collection) {
    if (collection === "getDiscoveryPrograms") return getDiscoveryPrograms();
    if (collection === "getDiscoverySchools") return getDiscoverySchools();
    if (collection === "getDiscoveryScholarships") return getDiscoveryScholarships();
    if (collection === "getDiscoveryCities") return getDiscoveryCities();
    if (collection === "getApplicationTimeline") return [getApplicationTimeline()];
    if (collection === "buildSubmittedRecords") return buildSubmittedRecords();
    return [];
  }

  function getLegacyContractReadiness() {
    const entities = Object.entries(legacyRuntimeReadinessRules).map(([entity, rule]) => {
      const records = getLegacyRuntimeRecords(rule.collection);
      const issues = [];
      records.forEach((record, index) => {
        rule.requiredFields.forEach((field) => {
          if (!hasContractValue(record, field)) {
            issues.push({
              entity,
              index,
              field,
              message: `${entity} record ${index + 1} is missing CSCAlite-compatible field ${field}.`,
            });
          }
        });
        const sourceModel = record?.sourceFieldLineage?.sourceModel || record?.sourceFieldLineage?.fromProgramRecord?.sourceModel;
        if (rule.lineageModel && sourceModel !== rule.lineageModel) {
          issues.push({
            entity,
            index,
            field: "sourceFieldLineage.sourceModel",
            message: `${entity} record ${index + 1} should preserve ${rule.lineageModel} lineage.`,
          });
        }
      });
      return {
        entity,
        collection: rule.collection,
        checkedRecords: records.length,
        requiredFields: clone(rule.requiredFields),
        issues,
        passed: records.length > 0 && issues.length === 0,
      };
    });
    const issues = entities.flatMap((entity) => entity.issues);
    return {
      sourceProject: legacyFieldContracts.sourceProject,
      checkedAt: legacyFieldContracts.auditEvidence.checkedAt,
      entities,
      issueCount: issues.length,
      issues,
      passed: issues.length === 0 && entities.every((entity) => entity.checkedRecords > 0),
    };
  }

  window.CuacDataClient = {
    config,
    storageKeys,
    legacyFieldContracts: clone(legacyFieldContracts),
    defaultStudentProfile: clone(defaultStudentProfile),
    getProgramCatalog,
    getRouteContracts,
    getRouteContract,
    getBackendAdapterContract,
    getLegacyEntityContract,
    getLegacySourceCoverageAudit,
    getAgentContextPolicy,
    agentContextPolicies: clone(agentContextPolicies),
    getDiscoveryPrograms,
    getDiscoverySchools,
    getDiscoveryScholarships,
    getDiscoveryCities,
    getDiscoveryGuides,
    getApplicationTimeline,
    getLegacyContractReadiness,
    getHomeDiscoverySummary,
    getStudentHubSummary,
      getSavedItemsSummary,
      getNotificationCenterSummary,
      getPreferenceCenterSummary,
      getCompletionDetailCatalog,
      getCompletionDetail,
    normalizeDiscoverySchools,
    normalizeDiscoveryScholarships,
    normalizeDiscoveryCities,
    getSampleSchoolApplications,
    getBillingSnapshot,
    readApplicationDemoState: () => readStoredJson(storageKeys.applicationDemoState),
    readSchoolPortalDemoState: () => readStoredJson(storageKeys.schoolPortalDemoState),
    readSavedDetailItems,
    readNotificationEvents,
    readNotificationCenterState,
    writeApplicationDemoState: (value) => writeStoredJson(storageKeys.applicationDemoState, value),
    writeSchoolPortalDemoState: (value) => writeStoredJson(storageKeys.schoolPortalDemoState, value),
    writeSavedDetailItems,
    addSavedDetailItem,
    writeNotificationEvents,
    writeNotificationCenterState,
    addNotificationEvent,
    calculateFee,
    formatFee,
    buildSubmittedRecords,
    normalizeSchoolRecord,
    getTenantSubmittedRecords,
  };
})();
