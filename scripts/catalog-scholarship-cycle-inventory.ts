import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import pg from "pg";
import { PostgresCatalogAdminRepository } from "../src/server/catalog-admin/postgres-repository.ts";
import type { TransactionalSqlClient } from "../src/server/db/postgres-client.ts";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required.");
const parsed = new URL(databaseUrl);
if (!["127.0.0.1", "localhost"].includes(parsed.hostname)) {
  throw new Error("Scholarship cycle inventory is restricted to loopback PostgreSQL.");
}
const args = process.argv.slice(2);
if (args.some(value => !value.startsWith("--output=") && !value.startsWith("--as-of="))) {
  throw new Error("Only --output=<path> and --as-of=<ISO timestamp> are supported.");
}
const outputPath = resolve(args.find(value => value.startsWith("--output="))?.slice(9)
  || "work/catalog-quality/catalog-scholarship-cycle-inventory.json");
const asOf = new Date(args.find(value => value.startsWith("--as-of="))?.slice(8) || new Date().toISOString());
if (Number.isNaN(asOf.valueOf())) throw new Error("--as-of must be a valid ISO timestamp.");

type ScholarshipRow = { id: string; slug: string; title: string; applicationRound: string | null;
  deadlineDate: Date | null; deadlineLabel: string | null; tags: unknown; status: string;
  verificationStatus: string; version: number; sourceUrl: string | null; sourceLabel: string | null;
  seriesKey: string | null; cycleKey: string | null; intakeYear: number | null; intakeLabel: string | null };
const pool = new pg.Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 5000,
  statement_timeout: 20_000 });
const connection = await pool.connect();
const tx: TransactionalSqlClient = {
  async query<T extends Record<string, unknown>>(statement: string, params: readonly unknown[]) {
    return (await connection.query(statement, [...params])).rows as T[];
  },
  async transaction<T>(work: (client: TransactionalSqlClient) => Promise<T>) { return work(tx); },
};

try {
  await connection.query("begin");
  const actorRows = await tx.query<{ actorUserId: string; activeRole: "cuac_admin" }>(`select u.id::text as "actorUserId",
    'cuac_admin'::text as "activeRole" from users u join user_roles r on r.user_id=u.id and r.role='cuac_admin'
      and r.revoked_at is null join cuac_staff_access_grants g on g.user_id=u.id and g.requested_role='cuac_admin'
      and g.status='approved' and g.revoked_at is null and g.expires_at>clock_timestamp()
    where u.account_status='active' limit 1`, []);
  if (!actorRows[0]) throw new Error("An active CUAC admin fixture is required.");
  const repository = new PostgresCatalogAdminRepository(tx);
  const blockers = await repository.listReadiness({ ...actorRows[0], entityType: "scholarship", status: null,
    readiness: "blocked", reason: null, query: null, limit: 20_000, offset: 0 });
  if (!blockers.authorized) throw new Error("Catalog readiness inventory authority was revoked.");
  if (blockers.value.items.length !== blockers.value.total) throw new Error("Scholarship blocker inventory was truncated.");
  const rows = await tx.query<ScholarshipRow>(`select s.id::text,s.slug,s.title,s.application_round as "applicationRound",
    s.deadline_date as "deadlineDate",s.deadline_label as "deadlineLabel",s.tags,s.status,
    s.verification_status as "verificationStatus",s.version,s.source_url as "sourceUrl",s.source_label as "sourceLabel",
    l.series_key as "seriesKey",l.cycle_key as "cycleKey",l.intake_year as "intakeYear",l.intake_label as "intakeLabel"
    from scholarships s left join scholarship_cycle_lineage l on l.scholarship_id=s.id
    order by s.slug`, []);
  const classified = rows.map(row => classify(row, asOf));
  const signaled2027 = classified.filter(row => row.yearSignal !== "none");
  const blockedById = new Map(blockers.value.items.map(item => [item.entityId, item]));
  const waitingQueue = classified.filter(row => blockedById.has(row.id)
    || (row.yearSignal !== "none" && row.availability !== "open"))
    .map(row => ({ ...row, readinessBlockingReasons: blockedById.get(row.id)?.blockingReasons ?? [],
      disposition: row.availability === "closed" ? "retain_historical_wait_for_new_official_cycle"
        : row.availability === "unconfirmed" ? "wait_for_official_deadline_or_new_cycle"
          : "remediate_non_cycle_readiness_blockers" }));
  const report = { version: 1, generatedAt: new Date().toISOString(), asOf: asOf.toISOString(), mode: "read_only",
    rules: { open: "deadlineDate is strictly after asOf", closed: "deadlineDate is on or before asOf",
      unconfirmed: "no machine-readable deadline; no future date is inferred",
      explicit2027Intake: "text explicitly connects 2027 to intake, entry, spring, fall, March, or September",
      academicYearOnly: "2026-2027 label without an explicit 2027 intake statement" },
    safeguards: ["No 2026 deadline is rolled forward.", "Academic-year labels do not prove a 2027 intake.",
      "Missing deadlines remain unconfirmed.", "Historical records remain published history until separately archived."],
    summary: { totalScholarships: rows.length, readinessBlockedScholarships: blockers.value.total,
      signaled2027: signaled2027.length, explicit2027Intake: signaled2027.filter(item => item.yearSignal === "explicit_2027_intake").length,
      academicYearOnly: signaled2027.filter(item => item.yearSignal === "academic_year_2026_2027").length,
      open2027Signals: signaled2027.filter(item => item.availability === "open").length,
      closed2027Signals: signaled2027.filter(item => item.availability === "closed").length,
      unconfirmed2027Signals: signaled2027.filter(item => item.availability === "unconfirmed").length,
      registeredCycleLineage: rows.filter(item => item.seriesKey).length, waitingQueue: waitingQueue.length },
    open2027Candidates: signaled2027.filter(item => item.availability === "open"),
    signaled2027, waitingQueue };
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ok: true, outputPath, summary: report.summary,
    open2027Candidates: report.open2027Candidates.map(item => ({ slug: item.slug,
      yearSignal: item.yearSignal, deadlineDate: item.deadlineDate, applicationRound: item.applicationRound })) }, null, 2));
} finally {
  await connection.query("rollback").catch(() => undefined);
  connection.release();
  await pool.end();
}

function classify(row: ScholarshipRow, asOf: Date) {
  const text = [row.title, row.applicationRound, row.deadlineLabel, JSON.stringify(row.tags)].filter(Boolean).join(" ");
  const explicit = /(?:spring|march|fall|autumn|september|entry|intake)[^\n]{0,32}2027|2027[^\n]{0,32}(?:spring|march|fall|autumn|september|entry|intake)/i.test(text);
  const academic = /2026\s*(?:[-–—/]|to)\s*2027/i.test(text);
  const yearSignal = explicit ? "explicit_2027_intake" : academic ? "academic_year_2026_2027"
    : /2027/.test(text) ? "other_2027_reference" : "none";
  const availability = row.deadlineDate ? (row.deadlineDate > asOf ? "open" : "closed") : "unconfirmed";
  return { ...row, deadlineDate: row.deadlineDate?.toISOString() ?? null, yearSignal, availability };
}
