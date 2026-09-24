import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { CatalogAdminService, createCatalogAdminHttpHandlers, createRequestContext, evaluatePolicy,
  SESSION_COOKIE_NAME } from "../../../src/server/index.ts";

const actorId = randomUUID(), cityId = randomUUID(), schoolId = randomUUID(), programId = randomUUID(), scholarshipId = randomUUID(), manifestId = randomUUID();
const now = new Date();

function context(overrides = {}) {
  return createRequestContext({ actorUserId: actorId, activeRole: "cuac_ops", selectedSurface: "ops",
    purpose: "catalog_management", authStrength: "session", ...overrides });
}

function document(overrides = {}) {
  return { slug: "hangzhou", nameZh: "杭州", nameEn: "Hangzhou", region: "East China", province: "Zhejiang",
    monthlyCost: "RMB 2,500–4,500", monthlyCostRmb: 3500, costLevel: "balanced", density: "high",
    tags: ["Digital economy"], content: { summary: "Student city" }, nearby: ["Shanghai"], sortOrder: 10,
    sourceUrl: "https://www.hangzhou.gov.cn/", sourceLabel: "Hangzhou government", sourceNote: null, ...overrides };
}

function record(overrides = {}) {
  return { id: cityId, ...document(), version: 1, status: "draft", verificationStatus: "unverified",
    verifiedByUserId: null, lastVerifiedAt: null, nextReviewDueAt: null, createdAt: now, updatedAt: now, ...overrides };
}

function schoolDocument(overrides = {}) {
  return { slug: "zhejiang-university", nameZh: "浙江大学", nameEn: "Zhejiang University", schoolType: "University",
    region: "East China", cityId, city: "Hangzhou", cityZh: "杭州", citySlug: "hangzhou", province: "Zhejiang",
    regionLabel: "East China", ranking: "National key university", cscaRequired: false, cscaRequirement: null,
    cscaSubjects: [], applicationLevel: "Undergraduate and postgraduate", languageOfInstruction: "Chinese and English",
    languageRequirement: null, hskRequirement: null, englishRequirement: null, deadlineSummary: null,
    tuitionSummary: null, applicationFee: null, websiteUrl: "https://www.zju.edu.cn/", admissionsUrl: null,
    subjectTags: ["Engineering"], fitNotes: null, languageTags: ["English", "Chinese"], tuitionBandLabel: null,
    campusHighlights: ["Hangzhou campus"], contactNotes: null, qualityScore: 90, missingFields: [],
    completenessLabel: "Complete", sourceUrl: "https://www.zju.edu.cn/", sourceLabel: "Zhejiang University",
    sourceNote: null, ...overrides };
}

function schoolRecord(overrides = {}) {
  return { id: schoolId, ...schoolDocument(), version: 1, status: "draft", verificationStatus: "unverified",
    verifiedByUserId: null, lastVerifiedAt: null, nextReviewDueAt: null, createdAt: now, updatedAt: now, ...overrides };
}

function programDocument(overrides = {}) {
  return { schoolId, cityId, slug: "zju-computer-science", nameZh: "计算机科学", nameEn: "Computer Science",
    degreeLevel: "Bachelor", durationYears: 4, durationMonths: null, fieldCategory: "Engineering",
    subjectArea: "Computer Science", teachingLanguage: "English", cscaSubjects: ["Mathematics"],
    cscaRequirement: null, hskRequirement: null, englishRequirement: "IELTS 6.0", tuitionAmount: 42000,
    tuitionCurrency: "CNY", tuitionPeriod: "year", tuitionText: "CNY 42,000/year", scholarshipText: null,
    applicationUrl: "https://example.edu/apply", applicationNote: null, hasScholarship: true, badgeText: null,
    displayTuition: "RMB 42,000", displaySubjects: ["Mathematics"], displayGroup: "engineering",
    displayGroupLabel: "Engineering", sortOrder: 10, sourceUrl: "https://example.edu/program",
    sourceLabel: "Official program page", sourceNote: null, ...overrides };
}

function programRecord(overrides = {}) {
  return { id: programId, ...programDocument(), isVerified: false, version: 1, status: "draft",
    verificationStatus: "unverified", verifiedByUserId: null, lastVerifiedAt: null, nextReviewDueAt: null,
    createdAt: now, updatedAt: now, ...overrides };
}

