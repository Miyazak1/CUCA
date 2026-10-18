import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
  type CatalogSeedProgramIntake,
  type CatalogSeedScholarship,
} from "../src/server/catalog/seed-contract.ts";

type ManifestSource = {
  id: string;
  label: string;
  url: string;
  finalUrl?: string;
  fetchedAt: string;
  status: number;
  sha256: string;
  artifactPath: string;
};

const root = process.cwd();
const workRoot = resolve(root, "work/catalog-official");
const releasePath = resolve(root, "seeds/catalog.reviewed-100-official-release.json");
const candidatePath = resolve(root, "seeds/catalog.2027-wave-02.draft.json");
const validationPath = resolve(root, "seeds/catalog.2027-wave-02.validation.json");
const reviewPath = resolve(root, "seeds/catalog.2027-wave-02.review.json");
const expected: Record<string, string> = {
  "xmu-undergraduate-admissions-2027": "23339b569cd29cf3f29857e477d1bbe87e0ac8e54a09b56f94db0b45c4c6cbcf",
  "xmu-master-admissions-2027": "d9b75f2174b01ff4e78d4c15b9fe1b9224e9b72a5b8b25b85fbdba727c1af04f",
  "xmu-doctoral-admissions-2027": "922e30024117104ccf9582060849000df6115fcff5ffef37137ca8dba5a7495e",
  "xmu-undergraduate-programs-chinese-2027": "10ac274c2b150c2d17edf5661d7d90b6c782cdadbc025e60e7d58d5945772407",
  "xmu-undergraduate-programs-english-2027": "4c593c48f7d548814a16f3982184d71ca8e1f09db2ff917752ac02f4e9839bad",
  "xmu-master-programs-chinese-2027": "80e248e1c7c2c66c440fcf8f6fb02b2882f4f264bd65451068f709293bff2795",
  "xmu-master-programs-english-2027": "06b6dbcd7346ad5edd0bfcb5d49f30afabf87c65808326636c6426413e0977e5",
  "xmu-doctoral-programs-chinese-2027": "09411c05721de9440ff5e5dd2af3cc858c89c71837b10e683d48228407216c3a",
  "xmu-doctoral-programs-english-2027": "b912cc37128ddc05d5db628efa264c0a9f689b67c20760de56672bfbe34afea0",
  "xmu-new-international-student-scholarship-2027": "8e551110516ec05b9efe59fbd86ef4a05135512445934a0d6a208db767bd7a3d",
};

