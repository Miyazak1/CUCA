import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = {
  id: string;
  label: string;
  url: string;
  finalUrl?: string;
  fetchedAt: string;
  status: number;
  contentType: string;
  sha256: string;
  artifactPath: string;
};

const root = process.cwd();
const run = "2026-10-27T07-56-25-351Z";
const locks = new Map([
  ["ncepu-international-admission-page-2027", "1b9d03a3a42c20a4cfdf8495f586e364008fe2f989aa7ad012abc16132b328da"],
  ["ncepu-international-undergraduate-program-index-current", "6c1000a067e2a094331b5f717d12d1c37977c6a196c5abb6cb9d216ad77db3ca"],
  ["ncepu-international-master-program-index-current", "b09765d1bb7ea5409b1ccf2e9514b769e1fd8d16fbc4c70585bb0001c9f789de"],
  ["ncepu-international-doctoral-program-index-current", "dfa5c5e8728d1da10502aa9b2fdadf7d1298fa00b893e8505b6857dea8e15328"],
]);
const directory = resolve(root, "work/catalog-official", run);
const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8")) as { sources: Source[] };
const sources = new Map<string, Source>();
for (const [id, sha256] of locks) {
  const source = manifest.sources.find((row) => row.id === id && row.status === 200 && row.sha256 === sha256);
  if (!source) throw new Error(`Missing locked NCEPU evidence ${id}.`);
  const bytes = await readFile(resolve(directory, source.artifactPath));
  if (createHash("sha256").update(bytes).digest("hex") !== sha256) throw new Error(`Evidence hash mismatch: ${id}.`);
  sources.set(id, source);
}

const admission = sources.get("ncepu-international-admission-page-2027")!;
const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-139.draft.json"), "utf8")) as CatalogSeedBundle;
const city = prior.cities?.find((row) => row.slug === "beijing");
const base = prior.schools?.find((row) => row.slug === "north-china-electric-power-university");
if (!city || !base) throw new Error("Wave 139 NCEPU dependencies are missing.");

const school = {
  ...base,
  applicationLevel: "Bachelor, Master, Doctoral, visiting and Chinese-language international study. The current official program indexes list 4 undergraduate, 7 master and 6 doctoral program references.",
  admissionsUrl: admission.finalUrl ?? admission.url,
  campusHighlights: [
    "Official 2027 international admission landing page published",
    "Current official indexes list 4 undergraduate, 7 master and 6 doctoral program references",
    "The 2027 guide attachment exceeds the deterministic 50 MB acquisition limit, so cycle-specific fees and dates remain blank",
  ],
  lastVerifiedAt: admission.fetchedAt,
  sourceUrl: admission.finalUrl ?? admission.url,
  sourceLabel: admission.label,
  sourceSha256: admission.sha256,
  capturedAt: admission.fetchedAt,
  sourceFieldLineage: {
    ...(base.sourceFieldLineage ?? {}),
    applicationLevel: "official current undergraduate, master and doctoral program indexes",
    admissionsUrl: "official 2027 international admission landing page",
    campusHighlights: "official 2027 landing page, current program indexes and documented acquisition limit",
  },
};

const groups = [
  {
    sourceId: "ncepu-international-undergraduate-program-index-current",
    degreeLevel: "Bachelor",
    programs: [
      "Engineering Management",
      "Electrical Engineering and its Automation",
      "Business Administration",
      "Mechanical Engineering",
    ],
  },
  {
    sourceId: "ncepu-international-master-program-index-current",
    degreeLevel: "Master",
    programs: [
      "Electrical Engineering",
      "Power Engineering and Engineering Thermophysics",
      "Computer Science and Technology",
      "Control Science and Engineering",
      "Business Administration",
      "Management Science and Engineering",
      "Renewable Energy and Clean Energy",
    ],
  },
  {
    sourceId: "ncepu-international-doctoral-program-index-current",
    degreeLevel: "Doctoral",
    programs: [
      "Electrical Engineering",
      "Power Engineering and Engineering Thermophysics",
      "Control Science and Engineering",
      "Business Management",
      "Management Science and Engineering",
      "Renewable Energy and Clean Energy",
    ],
  },
] as const;

const slugify = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const category = (name: string) => /Business|Management/.test(name) ? "Business and Management" : /Computer|Control/.test(name) ? "Computer Science and Automation" : "Engineering";
const programs = groups.flatMap((group) => {
  const source = sources.get(group.sourceId)!;
  const evidence = {
    sourceUrl: source.finalUrl ?? source.url,
    sourceLabel: source.label,
    sourceSha256: source.sha256,
    capturedAt: source.fetchedAt,
  };
  return group.programs.map((name) => ({
    slug: `north-china-electric-power-university-${group.degreeLevel.toLowerCase()}-${slugify(name)}-current`,
    schoolSlug: school.slug,
    citySlug: city.slug,
    nameEn: name,
    degreeLevel: group.degreeLevel,
    fieldCategory: category(name),
    subjectArea: name,
    applicationUrl: admission.finalUrl ?? admission.url,
    applicationNote: "The university publishes a 2027 admission landing page, but this current program index does not assign a cycle-specific intake, deadline, tuition or language rule. Verify the large official 2027 guide before applying.",
    badgeText: "Current official program index",
    displaySubjects: [name],
    displayGroup: `ncepu-${group.degreeLevel.toLowerCase()}-current`,
    displayGroupLabel: `NCEPU current official ${group.degreeLevel.toLowerCase()} program references`,
    status: "draft" as const,
    verificationStatus: "unverified" as const,
    ...evidence,
    sourceFieldLineage: {
      nameEn: "official current program-index title; school suffix omitted where the page truncates it",
      degreeLevel: "official undergraduate, master or doctoral index",
      fieldCategory: "CUAC taxonomy based on the official program title",
      subjectArea: "official program-index title",
      applicationUrl: "official 2027 international admission landing page",
      applicationNote: "documented separation between current program index and unresolved cycle-specific guide fields",
      badgeText: "official current program index",
    },
  }));
});

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: admission.fetchedAt,
  cities: [city],
  schools: [school],
  programs,
  programIntakes: [],
  scholarships: [],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: admission.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: {
    target: "2026 ShanghaiRanking BCUR top 150",
    targetPosition: 84,
    schoolSlugs: [school.slug],
    newSchools: 0,
    programs: programs.length,
    programIntakes: 0,
    scholarships: 0,
  },
  evidence: [...sources.values()].map((source) => ({
    id: source.id,
    label: source.label,
    url: source.finalUrl ?? source.url,
    contentType: source.contentType,
    fetchedAt: source.fetchedAt,
    sha256: source.sha256,
  })),
  unresolved: [
    "The official 2027 admission guide PDF is 90,577,220 bytes and exceeds the deterministic collector's 52,428,800-byte safety limit; it is not bypassed or partially represented.",
    "The current program indexes are dated 2021/2022 and are linked from the same official admission site, but they do not explicitly assign the listed programs to the 2027 intake; no intake row is created.",
    "Program-index titles truncate some parenthetical school names; only the complete degree-program name preceding the parenthesis is retained.",
    "Teaching language, duration, tuition, deadline, requirements and scholarship eligibility remain blank because the captured indexes do not publish them at route level.",
  ],
  sensitiveDataCheck: {
    result: "pass",
    note: "Only public institutional program titles and admissions links are included; no applicant or personal contact data are present.",
  },
};

const stem = resolve(root, "seeds/catalog.2027-wave-229");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 229, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