function scholarshipDocument(overrides = {}) {
  return { slug: "zju-merit-scholarship", title: "ZJU Merit Scholarship", nameZh: "浙江大学优秀奖学金",
    type: "university", typeLabel: "University scholarship", fundingLevel: "Partial", providerName: "浙江大学",
    providerNameEn: "Zhejiang University", providerLocation: "Hangzhou", schoolId, programId, coverage: "Tuition waiver",
    applicableDegree: "Bachelor", applicableProgram: "Computer Science", amountText: "RMB 20,000", requirementText: "Merit based",
    bodySections: [], benefitItems: [], eligibilityItems: [], applicationMaterials: [], applicationSteps: [], contactInfo: {},
    actionLinks: [{ label: "Apply", url: "https://example.edu/scholarship" }],
    deadlineDate: new Date(Date.now() + 200 * 86_400_000).toISOString(), deadlineLabel: "Annual deadline",
    applicationRound: "2027", targetCountries: [], targetRegions: [], benefits: ["Tuition"], tags: ["Merit"],
    summary: "Merit scholarship", sortOrder: 10, sourceUrl: "https://example.edu/scholarship",
    sourceLabel: "Official scholarship page", sourceNote: null, ...overrides };
}

function scholarshipRecord(overrides = {}) {
  const document = scholarshipDocument();
  return { id: scholarshipId, ...document, deadlineDate: new Date(document.deadlineDate), version: 1, status: "draft",
    verificationStatus: "unverified", verifiedByUserId: null, lastVerifiedAt: null, nextReviewDueAt: null,
    createdAt: now, updatedAt: now, ...overrides };
}

function readinessRecord(overrides = {}) {
  return { entityType: "program", entityId: programId, slug: "zju-computer-science", label: "Computer Science",
    status: "draft", verificationStatus: "unverified", version: 1, ready: true, blockingReasons: [],
    warningReasons: ["draft_record", "verification_not_current"], nextReviewDueAt: null, updatedAt: now, ...overrides };
}

function manifestRecord(overrides = {}) {
  return { id: manifestId, title: "2027 first release", status: "frozen", version: 1, selectionSha256: "a".repeat(64),
    itemCount: 1, driftedItemCount: 0, createdByUserId: actorId, supersededByUserId: null, supersededAt: null,
    createdAt: now, updatedAt: now, ...overrides };
}

function manifestDetail(overrides = {}) {
  return { manifest: manifestRecord(), items: [{ id: randomUUID(), position: 0, entityType: "program", entityId: programId,
    entityVersion: 1, slug: "zju-computer-science", label: "Computer Science",
    readinessSnapshot: { ready: true, blockingReasons: [], warningReasons: ["draft_record"], capturedAt: now.toISOString() },
    current: readinessRecord(), driftReasons: [] }], ...overrides };
}

