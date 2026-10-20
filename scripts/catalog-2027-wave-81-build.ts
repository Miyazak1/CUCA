import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
} from "../src/server/catalog/seed-contract.ts";

type ManifestSource = {
  id: string;
  label: string;
  url: string;
  finalUrl?: string;
  fetchedAt: string;
  status: number;
  contentType: string;
  sha256: string;
  artifactPath: string;
  schoolSlug?: string;
};

const root = process.cwd();
const degreeRun = "work/catalog-official/2026-10-15T08-56-20-492Z";
const languageRun = "work/catalog-official/2026-10-15T04-01-01-888Z";
const candidatePath = resolve(root, "seeds/catalog.2027-wave-81.draft.json");
const validationPath = resolve(root, "seeds/catalog.2027-wave-81.validation.json");
const reviewPath = resolve(root, "seeds/catalog.2027-wave-81.review.json");
const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const json = async <T>(path: string): Promise<T> => JSON.parse(await readFile(resolve(root, path), "utf8")) as T;

const expectedSources = new Map<string, string>([
  ["tju-undergraduate-admissions-2027", "1e55d46672aa6efc0957cd9f37c590bfef5234c070d77e192e2b89566455ece8"],
  ["tju-undergraduate-program-catalog-2027", "b39a8f16ea41b70d77566735caec737410391f45b4ebe8c6c37fea1c9bead684"],
  ["tju-undergraduate-csca-subjects-2027", "3cb0ab9ccff78ab2a9f6bc4b9eda9f32322d4b6b07a1be6a59512d0e561a28b2"],
  ["tju-master-admissions-2027", "902b7df52f9e034bf3a5f47bef8d3d10145ee6202abf982faf0cb3c9aa291557"],
  ["tju-master-program-catalog-2027", "abac819bc46e9388cd61def72ab4d6715322ac6383b6f89879688c525381958e"],
  ["tju-doctoral-admissions-2027", "d7681ada3a16460072fce6c51b55439da5602848dd7b0395cc6878bc5324622b"],
  ["tju-doctoral-program-catalog-2027", "38494b6a56f62af2f5ad32db182cf35fc92277aca977003759ced51fd631d3cc"],
  ["tju-international-chinese-language-teachers-2026", "7b93f2d6dbd621f020a71bc865399ad453ec71cced9daabf1c15557b18aecd66"],
]);

const [degreeManifest, languageManifest, degreeBundle, languageBundle, tianjinDependency] = await Promise.all([
  json<{ sources: ManifestSource[] }>(`${degreeRun}/manifest.json`),
  json<{ sources: ManifestSource[] }>(`${languageRun}/manifest.json`),
  json<CatalogSeedBundle>("seeds/catalog.tju-complete-batch-01.draft.json"),
  json<CatalogSeedBundle>("seeds/catalog.tju-language-spring-2027.draft.json"),
  json<CatalogSeedBundle>("seeds/catalog.2027-wave-22.draft.json"),
]);
const evidence = [...degreeManifest.sources, ...languageManifest.sources].filter((source) => expectedSources.has(source.id));
if (evidence.length !== expectedSources.size) throw new Error(`Expected ${expectedSources.size} TJU sources, found ${evidence.length}.`);
for (const source of evidence) {
  if (source.schoolSlug !== "tianjin-university" || source.status !== 200 || source.sha256 !== expectedSources.get(source.id)) {
    throw new Error(`TJU evidence mismatch: ${source.id}`);
  }
  const run = source.id === "tju-international-chinese-language-teachers-2026" ? languageRun : degreeRun;
  const artifact = await readFile(resolve(root, run, source.artifactPath));
  if (sha256(artifact) !== source.sha256) throw new Error(`TJU artifact hash mismatch: ${source.id}`);
}

if ((degreeBundle.schools ?? []).length !== 1 || degreeBundle.schools?.[0]?.slug !== "tianjin-university") throw new Error("Unexpected TJU degree school dependency.");
if ((degreeBundle.programs ?? []).length !== 324 || (degreeBundle.programIntakes ?? []).length !== 324) throw new Error("Unexpected TJU 2027 degree route count.");
if ((languageBundle.programs ?? []).length !== 1 || (languageBundle.programIntakes ?? []).length !== 1) throw new Error("Unexpected TJU Spring 2027 language route count.");

const generatedAt = evidence.map((source) => source.fetchedAt).sort().at(-1)!;
const city = tianjinDependency.cities?.find((row) => row.slug === "tianjin");
if (!city) throw new Error("Reviewed Tianjin city dependency is missing.");
const school = {
  ...degreeBundle.schools![0],
  applicationLevel: "Undergraduate, Master, Doctoral and Non-degree",
  campusHighlights: [...(degreeBundle.schools![0].campusHighlights ?? []), "March 2027 one-semester Chinese-language scholarship route"],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: generatedAt,
};
const programs = [...degreeBundle.programs!, ...languageBundle.programs!].map((program) => ({
  ...program,
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: program.capturedAt,
}));
const programIntakes = [...degreeBundle.programIntakes!, ...languageBundle.programIntakes!];
if (new Set(programs.map((row) => row.slug)).size !== 325) throw new Error("TJU Wave 81 contains duplicate program slugs.");
if (programIntakes.some((row) => row.intakeYear !== 2027)) throw new Error("TJU Wave 81 contains a non-2027 intake.");

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt,
  cities: [city],
  schools: [school],
  programs,
  programIntakes,
  scholarships: [],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = sha256(candidateText);
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 Wave 81 validation failed: ${validation.errors.join(" ")}`);

const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlug: "tianjin-university", refreshedPrograms: 325, new2027Intakes: 325, scholarships: 0, sourceSnapshots: evidence.length },
  evidence: evidence.map((source) => ({ id: source.id, label: source.label, url: source.finalUrl ?? source.url, fetchedAt: source.fetchedAt, sha256: source.sha256 })),
  notes: [
    "The batch replaces Tianjin University's older degree-route view with all 324 rows from the official 2027 undergraduate, master's and doctoral workbooks, plus the separately published March 2027 one-semester language route.",
    "All 2027 degree routes retain their official duration, teaching language, tuition, application fee and route-level CSCA mapping where applicable.",
    "The six scholarship notices in the earlier complete bundle are 2026-cycle records and are intentionally excluded; the March 2027 language route retains only the scholarship coverage explicitly published for that route.",
    "Corrupt Chinese workbook cells are not reconstructed; verified English program names remain authoritative.",
    "No applicant, account, passport, payment or other personal data is included.",
  ],
};

await Promise.all([
  writeFile(candidatePath, candidateText, "utf8"),
  writeFile(validationPath, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 81, candidateSha256, counts: { schools: 1, programs: programs.length, programIntakes: programIntakes.length, scholarships: 0, sourceSnapshots: evidence.length }, publicationAuthorized: false }, null, 2));
