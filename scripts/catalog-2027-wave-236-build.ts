import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };

const root = process.cwd();
const runRoot = resolve(root, "work/catalog-official/2026-10-27T08-40-09-014Z");
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: Source[] };
const expectedSha256 = "5ba8c1a1c20be6d7597256a0e14eebca6b0cf557b02fa7f411db77f09e9f048f";
const source = manifest.sources.find((row) => row.id === "hdu-international-student-admissions-2026" && row.status === 200 && row.sha256 === expectedSha256);
if (!source) throw new Error("Missing locked HDU 2026 admissions source.");
if (createHash("sha256").update(await readFile(resolve(runRoot, source.artifactPath))).digest("hex") !== expectedSha256) throw new Error("HDU evidence hash mismatch.");

const legacyPath = resolve(root, "seeds/catalog.hdu-complete-batch-01.draft.json");
const legacyText = await readFile(legacyPath, "utf8");
const legacy = JSON.parse(legacyText) as CatalogSeedBundle;
const schoolSlug = "hangzhou-dianzi-university";
if (legacy.schools?.length !== 1 || legacy.schools[0].slug !== schoolSlug || legacy.programs?.length !== 35 || legacy.programIntakes?.length !== 35) throw new Error("Unexpected legacy HDU extraction scope.");
if (legacy.programs.some((row) => row.sourceSha256 !== expectedSha256) || legacy.programIntakes.some((row) => row.sourceSha256 !== expectedSha256)) throw new Error("Legacy HDU rows do not match the locked official source.");

const evidence = { sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt };
const city = { ...legacy.cities![0], status: "draft" as const, verificationStatus: "unverified" as const, lastVerifiedAt: source.fetchedAt, ...evidence };
const school = {
  ...legacy.schools[0],
  applicationLevel: "The unchanged official 2026 international admissions brochure publishes 11 undergraduate, 15 master and 9 doctoral routes. No 2027 degree guide is currently published.",
  deadlineSummary: "The captured Fall 2026 application deadline was June 15, 2026 and is closed. No 2027 deadline is inferred.",
  campusHighlights: ["35 official 2026 international degree routes", "Engineering and information technology focus", "Hangzhou, Zhejiang"],
  status: "draft" as const,
  verificationStatus: "unverified" as const,
  lastVerifiedAt: source.fetchedAt,
  ...evidence,
  sourceFieldLineage: {
    ...(legacy.schools[0].sourceFieldLineage ?? {}),
    applicationLevel: "official 2026 brochure program tables",
    deadlineSummary: "official 2026 application procedure with closed-cycle limitation",
    campusHighlights: "official program table count and institutional location",
  },
};
const programs = legacy.programs.map((row) => ({ ...row, status: "draft" as const, verificationStatus: "unverified" as const, lastVerifiedAt: source.fetchedAt, ...evidence }));
const programIntakes = legacy.programIntakes.map((row) => ({ ...row, status: "closed" as const, ...evidence }));
const candidate: CatalogSeedBundle = { version: 1, generatedAt: source.fetchedAt, cities: [city], schools: [school], programs, programIntakes, scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: source.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 99, schoolSlugs: [schoolSlug], newSchools: 0, programs: programs.length, programIntakes: programIntakes.length, scholarships: 0 },
  evidence: [{ id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }],
  extraction: { path: "seeds/catalog.hdu-complete-batch-01.draft.json", sha256: createHash("sha256").update(legacyText).digest("hex"), extractor: "scripts/catalog-hdu-complete-build.ts", expectedPrograms: 35 },
  unresolved: [
    "The latest official international degree guide remains the 2026 cycle. The 35 routes and their closed Fall 2026 intakes are not relabeled as 2027.",
    "The guide does not publish a single duration for each route or a numeric English-test threshold; those fields remain absent.",
    "The guide names scholarship availability but does not publish enough award-specific rules and amounts to create scholarship entities.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Published office contacts and all applicant data are excluded." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-236");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 236, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