function fixture(overrides = {}) {
  const calls = [], audits = [];
  const repository = {
    async listCities(input) { calls.push(["list", input]); return { authorized: true, value: { items: [record()], total: 1 } }; },
    async getCity(input) { calls.push(["get", input]); return { authorized: true, value: { city: record(), revisions: [] } }; },
    async createCity(input) { calls.push(["create", input]); return { authorized: true, value: record() }; },
    async updateCity(input) { calls.push(["update", input]); return { authorized: true, value: record({ version: 2 }) }; },
    async publishCity(input) { calls.push(["publish", input]); return { authorized: true,
      value: record({ version: 2, status: "active", verificationStatus: "verified", lastVerifiedAt: now,
        nextReviewDueAt: input.reviewDueAt }) }; },
    async archiveCity(input) { calls.push(["archive", input]); return { authorized: true, value: record({ version: 2, status: "archived" }) }; },
    async restoreCity(input) { calls.push(["restore", input]); return { authorized: true, value: record({ version: 2 }) }; },
    async listSchools(input) { calls.push(["listSchool", input]); return { authorized: true, value: { items: [schoolRecord()], total: 1 } }; },
    async getSchool(input) { calls.push(["getSchool", input]); return { authorized: true, value: { school: schoolRecord(), revisions: [] } }; },
    async createSchool(input) { calls.push(["createSchool", input]); return { authorized: true, value: schoolRecord() }; },
    async updateSchool(input) { calls.push(["updateSchool", input]); return { authorized: true, value: schoolRecord({ version: 2 }) }; },
    async publishSchool(input) { calls.push(["publishSchool", input]); return { authorized: true,
      value: schoolRecord({ version: 2, status: "active", verificationStatus: "verified", nextReviewDueAt: input.reviewDueAt }) }; },
    async archiveSchool(input) { calls.push(["archiveSchool", input]); return { authorized: true, value: schoolRecord({ version: 2, status: "archived" }) }; },
    async restoreSchool(input) { calls.push(["restoreSchool", input]); return { authorized: true, value: schoolRecord({ version: 2 }) }; },
    async listPrograms(input) { calls.push(["listProgram", input]); return { authorized: true, value: { items: [programRecord()], total: 1 } }; },
    async getProgram(input) { calls.push(["getProgram", input]); return { authorized: true, value: { program: programRecord(), revisions: [], dependencies: { intakeCount: 0, openIntakeCount: 0, activeRequirementPublicationCount: 0, activeScholarshipCount: 0, activeApplicationChoiceCount: 0 } } }; },
    async createProgram(input) { calls.push(["createProgram", input]); return { authorized: true, value: programRecord() }; },
    async updateProgram(input) { calls.push(["updateProgram", input]); return { authorized: true, value: programRecord({ version: 2 }) }; },
    async publishProgram(input) { calls.push(["publishProgram", input]); return { authorized: true, value: programRecord({ version: 2, status: "active", verificationStatus: "verified", isVerified: true, nextReviewDueAt: input.reviewDueAt }) }; },
    async archiveProgram(input) { calls.push(["archiveProgram", input]); return { authorized: true, value: programRecord({ version: 2, status: "archived" }) }; },
    async restoreProgram(input) { calls.push(["restoreProgram", input]); return { authorized: true, value: programRecord({ version: 2 }) }; },
    async listScholarships(input) { calls.push(["listScholarship", input]); return { authorized: true, value: { items: [scholarshipRecord()], total: 1 } }; },
    async getScholarship(input) { calls.push(["getScholarship", input]); return { authorized: true, value: { scholarship: scholarshipRecord(), revisions: [], dependencies: { activeApplicationChoiceCount: 0, linkedProgramCount: 1 } } }; },
    async createScholarship(input) { calls.push(["createScholarship", input]); return { authorized: true, value: scholarshipRecord() }; },
    async updateScholarship(input) { calls.push(["updateScholarship", input]); return { authorized: true, value: scholarshipRecord({ version: 2 }) }; },
    async publishScholarship(input) { calls.push(["publishScholarship", input]); return { authorized: true, value: scholarshipRecord({ version: 2, status: "active", verificationStatus: "verified", nextReviewDueAt: input.reviewDueAt }) }; },
    async archiveScholarship(input) { calls.push(["archiveScholarship", input]); return { authorized: true, value: scholarshipRecord({ version: 2, status: "archived" }) }; },
    async restoreScholarship(input) { calls.push(["restoreScholarship", input]); return { authorized: true, value: scholarshipRecord({ version: 2 }) }; },
    async listReadiness(input) { calls.push(["listReadiness", input]); return { authorized: true, value: {
      items: [readinessRecord()], total: 1, summary: { total: 4, ready: 3, blocked: 1,
        byEntityType: { city: { total: 1, ready: 1, blocked: 0 }, school: { total: 1, ready: 1, blocked: 0 },
          program: { total: 1, ready: 1, blocked: 0 }, scholarship: { total: 1, ready: 0, blocked: 1 } },
        issueCounts: { deadline_unavailable: 1 }, generatedAt: now } } }; },
    async getReadiness(input) { calls.push(["getReadiness", input]); return { authorized: true, value: readinessRecord() }; },
    async listReleaseManifests(input) { calls.push(["listReleaseManifests", input]); return { authorized: true,
      value: { items: [manifestRecord()], total: 1 } }; },
    async getReleaseManifest(input) { calls.push(["getReleaseManifest", input]); return { authorized: true, value: manifestDetail() }; },
    async createReleaseManifest(input) { calls.push(["createReleaseManifest", input]); return { authorized: true, value: manifestDetail() }; },
    async supersedeReleaseManifest(input) { calls.push(["supersedeReleaseManifest", input]); return { authorized: true,
      value: manifestRecord({ status: "superseded", version: 2, supersededByUserId: actorId, supersededAt: now }) }; },
    ...overrides,
  };
  return { calls, audits, service: new CatalogAdminService(repository, { async record(event) { audits.push(event); } }) };
}

