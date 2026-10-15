import type { RequirementReleaseCandidate } from "./catalog-requirement-candidate-runtime.ts";

type SqlClient = {
  query: (text: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
};

export type SingleHostRequirementPreflightTarget = {
  databaseName: "cuac_local";
  hostname: "127.0.0.1" | "[::1]";
};

export function assertSingleHostRequirementPreflightTarget(
  env: Record<string, string | undefined>,
): SingleHostRequirementPreflightTarget {
  if (env.CUAC_REQUIREMENT_PREFLIGHT_TARGET !== "single_host_read_only") {
    throw new Error("Requirement preflight requires CUAC_REQUIREMENT_PREFLIGHT_TARGET=single_host_read_only.");
  }
  if (env.CUAC_ENV !== "development" || env.CUAC_LOCAL_RUNTIME !== "1") {
    throw new Error("Requirement preflight is restricted to the owner-controlled single-host runtime.");
  }
  const rawUrl = env.DATABASE_URL || env.POSTGRES_URL || env.PG_DATABASE_URL;
  if (!rawUrl) throw new Error("Requirement preflight requires a PostgreSQL URL.");
  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    throw new Error("Requirement preflight target must be a valid PostgreSQL URL.");
  }
  if (!["postgres:", "postgresql:"].includes(target.protocol) || target.search || target.hash) {
    throw new Error("Requirement preflight target must be a plain PostgreSQL URL.");
  }
  if (target.hostname !== "127.0.0.1" && target.hostname !== "[::1]") {
    throw new Error("Requirement preflight is restricted to the loopback single-host database.");
  }
  if (decodeURIComponent(target.username) !== "cuac_local") {
    throw new Error("Requirement preflight requires the cuac_local database role.");
  }
  const databaseName = decodeURIComponent(target.pathname.replace(/^\//, ""));
  if (databaseName !== "cuac_local") throw new Error("Requirement preflight requires the cuac_local database.");
  return { hostname: target.hostname, databaseName };
}

function count(row: Record<string, unknown>, key: string): number {
  const value = Number(row[key]);
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Invalid preflight count: ${key}.`);
  return value;
}

export async function preflightSingleHostRequirementCandidate(
  client: SqlClient,
  candidate: RequirementReleaseCandidate,
) {
  const payload = candidate.operations.map((operation) => ({
    operation_key: operation.operationKey,
    school_slug: operation.schoolSlug,
    program_slug: operation.programSlug,
    intake_term: operation.intakeTerm,
    intake_year: operation.intakeYear,
    cycle_state: operation.cycleState,
    version_identity: operation.versionIdentity,
    content_sha256: operation.documentSha256,
  }));
  const values = [JSON.stringify(payload)];
  const summaryResult = await client.query(`with requested as materialized (
      select * from jsonb_to_recordset($1::jsonb) x(
        operation_key text, school_slug text, program_slug text, intake_term text, intake_year integer,
        cycle_state text, version_identity uuid, content_sha256 text)
    ), resolved as materialized (
      select r.*, s.id school_id, p.id program_id, i.id intake_id
      from requested r
      left join schools s on s.slug=r.school_slug
      left join programs p on p.slug=r.program_slug and p.school_id=s.id
      left join program_intakes i on i.program_id=p.id and i.intake_term=r.intake_term and i.intake_year=r.intake_year
    )
    select
      count(*)::integer requested,
      count(distinct school_slug)::integer requested_schools,
      count(distinct program_slug)::integer requested_programs,
      count(*) filter (where school_id is not null)::integer school_resolved_operations,
      count(*) filter (where program_id is not null)::integer program_resolved_operations,
      count(*) filter (where intake_id is not null)::integer intake_resolved_operations,
      count(*) filter (where cycle_state='historical_2026' and intake_id is not null)::integer historical_resolved,
      count(*) filter (where cycle_state='current_2027' and intake_id is not null)::integer current_resolved,
      count(*) filter (where exists (
        select 1 from program_requirement_versions v
        where v.id=version_identity and v.program_intake_id=intake_id and v.content_sha256=content_sha256
      ))::integer exact_existing_versions,
      count(*) filter (where intake_id is not null and exists (
        select 1 from program_requirement_versions v where v.program_intake_id=intake_id and v.version=1
      ) and not exists (
        select 1 from program_requirement_versions v
        where v.id=version_identity and v.program_intake_id=intake_id and v.content_sha256=content_sha256
      ))::integer conflicting_version_one
    from resolved`, values);
  const row = summaryResult.rows[0];
  if (!row) throw new Error("Requirement preflight returned no summary.");

  const samplesResult = await client.query(`with requested as materialized (
      select * from jsonb_to_recordset($1::jsonb) x(
        operation_key text, school_slug text, program_slug text, intake_term text, intake_year integer)
    ), resolved as (
      select r.*, s.id school_id, p.id program_id, i.id intake_id
      from requested r
      left join schools s on s.slug=r.school_slug
      left join programs p on p.slug=r.program_slug and p.school_id=s.id
      left join program_intakes i on i.program_id=p.id and i.intake_term=r.intake_term and i.intake_year=r.intake_year
    )
    select operation_key, school_slug, program_slug, intake_term, intake_year,
      case when school_id is null then 'missing_school'
           when program_id is null then 'missing_program_or_school_mismatch'
           when intake_id is null then 'missing_intake'
      end reason
    from resolved where intake_id is null order by operation_key limit 25`, values);

  const requested = count(row, "requested");
  const intakes = count(row, "intake_resolved_operations");
  const conflicts = count(row, "conflicting_version_one");
  return {
    status: intakes === requested && conflicts === 0 ? "ready_for_reviewed_import" : "blocked_by_online_catalog_mismatch",
    readOnly: true,
    publicationAttempted: false,
    candidate: {
      status: candidate.status,
      operationsSha256: candidate.hashes.operationsSha256,
      humanReviewCompleted: candidate.decision.humanReviewCompleted,
      publicationAuthorized: candidate.authorization.publicationAuthorized,
    },
    counts: {
      requested,
      requestedSchools: count(row, "requested_schools"),
      requestedPrograms: count(row, "requested_programs"),
      schoolResolvedOperations: count(row, "school_resolved_operations"),
      programResolvedOperations: count(row, "program_resolved_operations"),
      intakeResolvedOperations: intakes,
      historicalResolved: count(row, "historical_resolved"),
      currentResolved: count(row, "current_resolved"),
      exactExistingVersions: count(row, "exact_existing_versions"),
      conflictingVersionOne: conflicts,
    },
    missingBindingSamples: samplesResult.rows,
  };
}
