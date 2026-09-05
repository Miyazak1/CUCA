import assert from "node:assert/strict";
import test from "node:test";
import {
  toPublicCityDetailDto,
  toPublicCityDto,
  toPublicProgramDetailDto,
  toPublicProgramDto,
  toPublicScholarshipDetailDto,
  toPublicScholarshipDto,
  toPublicSchoolDetailDto,
  toPublicSchoolDto,
} from "../../../src/server/index.ts";

function baseCatalogFields() {
  return {
    status: "active",
    verificationStatus: "verified",
    sourceUrl: "https://example.edu/source",
    sourceLabel: "Official source",
    sourceNote: "internal source note",
    sourceFieldLineageJson: { nameEn: "official" },
    lastVerifiedAt: new Date("2026-08-01T00:00:00.000Z"),
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: new Date("2026-08-01T00:00:00.000Z"),
  };
}

test("program mapper returns only public program DTO fields", () => {
  const row = {
    id: "program_1",
    schoolId: "school_1",
    cityId: "city_1",
    slug: "cs-bsc",
    nameZh: "计算机科学",
    nameEn: "Computer Science",
    degreeLevel: "bachelor",
    durationYears: 4,
    durationMonths: 48,
    fieldCategory: "Engineering",
    subjectArea: "Computing",
    teachingLanguage: "english",
    cscaSubjects: ["mathematics"],
    cscaRequirement: "Required",
    hskRequirement: null,
    englishRequirement: "IELTS 6.0",
    tuitionAmount: 30000,
    tuitionCurrency: "CNY",
    tuitionPeriod: "year",
    tuitionText: "CNY 30,000/year",
    scholarshipText: "Available",
    applicationUrl: "https://example.edu/apply",
    applicationNote: "Apply online",
    isVerified: true,
    hasScholarship: true,
    badgeText: "Popular",
    displayTuition: "CNY 30k/year",
    displaySubjects: ["CS", "AI"],
    displayGroup: "engineering",
    displayGroupLabel: "Engineering",
    sortOrder: 1,
    schoolNameEn: "Zhejiang University",
    schoolNameZh: "浙江大学",
    schoolSlug: "zju",
    citySlug: "hangzhou",
    cityNameEn: "Hangzhou",
    cityNameZh: "杭州",
    createdByUserId: "ops_1",
    updatedByUserId: "ops_2",
    qualityScore: 92,
    missingFields: ["privateQualityField"],
    ...baseCatalogFields(),
  };
  const dto = toPublicProgramDto(row);
  const detail = toPublicProgramDetailDto(row);

  assert.equal(dto.name, "Computer Science");
  assert.equal(dto.university, "Zhejiang University");
  assert.equal(dto.sourceStatus, "verified");
  assert.deepEqual(dto.sourceFieldLineage, { nameEn: "official" });
  assert.equal("qualityScore" in dto, false);
  assert.equal("missingFields" in dto, false);
  assert.equal("createdByUserId" in dto, false);
  assert.equal("sourceNote" in dto, false);
  assert.equal(detail.slug, "cs-bsc");
  assert.equal(detail.durationYears, 4);
  assert.equal(detail.englishRequirement, "IELTS 6.0");
  assert.deepEqual(detail.school, { id: "school_1", slug: "zju", nameZh: "浙江大学", nameEn: "Zhejiang University" });
  assert.deepEqual(detail.city, { slug: "hangzhou", nameZh: "杭州", nameEn: "Hangzhou" });
  assert.equal("qualityScore" in detail, false);
  assert.equal("sourceNote" in detail, false);
});

