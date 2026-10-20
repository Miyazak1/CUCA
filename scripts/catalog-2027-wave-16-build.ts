import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
} from "../src/server/catalog/seed-contract.ts";

type ManifestSource = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; sha256: string; artifactPath: string };
const root = process.cwd();
const workRoot = resolve(root, "work/catalog-official");
const basePath = resolve(root, "seeds/catalog.reviewed-100-official-release.json");
const candidatePath = resolve(root, "seeds/catalog.2027-wave-16.draft.json");
const validationPath = resolve(root, "seeds/catalog.2027-wave-16.validation.json");
const reviewPath = resolve(root, "seeds/catalog.2027-wave-16.review.json");
const sourceBundles = ["beihang", "csu", "changan", "jilin", "lnutcm", "shu", "zjsu", "zju"] as const;
const expected: Record<string, string> = {
  "beihang-international-chinese-language-teachers-scholarship-2026": "ae0b491171b41b28531f552b4f284f24cc7a50fb35f483d0eb9a32854826ac9e",
  "csu-international-chinese-language-teachers-scholarship-2026": "7a48ccdd412b267f15145975ea8eb385a32f83aad7655d233acfaa1441883fb7",
  "changan-international-chinese-language-teachers-scholarship-2026": "22ef64ba3d6b9d591ea1e5eb5c91c915777be6316f65fd09a780dbd7f9df8c22",
  "changan-spring-intake-programs-2027": "1a1fa6f85d4ce2e9cca93a07b792e568a192c0c577b93f4e6d3a3b952fba6a0f",
  "jilin-international-chinese-language-teachers-scholarship-2026": "4e06f233bdfb8ddf5136125a54a1efa4ae622bcba90881f5e0878694624bc121",
  "lnutcm-chinese-language-program-2026-2027": "b23fae23d63e4c88bb0ef8f1b19fe46aca7b5e7d496b29b905a31481dc646115",
  "lnutcm-chinese-language-guide-image-1-2026-2027": "274161ca59d39d18f1a4c9285e557515adac5cbe55909e9ab87b1139628de44a",
  "lnutcm-chinese-language-guide-image-2-2026-2027": "1bf78a9710184461dff0895682d9671e7f27215feb98d087d4cabe674e977da9",
  "lnutcm-chinese-language-guide-image-3-2026-2027": "18201b336fa26400fc035ef28f3cbeec0f4f2f9490d947810a5e6a92b2501d07",
  "lnutcm-chinese-language-guide-image-4-2026-2027": "3bb35723bc2ff722e76e88fec21b34989d3ee4f88ef0177f9128e0ba87bcc8ab",
  "lnutcm-chinese-language-guide-image-5-2026-2027": "0b81eb5160f3066f6dcf833eb4d649801cf58c7cea0bf33cfeb507536d245a0c",
  "lnutcm-chinese-language-guide-image-6-2026-2027": "ba5d1a094d82c000968b26f2b093f3b45ac73be780cb711addb8c27753a3f2df",
  "shu-international-chinese-language-teachers-scholarship-2026": "cb9703d6835e09db3391b4d8beedb5ab820a8484b9000a3277a48334731951c4",
  "zjsu-international-chinese-language-teachers-scholarship-2026": "6471a83e0a0192fdfd7f9a8d0c32e4d20c6a74e293c30615facffed2ebf0fc6d",
  "zju-international-chinese-language-teachers-scholarship-2026": "2b88b8fadfe9f84d079829ae65008ab977a1277672f3fbea4baf4f6b8bae7f4c",
};

