import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PostgresAuditWriter } from "../src/server/audit/postgres-writer.ts";
import { AuthCredentialsService } from "../src/server/auth/credentials.ts";
import { PostgresAuthSessionRepository } from "../src/server/auth/postgres-repository.ts";
import { CatalogSeedWriter } from "../src/server/catalog/seed-writer.ts";
import { createPostgresPool, createTransactionalSqlClient } from "../src/server/db/postgres-client.ts";
import { createRequestContext } from "../src/server/shared/request-context.ts";
import { PostgresOfficialSubmissionPolicyGovernance } from "../src/server/submission-policy/postgres-governance.ts";
import { createPostgresStudentService } from "../src/server/student/runtime/routes.ts";

const projectDir = fileURLToPath(new URL("../", import.meta.url));
const fixturePath = resolve(projectDir, "seeds/catalog.local.synthetic.json");
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

function assertLocalOnly(): void {
  if (process.env.CUAC_LOCAL_RUNTIME !== "1" || process.env.CUAC_ENV !== "development") throw new Error("Local seed requires the generated development runtime.");
  const databaseUrl = new URL(required("DATABASE_URL"));
  if (databaseUrl.protocol !== "postgresql:" || databaseUrl.hostname !== "127.0.0.1" || databaseUrl.search || databaseUrl.hash) {
    throw new Error("Local seed refuses non-loopback or non-PostgreSQL targets.");
  }
  for (const name of ["CUAC_LOCAL_STUDENT_EMAIL", "CUAC_LOCAL_SCHOOL_EMAIL", "CUAC_LOCAL_OPS_EMAIL", "CUAC_LOCAL_ADMIN_EMAIL"]) {
    if (required(name).split("@")[1] !== "local.cuac.invalid") throw new Error("Local seed requires synthetic account domains.");
  }
}

function fixtureIds() {
  const applicationSetId = required("CUAC_LOCAL_APPLICATION_SET_ID");
  const choiceIds = JSON.parse(required("CUAC_LOCAL_CHOICE_IDS_JSON")) as unknown;
  if (!uuidPattern.test(applicationSetId) || !Array.isArray(choiceIds) || choiceIds.length !== 3
    || choiceIds.some(id => typeof id !== "string" || !uuidPattern.test(id)) || new Set(choiceIds).size !== 3) {
    throw new Error("Local fixture IDs are invalid.");
  }
  return { applicationSetId, choiceIds: choiceIds as [string, string, string] };
}

function safeLocalSeedFailure(error: unknown): string {
  const failure = error as { message?: unknown; code?: unknown; constraint?: unknown };
  let message = typeof failure?.message === "string" ? failure.message : "Unknown local seed error.";
  for (const name of ["DATABASE_URL", "CUAC_LOCAL_STUDENT_EMAIL", "CUAC_LOCAL_STUDENT_PASSWORD",
    "CUAC_LOCAL_SCHOOL_EMAIL", "CUAC_LOCAL_SCHOOL_PASSWORD", "CUAC_LOCAL_OPS_EMAIL", "CUAC_LOCAL_OPS_PASSWORD",
    "CUAC_LOCAL_ADMIN_EMAIL", "CUAC_LOCAL_ADMIN_PASSWORD"]) {
    const secret = process.env[name];
    if (secret) message = message.replaceAll(secret, `[${name}]`);
  }
  message = message.replace(/[A-Za-z0-9._%+-]+@local\.cuac\.invalid/gi, "[LOCAL_SYNTHETIC_EMAIL]");
  const metadata = [failure.code, failure.constraint].filter(value => typeof value === "string").join("/");
  return `${metadata ? `${metadata}: ` : ""}${message}`;
}

assertLocalOnly();
const ids = fixtureIds();
const studentEmail = required("CUAC_LOCAL_STUDENT_EMAIL");
const studentPassword = required("CUAC_LOCAL_STUDENT_PASSWORD");
const schoolEmail = required("CUAC_LOCAL_SCHOOL_EMAIL");
const schoolPassword = required("CUAC_LOCAL_SCHOOL_PASSWORD");
const opsEmail = required("CUAC_LOCAL_OPS_EMAIL");
const opsPassword = required("CUAC_LOCAL_OPS_PASSWORD");
const adminEmail = required("CUAC_LOCAL_ADMIN_EMAIL");
const adminPassword = required("CUAC_LOCAL_ADMIN_PASSWORD");
const pool = createPostgresPool({ max: 2, applicationName: "cuac:local-seed" });
const client = createTransactionalSqlClient(pool);