test("catalog master-data policy permits Ops editing but reserves lifecycle commands for stepped-up admins", () => {
  const resource = { type: "catalog", dataClasses: ["internal_catalog_metadata"] };
  assert.equal(evaluatePolicy(context(), "catalog.read_master_data", resource).allowed, true);
  assert.equal(evaluatePolicy(context(), "catalog.edit_master_data", resource).allowed, true);
  assert.equal(evaluatePolicy(context(), "catalog.publish_master_data", resource).allowed, false);
  const admin = context({ activeRole: "cuac_admin", authStrength: "step_up" });
  assert.equal(evaluatePolicy(admin, "catalog.publish_master_data", resource).allowed, true);
  assert.equal(evaluatePolicy(admin, "catalog.archive_master_data", resource).allowed, true);
});

test("city management validates typed documents, uses expected versions and emits metadata-only audit", async () => {
  const { service, calls, audits } = fixture();
  await service.createCity(context(), document());
  await service.updateCity(context(), cityId, { expectedVersion: 1, document: document({ nameEn: "Hangzhou City" }) });
  assert.deepEqual(calls.map(call => call[0]), ["create", "update"]);
  assert.equal(calls[1][1].expectedVersion, 1);
  assert.equal(calls[1][1].city.nameEn, "Hangzhou City");
  assert.deepEqual(audits.map(event => event.action), ["ops.catalog.city.create", "ops.catalog.city.update"]);
  assert.doesNotMatch(JSON.stringify(audits), /hangzhou\.gov|sourceNote|Student city/);
});

test("city publication is single-admin step-up, version-bound and schedules review", async () => {
  const { service, calls } = fixture();
  const reviewDueAt = new Date(Date.now() + 180 * 86_400_000).toISOString();
  await assert.rejects(service.publishCity(context(), cityId, { expectedVersion: 1, reviewDueAt }), error => error.status === 403);
  const result = await service.publishCity(context({ activeRole: "cuac_admin", authStrength: "step_up" }), cityId,
    { expectedVersion: 1, reviewDueAt });
  assert.equal(result.status, "active");
  assert.equal(calls[0][0], "publish");
  assert.equal(calls[0][1].reviewDueAt.toISOString(), reviewDueAt);
});

test("city management fails closed on malformed content, unsafe evidence, stale versions and revoked authority", async () => {
  for (const invalid of [document({ slug: "Bad Slug" }), document({ sourceUrl: "http://example.test" }),
    document({ tags: Array.from({ length: 31 }, (_, i) => `tag-${i}`) }), document({ content: [] })]) {
    const current = fixture();
    await assert.rejects(current.service.createCity(context(), invalid), error => error.status === 400);
    assert.deepEqual(current.calls, []);
  }
  const stale = fixture({ async updateCity() { return { authorized: true, value: null }; } });
  await assert.rejects(stale.service.updateCity(context(), cityId, { expectedVersion: 1, document: document() }),
    error => error.status === 409);
  const revoked = fixture({ async listCities() { return { authorized: false }; } });
  await assert.rejects(revoked.service.listCities(context()), error => error.status === 403);
});

test("school management validates relationships, versions and metadata-only audit", async () => {
  const { service, calls, audits } = fixture();
  await service.createSchool(context(), schoolDocument());
  await service.updateSchool(context(), schoolId, { expectedVersion: 1,
    document: schoolDocument({ nameEn: "Zhejiang University Updated" }) });
  assert.deepEqual(calls.map(call => call[0]), ["createSchool", "updateSchool"]);
  assert.equal(calls[1][1].expectedVersion, 1);
  assert.deepEqual(audits.map(event => event.action), ["ops.catalog.school.create", "ops.catalog.school.update"]);
  assert.doesNotMatch(JSON.stringify(audits), /zju\.edu|Hangzhou campus|Engineering/);
  for (const invalid of [schoolDocument({ cityId: "not-a-uuid" }), schoolDocument({ websiteUrl: "http://zju.edu.cn" }),
    schoolDocument({ cscaRequired: "no" }), schoolDocument({ qualityScore: 101 })]) {
    const current = fixture();
    await assert.rejects(current.service.createSchool(context(), invalid), error => error.status === 400);
    assert.deepEqual(current.calls, []);
  }
});