test("school mapper excludes staff, quality, and tenant data", () => {
  const row = {
    id: "school_1",
    slug: "zju",
    nameZh: "浙江大学",
    nameEn: "Zhejiang University",
    schoolType: "public",
    region: "East China",
    cityId: "city_1",
    city: "Hangzhou",
    cityZh: "杭州",
    citySlug: "hangzhou",
    province: "Zhejiang",
    regionLabel: "East China",
    ranking: "Top 5",
    cscaRequired: true,
    cscaRequirement: "Required",
    cscaSubjects: ["math"],
    applicationLevel: "undergraduate",
    languageOfInstruction: "english",
    languageRequirement: "IELTS",
    hskRequirement: null,
    englishRequirement: "IELTS 6.0",
    deadlineSummary: "June",
    tuitionSummary: "CNY 30k",
    applicationFee: "CNY 800",
    websiteUrl: "https://zju.edu.cn",
    admissionsUrl: "https://zju.edu.cn/admissions",
    subjectTags: ["engineering"],
    fitNotes: "private-ish fit note",
    languageTags: ["english"],
    tuitionBandLabel: "medium",
    campusHighlights: ["Hangzhou"],
    contactNotes: "internal contact notes",
    qualityScore: 95,
    missingFields: [],
    completenessLabel: "complete",
    programCount: 10,
    englishProgramCount: 4,
    scholarshipCount: 3,
    upcomingDeadlines: [{
      programId: "program_1",
      programNameEn: "Computer Science",
      intakeId: "intake_1",
      intakeTerm: "fall",
      intakeYear: 2027,
      deadlineDate: "2027-06-01",
      deadlineLabel: null,
      applicationRound: "main",
    }],
    staffMemberships: [{ userId: "staff_1" }],
    tenantSettings: { hidden: true },
    ...baseCatalogFields(),
  };
  const dto = toPublicSchoolDto(row);
  const detail = toPublicSchoolDetailDto(row);

  assert.equal(dto.slug, "zju");
  assert.equal(dto.programCount, 10);
  assert.equal(dto.sourceStatus, "verified");
  assert.equal("staffMemberships" in dto, false);
  assert.equal("tenantSettings" in dto, false);
  assert.equal("qualityScore" in dto, false);
  assert.equal("contactNotes" in dto, false);
  assert.equal("sourceNote" in dto, false);
  assert.equal(detail.ranking, "Top 5");
  assert.deepEqual(detail.cscaSubjects, ["math"]);
  assert.deepEqual(detail.campusHighlights, ["Hangzhou"]);
  assert.equal(detail.upcomingDeadlines[0].intakeId, "intake_1");
  assert.equal("fitNotes" in detail, false);
  assert.equal("qualityScore" in detail, false);
  assert.equal("contactNotes" in detail, false);

  assert.throws(() => toPublicSchoolDto({ ...row, upcomingDeadlines: ["2027-06-01"] }), /deadline projection/);
  assert.throws(() => toPublicSchoolDto({ ...row, upcomingDeadlines: [{ ...row.upcomingDeadlines[0], privateNote: "hidden" }] }), /deadline projection/);
});

