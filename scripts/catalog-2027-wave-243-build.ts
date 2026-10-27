import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string; artifactPath: string };
const root = process.cwd();
const dependencyPath = resolve(root, "seeds/catalog.uestc-complete-batch-01.draft.json");
const dependencyText = await readFile(dependencyPath, "utf8");
const dependency = JSON.parse(dependencyText) as CatalogSeedBundle;
if (dependency.schools?.length !== 1 || dependency.schools[0].slug !== "university-of-electronic-science-and-technology-of-china") throw new Error("Unexpected UESTC school dependency.");
if (dependency.programs?.length !== 72 || dependency.programIntakes?.length !== 72 || dependency.scholarships?.length !== 10) throw new Error("Unexpected UESTC catalog dependency.");

const manifestRoot = resolve(root, "work/catalog-official/full-refresh-large-files-2026-10-20");
const manifest = JSON.parse(await readFile(resolve(manifestRoot, "manifest.json"), "utf8")) as { sources: Source[] };
const brochure = manifest.sources.find((source) => source.id === "uestc-admission-brochure-en-2026");
if (!brochure || brochure.status !== 200) throw new Error("Missing UESTC brochure evidence.");
const artifact = await readFile(resolve(manifestRoot, brochure.artifactPath));
if (createHash("sha256").update(artifact).digest("hex") !== brochure.sha256) throw new Error("UESTC brochure evidence hash mismatch.");
if (dependency.programs.some((program) => program.sourceSha256 !== brochure.sha256)) throw new Error("UESTC program dependency does not match the locked brochure.");

const programs = dependency.programs.map((program) => ({
  ...program,
  status: "draft" as const,
  verificationStatus: "unverified" as const,
  lastVerifiedAt: brochure.fetchedAt,
  applicationNote: `${String(program.applicationNote ?? "Official 2026 international degree route.")} The latest public international brochure remains the 2026 edition; no 2027 intake is inferred.`,
}));
const programIntakes = dependency.programIntakes.map((intake) => ({ ...intake, status: "closed" as const }));
const school = {
  ...dependency.schools[0],
  status: "draft" as const,
  verificationStatus: "unverified" as const,
  lastVerifiedAt: brochure.fetchedAt,
  deadlineSummary: "The latest verified official international admission brochure remains the closed 2026 cycle. Domestic 2027 graduate notices are outside the international-applicant scope and no 2027 international degree deadline is inferred.",
  sourceFieldLineage: {
    ...(dependency.schools[0].sourceFieldLineage ?? {}),
    deadlineSummary: "official 2026 international brochure plus October 27, 2026 international-source freshness review",
  },
};
const city = { ...dependency.cities![0], status: "draft" as const, verificationStatus: "unverified" as const };
const scholarships = dependency.scholarships.map((row) => ({ ...row, status: "draft" as const, verificationStatus: "unverified" as const }));
const candidate: CatalogSeedBundle = { version: 1, generatedAt: brochure.fetchedAt, cities: [city], schools: [school], programs, programIntakes, scholarships };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(validation.errors.join("\n"));

const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: candidate.generatedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 33, schoolSlugs: [school.slug], newSchools: 0, programs: programs.length, programIntakes: programIntakes.length, scholarships: scholarships.length },
  evidence: [{ id: brochure.id, label: brochure.label, url: brochure.finalUrl ?? brochure.url, fetchedAt: brochure.fetchedAt, sha256: brochure.sha256 }],
  dependencies: [{ path: "seeds/catalog.uestc-complete-batch-01.draft.json", sha256: createHash("sha256").update(dependencyText).digest("hex") }],
  freshness: {
    result: "complete_2026_catalog_latest_2027_international_cycle_unpublished",
    note: "The hash-locked official brochure contains 72 degree/language routes and ten scholarship routes. The latest verified international cycle remains 2026; domestic 2027 notices are excluded.",
  },
  acquisitionLimits: [
    "A new October 27 fetch of the brochure was rejected by the collector because the declared file exceeds the 15 MiB safety cap; the October 20 official snapshot remains hash-valid.",
    "The international application index currently presents a certificate for *.17gz.org rather than admission.uestc.edu.cn and was rejected without bypassing TLS validation.",
    "The current scholarship-cost page returned HTTP 202 with an anti-bot challenge document, so it was not used to update fields.",
  ],
  unresolved: [
    "No general 2027 international degree admission guide or deadline is available from the validated sources.",
    "The two legacy CUAC aliases in catalog.uestc-legacy-alignment-batch-01 are not duplicated here; their semantic routes already exist among the 72 canonical records.",
    "Scholarship terms remain those explicitly published in the locked 2026 brochure; no current-year extension is inferred.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Only public institutional program, fee and scholarship facts are included." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-243");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 243, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