test("school publication and archive are stepped-up, version-bound lifecycle commands", async () => {
  const { service, calls } = fixture();
  const admin = context({ activeRole: "cuac_admin", authStrength: "step_up" });
  const reviewDueAt = new Date(Date.now() + 180 * 86_400_000).toISOString();
  await assert.rejects(service.publishSchool(context(), schoolId, { expectedVersion: 1, reviewDueAt }), error => error.status === 403);
  assert.equal((await service.publishSchool(admin, schoolId, { expectedVersion: 1, reviewDueAt })).status, "active");
  assert.equal((await service.archiveSchool(admin, schoolId, { expectedVersion: 2 })).status, "archived");
  assert.equal((await service.restoreSchool(admin, schoolId, { expectedVersion: 3 })).status, "draft");
  assert.deepEqual(calls.map(call => call[0]), ["publishSchool", "archiveSchool", "restoreSchool"]);
});

test("program management validates relationships, official URLs and version-bound lifecycle", async () => {
  const { service, calls, audits } = fixture(), admin = context({ activeRole: "cuac_admin", authStrength: "step_up" });
  await service.createProgram(context(), programDocument());
  await service.updateProgram(context(), programId, { expectedVersion: 1, document: programDocument({ nameEn: "Computer Science Updated" }) });
  const reviewDueAt = new Date(Date.now() + 180 * 86_400_000).toISOString();
  assert.equal((await service.publishProgram(admin, programId, { expectedVersion: 2, reviewDueAt })).status, "active");
  assert.equal((await service.archiveProgram(admin, programId, { expectedVersion: 3 })).status, "archived");
  assert.equal((await service.restoreProgram(admin, programId, { expectedVersion: 4 })).status, "draft");
  assert.deepEqual(calls.map(call => call[0]), ["createProgram","updateProgram","publishProgram","archiveProgram","restoreProgram"]);
  assert.deepEqual(audits.map(event => event.action), ["ops.catalog.program.create","ops.catalog.program.update",
    "ops.catalog.program.publish","ops.catalog.program.archive","ops.catalog.program.restore"]);
  for (const invalid of [programDocument({ cityId: "bad" }), programDocument({ applicationUrl: "http://example.edu" }),
    programDocument({ hasScholarship: "yes" }), programDocument({ tuitionCurrency: "yuan" })]) {
    await assert.rejects(fixture().service.createProgram(context(), invalid), error => error.status === 400);
  }
});

test("scholarship management validates structured content, optional relationships and lifecycle authority", async () => {
  const { service, calls, audits } = fixture(), admin = context({ activeRole: "cuac_admin", authStrength: "step_up" });
  await service.createScholarship(context(), scholarshipDocument());
  await service.updateScholarship(context(), scholarshipId, { expectedVersion: 1,
    document: scholarshipDocument({ title: "Updated scholarship" }) });
  const reviewDueAt = new Date(Date.now() + 180 * 86_400_000).toISOString();
  assert.equal((await service.publishScholarship(admin, scholarshipId, { expectedVersion: 2, reviewDueAt })).status, "active");
  assert.equal((await service.archiveScholarship(admin, scholarshipId, { expectedVersion: 3 })).status, "archived");
  assert.equal((await service.restoreScholarship(admin, scholarshipId, { expectedVersion: 4 })).status, "draft");
  assert.deepEqual(calls.map(call => call[0]), ["createScholarship","updateScholarship","publishScholarship",
    "archiveScholarship","restoreScholarship"]);
  assert.deepEqual(audits.map(event => event.action), ["ops.catalog.scholarship.create","ops.catalog.scholarship.update",
    "ops.catalog.scholarship.publish","ops.catalog.scholarship.archive","ops.catalog.scholarship.restore"]);
  for (const invalid of [scholarshipDocument({ schoolId: "bad" }), scholarshipDocument({ sourceUrl: "http://example.edu" }),
    scholarshipDocument({ bodySections: {} }), scholarshipDocument({ contactInfo: [] }),
    scholarshipDocument({ deadlineDate: "2027-01-01" })]) {
    await assert.rejects(fixture().service.createScholarship(context(), invalid), error => error.status === 400);
  }
});