async function ensureLocalSubmissionPolicies(studentUserId: string, preparerUserId: string, reviewerUserId: string) {
  const targets = await client.query<{ choiceId: string; schoolId: string; programId: string; programIntakeId: string; admissionRouteKey: string | null }>(
    `select id as "choiceId", school_id as "schoolId", program_id as "programId",
       program_intake_id as "programIntakeId", admission_route_key as "admissionRouteKey"
     from application_choices where application_set_id = $1 and user_id = $2 and removed_at is null
     order by school_id, program_intake_id`,
    [ids.applicationSetId, studentUserId],
  );
  if (targets.length !== ids.choiceIds.length || targets.some(target => !target.programId || !target.programIntakeId)) {
    throw new Error("Synthetic application policy targets are incomplete.");
  }
  const grouped = new Map<string, typeof targets>();
  for (const target of targets) grouped.set(target.schoolId, [...(grouped.get(target.schoolId) || []), target]);
  const governance = new PostgresOfficialSubmissionPolicyGovernance(client);
  const base = { selectedSurface: "ops" as const, purpose: "catalog_management" as const, tenantSchoolId: null };
  const preparer = createRequestContext({ ...base, actorUserId: preparerUserId, activeRole: "cuac_ops", authStrength: "session" });
  const reviewer = createRequestContext({ ...base, actorUserId: reviewerUserId, activeRole: "cuac_admin", authStrength: "step_up" });

  for (const [schoolId, schoolTargets] of grouped) {
    const targetIds = schoolTargets.map(target => target.programIntakeId);
    const current = await client.query<{ programIntakeId: string }>(
      `select program_intake_id as "programIntakeId" from official_submission_policy_publications
       where admission_route_key = 'direct_university' and status = 'active'
         and program_intake_id = any($1::uuid[]) order by program_intake_id`,
      [targetIds],
    );
    if (current.length !== schoolTargets.length) {
      if (current.length) throw new Error("Synthetic submission-policy publications require reconciliation.");
      const policyTargets = schoolTargets.map(target => ({ programId: target.programId, programIntakeId: target.programIntakeId }));
      const document = {
        schemaVersion: 1 as const,
        admissionRouteKey: "direct_university",
        formMode: "one_program_per_form" as const,
        maxProgramChoices: Math.max(1, schoolTargets.length),
        orderingMode: schoolTargets.length > 1 ? "ranked" as const : "none" as const,
        externalChannelType: "university_portal" as const,
        sources: [{
          key: "local_official_admissions_notice",
          url: "https://admissions.example.edu/cuac-local-policy",
          title: "Synthetic local admissions delivery policy",
          capturedAt: "2026-01-01T00:00:00.000Z",
          contentSha256: "a".repeat(64),
        }],
      };
      const policyKey = "local_direct_application_2027";
      const draft = await governance.createDraft(preparer, schoolId, policyKey, "direct_university", {
        versionId: randomUUID(), document, targets: policyTargets,
      });
      const approved = await governance.approve(reviewer, schoolId, policyKey, "direct_university", {
        versionId: draft.versionId,
        expectedDocumentSha256: draft.documentSha256,
        expectedTargetSetSha256: draft.targetSetSha256,
        effectiveFrom: null,
        reviewDueAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        sourceChecks: document.sources.map(source => ({ sourceKey: source.key, contentSha256: source.contentSha256, officialSourceConfirmed: true })),
        scopeConfirmed: true,
        routingConfirmed: true,
      });
      await governance.publish(reviewer, schoolId, policyKey, "direct_university", {
        versionId: approved.versionId,
        expectedDocumentSha256: approved.documentSha256,
        expectedTargetSetSha256: approved.targetSetSha256,
        expectedApprovalSha256: approved.approvalSha256,
        expectedPublications: approved.targets.map(target => ({ programIntakeId: target.programIntakeId, expectedRevision: 0 })),
      });
    }
  }

  const student = createPostgresStudentService(client);
  const context = createRequestContext({ actorUserId: studentUserId, activeRole: "student", selectedSurface: "student",
    purpose: "student_action", authStrength: "session", tenantSchoolId: null });
  for (const target of targets.filter(target => target.admissionRouteKey !== "direct_university")) {
    const set = await student.getOwnApplicationSet(context, ids.applicationSetId);
    if (!set) throw new Error("Synthetic application set is unavailable while binding its submission policy.");
    await student.updateOwnApplicationChoice(context, ids.applicationSetId, target.choiceId,
      { expectedRevision: set.revision, admissionRouteKey: "direct_university" });
  }
  return targets.length;
}

