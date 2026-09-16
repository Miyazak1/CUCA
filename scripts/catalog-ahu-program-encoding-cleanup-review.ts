import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { createPostgresPool } from "../src/server/db/postgres-client.ts";
import { localDatabaseUrl } from "./lib/local-development.ts";

const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const prefix = "catalog.ahu-program-encoding-cleanup";
const corrections = [
  {
    oldSlug: "anhui-university-undergraduate-cid-36-cid-85-cid-87-cid-76-cid-191-cid-70-cid-76-cid-68-cid-79-cid-3-cid-44-cid-81-cid-87-cid-72-cid-79-cid-79-cid-76-cid-74-cid-72-cid-81-cid-70-cid-72-cid-36-cid-85-cid-87-cid-76-cid-191-cid-70-cid-76-cid-68-cid-79-cid-3-intelligence",
    newSlug: "anhui-university-undergraduate-artificial-intelligence-artificial-intelligence",
    nameEn: "Artificial Intelligence", nameZh: "人工智能", degreeLevel: "本科", fieldCategory: "Artificial Intelligence", subjectArea: "Artificial Intelligence", source: "undergraduate", sourceRow: 79,
  },
  {
    oldSlug: "anhui-university-undergraduate-robotics-engineering-cid-36-cid-85-cid-87-cid-76-cid-191-cid-70-cid-76-cid-68-cid-79-cid-3-intelligence",
    newSlug: "anhui-university-undergraduate-robotics-engineering-artificial-intelligence",
    nameEn: "Robotics Engineering", nameZh: "机器人工程", degreeLevel: "本科", fieldCategory: "Artificial Intelligence", subjectArea: "Robotics Engineering", source: "undergraduate", sourceRow: 80,
  },
  {
    oldSlug: "anhui-university-master-control-science-and-engineering-cid-36-cid-85-cid-87-cid-76-cid-191-cid-70-cid-76-cid-68-cid-79-cid-3-cid-44-cid-81-cid-87-cid-72-cid-79-cid-79-cid-76-cid-74-cid-72-cid-81-cid-70-cid-72",
    newSlug: "anhui-university-master-control-science-and-engineering-artificial-intelligence",
    nameEn: "Control Science and Engineering", nameZh: "控制科学与工程", degreeLevel: "硕士", fieldCategory: "Artificial Intelligence", subjectArea: "Control Science and Engineering", source: "master", sourceRow: 82,
  },
  {
    oldSlug: "anhui-university-master-computer-science-and-technology-cid-36-cid-85-cid-87-cid-76-cid-191-cid-70-cid-76-cid-68-cid-79-cid-3-cid-44-cid-81-cid-87-cid-72-cid-79-cid-79-cid-76-cid-74-cid-72-cid-81-cid-70-cid-72",
    newSlug: "anhui-university-master-computer-science-and-technology-artificial-intelligence",
    nameEn: "Computer Science and Technology", nameZh: "计算机科学与技术", degreeLevel: "硕士", fieldCategory: "Artificial Intelligence", subjectArea: "Computer Science and Technology", source: "master", sourceRow: 83,
  },
  {
    oldSlug: "anhui-university-master-intelligent-science-and-technology-cid-36-cid-85-cid-87-cid-76-cid-191-cid-70-cid-76-cid-68-cid-79-cid-3-cid-44-cid-81-cid-87-cid-72-cid-79-cid-79-cid-76-cid-74-cid-72-cid-81-cid-70-cid-72",
    newSlug: "anhui-university-master-intelligent-science-and-technology-artificial-intelligence",
    nameEn: "Intelligent Science and Technology", nameZh: "智能科学与技术", degreeLevel: "硕士", fieldCategory: "Artificial Intelligence", subjectArea: "Intelligent Science and Technology", source: "master", sourceRow: 84,
  },
];

