import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const root = process.cwd();
const paths = { approval: resolve(root, "seeds/catalog.pku-scholarships-split-batch-01.approval.json"), publication: resolve(root, "seeds/catalog.pku-scholarships-split-batch-01.approved.local.json"), review: resolve(root, "seeds/catalog.pku-scholarships-cleanup.review.json"), state: resolve(root, ".cuac-local/runtime.json") };
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const [approvalText, publicationText, stateText] = await Promise.all([readFile(paths.approval, "utf8"), readFile(paths.publication, "utf8"), readFile(paths.state, "utf8")]);
const approval = JSON.parse(approvalText), publication = JSON.parse(publicationText), state = JSON.parse(stateText), newSlugs: string[] = approval.scholarshipSlugs;
if (newSlugs?.length !== 3 || publication.scholarships?.length !== 3 || approval.archivedScholarshipAliases?.length !== 0) throw new Error("PKU split publication artifact changed.");
const archiveSlugs = ["official-2026-pku-prospective-graduate-scholarships", "peking-university", "peking-university-2024", "peking-university-2024-35", "peking-university-2026", "peking-university-2026-37"];
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:pku-scholarships-cleanup-review" });
let baseline: any;
try {
  const school = await pool.query("select id,status,verification_status from schools where slug='peking-university'");
  const active = await pool.query("select id,slug,title,status,verification_status,source_url,last_verified_at,jsonb_array_length(benefit_items)::int benefits,jsonb_array_length(eligibility_items)::int eligibility,jsonb_array_length(application_materials)::int materials,jsonb_array_length(application_steps)::int steps,jsonb_array_length(action_links)::int links from scholarships where school_id=$1 and status='active' order by slug", [school.rows[0]?.id]);
  const newRows = active.rows.filter((row: any) => newSlugs.includes(row.slug)), archiveRows = active.rows.filter((row: any) => archiveSlugs.includes(row.slug));
  if (school.rows.length !== 1 || school.rows[0].status !== "active" || school.rows[0].verification_status !== "verified" || active.rows.length !== 9 || newRows.length !== 3 || newRows.some((row: any) => row.verification_status !== "verified" || row.last_verified_at?.toISOString() !== approval.approvedAt || [row.benefits,row.eligibility,row.materials,row.steps,row.links].some((value) => value < 1)) || archiveRows.length !== 6) throw new Error("PKU scholarship cleanup baseline changed.");
  const combined = archiveRows.find((row: any) => row.slug === "official-2026-pku-prospective-graduate-scholarships");
  if (!combined || combined.verification_status !== "verified" || archiveRows.filter((row: any) => row.slug !== combined.slug).some((row: any) => row.verification_status !== "unverified")) throw new Error("PKU archive classifications changed.");
  baseline = { school: school.rows[0], active: active.rows, archiveRows };
} finally { await pool.end(); }
const reasons: Record<string, string> = {
  "official-2026-pku-prospective-graduate-scholarships": "Verified combined overview superseded by three independently scoped verified official 2026 scholarship records.",
  "peking-university": "Unverified third-party duplicate of the Chinese Government Advanced Graduate scholarship.",
  "peking-university-2024": "Unverified 2024 scholarship record outside the current 2026 cycle.",
  "peking-university-2024-35": "Unverified 2024 scholarship record outside the current 2026 cycle.",
  "peking-university-2026": "Undergraduate admission guide incorrectly classified as a scholarship.",
  "peking-university-2026-37": "Undergraduate admission guide incorrectly classified as a scholarship.",
};
const reviewBase = { version: 1, status: "requires_explicit_approval", generatedAt: new Date().toISOString(), scope: { schoolSlug: "peking-university", archiveScholarshipCount: 6, insertCount: 0, overwriteCount: 0, deleteCount: 0 }, publicationEvidence: { approvalSha256: sha(approvalText), publicationSha256: sha(publicationText), protectedNewScholarshipSlugs: newSlugs }, reconciliation: { destructiveDeletion: false, archives: baseline.archiveRows.map((row: any) => ({ entityType: "scholarship", id: row.id, slug: row.slug, title: row.title, reason: reasons[row.slug] })), databaseBaseline: { schoolId: baseline.school.id, activeScholarshipCount: 9, archiveVerifiedCombinedCount: 1, archiveUnverifiedLegacyCount: 5 } }, sensitiveDataCheck: { result: "pass", scope: "six scholarship status changes", note: "Only public catalog record identifiers and statuses are used; no applicant or personal data is read or written." }, reviewNotes: ["The three newly published independent rich scholarship records are protected and unchanged.", "One verified combined overview and five unverified legacy/misclassified rows are archived, not deleted.", "After cleanup PKU will have three active scholarships, all independently scoped and verified."] };
const reviewHash = sha(JSON.stringify(reviewBase));
const requiredApproval = `批准归档北京大学 6 条旧奖学金记录（审核哈希 ${reviewHash}），包括 1 条已拆分合并概览、3 条重复或过期奖学金及 2 条误归类招生简章`;
await writeFile(paths.review, `${JSON.stringify({ ...reviewBase, reviewHash, requiredApproval }, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, reviewHash, requiredApproval, scope: reviewBase.scope, paths }, null, 2));
