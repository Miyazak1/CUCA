import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
  type CatalogSeedProgramIntake,
} from "../src/server/catalog/seed-contract.ts";

type ManifestSource = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string; artifactPath: string };
const root = process.cwd();
const workRoot = resolve(root, "work/catalog-official");
const expected: Record<string, string> = {
  "gdufs-chinese-language-undergraduate-programs-current": "5c1560c7f0d5a485e8ea150d944dcb81113c7770a5cd9118cff53fcddf68788d",
  "gdufs-degree-admissions-chinese-spring-2027": "81c19154358ad7e6468266abd7e78b879e571e139f5d1bab93da2372f97617e5",
};
const evidence = new Map<string, ManifestSource>();
for (const entry of await readdir(workRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const runRoot = resolve(workRoot, entry.name);
  try {
    const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
    for (const item of manifest.sources ?? []) {
      if (item.status !== 200 || expected[item.id] !== item.sha256) continue;
      const bytes = await readFile(resolve(runRoot, item.artifactPath));
      if (createHash("sha256").update(bytes).digest("hex") !== item.sha256) throw new Error(`GDUFS Wave 44 evidence hash mismatch: ${item.id}`);
      evidence.set(item.id, item);
    }
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}
const missing = Object.keys(expected).filter((id) => !evidence.has(id));
if (missing.length) throw new Error(`Missing locked GDUFS Wave 44 evidence: ${missing.join(", ")}`);
const source = (id: string) => evidence.get(id)!;
const fields = (id: string) => {
  const row = source(id);
  return { sourceUrl: row.finalUrl ?? row.url, sourceLabel: row.label, sourceSha256: row.sha256, capturedAt: row.fetchedAt };
};
const verifiedAt = [...evidence.values()].map((row) => row.fetchedAt).sort().at(-1)!;

const dependency = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-11.draft.json"), "utf8")) as CatalogSeedBundle;
const school = dependency.schools?.find((row) => row.slug === "guangdong-university-of-foreign-studies");
const city = dependency.cities?.find((row) => row.slug === "guangzhou");
const targetProgramSlugs = [
  "guangdong-university-of-foreign-studies-chinese-language-business-chinese-spring-2027",
  "guangdong-university-of-foreign-studies-chinese-language-culture-communication-spring-2027",
];
const basePrograms = (dependency.programs ?? []).filter((row) => targetProgramSlugs.includes(row.slug));
const baseIntakes = (dependency.programIntakes ?? []).filter((row) => targetProgramSlugs.includes(row.programSlug));
if (!school || !city || basePrograms.length !== 2 || baseIntakes.length !== 2) throw new Error("Wave 44 GDUFS dependencies are incomplete.");

const cscaRequirement = "All undergraduate applicants must submit CSCA results. Mathematics is mandatory. Chinese-taught applicants take the applicable Professional Chinese paper; applicants to the Chinese Language undergraduate program may be exempt from Professional Chinese when they hold a valid HSK Level 4 report. Physics or Chemistry is required in principle only for science, engineering, agriculture or medicine routes and is not assigned to these two Chinese-language routes.";
const programs: CatalogSeedProgram[] = basePrograms.map((program) => ({
  ...program,
  cscaSubjects: ["Professional Chinese", "Mathematics"],
  cscaRequirement,
  applicationNote: `${program.applicationNote ?? ""} Required files include the high-school diploma and transcript, CSCA report, applicable HSK proof, passport, photo and valid physical examination; the university may request recommendation, police-clearance or nationality-status documents where applicable.`.trim(),
  verificationStatus: "verified",
  lastVerifiedAt: verifiedAt,
  ...fields("gdufs-degree-admissions-chinese-spring-2027"),
  sourceFieldLineage: {
    ...(program.sourceFieldLineage ?? {}),
    tuitionAmount: "current official Chinese-language undergraduate program page",
    tuitionCurrency: "current official Chinese-language undergraduate program page",
    tuitionPeriod: "current official Chinese-language undergraduate program page",
    tuitionText: "current official Chinese-language undergraduate program page",
    cscaSubjects: "Spring 2027 Chinese notice, CSCA appendix",
    cscaRequirement: "Spring 2027 Chinese notice, CSCA appendix",
    applicationNote: "Spring 2027 Chinese notice, eligibility, materials and supplementary-material appendix",
  },
}));
const programIntakes: CatalogSeedProgramIntake[] = baseIntakes.map((intake) => ({
  ...intake,
  deadlineDate: "2026-12-10T15:59:59.000Z",
  deadlineLabel: "Apply September 30-December 10, 2026. The exact closing time is not published; the deadline is normalized to end of day in Guangzhou.",
  ...fields("gdufs-degree-admissions-chinese-spring-2027"),
  sourceFieldLineage: {
    ...(intake.sourceFieldLineage ?? {}),
    deadlineDate: "official Spring 2027 Chinese notice; Guangzhou end-of-day normalization",
    deadlineLabel: "official Spring 2027 Chinese notice",
  },
}));

const candidate: CatalogSeedBundle = { version: 1, generatedAt: verifiedAt, cities: [city], schools: [school], programs, programIntakes, scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 44 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: verifiedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: [school.slug], refreshedPrograms: programs.length, new2027Intakes: 0, enriched2027Intakes: programIntakes.length, refreshedScholarships: 0, sourceSnapshots: 1 },
  evidence: [source("gdufs-degree-admissions-chinese-spring-2027")].map(({ id, label, url, fetchedAt, sha256 }) => ({ id, label, url, fetchedAt, sha256 })),
  unresolved: [
    "The Spring 2027 notice explicitly names only Chinese Language and Chinese Language (Business Chinese). No other GDUFS degree route is added for this intake.",
    "The notice gives general CSCA rules, not a program-by-program score threshold. The two Chinese-language routes therefore retain required subjects and the published HSK exemption rule without inventing a minimum CSCA score.",
    "Scholarship pages are standing schemes without one route-specific Spring 2027 award decision, so this evidence upgrade emits no scholarship entity.",
  ],
  notes: ["Wave 44 supersedes the matching Wave 11 program and intake rows in the unified candidate; it does not create duplicates.", "The builder re-verifies the locked current program-page artifact used by Wave 11, while the review lists only the newly added Chinese notice to avoid duplicating identical content captured at a later timestamp.", "No applicant, account, passport, payment or other personal data is included."],
};
const stem = resolve(root, "seeds/catalog.2027-wave-44");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 44, candidateSha256, counts: { schools: 1, programs: programs.length, enrichedProgramIntakes: programIntakes.length, scholarships: 0, sourceSnapshots: 1, reusedLockedSnapshots: 1 }, publicationAuthorized: false }, null, 2));