test("catalog readiness is read-only, strictly filtered and audited without exposing source content", async () => {
  const { service, calls, audits } = fixture();
  const list = await service.listReadiness(context(), { entityType: "program", status: "draft", readiness: "ready",
    reason: "draft_record", query: "computer", limit: 20, offset: 0 });
  const detail = await service.getReadiness(context(), "program", programId);
  assert.equal(list.items[0].ready, true);
  assert.equal(detail.entityId, programId);
  assert.deepEqual(calls.map(call => call[0]), ["listReadiness", "getReadiness"]);
  assert.equal(calls[0][1].reason, "draft_record");
  assert.deepEqual(audits.map(event => event.action), ["ops.catalog.catalog.readiness_list", "ops.catalog.catalog.readiness_read"]);
  assert.doesNotMatch(JSON.stringify(audits), /example\.edu|Computer Science/);
  for (const invalid of [{ entityType: "intake" }, { readiness: "almost" }, { reason: "unknown_reason" }, { limit: 101 }]) {
    await assert.rejects(fixture().service.listReadiness(context(), invalid), error => error.status === 400);
  }
});

test("release manifests freeze explicit unique ready versions and never invoke publication", async () => {
  const { service, calls, audits } = fixture();
  const selections = [{ entityType: "program", entityId: programId, expectedVersion: 1 }];
  const created = await service.createReleaseManifest(context(), { title: "2027 first release", selections });
  const list = await service.listReleaseManifests(context(), { status: "frozen", limit: 20, offset: 0 });
  const detail = await service.getReleaseManifest(context(), manifestId);
  const superseded = await service.supersedeReleaseManifest(context(), manifestId, { expectedVersion: 1 });
  assert.equal(created.manifest.selectionSha256, "a".repeat(64));
  assert.equal(list.total, 1); assert.equal(detail.items[0].driftReasons.length, 0); assert.equal(superseded.status, "superseded");
  assert.deepEqual(calls.map(call => call[0]), ["createReleaseManifest","listReleaseManifests","getReleaseManifest","supersedeReleaseManifest"]);
  assert.ok(calls.every(call => !String(call[0]).toLowerCase().includes("publish")));
  assert.deepEqual(audits.map(event => event.action), ["ops.catalog.release_manifest.create","ops.catalog.release_manifest.list",
    "ops.catalog.release_manifest.read","ops.catalog.release_manifest.supersede"]);
  assert.doesNotMatch(JSON.stringify(audits), /Computer Science|example\.edu/);
  for (const invalid of [
    { title: "", selections },
    { title: "x", selections: [] },
    { title: "x", selections: [...selections, ...selections] },
    { title: "x", selections: [{ ...selections[0], expectedVersion: 0 }] },
  ]) await assert.rejects(fixture().service.createReleaseManifest(context(), invalid), error => error.status === 400);
});

function httpFixture() {
  const calls = [];
  const service = Object.fromEntries(["listCities", "getCity", "createCity", "updateCity", "publishCity", "archiveCity", "restoreCity",
    "listSchools", "getSchool", "createSchool", "updateSchool", "publishSchool", "archiveSchool", "restoreSchool",
    "listPrograms", "getProgram", "createProgram", "updateProgram", "publishProgram", "archiveProgram", "restoreProgram",
    "listScholarships", "getScholarship", "createScholarship", "updateScholarship", "publishScholarship", "archiveScholarship", "restoreScholarship",
    "listReadiness", "getReadiness"]
    .concat(["listReleaseManifests", "getReleaseManifest", "createReleaseManifest", "supersedeReleaseManifest"])
    .map(method => [method, async (...args) => { calls.push({ method, args }); return { method }; }]));
  const auth = {
    async findActiveSessionByTokenHash() { return { userId: actorId, selectedSurface: "ops", activeRole: "cuac_admin",
      tenantSchoolId: null, authStrength: "step_up", expiresAt: new Date(Date.now() + 86_400_000), revokedAt: null,
      accountStatus: "active" }; },
    async findActiveCuacStaffAccessGrantByUserAndRole(userId, role) { return { userId, role, status: "approved",
      expiresAt: new Date(Date.now() + 86_400_000) }; },
  };
  return { calls, handlers: createCatalogAdminHttpHandlers(service, auth) };
}

