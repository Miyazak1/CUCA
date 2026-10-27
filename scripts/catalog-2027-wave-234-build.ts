import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
const root = process.cwd();
const homeRun = "2026-10-27T08-28-19-044Z";
const linkedRun = "2026-10-27T08-29-17-220Z";
const locks = new Map([
  ["gxu-international-english-home-current", "4a48c6d6c81465f5358d3d94a36a3a498e2f4769d183b164c5ccf77865fffbcf"],
  ["gxu-chinese-language-program-march-2027", "9766bac20b8c24e73101e6e86ab0f4b0de71cedb09008b5ca4cfa432fa0177b8"],
  ["gxu-international-admission-current", "7df1f430a9d84d45c8834d437459467d283a1397b11e491edfd8fb65031b05c0"],
  ["gxu-international-programs-current", "cf9efee00d6f76c17b9dcc7d7f8b25a4e0f5eb7190954cdc2be08e80cacd75c8"],
  ["gxu-chinese-government-scholarship-2027", "32820a0808551f79764d8178af546e96695ec3a0d457e91116c48f2b3aa9376e"],
]);
const manifests = await Promise.all([homeRun, linkedRun].map(async (name) => JSON.parse(await readFile(resolve(root, "work/catalog-official", name, "manifest.json"), "utf8")) as { sources: Source[] }));
const sources = new Map<string, Source>();
for (const [id, sha256] of locks) {
  const source = manifests.flatMap((manifest) => manifest.sources).find((row) => row.id === id && row.status === 200 && row.sha256 === sha256);
  if (!source) throw new Error(`Missing locked GXU source ${id}.`);
  const sourceRun = ["gxu-international-english-home-current", "gxu-chinese-language-program-march-2027"].includes(id) ? homeRun : linkedRun;
  const bytes = await readFile(resolve(root, "work/catalog-official", sourceRun, source.artifactPath));
  if (createHash("sha256").update(bytes).digest("hex") !== sha256) throw new Error(`Evidence hash mismatch: ${id}.`);
  sources.set(id, source);
}
const home = sources.get("gxu-international-english-home-current")!;
const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-140.draft.json"), "utf8")) as CatalogSeedBundle;
const city = prior.cities?.find((row) => row.slug === "nanning");
const base = prior.schools?.find((row) => row.slug === "guangxi-university");
if (!city || !base) throw new Error("Wave 140 GXU dependencies are missing.");
const school = {
  ...base,
  applicationLevel: "The current official international home explicitly lists a March 2027 Chinese Language Program and a 2027 Chinese Government Scholarship notice. The linked notices require an interactive WeChat verification page, so unavailable details remain absent.",
  admissionsUrl: home.finalUrl ?? home.url,
  campusHighlights: [...(base.campusHighlights ?? []), "Official March 2027 Chinese Language Program listing", "Official 2027 Chinese Government Scholarship notice listed; details inaccessible without interactive verification"],
  lastVerifiedAt: home.fetchedAt,
  sourceUrl: home.finalUrl ?? home.url,
  sourceLabel: home.label,
  sourceSha256: home.sha256,
  capturedAt: home.fetchedAt,
  sourceFieldLineage: {
    ...(base.sourceFieldLineage ?? {}),
    applicationLevel: "current official home Notice list and linked-notice access review",
    admissionsUrl: "current official international home",
    campusHighlights: "current official home Notice list",
  },
};
const program = {
  slug: "guangxi-university-chinese-language-program-spring-2027",
  schoolSlug: school.slug,
  citySlug: city.slug,
  nameEn: "Chinese Language Program (March 2027 Intake)",
  degreeLevel: "Non-degree",
  fieldCategory: "Chinese Language and Culture",
  subjectArea: "Chinese Language",
  applicationNote: "The current official international home lists this route as ‘2027 Chinese Language Program (March Intake)’ on October 23, 2026. Tuition, duration, eligibility, materials and deadline are not imported because the linked notice requires interactive verification.",
  badgeText: "March 2027 official listing",
  displaySubjects: ["Chinese Language"],
  displayGroup: "gxu-chinese-language-spring-2027",
  displayGroupLabel: "GXU March 2027 Chinese-language route",
  status: "draft" as const,
  verificationStatus: "unverified" as const,
  sourceUrl: home.finalUrl ?? home.url,
  sourceLabel: home.label,
  sourceSha256: home.sha256,
  capturedAt: home.fetchedAt,
  sourceFieldLineage: {
    nameEn: "current official home Notice title",
    degreeLevel: "CUAC non-degree taxonomy based on explicit Chinese Language Program title",
    fieldCategory: "CUAC taxonomy based on explicit Chinese Language Program title",
    subjectArea: "current official home Notice title",
    applicationNote: "current official home Notice title and linked-notice verification result",
    badgeText: "current official home Notice title",
    displaySubjects: "current official home Notice title",
  },
};
const intake = {
  programSlug: program.slug,
  intakeTerm: "Spring",
  intakeYear: 2027,
  applicationRound: "March 2027 Chinese Language Program",
  status: "open" as const,
  sourceUrl: home.finalUrl ?? home.url,
  sourceLabel: home.label,
  sourceSha256: home.sha256,
  capturedAt: home.fetchedAt,
  sourceFieldLineage: {
    intakeTerm: "March intake in current official home Notice title",
    intakeYear: "2027 in current official home Notice title",
    applicationRound: "current official home Notice title",
    status: "derived from current official home publication on October 23, 2026 and capture on October 27, 2026; no closing date imported",
  },
};
const candidate: CatalogSeedBundle = { version: 1, generatedAt: home.fetchedAt, cities: [city], schools: [school], programs: [program], programIntakes: [intake], scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: home.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 86, schoolSlugs: [school.slug], newSchools: 0, programs: 1, programIntakes: 1, scholarships: 0 },
  evidence: [...sources.values()].map((source) => ({ id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 })),
  accessReview: { result: "partial", note: "The university-owned home page directly publishes the two 2027 notice titles. All linked WeChat pages returned an environment-verification interstitial; no bypass was attempted and no hidden detail was inferred." },
  unresolved: ["Chinese-language program tuition, duration, language level, eligibility, materials and deadline remain absent.", "The 2027 Chinese Government Scholarship title is recorded only as a school-level review fact; no scholarship entity is created without coverage, eligibility or deadline text.", "Current degree-program details remain unresolved because the linked Programs page returned the same verification interstitial."],
  sensitiveDataCheck: { result: "pass", note: "No applicant data, personal contacts, payment details or account information are included." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-234");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 234, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
