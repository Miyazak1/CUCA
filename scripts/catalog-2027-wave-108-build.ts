import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

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
};

const root = process.cwd();
const runRoot = resolve(root, "work/catalog-official/2026-10-26T04-11-46-706Z");
const sourceId = "dmu-international-spring-programs-2027";
const expectedSha256 = "f0e951abb6a120dd3670a3698c1997e080b652c4e4d73466cf5b6a1ae1fcef0f";
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: ManifestSource[] };
const source = manifest.sources.find((row) => row.id === sourceId && row.status === 200 && row.sha256 === expectedSha256);
if (!source) throw new Error(`Missing locked official evidence ${sourceId} at ${expectedSha256}.`);
const artifact = await readFile(resolve(runRoot, source.artifactPath));
if (createHash("sha256").update(artifact).digest("hex") !== expectedSha256) throw new Error(`Evidence hash mismatch: ${sourceId}.`);
const englishRunRoot = resolve(root, "work/catalog-official/2026-10-26T14-41-53-843Z");
const englishSourceId = "dmu-international-spring-programs-en-2027";
const englishExpectedSha256 = "66bebb21f3351c547403a96b86128ee4573626a23208bb10bc17e7210a74b0c3";
const englishManifest = JSON.parse(await readFile(resolve(englishRunRoot, "manifest.json"), "utf8")) as { sources: ManifestSource[] };
const englishSource = englishManifest.sources.find((row) => row.id === englishSourceId && row.status === 200 && row.sha256 === englishExpectedSha256);
if (!englishSource) throw new Error(`Missing locked official evidence ${englishSourceId} at ${englishExpectedSha256}.`);
const englishArtifact = await readFile(resolve(englishRunRoot, englishSource.artifactPath));
if (createHash("sha256").update(englishArtifact).digest("hex") !== englishExpectedSha256) throw new Error(`Evidence hash mismatch: ${englishSourceId}.`);
const sourceFields = {
  sourceUrl: source.finalUrl ?? source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
};

const dependency = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const city = dependency.cities?.find((row) => row.slug === "dalian");
if (!city) throw new Error("Dalian city dependency is missing.");

const schoolSlug = "dalian-medical-university";
if (dependency.schools?.some((row) => row.slug === schoolSlug)) throw new Error("Dalian Medical University already exists in the 100-school base.");
const preMedicalSlug = `${schoolSlug}-pre-medical`;
const mbbsSlug = `${schoolSlug}-clinical-medicine-mbbs`;

const school = {
  slug: schoolSlug,
  nameEn: "Dalian Medical University",
  nameZh: "大连医科大学",
  citySlug: "dalian",
  schoolType: "Medical university",
  region: "Dalian, Liaoning, Northeast China",
  applicationLevel: "Foundation and Undergraduate",
  languageOfInstruction: "English for the published Spring 2027 Clinical Medicine (MBBS) route; the Pre-Medical teaching language is not published in the captured announcement.",
  deadlineSummary: "The Spring 2027 application system opens October 20, 2026. The captured announcement does not publish a closing date.",
  websiteUrl: "https://www.dmu.edu.cn/",
  admissionsUrl: sourceFields.sourceUrl,
  subjectTags: ["Medicine", "Pre-Medical Studies", "Clinical Medicine"],
  languageTags: ["English"],
  campusHighlights: ["Spring 2027 Pre-Medical intake", "Spring 2027 English-taught Clinical Medicine (MBBS) intake"],
  contactNotes: "International Education College, Dalian Medical University, 9 West Section, Lvshun South Road, Dalian, Liaoning; dmunewstudent@163.com; +86-411-86110202.",
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: source.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    nameEn: "official university identity and English announcement title",
    nameZh: "official announcement title",
    citySlug: "official page footer address",
    schoolType: "official university identity; no broader institutional classification inferred",
    region: "official page footer address plus the reviewed Dalian city dependency",
    applicationLevel: "official Spring 2027 announcement program list",
    languageOfInstruction: "official announcement explicitly labels Clinical Medicine as English-taught; Pre-Medical remains unresolved",
    deadlineSummary: "official announcement application-system opening date; no closing date inferred",
    websiteUrl: "official university link in the International Education College footer",
    admissionsUrl: "captured official Spring 2027 announcement",
    subjectTags: "official Spring 2027 program list",
    campusHighlights: "official Spring 2027 program list",
    contactNotes: "official page footer public institutional contact details",
  },
};