try {
  const accountRepository = new PostgresAuthSessionRepository(client);
  const accountInputs = [
    { email: studentEmail, password: studentPassword, displayName: "Local Student" },
    { email: schoolEmail, password: schoolPassword, displayName: "Local School Staff" },
    { email: opsEmail, password: opsPassword, displayName: "Local CUAC Ops" },
    { email: adminEmail, password: adminPassword, displayName: "Local CUAC Admin Reviewer" },
  ] as const;
  const identities = new Map<string, { userId: string }>();
  for (const account of accountInputs) {
    let identity = await accountRepository.findPasswordIdentityByEmailNormalized(account.email.toLowerCase());
    if (!identity) {
      const session = await client.transaction(tx => new AuthCredentialsService(new PostgresAuthSessionRepository(tx), {
        auditSink: new PostgresAuditWriter(tx),
      }).registerStudent(account));
      await client.transaction(tx => new AuthCredentialsService(new PostgresAuthSessionRepository(tx), {
        auditSink: new PostgresAuditWriter(tx),
      }).revokeSession(session.sessionToken));
      identity = await accountRepository.findPasswordIdentityByEmailNormalized(account.email.toLowerCase());
    }
    if (!identity) throw new Error("Synthetic local account was not created.");
    identities.set(account.email, { userId: identity.userId });
  }
  const studentIdentity = identities.get(studentEmail)!;
  const schoolIdentity = identities.get(schoolEmail)!;
  const opsIdentity = identities.get(opsEmail)!;
  const adminIdentity = identities.get(adminEmail)!;
  const bundle = JSON.parse(await readFile(fixturePath, "utf8")) as unknown;
  const result = await client.transaction(async tx => {
    const catalog = await new CatalogSeedWriter(tx).writeBundle(bundle);
    if (!catalog.ok) throw new Error("Synthetic catalog fixture is invalid.");
    const intakeRows = [
      ["local-north-computer-science", "fall", 2027, "2026-10-01T00:00:00.000Z", "2027-05-31T23:59:59.000Z", "Fall 2027"],
      ["local-north-international-business", "fall", 2027, "2026-10-01T00:00:00.000Z", "2027-05-31T23:59:59.000Z", "Fall 2027"],
      ["local-harbor-data-engineering", "spring", 2028, "2027-03-01T00:00:00.000Z", "2027-10-31T23:59:59.000Z", "Spring 2028"],
    ] as const;
    for (const [slug, term, year, openDate, deadlineDate, label] of intakeRows) {
      await tx.query(
        `insert into program_intakes (program_id, intake_term, intake_year, open_date, deadline_date, deadline_label, application_round, status)
         select id, $2, $3, $4::timestamptz, $5::timestamptz, $6, 'standard', 'open' from programs where slug = $1
         on conflict (program_id, intake_term, intake_year) do update set
           open_date = excluded.open_date, deadline_date = excluded.deadline_date, deadline_label = excluded.deadline_label,
           application_round = excluded.application_round, status = excluded.status, updated_at = now()`,
        [slug, term, year, openDate, deadlineDate, label],
      );
    }
    await tx.query(
      `insert into student_profiles (user_id, display_name, target_degree_level, target_intake, preferences_json, profile_completion_json)
       values ($1, 'Local Student', 'bachelor', 'Fall 2027', '{"fixture":"local-only"}'::jsonb, '{"fixture":true}'::jsonb)
       on conflict (user_id) do nothing`,
      [studentIdentity.userId],
    );
    await tx.query(
      `with reference_clock as materialized (
         select extract(year from clock_timestamp() at time zone 'UTC')::integer as reference_year
       ), allocated as (
         insert into application_reference_counters (reference_year, last_issued_sequence)
         select reference_year, 1 from reference_clock
         where not exists (select 1 from application_sets where id = $1)
         on conflict (reference_year) do update set
           last_issued_sequence = application_reference_counters.last_issued_sequence + 1,
           updated_at = clock_timestamp()
         returning reference_year, last_issued_sequence
       )
       insert into application_sets (id, user_id, name, status, target_intake, metadata_json,
         cuac_reference_year, cuac_reference_sequence)
       select $1, $2, '2027 Program Applications', 'draft', 'Fall 2027',
         '{"fixture":"cuac-local-v1"}'::jsonb, reference_year, last_issued_sequence from allocated
       on conflict (id) do nothing`,
      [ids.applicationSetId, studentIdentity.userId],
    );
    for (let index = 0; index < intakeRows.length; index += 1) {
      await tx.query(
        `insert into application_choices (
           id, application_set_id, user_id, school_id, program_id, program_intake_id, rank_order, status, metadata_json
         )
         select $1, $2, $3, p.school_id, p.id, pi.id, $5, 'draft', '{"fixture":"cuac-local-v1"}'::jsonb
         from programs p
         join program_intakes pi on pi.program_id = p.id and pi.intake_term = $6 and pi.intake_year = $7
         where p.slug = $4
         on conflict (id) do nothing`,
        [ids.choiceIds[index], ids.applicationSetId, studentIdentity.userId, intakeRows[index][0], index + 1, intakeRows[index][1], intakeRows[index][2]],
      );
    }
    const schoolRows = await tx.query<{ id: string }>("select id from schools where slug = 'local-north-university' limit 1", []);
    const schoolId = schoolRows[0]?.id;
    if (!schoolId) throw new Error("Synthetic school fixture is missing.");
    await tx.query(
      `insert into user_roles (user_id, role, grant_source)
       values ($1, 'school_staff', 'local_fixture'), ($2, 'cuac_ops', 'local_fixture'),
         ($3, 'cuac_admin', 'local_fixture')
       on conflict (user_id, role) where revoked_at is null do nothing`,
      [schoolIdentity.userId, opsIdentity.userId, adminIdentity.userId],
    );
    await tx.query(
      `insert into school_staff_memberships (school_id, user_id, role, status)
       values ($1, $2, 'admissions', 'active')
       on conflict (school_id, user_id) where removed_at is null do update
       set role = 'admissions', status = 'active', updated_at = clock_timestamp()`,
      [schoolId, schoolIdentity.userId],
    );
    const approverEmail = `ops-approver+${required("CUAC_LOCAL_INSTALLATION_ID").slice(0, 8)}@local.cuac.invalid`;
    const approvers = await tx.query<{ id: string }>(
      `insert into users (email, email_normalized, display_name)
       values ($1, $1, 'Local CUAC Access Approver')
       on conflict (email_normalized) do update set email_normalized = excluded.email_normalized
       returning id`,
      [approverEmail],
    );
    const approverId = approvers[0]?.id;
    if (!approverId) throw new Error("Synthetic access approver was not created.");
    await tx.query(
      `insert into user_roles (user_id, role, grant_source)
       values ($1, 'cuac_admin', 'local_fixture')
       on conflict (user_id, role) where revoked_at is null do nothing`,
      [approverId],
    );
    await tx.query(
      `insert into cuac_staff_access_grants
         (user_id, email, email_normalized, requested_role, status, approved_by_user_id, reason, approved_at, expires_at)
       values ($1, $2, $2, 'cuac_ops', 'approved', $3, 'Synthetic local development access',
         clock_timestamp(), clock_timestamp() + interval '30 days'),
         ($4, $5, $5, 'cuac_admin', 'approved', $3, 'Synthetic local development review access',
         clock_timestamp(), clock_timestamp() + interval '30 days')
       on conflict (user_id, requested_role) where status = 'approved' and revoked_at is null do update
       set email = excluded.email, email_normalized = excluded.email_normalized,
         approved_by_user_id = excluded.approved_by_user_id, reason = excluded.reason,
         expires_at = greatest(cuac_staff_access_grants.expires_at, excluded.expires_at),
         updated_at = clock_timestamp()`,
      [opsIdentity.userId, opsEmail.toLowerCase(), approverId, adminIdentity.userId, adminEmail.toLowerCase()],
    );
    let portalSet = (await tx.query<{ id: string; cuacId: string }>(
      `select id, cuac_id as "cuacId" from application_sets
       where user_id = $1 and metadata_json->>'fixture' = 'cuac-local-school-portal-v1' limit 1`,
      [studentIdentity.userId],
    ))[0];
    if (!portalSet) {
      const portalSetId = randomUUID();
      portalSet = (await tx.query<{ id: string; cuacId: string }>(
        `with reference_clock as materialized (
           select extract(year from clock_timestamp() at time zone 'UTC')::integer as reference_year
         ), allocated as (
           insert into application_reference_counters (reference_year, last_issued_sequence)
           select reference_year, 1 from reference_clock
           on conflict (reference_year) do update set
             last_issued_sequence = application_reference_counters.last_issued_sequence + 1,
             updated_at = clock_timestamp()
           returning reference_year, last_issued_sequence
         )
         insert into application_sets (id, user_id, name, status, target_intake, submitted_at, locked_at,
           metadata_json, cuac_reference_year, cuac_reference_sequence)
         select $1, $2, 'School Portal Fixture', 'submitted', 'Fall 2027', clock_timestamp(), clock_timestamp(),
           '{"fixture":"cuac-local-school-portal-v1"}'::jsonb, reference_year, last_issued_sequence from allocated
         returning id, cuac_id as "cuacId"`,
        [portalSetId, studentIdentity.userId],
      ))[0];
    }
    if (!portalSet) throw new Error("Synthetic school portal application set was not created.");
    let portalChoice = (await tx.query<{ id: string }>(
      `select id from application_choices where application_set_id = $1
       and metadata_json->>'fixture' = 'cuac-local-school-portal-v1' limit 1`,
      [portalSet.id],
    ))[0];
    if (!portalChoice) {
      portalChoice = (await tx.query<{ id: string }>(
        `insert into application_choices
           (id, application_set_id, user_id, school_id, program_id, program_intake_id, rank_order, status, metadata_json)
         select $1, $2, $3, p.school_id, p.id, pi.id, 0, 'submitted',
           '{"fixture":"cuac-local-school-portal-v1"}'::jsonb
         from programs p join program_intakes pi on pi.program_id = p.id
           and pi.intake_term = 'fall' and pi.intake_year = 2027
         where p.slug = 'local-north-computer-science'
         returning id`,
        [randomUUID(), portalSet.id, studentIdentity.userId],
      ))[0];
    }
    if (!portalChoice) throw new Error("Synthetic school portal application choice was not created.");
    await tx.query(
      `update school_applications sa set application_set_id = $3, cuac_id = $4, application_choice_id = $5,
         updated_at = clock_timestamp()
       where sa.application_set_id = $1 and sa.application_choice_id = $2
         and sa.application_record_format = 'cuac.program-application.v1'
         and sa.routing_metadata_json->>'fixture' = 'cuac-local-v1'`,
      [ids.applicationSetId, ids.choiceIds[0], portalSet.id, portalSet.cuacId, portalChoice.id],
    );
    await tx.query(
      `insert into school_applications
         (application_record_format, application_set_id, cuac_id, application_choice_id, student_user_id,
          school_id, program_id, program_intake_id, status, submitted_at, status_changed_at,
          school_visible_profile_json, routing_metadata_json)
       select 'cuac.program-application.v1', s.id, s.cuac_id, c.id, s.user_id,
         c.school_id, c.program_id, c.program_intake_id, 'new', clock_timestamp(), clock_timestamp(),
         '{"displayName":"Local Student","fixture":"local-only"}'::jsonb,
         '{"fixture":"cuac-local-v1"}'::jsonb
       from application_sets s join application_choices c on c.application_set_id = s.id and c.id = $2
       where s.id = $1 on conflict (application_choice_id) do nothing`,
      [portalSet.id, portalChoice.id],
    );
    await tx.query(
      `update school_applications
       set status = 'new', submitted_at = coalesce(submitted_at, clock_timestamp()),
         status_changed_at = clock_timestamp(), updated_at = clock_timestamp()
       where application_choice_id = $1 and application_set_id = $2
         and application_record_format = 'cuac.program-application.v1'
         and routing_metadata_json->>'fixture' = 'cuac-local-v1'
         and status in ('submitted', 'under_review')`,
      [portalChoice.id, portalSet.id],
    );
    const applicationRows = await tx.query<{ id: string; cuacId: string }>(
      `select sa.id, s.cuac_id as "cuacId" from school_applications sa
       join application_sets s on s.id = sa.application_set_id
       where sa.application_choice_id = $1 and sa.school_id = $2`,
      [portalChoice.id, schoolId],
    );
    if (!applicationRows[0]) throw new Error("Synthetic school application was not created.");
    return { catalog: catalog.summary, schoolId, approverId, portalApplicationSetId: portalSet.id, ...applicationRows[0] };
  });
  const policyTargetCount = await ensureLocalSubmissionPolicies(studentIdentity.userId, opsIdentity.userId, result.approverId);
  console.log(JSON.stringify({
    fixture: "cuac-local-v1",
    syntheticAccounts: { student: studentEmail, school: schoolEmail, ops: opsEmail, admin: adminEmail },
    applicationSetId: ids.applicationSetId,
    schoolId: result.schoolId,
    schoolApplicationId: result.id,
    schoolPortalApplicationSetId: result.portalApplicationSetId,
    cuacId: result.cuacId,
    submissionPolicyTargets: policyTargetCount,
    catalog: result.catalog,
    note: "All fixture records are synthetic and local-only.",
  }, null, 2));
} catch (error) {
  console.error(`Synthetic local seed failed: ${safeLocalSeedFailure(error)}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
