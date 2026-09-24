import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { PostgresCatalogAdminRepository } from "../src/server/catalog-admin/postgres-repository.ts";
import type { TransactionalSqlClient } from "../src/server/db/postgres-client.ts";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for the catalog admin rehearsal.");
const parsed = new URL(databaseUrl);
if (!(["127.0.0.1", "localhost"].includes(parsed.hostname))) {
  throw new Error("Catalog admin rehearsal is restricted to loopback PostgreSQL.");
}

const pool = new pg.Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 5000, statement_timeout: 10_000 });
const connection = await pool.connect();
const tx: TransactionalSqlClient = {
  async query<T extends Record<string, unknown>>(statement: string, params: readonly unknown[]) {
    return (await connection.query(statement, [...params])).rows as T[];
  },
  async transaction<T>(work: (client: TransactionalSqlClient) => Promise<T>) { return work(tx); },
};

try {
  await connection.query("begin");
  const actors = await tx.query<{ actorUserId: string; activeRole: "cuac_admin" }>(`select u.id::text as "actorUserId",'cuac_admin'::text as "activeRole"
    from users u join user_roles r on r.user_id=u.id and r.role='cuac_admin' and r.revoked_at is null
    join cuac_staff_access_grants g on g.user_id=u.id and g.requested_role='cuac_admin' and g.status='approved'
      and g.revoked_at is null and g.expires_at>clock_timestamp()
    where u.account_status='active' limit 1`, []);
  assert.ok(actors[0], "Local rehearsal requires an active CUAC admin fixture.");
  const actor = actors[0], repository = new PostgresCatalogAdminRepository(tx);
  const slug = `rehearsal-${randomUUID().slice(0, 8)}`;
  const document = { slug, nameZh: "目录演练城市", nameEn: "Catalog Rehearsal City", region: "Test", province: "Test",
    monthlyCost: "RMB 1,000", monthlyCostRmb: 1000, costLevel: "test", density: "test", tags: ["rehearsal"],
    content: { summary: "Transactional rehearsal only" }, nearby: [], sortOrder: 9999,
    sourceUrl: "https://example.edu/catalog-rehearsal", sourceLabel: "Rehearsal official source", sourceNote: null };

  const created = await repository.createCity({ ...actor, city: document });
  assert.equal(created.authorized, true); assert.ok(created.value); assert.equal(created.value.version, 1);
  const stale = await repository.updateCity({ ...actor, cityId: created.value.id, expectedVersion: 999, city: document });
  assert.deepEqual(stale, { authorized: true, value: null });
  const updated = await repository.updateCity({ ...actor, cityId: created.value.id, expectedVersion: 1,
    city: { ...document, nameEn: "Catalog Rehearsal City Updated" } });
  assert.equal(updated.authorized, true); assert.equal(updated.value?.version, 2);
  const published = await repository.publishCity({ ...actor, cityId: created.value.id, expectedVersion: 2,
    reviewDueAt: new Date(Date.now() + 180 * 86_400_000) });
  assert.equal(published.authorized, true); assert.equal(published.value?.status, "active");
  const archived = await repository.archiveCity({ ...actor, cityId: created.value.id, expectedVersion: 3 });
  assert.equal(archived.authorized, true); assert.equal(archived.value?.status, "archived");
  const restored = await repository.restoreCity({ ...actor, cityId: created.value.id, expectedVersion: 4 });
  assert.equal(restored.authorized, true); assert.equal(restored.value?.status, "draft");
  const details = await repository.getCity({ ...actor, cityId: created.value.id });
  assert.equal(details.authorized, true); assert.equal(details.value?.revisions.length, 5);
  assert.deepEqual(details.value?.revisions.map(item => item.action), ["restored", "archived", "published", "updated", "created"]);
  const cityRepublished = await repository.publishCity({ ...actor, cityId: created.value.id, expectedVersion: 5,
    reviewDueAt: new Date(Date.now() + 180 * 86_400_000) });
  assert.equal(cityRepublished.authorized, true); assert.ok(cityRepublished.value); assert.equal(cityRepublished.value.status, "active");
  const schoolSlug = `school-rehearsal-${randomUUID().slice(0, 8)}`, activeCity = cityRepublished.value;
  const schoolDocument = { slug: schoolSlug, nameZh: "目录演练大学", nameEn: "Catalog Rehearsal University",
    schoolType: "University", region: "Test", cityId: activeCity.id, city: activeCity.nameEn,
    cityZh: activeCity.nameZh, citySlug: activeCity.slug, province: activeCity.province, regionLabel: "Test",
    ranking: null, cscaRequired: false, cscaRequirement: null, cscaSubjects: [], applicationLevel: "Undergraduate",
    languageOfInstruction: "English", languageRequirement: null, hskRequirement: null, englishRequirement: null,
    deadlineSummary: null, tuitionSummary: null, applicationFee: null, websiteUrl: "https://example.edu/",
    admissionsUrl: "https://example.edu/admissions", subjectTags: ["Rehearsal"], fitNotes: null,
    languageTags: ["English"], tuitionBandLabel: null, campusHighlights: ["Transactional rehearsal"], contactNotes: null,
    qualityScore: 100, missingFields: [], completenessLabel: "Complete", sourceUrl: "https://example.edu/school-rehearsal",
    sourceLabel: "Rehearsal official source", sourceNote: null };
  const invalidRelationship = await repository.createSchool({ ...actor,
    school: { ...schoolDocument, slug: `${schoolSlug}-invalid`, cityId: randomUUID() } });
  assert.deepEqual(invalidRelationship, { authorized: true, value: null });
  const schoolCreated = await repository.createSchool({ ...actor,
    school: { ...schoolDocument, city: "Forged City", cityZh: "错误城市", citySlug: "forged-city", province: "Forged" } });
  assert.equal(schoolCreated.authorized, true); assert.ok(schoolCreated.value); assert.equal(schoolCreated.value.version, 1);
  assert.equal(schoolCreated.value.city, activeCity.nameEn); assert.equal(schoolCreated.value.citySlug, activeCity.slug);
  const blockedCityArchive = await repository.archiveCity({ ...actor, cityId: activeCity.id, expectedVersion: 6 });
  assert.deepEqual(blockedCityArchive, { authorized: true, value: null });
  const schoolStale = await repository.updateSchool({ ...actor, schoolId: schoolCreated.value.id, expectedVersion: 999,
    school: schoolDocument });
  assert.deepEqual(schoolStale, { authorized: true, value: null });
  const schoolUpdated = await repository.updateSchool({ ...actor, schoolId: schoolCreated.value.id, expectedVersion: 1,
    school: { ...schoolDocument, nameEn: "Catalog Rehearsal University Updated" } });
  assert.equal(schoolUpdated.authorized, true); assert.equal(schoolUpdated.value?.version, 2);
  const schoolPublished = await repository.publishSchool({ ...actor, schoolId: schoolCreated.value.id, expectedVersion: 2,
    reviewDueAt: new Date(Date.now() + 180 * 86_400_000) });
  assert.equal(schoolPublished.authorized, true); assert.equal(schoolPublished.value?.status, "active");
  const activeEdited = await repository.updateSchool({ ...actor, schoolId: schoolCreated.value.id, expectedVersion: 3,
    school: { ...schoolDocument, nameEn: "Catalog Rehearsal University Republish" } });
  assert.equal(activeEdited.authorized, true); assert.equal(activeEdited.value?.status, "draft");
  assert.equal(activeEdited.value?.verificationStatus, "unverified");
  const republished = await repository.publishSchool({ ...actor, schoolId: schoolCreated.value.id, expectedVersion: 4,
    reviewDueAt: new Date(Date.now() + 180 * 86_400_000) });
  assert.equal(republished.authorized, true); assert.equal(republished.value?.status, "active");
  const programSlug = `program-rehearsal-${randomUUID().slice(0, 8)}`;
  const programDocument = { schoolId: schoolCreated.value.id, cityId: activeCity.id, slug: programSlug,
    nameZh: "目录演练项目", nameEn: "Catalog Rehearsal Program", degreeLevel: "Bachelor", durationYears: 4,
    durationMonths: null, fieldCategory: "Engineering", subjectArea: "Rehearsal", teachingLanguage: "English",
    cscaSubjects: ["Mathematics"], cscaRequirement: null, hskRequirement: null, englishRequirement: "IELTS 6.0",
    tuitionAmount: 10000, tuitionCurrency: "CNY", tuitionPeriod: "year", tuitionText: "CNY 10,000/year",
    scholarshipText: null, applicationUrl: "https://example.edu/apply", applicationNote: null,
    hasScholarship: false, badgeText: null, displayTuition: "RMB 10,000", displaySubjects: ["Mathematics"],
    displayGroup: "rehearsal", displayGroupLabel: "Rehearsal", sortOrder: 9999,
    sourceUrl: "https://example.edu/program-rehearsal", sourceLabel: "Rehearsal official source", sourceNote: null };
  const invalidProgramRelationship = await repository.createProgram({ ...actor,
    program: { ...programDocument, slug: `${programSlug}-invalid`, cityId: randomUUID() } });
  assert.deepEqual(invalidProgramRelationship, { authorized: true, value: null });
  const programCreated = await repository.createProgram({ ...actor, program: programDocument });
  assert.equal(programCreated.authorized, true); assert.ok(programCreated.value); assert.equal(programCreated.value.version, 1);
  const programStale = await repository.updateProgram({ ...actor, programId: programCreated.value.id,
    expectedVersion: 999, program: programDocument });
  assert.deepEqual(programStale, { authorized: true, value: null });
  const programUpdated = await repository.updateProgram({ ...actor, programId: programCreated.value.id,
    expectedVersion: 1, program: { ...programDocument, nameEn: "Catalog Rehearsal Program Updated" } });
  assert.equal(programUpdated.authorized, true); assert.equal(programUpdated.value?.version, 2);
  const programPublished = await repository.publishProgram({ ...actor, programId: programCreated.value.id,
    expectedVersion: 2, reviewDueAt: new Date(Date.now() + 180 * 86_400_000) });
  assert.equal(programPublished.authorized, true); assert.equal(programPublished.value?.status, "active");
  const programActiveEdited = await repository.updateProgram({ ...actor, programId: programCreated.value.id,
    expectedVersion: 3, program: { ...programDocument, nameEn: "Catalog Rehearsal Program Republish" } });
  assert.equal(programActiveEdited.authorized, true); assert.equal(programActiveEdited.value?.status, "draft");
  const programRepublished = await repository.publishProgram({ ...actor, programId: programCreated.value.id,
    expectedVersion: 4, reviewDueAt: new Date(Date.now() + 180 * 86_400_000) });
  assert.equal(programRepublished.authorized, true); assert.equal(programRepublished.value?.status, "active");
  const scholarshipSlug = `scholarship-rehearsal-${randomUUID().slice(0, 8)}`;
  const scholarshipDocument = { slug: scholarshipSlug, title: "Catalog Rehearsal Scholarship", nameZh: "目录演练奖学金",
    type: "university", typeLabel: "University scholarship", fundingLevel: "Partial",
    providerName: "目录演练大学", providerNameEn: "Catalog Rehearsal University", providerLocation: "Test",
    schoolId: schoolCreated.value.id, programId: programCreated.value.id, coverage: "Tuition waiver",
    applicableDegree: "Bachelor", applicableProgram: "Catalog Rehearsal Program", amountText: "CNY 5,000",
    requirementText: "Rehearsal only", bodySections: [], benefitItems: [], eligibilityItems: [],
    applicationMaterials: [], applicationSteps: [], contactInfo: {},
    actionLinks: [{ label: "Official page", url: "https://example.edu/scholarship-rehearsal" }],
    deadlineDate: new Date(Date.now() + 220 * 86_400_000), deadlineLabel: "Rehearsal deadline", applicationRound: "2099",
    targetCountries: [], targetRegions: [], benefits: ["Tuition"], tags: ["rehearsal"], summary: "Transactional rehearsal only",
    sortOrder: 9999, sourceUrl: "https://example.edu/scholarship-rehearsal",
    sourceLabel: "Rehearsal official source", sourceNote: null };
  const invalidScholarshipRelationship = await repository.createScholarship({ ...actor,
    scholarship: { ...scholarshipDocument, slug: `${scholarshipSlug}-invalid`, schoolId: randomUUID() } });
  assert.deepEqual(invalidScholarshipRelationship, { authorized: true, value: null });
  const scholarshipCreated = await repository.createScholarship({ ...actor,
    scholarship: { ...scholarshipDocument, schoolId: null } });
  assert.equal(scholarshipCreated.authorized, true); assert.ok(scholarshipCreated.value);
  assert.equal(scholarshipCreated.value.schoolId, schoolCreated.value.id);
  const scholarshipStale = await repository.updateScholarship({ ...actor, scholarshipId: scholarshipCreated.value.id,
    expectedVersion: 999, scholarship: scholarshipDocument });
  assert.deepEqual(scholarshipStale, { authorized: true, value: null });
  const scholarshipUpdated = await repository.updateScholarship({ ...actor, scholarshipId: scholarshipCreated.value.id,
    expectedVersion: 1, scholarship: { ...scholarshipDocument, title: "Catalog Rehearsal Scholarship Updated" } });
  assert.equal(scholarshipUpdated.authorized, true); assert.equal(scholarshipUpdated.value?.version, 2);
  const scholarshipPublished = await repository.publishScholarship({ ...actor, scholarshipId: scholarshipCreated.value.id,
    expectedVersion: 2, reviewDueAt: new Date(Date.now() + 180 * 86_400_000) });
  assert.equal(scholarshipPublished.authorized, true); assert.equal(scholarshipPublished.value?.status, "active");
  const scholarshipActiveEdited = await repository.updateScholarship({ ...actor, scholarshipId: scholarshipCreated.value.id,
    expectedVersion: 3, scholarship: { ...scholarshipDocument, title: "Catalog Rehearsal Scholarship Republish" } });
  assert.equal(scholarshipActiveEdited.authorized, true); assert.equal(scholarshipActiveEdited.value?.status, "draft");
  const scholarshipRepublished = await repository.publishScholarship({ ...actor, scholarshipId: scholarshipCreated.value.id,
    expectedVersion: 4, reviewDueAt: new Date(Date.now() + 180 * 86_400_000) });
  assert.equal(scholarshipRepublished.authorized, true); assert.equal(scholarshipRepublished.value?.status, "active");
  const applicationSet = await tx.query<{ id: string; userId: string }>(`select id::text as id,user_id::text as "userId"
    from application_sets order by created_at limit 1`, []);
  assert.ok(applicationSet[0], "Local rehearsal requires an application-set fixture.");
  const choice = await tx.query<{ id: string }>(`insert into application_choices
    (application_set_id,user_id,school_id,program_id,scholarship_id,status)
    values ($1,$2,$3,$4,$5,'draft') returning id::text as id`,
  [applicationSet[0].id,applicationSet[0].userId,schoolCreated.value.id,programCreated.value.id,scholarshipCreated.value.id]);
  const blockedScholarshipArchive = await repository.archiveScholarship({ ...actor,
    scholarshipId: scholarshipCreated.value.id, expectedVersion: 5 });
  assert.deepEqual(blockedScholarshipArchive, { authorized: true, value: null });
  await tx.query("update application_choices set status='removed',removed_at=clock_timestamp() where id=$1", [choice[0].id]);
  const scholarshipArchived = await repository.archiveScholarship({ ...actor,
    scholarshipId: scholarshipCreated.value.id, expectedVersion: 5 });
  assert.equal(scholarshipArchived.authorized, true); assert.equal(scholarshipArchived.value?.status, "archived");
  const scholarshipRestored = await repository.restoreScholarship({ ...actor,
    scholarshipId: scholarshipCreated.value.id, expectedVersion: 6 });
  assert.equal(scholarshipRestored.authorized, true); assert.equal(scholarshipRestored.value?.status, "draft");
  const scholarshipRearchived = await repository.archiveScholarship({ ...actor,
    scholarshipId: scholarshipCreated.value.id, expectedVersion: 7 });
  assert.equal(scholarshipRearchived.authorized, true); assert.equal(scholarshipRearchived.value?.status, "archived");
  const scholarshipDetails = await repository.getScholarship({ ...actor, scholarshipId: scholarshipCreated.value.id });
  assert.equal(scholarshipDetails.authorized, true); assert.equal(scholarshipDetails.value?.revisions.length, 8);
  const scholarshipList = await repository.listScholarships({ ...actor, query: scholarshipSlug, status: "archived", limit: 10, offset: 0 });
  assert.equal(scholarshipList.authorized, true); assert.equal(scholarshipList.value.total, 1);
  const intake = await tx.query<{ id: string }>(`insert into program_intakes (program_id,intake_term,intake_year,status)
    values ($1,'Fall',2099,'open') returning id::text as id`, [programCreated.value.id]);
  assert.ok(intake[0]);
  const blockedProgramArchive = await repository.archiveProgram({ ...actor, programId: programCreated.value.id, expectedVersion: 5 });
  assert.deepEqual(blockedProgramArchive, { authorized: true, value: null });
  await tx.query("update program_intakes set status='closed' where id=$1", [intake[0].id]);
  const programArchived = await repository.archiveProgram({ ...actor, programId: programCreated.value.id, expectedVersion: 5 });
  assert.equal(programArchived.authorized, true); assert.equal(programArchived.value?.status, "archived");
  const programRestored = await repository.restoreProgram({ ...actor, programId: programCreated.value.id, expectedVersion: 6 });
  assert.equal(programRestored.authorized, true); assert.equal(programRestored.value?.status, "draft");
  const programRearchived = await repository.archiveProgram({ ...actor, programId: programCreated.value.id, expectedVersion: 7 });
  assert.equal(programRearchived.authorized, true); assert.equal(programRearchived.value?.status, "archived");
  const programDetails = await repository.getProgram({ ...actor, programId: programCreated.value.id });
  assert.equal(programDetails.authorized, true); assert.equal(programDetails.value?.revisions.length, 8);
  assert.equal(programDetails.value?.dependencies.intakeCount, 1);
  const programList = await repository.listPrograms({ ...actor, query: programSlug, status: "archived", limit: 10, offset: 0 });
  assert.equal(programList.authorized, true); assert.equal(programList.value.total, 1);
  assert.equal(programList.value.items[0]?.id, programCreated.value.id);
  const blockedArchive = await repository.archiveSchool({ ...actor, schoolId: schoolCreated.value.id, expectedVersion: 5 });
  assert.equal(blockedArchive.authorized, true); assert.equal(blockedArchive.value?.status, "archived");
  const schoolArchived = blockedArchive;
  assert.equal(schoolArchived.authorized, true); assert.equal(schoolArchived.value?.status, "archived");
  const schoolRestored = await repository.restoreSchool({ ...actor, schoolId: schoolCreated.value.id, expectedVersion: 6 });
  assert.equal(schoolRestored.authorized, true); assert.equal(schoolRestored.value?.status, "draft");
  const schoolDetails = await repository.getSchool({ ...actor, schoolId: schoolCreated.value.id });
  assert.equal(schoolDetails.authorized, true); assert.equal(schoolDetails.value?.revisions.length, 7);
  assert.deepEqual(schoolDetails.value?.revisions.map(item => item.action),
    ["restored", "archived", "published", "updated", "published", "updated", "created"]);
  const schoolList = await repository.listSchools({ ...actor, query: schoolSlug, status: "draft", limit: 10, offset: 0 });
  assert.equal(schoolList.authorized, true); assert.equal(schoolList.value.total, 1);
  assert.equal(schoolList.value.items[0]?.id, schoolCreated.value.id);
  const mixedLegacyList = await repository.listSchools({ ...actor, query: null, status: null, limit: 100, offset: 0 });
  assert.equal(mixedLegacyList.authorized, true); assert.ok(mixedLegacyList.value.total >= 1);
  const readiness = await repository.listReadiness({ ...actor, entityType: null, status: null, readiness: null,
    reason: null, query: "rehearsal", limit: 100, offset: 0 });
  assert.equal(readiness.authorized, true); assert.ok(readiness.value.total >= 4);
  assert.ok(readiness.value.summary.total >= readiness.value.total);
  assert.ok(readiness.value.items.some(item => item.entityType === "city" && item.entityId === activeCity.id && item.ready));
  assert.ok(readiness.value.items.some(item => item.entityType === "program" && item.entityId === programCreated.value.id
    && !item.ready && item.blockingReasons.includes("archived")));
  const readinessDetail = await repository.getReadiness({ ...actor, entityType: "scholarship",
    entityId: scholarshipCreated.value.id });
  assert.equal(readinessDetail.authorized, true); assert.equal(readinessDetail.value?.ready, false);
  assert.ok(readinessDetail.value?.blockingReasons.includes("archived"));
  const blockedReadiness = await repository.listReadiness({ ...actor, entityType: null, status: null,
    readiness: "blocked", reason: null, query: null, limit: 20_000, offset: 0 });
  assert.equal(blockedReadiness.authorized, true);
  assert.equal(blockedReadiness.value.items.length, blockedReadiness.value.total);
  assert.ok(blockedReadiness.value.items.every(item => !item.ready && item.blockingReasons.length > 0));
  const releaseCreated = await repository.createReleaseManifest({ ...actor, title: "Transactional release rehearsal",
    selections: [
      { entityType: "city", entityId: activeCity.id, expectedVersion: cityRepublished.value.version },
      { entityType: "school", entityId: schoolCreated.value.id, expectedVersion: schoolRestored.value!.version },
    ] });
  assert.equal(releaseCreated.authorized, true); assert.ok(releaseCreated.value);
  assert.equal(releaseCreated.value.manifest.status, "frozen");
  assert.equal(releaseCreated.value.manifest.itemCount, 2);
  assert.equal(releaseCreated.value.manifest.driftedItemCount, 0);
  assert.match(releaseCreated.value.manifest.selectionSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(releaseCreated.value.items.map(item => item.entityType), ["city", "school"]);
  const staleRelease = await repository.createReleaseManifest({ ...actor, title: "Stale release rehearsal",
    selections: [{ entityType: "city", entityId: activeCity.id, expectedVersion: 999 }] });
  assert.deepEqual(staleRelease, { authorized: true, value: null });
  await connection.query("savepoint manifest_item_immutability");
  await assert.rejects(connection.query("update catalog_release_manifest_items set label='tampered' where manifest_id=$1",
    [releaseCreated.value.manifest.id]), /immutable/i);
  await connection.query("rollback to savepoint manifest_item_immutability");
  const driftedCity = await repository.updateCity({ ...actor, cityId: activeCity.id,
    expectedVersion: cityRepublished.value.version, city: { ...document, nameEn: "Catalog Rehearsal City Drifted" } });
  assert.equal(driftedCity.authorized, true); assert.equal(driftedCity.value?.version, 7);
  const driftedManifest = await repository.getReleaseManifest({ ...actor, manifestId: releaseCreated.value.manifest.id });
  assert.equal(driftedManifest.authorized, true); assert.equal(driftedManifest.value?.manifest.driftedItemCount, 2);
  assert.ok(driftedManifest.value?.items.some(item => item.entityType === "city"
    && item.driftReasons.includes("version_changed")));
  assert.ok(driftedManifest.value?.items.some(item => item.entityType === "school"
    && item.driftReasons.includes("readiness_blocked")));
  const supersededRelease = await repository.supersedeReleaseManifest({ ...actor,
    manifestId: releaseCreated.value.manifest.id, expectedVersion: 1 });
  assert.equal(supersededRelease.authorized, true); assert.equal(supersededRelease.value?.status, "superseded");
  assert.equal(supersededRelease.value?.version, 2); assert.equal(supersededRelease.value?.driftedItemCount, 2);
  const staleSupersede = await repository.supersedeReleaseManifest({ ...actor,
    manifestId: releaseCreated.value.manifest.id, expectedVersion: 1 });
  assert.deepEqual(staleSupersede, { authorized: true, value: null });
  const releaseList = await repository.listReleaseManifests({ ...actor, status: "superseded", limit: 10, offset: 0 });
  assert.equal(releaseList.authorized, true); assert.equal(releaseList.value.total, 1);
  assert.equal(releaseList.value.items[0]?.driftedItemCount, 2);
  await connection.query("savepoint manifest_delete_immutability");
  await assert.rejects(connection.query("delete from catalog_release_manifests where id=$1",
    [releaseCreated.value.manifest.id]), /cannot be deleted/i);
  await connection.query("rollback to savepoint manifest_delete_immutability");
  console.log(JSON.stringify({ ok: true, city: { finalVersion: cityRepublished.value?.version,
    revisionCount: 6, dependencyArchiveBlocked: true }, school: { finalVersion: schoolRestored.value?.version,
    revisionCount: schoolDetails.value?.revisions.length, dependencyArchiveBlocked: true },
    program: { finalVersion: programRearchived.value?.version, revisionCount: programDetails.value?.revisions.length,
      dependencyArchiveBlocked: true }, scholarship: { finalVersion: scholarshipRearchived.value?.version,
      revisionCount: scholarshipDetails.value?.revisions.length, dependencyArchiveBlocked: true },
    readiness: { filteredTotal: readiness.value.total, summaryTotal: readiness.value.summary.total,
      blockedTotal: blockedReadiness.value.total, everyBlockExplained: true,
      exactDetailBlocked: !readinessDetail.value?.ready },
    releaseManifest: { frozenItemCount: releaseCreated.value.manifest.itemCount, immutableItems: true,
      driftedItemCount: driftedManifest.value?.manifest.driftedItemCount, supersededVersion: supersededRelease.value?.version,
      staleCreationRejected: !staleRelease.value, staleSupersedeRejected: !staleSupersede.value } }));
} finally {
  await connection.query("rollback").catch(() => undefined);
  connection.release();
  await pool.end();
}