const evidence = new Map<string, ManifestSource & { runRoot: string }>();
for (const entry of await readdir(workRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const runRoot = resolve(workRoot, entry.name);
  try {
    const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
    for (const source of manifest.sources ?? []) if (source.status === 200 && expected[source.id] === source.sha256) evidence.set(source.id, { ...source, runRoot });
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}
const missing = Object.keys(expected).filter((id) => !evidence.has(id));
if (missing.length) throw new Error(`Missing locked XMU 2027 evidence: ${missing.join(", ")}`);
for (const source of evidence.values()) {
  const bytes = await readFile(resolve(source.runRoot, source.artifactPath));
  if (createHash("sha256").update(bytes).digest("hex") !== source.sha256) throw new Error(`Evidence hash mismatch: ${source.id}`);
}
const visibleText = async (source: ManifestSource & { runRoot: string }) => (await readFile(resolve(source.runRoot, source.artifactPath), "utf8"))
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;|&#160;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/\s+/g, " ");

const catalogText = new Map<string, string>();
for (const id of Object.keys(expected).filter((id) => id.includes("-programs-"))) catalogText.set(id, await visibleText(evidence.get(id)!));
const release = JSON.parse(await readFile(releasePath, "utf8")) as CatalogSeedBundle;
const xmuPrograms = (release.programs ?? []).filter((program) => program.schoolSlug === "xiamen-university");
const catalogId = (program: CatalogSeedProgram) => `xmu-${program.degreeLevel.toLowerCase()}-programs-${program.teachingLanguage === "English" ? "english" : "chinese"}-2027`;
const codeOf = (program: CatalogSeedProgram) => /official program code ([A-Z0-9]+)/i.exec(program.applicationNote ?? "")?.[1];
const confirmedPrograms = xmuPrograms.filter((program) => {
  const code = codeOf(program);
  return Boolean(code && catalogText.get(catalogId(program))?.includes(code));
});
const intakes: CatalogSeedProgramIntake[] = confirmedPrograms.map((program) => {
  const sourceId = program.degreeLevel === "Master" ? "xmu-master-admissions-2027" : "xmu-doctoral-admissions-2027";
  const source = evidence.get(sourceId)!;
  return {
    programSlug: program.slug,
    intakeTerm: "Fall",
    intakeYear: 2027,
    openDate: "2026-12-01T00:00:00.000Z",
    deadlineDate: "2027-05-31T15:59:59.000Z",
    deadlineLabel: "Self-funded application deadline: May 31, 2027; scholarship deadlines are earlier",
    applicationRound: `2027 Xiamen University international ${program.degreeLevel.toLowerCase()} admission`,
    status: "open",
    sourceUrl: source.finalUrl ?? source.url,
    sourceLabel: source.label,
    sourceSha256: source.sha256,
    capturedAt: source.fetchedAt,
    sourceFieldLineage: {
      intakeYear: "2027 admission guide and current degree-level program catalog",
      openDate: "admission guide, application timetable",
      deadlineDate: "admission guide, self-funded application deadline; end-of-day Beijing time normalized to UTC",
      status: "published application window",
    },
  };
});
if (confirmedPrograms.length !== 386 || intakes.length !== 386) throw new Error(`Expected 386 code-confirmed XMU graduate routes, found ${confirmedPrograms.length}.`);

const scholarshipSource = evidence.get("xmu-new-international-student-scholarship-2027")!;
const scholarship: CatalogSeedScholarship = {
  slug: "official-2027-xmu-new-international-student-scholarship",
  schoolSlug: "xiamen-university",
  title: "Xiamen University 2027 New International Students Scholarship",
  type: "university",
  typeLabel: "University scholarship",
  providerNameEn: "Xiamen University",
  providerLocation: "Xiamen, Fujian, China",
  fundingLevel: "Tiered tuition award with selected living stipend",
  coverage: "First prize waives tuition and provides a monthly stipend; second prize waives tuition; third prize waives 50% of tuition.",
  applicableDegree: "Undergraduate, Master, Doctoral",
  applicableProgram: "Eligible 2027 Xiamen University international degree programs; English-taught undergraduate programs are excluded.",
  amountText: "First prize: tuition waiver plus RMB 2,500/month undergraduate, RMB 3,000/month master, or RMB 3,500/month doctoral stipend; second prize: tuition waiver; third prize: 50% tuition waiver",
  deadlineDate: "2027-04-30",
  deadlineLabel: "Application period: December 1, 2026 to April 30, 2027",
  applicationRound: "2027 international degree intake",
  benefitItems: [
    { label: "First prize", included: true, note: "Full tuition waiver and degree-level monthly stipend" },
    { label: "Second prize", included: true, note: "Full tuition waiver" },
    { label: "Third prize", included: true, note: "50% tuition waiver" },
  ],
  eligibilityItems: [
    { label: "Admission eligibility", value: "Meet all requirements of the applicable 2027 XMU admission guide" },
    { label: "Undergraduate", value: "High-school qualification or above; no older than 25" },
    { label: "Master", value: "Bachelor qualification or above; no older than 40" },
    { label: "Doctoral", value: "Master qualification or above; no older than 45" },
  ],
  applicationMaterials: [{ label: "Signed XMU New International Students Scholarship application form" }],
  applicationSteps: [
    { label: "Step 1", value: "Apply to an eligible XMU degree program in the international applicant system" },
    { label: "Step 2", value: "Upload the signed scholarship form before April 30, 2027" },
  ],
  actionLinks: [{ label: "Official XMU scholarship guide", url: scholarshipSource.finalUrl ?? scholarshipSource.url, kind: "official-source" }],
  targetCountries: [],
  targetRegions: [],
  summary: "XMU's tiered 2027 award for newly admitted international degree students.",
  sortOrder: 10,
  status: "draft",
  verificationStatus: "unverified",
  sourceUrl: scholarshipSource.finalUrl ?? scholarshipSource.url,
  sourceLabel: scholarshipSource.label,
  sourceSha256: scholarshipSource.sha256,
  capturedAt: scholarshipSource.fetchedAt,
  sourceFieldLineage: {
    title: "official page title",
    fundingLevel: "section 4 funding standards",
    coverage: "sections 1 and 4",
    applicableDegree: "sections 2-5",
    amountText: "section 4 funding standards table",
    deadlineDate: "section 6 application period",
    eligibilityItems: "section 2 applicant qualifications",
    applicationSteps: "section 7 application procedure",
  },
};

const generatedAt = [...evidence.values()].map((source) => source.fetchedAt).sort().at(-1)!;
const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt,
  cities: (release.cities ?? []).filter((row) => row.slug === "xiamen"),
  schools: (release.schools ?? []).filter((row) => row.slug === "xiamen-university"),
  programs: confirmedPrograms.sort((left, right) => left.slug.localeCompare(right.slug)),
  programIntakes: intakes.sort((left, right) => left.programSlug.localeCompare(right.programSlug)),
  scholarships: [scholarship],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 02 validation failed:\n${validation.errors.join("\n")}`);
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  target: { schools: 10, completedThroughWave: 4 },
  scope: {
    schoolSlug: "xiamen-university",
    existingPrograms: xmuPrograms.length,
    exactCodeConfirmedPrograms: confirmedPrograms.length,
    unresolvedPrograms: xmuPrograms.length - confirmedPrograms.length,
    new2027Intakes: intakes.length,
    new2027Scholarships: 1,
  },
  evidence: [...evidence.values()].map(({ id, label, url, fetchedAt, sha256 }) => ({ id, label, url, fetchedAt, sha256 })).sort((a, b) => a.id.localeCompare(b.id)),
  notes: [
    "Only master and doctoral routes whose official program code is present in the matching 2027 catalog receive an intake.",
    "Undergraduate routes remain unresolved because the legacy records do not carry official program codes; they are not rolled forward automatically.",
    "The self-funded deadline is stored on program intakes; scholarship-specific deadlines remain on scholarship records.",
    "No applicant or account data is present.",
  ],
};
await Promise.all([
  writeFile(candidatePath, candidateText, "utf8"),
  writeFile(validationPath, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, school: "xiamen-university", confirmedPrograms: confirmedPrograms.length,
  new2027Intakes: intakes.length, new2027Scholarships: 1, unresolvedPrograms: xmuPrograms.length - confirmedPrograms.length,
  candidatePath, validationPath, reviewPath, candidateSha256 }, null, 2));
