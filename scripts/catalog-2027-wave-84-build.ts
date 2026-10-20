import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedScholarship,
} from "../src/server/catalog/seed-contract.ts";

type ManifestSource = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string; artifactPath: string };
const root = process.cwd();
const run = "work/catalog-official/2026-10-20-ouc-marine-scholarship-page-2026";
const sourceId = "ouc-marine-scholarship-page-2026";
const expectedSha256 = "83f841975978107863a6bc23cd0e049103eb9bb70b4966dc6aba6e95b446edfb";
const manifest = JSON.parse(await readFile(resolve(root, run, "manifest.json"), "utf8")) as { sources: ManifestSource[] };
const source = manifest.sources.find((row) => row.id === sourceId && row.status === 200 && row.sha256 === expectedSha256);
if (!source) throw new Error("Missing locked Ocean University of China 2026/2027 Marine Scholarship evidence.");
const artifact = await readFile(resolve(root, run, source.artifactPath));
if (createHash("sha256").update(artifact).digest("hex") !== source.sha256) throw new Error("OUC Marine Scholarship artifact hash mismatch.");
const html = artifact.toString("utf8");
if (!html.includes("中国海洋大学2026/2027中国政府海洋奖学金项目简章") || !html.includes("高水平研究生")) {
  throw new Error("OUC Marine Scholarship page no longer contains the expected title and incorporated-reference text.");
}

const dependency = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const school = dependency.schools?.find((row) => row.slug === "ocean-university-of-china");
const city = dependency.cities?.find((row) => row.slug === "qingdao");
const reference = dependency.scholarships?.find((row) => row.slug === "official-2026-ouc-cgs-high-level-graduate");
if (!school || !city || !reference) throw new Error("OUC dependency rows or the incorporated High-Level Graduate scholarship record are missing.");
const sourceUrl = source.finalUrl ?? source.url;
const scholarship: CatalogSeedScholarship = {
  ...reference,
  slug: "official-2026-ouc-cgs-marine-scholarship",
  title: "OUC 2026/2027 Chinese Government Marine Scholarship Program",
  nameZh: "中国海洋大学2026/2027中国政府海洋奖学金项目",
  typeLabel: "Chinese Government Marine Scholarship Program",
  applicableProgram: "OUC master's and doctoral routes eligible under the Marine Scholarship; the official notice incorporates the 2026/2027 High-Level Graduate Student Program guide by reference.",
  applicationRound: "2026/2027 Chinese Government Marine Scholarship Program",
  actionLinks: [
    { label: "Official Marine Scholarship notice", url: sourceUrl, kind: "official-source" },
    { label: "Referenced OUC scholarship guide", url: reference.sourceUrl!, kind: "official-source" },
    ...(reference.actionLinks ?? []).filter((row) => row.kind === "official-application"),
  ],
  summary: "OUC's 2026/2027 Chinese Government Marine Scholarship route, whose official notice incorporates the published High-Level Graduate Student Program requirements and coverage by reference; the application deadline has closed.",
  sortOrder: 11,
  sourceUrl,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
  lastVerifiedAt: source.fetchedAt,
  sourceFieldLineage: {
    title: "official Marine Scholarship page title",
    applicationRound: "official Marine Scholarship page title",
    fundingLevel: "Marine Scholarship notice incorporates the 2026/2027 OUC High-Level Graduate Student Program guide by reference",
    coverage: "incorporated 2026/2027 OUC High-Level Graduate Student Program guide, Scholarship Coverage",
    amountText: "incorporated 2026/2027 OUC High-Level Graduate Student Program guide, Scholarship Coverage",
    applicableDegree: "incorporated 2026/2027 OUC High-Level Graduate Student Program guide, Program Categories",
    applicableProgram: "Marine Scholarship notice plus incorporated 2026/2027 OUC High-Level Graduate Student Program guide",
    deadlineDate: "incorporated 2026/2027 OUC High-Level Graduate Student Program guide, application deadline",
    eligibilityItems: "incorporated 2026/2027 OUC High-Level Graduate Student Program guide, Eligibility",
    applicationMaterials: "incorporated 2026/2027 OUC High-Level Graduate Student Program guide, Application Documents",
    applicationSteps: "incorporated 2026/2027 OUC High-Level Graduate Student Program guide, Application Procedure",
  },
};

const candidate: CatalogSeedBundle = { version: 1, generatedAt: source.fetchedAt, cities: [city], schools: [school], programs: [], programIntakes: [], scholarships: [scholarship] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 Wave 84 validation failed: ${validation.errors.join(" ")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: source.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlug: school.slug, refreshedScholarships: 1, sourceSnapshots: 1 },
  evidence: [{ id: source.id, label: source.label, url: sourceUrl, fetchedAt: source.fetchedAt, sha256: source.sha256 }],
  unresolved: [
    "The Marine Scholarship notice does not publish a separate major list and instead refers applicants to the 2026/2027 OUC High-Level Graduate Student Program guide.",
    "The scholarship is a 2026/2027 academic-year award with a closed February 15, 2026 deadline; it does not establish a Fall 2027 intake.",
  ],
  notes: [
    "Coverage, stipend, eligibility and application details are copied only from the already verified OUC guide that the Marine Scholarship notice explicitly incorporates by reference.",
    "No applicant or other personal data is included.",
  ],
};
const stem = resolve(root, "seeds/catalog.2027-wave-84");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 84, candidateSha256, counts: { schools: 1, programs: 0, programIntakes: 0, scholarships: 1, sourceSnapshots: 1 }, publicationAuthorized: false }, null, 2));