const undergraduatePath = "work/catalog-official/ahu-programs-batch-01/raw/ahu-undergraduate-programs-current.95397e8a135c3a67045dceddd10b8e4bbfe652d3ddc02f2eeab1e553c7ae6b98.pdf";
const masterPath = "work/catalog-official/ahu-programs-batch-01/raw/ahu-master-programs-current.06f23c29e4f330d01e58ed67b198a2018de09b79825a654d2ff510bd05cbed46.pdf";
const [undergraduatePdf, masterPdf, stateText, manifestText] = await Promise.all([
  readFile(undergraduatePath), readFile(masterPath), readFile(".cuac-local/runtime.json", "utf8"), readFile("work/catalog-official/ahu-programs-batch-01/manifest.json", "utf8"),
]);
if (sha(undergraduatePdf) !== "95397e8a135c3a67045dceddd10b8e4bbfe652d3ddc02f2eeab1e553c7ae6b98" || sha(masterPdf) !== "06f23c29e4f330d01e58ed67b198a2018de09b79825a654d2ff510bd05cbed46") throw new Error("AHU source PDF hash changed.");

const state = JSON.parse(stateText);
const pool = createPostgresPool({ databaseUrl: localDatabaseUrl(state), max: 1, applicationName: "cuac:ahu-program-encoding-cleanup-review" });
let baseline: any;
try {
  const school = await pool.query("select id,slug,status,verification_status from schools where slug='anhui-university'");
  const oldRows = await pool.query("select id,slug,name_en,name_zh,degree_level,field_category,subject_area,status,verification_status from programs where slug=any($1::text[]) order by slug", [corrections.map((row) => row.oldSlug)]);
  const conflicts = await pool.query("select id,slug,status from programs where slug=any($1::text[])", [corrections.map((row) => row.newSlug)]);
  baseline = { school: school.rows[0], programs: oldRows.rows, targetSlugConflicts: conflicts.rows };
  if (school.rows.length !== 1 || school.rows[0].status !== "active" || oldRows.rows.length !== 5 || oldRows.rows.some((row: any) => row.status !== "active" || row.verification_status !== "verified") || conflicts.rows.length !== 0) throw new Error(`AHU encoding-cleanup baseline changed: ${JSON.stringify(baseline)}`);
  for (const correction of corrections) {
    const row = oldRows.rows.find((item: any) => item.slug === correction.oldSlug);
    const acceptedDegreeLevels = correction.degreeLevel === "本科" ? ["本科", "Undergraduate"] : ["硕士", "Master"];
    if (!row || !acceptedDegreeLevels.includes(row.degree_level) || !`${row.name_en} ${row.field_category}`.includes("(cid:")) throw new Error(`Unexpected AHU source row: ${JSON.stringify({ correction: correction.oldSlug, row })}`);
  }
} finally { await pool.end(); }

const manifest = JSON.parse(manifestText);
const evidence = manifest.sources.map((source: any) => ({ sourceId: source.id, sourceUrl: source.url, sha256: source.sha256, capturedAt: source.fetchedAt, contentType: source.contentType }));
const reviewBase = {
  version: 1, status: "requires_explicit_approval", generatedAt: new Date().toISOString(),
  scope: { schoolSlug: "anhui-university", programOverwriteCount: 5, programSlugRenameCount: 5, archiveCount: 0, deleteCount: 0 },
  evidence,
  visualReview: { result: "pass", pagesReviewed: { undergraduate: [2], master: [2] }, note: "The complete relevant table pages were rendered at 180 DPI. Undergraduate rows 79-80 and master rows 82-84 explicitly show the school as Artificial Intelligence and provide the Chinese and English major names used here." },
  reconciliation: { destructiveDeletion: false, baseline, corrections },
  sensitiveDataCheck: { result: "pass", scope: "five public institutional program rows", note: "The reviewed PDF pages contain only school and major tables; no applicant, account, passport, payment or personal contact data is present." },
  reviewNotes: ["This corrects PDF CID font-decoding artifacts that escaped the first AHU program review.", "No program is added, archived or deleted; the same five verified record IDs are retained.", "Only slug, bilingual name, field category and subject area are normalized to the visually confirmed official table values."],
  postconditions: { correctedActivePrograms: 5, verifiedCorrectedPrograms: 5, remainingAhuCidArtifacts: 0 },
};
const reviewHash = sha(JSON.stringify(reviewBase));
const requiredApproval = `批准修正安徽大学 5 条项目 PDF 字体编码异常（审核哈希 ${reviewHash}），保留原记录 ID 并更新项目名称、院系及规范化链接`;
await writeFile(`seeds/${prefix}.review.json`, `${JSON.stringify({ ...reviewBase, reviewHash, requiredApproval }, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, reviewHash, requiredApproval, scope: reviewBase.scope, postconditions: reviewBase.postconditions }, null, 2));