test("scholarship and city mappers return public DTO shapes", () => {
  const scholarshipRow = {
    id: "sch_1",
    slug: "csc",
    title: "CSC Scholarship",
    nameZh: "中国政府奖学金",
    type: "government",
    typeLabel: "Government",
    fundingLevel: "full",
    providerName: "CSC",
    providerNameEn: "China Scholarship Council",
    providerLocation: "China",
    schoolId: null,
    programId: null,
    coverage: "full",
    applicableDegree: "bachelor",
    applicableProgram: null,
    amountText: "Full tuition",
    requirementText: "Strong academic profile",
    bodySections: [{ title: "Overview", body: "Published award", paragraphs: [], items: ["Apply early"] }],
    benefitItems: [{ key: "tuition", label: "Tuition", included: true, note: null }],
    eligibilityItems: [{ label: "Applicant", value: null, body: "International" }],
    applicationMaterials: [{ label: "Form", value: null, body: null }],
    applicationSteps: [{ label: "Apply", value: null, body: "Use the official route" }],
    contactInfo: {},
    actionLinks: [{ label: "Official notice", url: "https://example.edu/award", kind: "source" }],
    deadlineDate: new Date("2027-03-01T00:00:00.000Z"),
    deadlineLabel: "March 2027",
    applicationRound: "2027",
    targetCountries: ["all"],
    targetRegions: ["global"],
    benefits: ["tuition"],
    tags: ["full"],
    summary: "Full funding",
    sortOrder: 1,
    version: 1,
    schoolSlug: "zju",
    schoolNameZh: "浙江大学",
    schoolNameEn: "Zhejiang University",
    programSlug: null,
    programNameZh: null,
    programNameEn: null,
    ...baseCatalogFields(),
  };
  scholarshipRow.schoolId = "school_1";
  const scholarship = toPublicScholarshipDto(scholarshipRow);
  const scholarshipDetail = toPublicScholarshipDetailDto(scholarshipRow);
  const cityRow = {
    id: "city_1",
    slug: "hangzhou",
    nameZh: "杭州",
    nameEn: "Hangzhou",
    region: "East China",
    province: "Zhejiang",
    monthlyCost: "CNY 3,000-5,000",
    monthlyCostRmb: 4000,
    costLevel: "medium",
    density: "large",
    tags: ["technology"],
    contentJson: {
      summary: "City guide",
      overview: "A source-backed city overview.",
      bestFor: ["Technology"],
      quickFacts: [{ label: "Climate", value: "Humid", note: null }],
      budgetSummary: { monthly: "CNY 4,000", yearly: null, note: "Housing varies" },
      costProfiles: [],
      why: ["Strong program range"],
      costBreakdown: [{ label: "Housing", value: "CNY 2,000", note: null }],
      lifeSections: [{ title: "Campus", body: "Confirm the exact campus" }],
      transportNotes: [],
      applicationTips: ["Choose a program first"],
      applicationAdvice: [],
      relatedProgramKeywords: ["engineering"],
      nextSteps: [],
      faqs: [{ question: "Is housing included?", answer: "Check the school record." }],
      cityFaqs: [],
    },
    nearby: ["Shanghai"],
    referenceSchoolCount: 8,
    referenceProgramCount: 40,
    referenceEnglishProgramCount: 12,
    referenceScholarshipCount: 6,
    referenceCscaSchoolCount: 3,
    sortOrder: 2,
    version: 1,
    ...baseCatalogFields(),
  };
  const city = toPublicCityDto(cityRow);
  const cityDetail = toPublicCityDetailDto(cityRow);

  assert.equal(scholarship.sourceStatus, "verified");
  assert.equal("sourceNote" in scholarship, false);
  assert.deepEqual(scholarship.benefitItems, [{ key: "tuition", label: "Tuition", included: true, note: null }]);
  assert.deepEqual(scholarshipDetail.bodySections[0].items, ["Apply early"]);
  assert.equal(scholarship.actionLinks[0].url, "https://example.edu/award");
  assert.throws(() => toPublicScholarshipDto({ ...scholarshipRow,
    eligibilityItems: [{ label: "Applicant", body: "International", contactInfo: "private" }] }), /projection/);
  assert.throws(() => toPublicScholarshipDetailDto({ ...scholarshipRow,
    bodySections: [{ title: "Overview", body: "Published", internalNote: "private" }] }), /projection/);
  assert.equal(city.actualSchoolCount, 8);
  assert.equal(city.content.quickFacts[0].label, "Climate");
  assert.deepEqual(city.content.lifeSections[0], { label: "Campus", text: "Confirm the exact campus" });
  assert.throws(() => toPublicCityDto({ ...cityRow, contentJson: { ...cityRow.contentJson, internalNotes: "private" } }), /city content projection/);
  assert.throws(() => toPublicCityDto({ ...cityRow, contentJson: { ...cityRow.contentJson,
    quickFacts: [{ label: "Climate", value: "Humid", contactInfo: "private" }] } }), /projection/);
  assert.deepEqual(Object.keys(city.content).sort(), [
    "applicationAdvice", "applicationTips", "bestFor", "budgetSummary", "cityFaqs", "costBreakdown",
    "costProfiles", "faqs", "lifeSections", "nextSteps", "overview", "quickFacts",
    "relatedProgramKeywords", "summary", "transportNotes", "why",
  ]);
  assert.equal("sourceFieldLineage" in city, false);
  assert.equal(scholarshipDetail.nameZh, "中国政府奖学金");
  assert.deepEqual(scholarshipDetail.school, { id: "school_1", slug: "zju", nameZh: "浙江大学", nameEn: "Zhejiang University" });
  assert.equal("contactInfo" in scholarshipDetail, false);
  assert.equal(cityDetail.id, "city_1");
  assert.equal(cityDetail.sourceStatus, "verified");
  assert.deepEqual(cityDetail.sourceFieldLineage, { nameEn: "official" });
});

test("detail source status preserves disputed and invalid review outcomes", () => {
  const row = {
    id: "city_1",
    slug: "hangzhou",
    nameZh: "杭州",
    nameEn: "Hangzhou",
    region: null,
    province: null,
    monthlyCost: null,
    monthlyCostRmb: null,
    costLevel: null,
    density: null,
    tags: [],
    contentJson: {},
    nearby: [],
    referenceSchoolCount: 0,
    referenceProgramCount: 0,
    referenceEnglishProgramCount: 0,
    referenceScholarshipCount: 0,
    referenceCscaSchoolCount: 0,
    sortOrder: 0,
    version: 1,
    ...baseCatalogFields(),
    verificationStatus: "disputed",
  };

  assert.equal(toPublicCityDetailDto(row).sourceStatus, "disputed");
  assert.equal(toPublicCityDetailDto({ ...row, verificationStatus: "invalid" }).sourceStatus, "invalid");
});