const evidence = new Map<string, ManifestSource & { runRoot: string }>();
for (const entry of await readdir(workRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const runRoot = resolve(workRoot, entry.name);
  try {
    const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
    for (const item of manifest.sources ?? []) {
      if (item.status !== 200 || expected[item.id] !== item.sha256) continue;
      const prior = evidence.get(item.id);
      if (!prior || prior.fetchedAt < item.fetchedAt) evidence.set(item.id, { ...item, runRoot });
    }
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}
const missing = Object.keys(expected).filter((id) => !evidence.has(id));
if (missing.length) throw new Error(`Missing locked 2027 wave 16 evidence: ${missing.join(", ")}`);
for (const item of evidence.values()) {
  const bytes = await readFile(resolve(item.runRoot, item.artifactPath));
  if (createHash("sha256").update(bytes).digest("hex") !== item.sha256) throw new Error(`Evidence hash mismatch: ${item.id}`);
}

const bundles = await Promise.all(sourceBundles.map(async (stem) => JSON.parse(await readFile(resolve(root, `seeds/catalog.${stem}-language-spring-2027.draft.json`), "utf8")) as CatalogSeedBundle));
for (const [index, bundle] of bundles.entries()) {
  const report = createCatalogMigrationValidationReport(bundle);
  if (!report.ok) throw new Error(`${sourceBundles[index]} Spring 2027 source bundle is invalid:\n${report.errors.join("\n")}`);
  if ((bundle.schools ?? []).length !== 1 || (bundle.programs ?? []).length !== 1 || (bundle.programIntakes ?? []).length !== 1) {
    throw new Error(`${sourceBundles[index]} Spring 2027 source bundle no longer has the expected one-school, one-program and one-intake shape.`);
  }
}

const base = JSON.parse(await readFile(basePath, "utf8")) as CatalogSeedBundle;
const citySlugs = [...new Set(bundles.flatMap((bundle) => (bundle.programs ?? []).map((row) => row.citySlug)))];
const cities = citySlugs.map((slug) => (base.cities ?? []).find((row) => row.slug === slug)).filter((row): row is NonNullable<typeof row> => Boolean(row));
if (cities.length !== citySlugs.length) throw new Error("Wave 16 is missing a reviewed city dependency.");
const schools = bundles.flatMap((bundle) => bundle.schools ?? []);
const changanSchoolIndex = schools.findIndex((row) => row.slug === "chang-an-university");
schools[changanSchoolIndex] = {
  ...schools[changanSchoolIndex],
  applicationFee: "CNY 400 for the self-funded Chinese-language route; CNY 600 for the China Link route after material review. Scholarship-route fees may differ.",
  sourceFieldLineage: {
    ...(schools[changanSchoolIndex].sourceFieldLineage ?? {}),
    applicationFee: "official 2027 self-funded Chinese-language fee table and China Link application procedure",
  },
};
const programs = bundles.flatMap((bundle) => bundle.programs ?? []);
const changanProgramIndex = programs.findIndex((row) => row.slug === "chang-an-university-iclts-one-semester-study-spring-2027");
programs[changanProgramIndex] = {
  ...programs[changanProgramIndex],
  tuitionText: "Tuition is fully covered by the linked International Chinese Language Teachers Scholarship; no self-funded amount is published for this route.",
  sourceFieldLineage: {
    ...(programs[changanProgramIndex].sourceFieldLineage ?? {}),
    tuitionText: "official scholarship coverage section",
  },
};
const programIntakes = bundles.flatMap((bundle) => bundle.programIntakes ?? []);
if (new Set(schools.map((row) => row.slug)).size !== schools.length) throw new Error("Wave 16 contains duplicate school rows.");
if (new Set(programs.map((row) => row.slug)).size !== programs.length) throw new Error("Wave 16 contains duplicate program rows.");
if (programIntakes.some((row) => row.intakeYear !== 2027)) throw new Error("Wave 16 contains a non-2027 intake.");

const generatedAt = [...evidence.values()].map((row) => row.fetchedAt).sort().at(-1)!;
const candidate: CatalogSeedBundle = { version: 1, generatedAt, cities, schools, programs, programIntakes, scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 16 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: schools.map((row) => row.slug).sort(), refreshedPrograms: programs.length, new2027Intakes: programIntakes.length, refreshedScholarships: 0, sourceSnapshots: evidence.size },
  evidence: [...evidence.values()].map(({ id, label, url, fetchedAt, sha256 }) => ({ id, label, url, fetchedAt, sha256 })).sort((a, b) => a.id.localeCompare(b.id)),
  unresolved: [
    "Seven routes are March 2027 one-semester International Chinese Language Teachers Scholarship routes published inside 2026 scholarship guides; they do not establish general Fall 2027 degree admissions.",
    "The LNUTCM route is a separate Spring 2027 self-funded Chinese-language program; its degree routes remain on earlier cycles.",
    "The underlying draft rows remain unverified pending human review; this aggregation does not promote them or authorize publication.",
    "Jilin's monetary scholarship coverage remains absent because the official attachment is CAPTCHA-protected and was not bypassed.",
  ],
  notes: [
    "This wave reuses eight previously generated, contract-valid source bundles and re-verifies every locked raw artifact hash, including all six LNUTCM guide images.",
    "No applicant, account, passport, payment or other personal data is included.",
  ],
};
await Promise.all([
  writeFile(candidatePath, candidateText, "utf8"),
  writeFile(validationPath, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, candidatePath, validationPath, reviewPath, candidateSha256, counts: { cities: cities.length, schools: schools.length, programs: programs.length, programIntakes: programIntakes.length, scholarships: 0, sourceSnapshots: evidence.size }, publicationAuthorized: false }, null, 2));