function request(path, method = "GET", body) {
  return new Request(`https://cuac.test${path}`, { method, headers: { cookie: `${SESSION_COOKIE_NAME}=ops-token`,
    ...(method === "GET" ? {} : { "content-type": "application/json" }) },
  body: method === "GET" ? undefined : JSON.stringify(body ?? {}) });
}

test("catalog city HTTP binds CRUD and lifecycle commands to route identity and server session", async () => {
  const { calls, handlers } = httpFixture(), base = "/api/v1/ops/catalog/cities";
  assert.equal((await handlers.listCities(request(`${base}?limit=20&status=draft`))).status, 200);
  assert.equal((await handlers.createCity(request(base, "POST", document()))).status, 201);
  assert.equal((await handlers.getCity(request(`${base}/${cityId}`), cityId)).status, 200);
  assert.equal((await handlers.updateCity(request(`${base}/${cityId}`, "PATCH", { expectedVersion: 1, document: document() }), cityId)).status, 200);
  assert.equal((await handlers.publishCity(request(`${base}/${cityId}/publication`, "POST", { expectedVersion: 1,
    reviewDueAt: new Date(Date.now() + 180 * 86_400_000).toISOString() }), cityId)).status, 200);
  assert.equal((await handlers.archiveCity(request(`${base}/${cityId}/archive`, "POST", { expectedVersion: 2 }), cityId)).status, 200);
  assert.equal((await handlers.restoreCity(request(`${base}/${cityId}/restore`, "POST", { expectedVersion: 3 }), cityId)).status, 200);
  assert.deepEqual(calls.map(call => call.method), ["listCities", "createCity", "getCity", "updateCity", "publishCity", "archiveCity", "restoreCity"]);
  assert.ok(calls.every(call => call.args[0].purpose === "catalog_management" && call.args[0].selectedSurface === "ops"));
});

test("catalog school HTTP binds CRUD and lifecycle commands to route identity and server session", async () => {
  const { calls, handlers } = httpFixture(), base = "/api/v1/ops/catalog/schools";
  assert.equal((await handlers.listSchools(request(`${base}?limit=20&status=draft`))).status, 200);
  assert.equal((await handlers.createSchool(request(base, "POST", schoolDocument()))).status, 201);
  assert.equal((await handlers.getSchool(request(`${base}/${schoolId}`), schoolId)).status, 200);
  assert.equal((await handlers.updateSchool(request(`${base}/${schoolId}`, "PATCH", { expectedVersion: 1,
    document: schoolDocument() }), schoolId)).status, 200);
  assert.equal((await handlers.publishSchool(request(`${base}/${schoolId}/publication`, "POST", { expectedVersion: 1,
    reviewDueAt: new Date(Date.now() + 180 * 86_400_000).toISOString() }), schoolId)).status, 200);
  assert.equal((await handlers.archiveSchool(request(`${base}/${schoolId}/archive`, "POST", { expectedVersion: 2 }), schoolId)).status, 200);
  assert.equal((await handlers.restoreSchool(request(`${base}/${schoolId}/restore`, "POST", { expectedVersion: 3 }), schoolId)).status, 200);
  assert.deepEqual(calls.map(call => call.method), ["listSchools", "createSchool", "getSchool", "updateSchool",
    "publishSchool", "archiveSchool", "restoreSchool"]);
});