const sharedApplicationNote = "Apply through the online system published by the university. The announcement requires the high-school diploma and transcripts to be authenticated by a Chinese embassy or consulate, or notarized in China; originals must be submitted and are not returned. Financial proof or a one-year bank statement, medical examination, passport photo and other supporting documents may be uploaded. Pre-admitted applicants pay the stated fee in their offer before the university issues the Admission Notice and JW202.";

const programs = [
  {
    slug: preMedicalSlug,
    schoolSlug,
    citySlug: "dalian",
    nameEn: "Pre-Medical Program",
    nameZh: "预科项目",
    degreeLevel: "Foundation",
    fieldCategory: "Medicine and Health Sciences",
    subjectArea: "Pre-Medical Studies",
    applicationNote: sharedApplicationNote,
    badgeText: "Spring 2027",
    status: "active" as const,
    verificationStatus: "verified" as const,
    lastVerifiedAt: source.fetchedAt,
    ...sourceFields,
    sourceFieldLineage: {
      nameEn: "translated from the official Spring 2027 program list",
      nameZh: "official Spring 2027 program list",
      degreeLevel: "official pre-medical / preparatory classification",
      fieldCategory: "official pre-medical program identity",
      subjectArea: "official pre-medical program identity",
      applicationNote: "official announcement application process and document note",
      badgeText: "official announcement title",
    },
  },
  {
    slug: mbbsSlug,
    schoolSlug,
    citySlug: "dalian",
    nameEn: "Clinical Medicine (MBBS)",
    nameZh: "临床医学（英语授课）",
    degreeLevel: "Bachelor",
    fieldCategory: "Medicine and Health Sciences",
    subjectArea: "Clinical Medicine",
    teachingLanguage: "English",
    applicationNote: sharedApplicationNote,
    badgeText: "Spring 2027",
    displaySubjects: ["Clinical Medicine"],
    status: "active" as const,
    verificationStatus: "verified" as const,
    lastVerifiedAt: source.fetchedAt,
    ...sourceFields,
    sourceFieldLineage: {
      nameEn: "official English Spring 2027 announcement program name",
      nameZh: "official Chinese Spring 2027 announcement program name",
      degreeLevel: "official undergraduate classification",
      fieldCategory: "official program identity",
      subjectArea: "official program identity",
      teachingLanguage: "official announcement explicitly marks the program as English-taught",
      applicationNote: "official announcement application process and document note",
      badgeText: "official announcement title",
      displaySubjects: "official program identity only; no unverified curriculum subjects added",
    },
  },
];

const programIntakes = [preMedicalSlug, mbbsSlug].map((programSlug) => ({
  programSlug,
  intakeTerm: "Spring",
  intakeYear: 2027,
  openDate: "2026-10-19T16:00:00.000Z",
  deadlineLabel: "Application system opens October 20, 2026 Beijing Time; no closing date is published in the captured announcement.",
  applicationRound: "Dalian Medical University Spring 2027 International Student Programs",
  ...sourceFields,
  sourceFieldLineage: {
    intakeTerm: "official Spring 2027 announcement title",
    intakeYear: "official Spring 2027 announcement title",
    openDate: "official Beijing-time system opening date converted to UTC",
    deadlineLabel: "official opening date; closing date explicitly left unresolved",
    applicationRound: "official announcement title",
  },
}));

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: source.fetchedAt,
  cities: [city],
  schools: [school],
  programs,
  programIntakes,
  scholarships: [],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 Wave 108 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: source.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: [schoolSlug], newSchools: 1, programs: 2, programIntakes: 2, scholarships: 0 },
  evidence: [
    { id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 },
    { id: englishSource.id, label: englishSource.label, url: englishSource.finalUrl ?? englishSource.url, contentType: englishSource.contentType, fetchedAt: englishSource.fetchedAt, sha256: englishSource.sha256 },
  ],
  unresolved: [
    "The Chinese and English announcement pages are both captured and hash-locked. Their linked 2026-2027 admission-brochure endpoints return verification-code HTML instead of the advertised PDF; the CAPTCHA is not bypassed and no claims are taken from those responses.",
    "The captured announcement does not publish an application closing date, tuition, application fee, program duration, scholarship terms, CSCA requirements or language thresholds. Those fields remain absent.",
    "The announcement explicitly labels Clinical Medicine as English-taught but does not state the Pre-Medical teaching language, so that program's teachingLanguage remains absent.",
    "The online application system is an HTTP external service URL published by the university. It is retained as a referenced application endpoint and is not collected or accessed by this workflow.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Only public institutional admissions facts and public office contact details are included; no applicant or account data is present." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-108");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 108, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