test("catalog program HTTP binds CRUD and lifecycle commands to route identity and server session", async () => {
  const { calls, handlers } = httpFixture(), base = "/api/v1/ops/catalog/programs";
  assert.equal((await handlers.listPrograms(request(`${base}?limit=20&status=draft`))).status, 200);
  assert.equal((await handlers.createProgram(request(base, "POST", programDocument()))).status, 201);
  assert.equal((await handlers.getProgram(request(`${base}/${programId}`), programId)).status, 200);
  assert.equal((await handlers.updateProgram(request(`${base}/${programId}`, "PATCH", { expectedVersion: 1,
    document: programDocument() }), programId)).status, 200);
  assert.equal((await handlers.publishProgram(request(`${base}/${programId}/publication`, "POST", { expectedVersion: 1,
    reviewDueAt: new Date(Date.now() + 180 * 86_400_000).toISOString() }), programId)).status, 200);
  assert.equal((await handlers.archiveProgram(request(`${base}/${programId}/archive`, "POST", { expectedVersion: 2 }), programId)).status, 200);
  assert.equal((await handlers.restoreProgram(request(`${base}/${programId}/restore`, "POST", { expectedVersion: 3 }), programId)).status, 200);
  assert.deepEqual(calls.map(call => call.method), ["listPrograms","createProgram","getProgram","updateProgram",
    "publishProgram","archiveProgram","restoreProgram"]);
});

test("catalog scholarship HTTP binds CRUD and lifecycle commands to route identity and server session", async () => {
  const { calls, handlers } = httpFixture(), base = "/api/v1/ops/catalog/scholarships";
  assert.equal((await handlers.listScholarships(request(`${base}?limit=20&status=draft`))).status, 200);
  assert.equal((await handlers.createScholarship(request(base, "POST", scholarshipDocument()))).status, 201);
  assert.equal((await handlers.getScholarship(request(`${base}/${scholarshipId}`), scholarshipId)).status, 200);
  assert.equal((await handlers.updateScholarship(request(`${base}/${scholarshipId}`, "PATCH", { expectedVersion: 1,
    document: scholarshipDocument() }), scholarshipId)).status, 200);
  assert.equal((await handlers.publishScholarship(request(`${base}/${scholarshipId}/publication`, "POST", { expectedVersion: 1,
    reviewDueAt: new Date(Date.now() + 180 * 86_400_000).toISOString() }), scholarshipId)).status, 200);
  assert.equal((await handlers.archiveScholarship(request(`${base}/${scholarshipId}/archive`, "POST", { expectedVersion: 2 }), scholarshipId)).status, 200);
  assert.equal((await handlers.restoreScholarship(request(`${base}/${scholarshipId}/restore`, "POST", { expectedVersion: 3 }), scholarshipId)).status, 200);
  assert.deepEqual(calls.map(call => call.method), ["listScholarships","createScholarship","getScholarship",
    "updateScholarship","publishScholarship","archiveScholarship","restoreScholarship"]);
});

test("catalog readiness HTTP binds strict list filters and exact entity identity", async () => {
  const { calls, handlers } = httpFixture(), base = "/api/v1/ops/catalog/readiness";
  assert.equal((await handlers.listReadiness(request(`${base}?entityType=program&readiness=blocked&reason=inactive_school&limit=20`))).status, 200);
  assert.equal((await handlers.getReadiness(request(`${base}/program/${programId}`), "program", programId)).status, 200);
  assert.deepEqual(calls.map(call => call.method), ["listReadiness", "getReadiness"]);
  assert.equal(calls[0].args[1].reason, "inactive_school");
  assert.equal((await handlers.listReadiness(request(`${base}?unknown=1`))).status, 400);
});

test("release manifest HTTP exposes immutable planning commands without a publication endpoint", async () => {
  const { calls, handlers } = httpFixture(), base = "/api/v1/ops/catalog/release-manifests";
  assert.equal((await handlers.listReleaseManifests(request(`${base}?status=frozen&limit=20`))).status, 200);
  assert.equal((await handlers.createReleaseManifest(request(base, "POST", { title: "Release",
    selections: [{ entityType: "program", entityId: programId, expectedVersion: 1 }] }))).status, 201);
  assert.equal((await handlers.getReleaseManifest(request(`${base}/${manifestId}`), manifestId)).status, 200);
  assert.equal((await handlers.supersedeReleaseManifest(request(`${base}/${manifestId}/supersede`, "POST",
    { expectedVersion: 1 }), manifestId)).status, 200);
  assert.deepEqual(calls.map(call => call.method), ["listReleaseManifests","createReleaseManifest",
    "getReleaseManifest","supersedeReleaseManifest"]);
  assert.equal((await handlers.listReleaseManifests(request(`${base}?unknown=1`))).status, 400);
});
