import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
  type CatalogSeedProgramIntake,
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
const expected = {
  "hust-international-exchange-programs-2027": {
    sha256: "56b6a9a986aa56ae88644cccf511ccede675526ce1be19707911a90a206a7b38",
    runRoot: "work/catalog-official/hust-exchange-2027-2026-10-18",
  },
  "hust-visiting-student-english-programs-2027": {
    sha256: "e467e88b37f5d0834debc412d1ec822862a394c08e0fd1ce02506ee506654719",
    runRoot: "work/catalog-official/hust-exchange-programs-2027-2026-10-18",
  },
} as const;

const evidence = new Map<string, ManifestSource>();
for (const [id, lock] of Object.entries(expected)) {
  const runRoot = resolve(root, lock.runRoot);
  const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources?: ManifestSource[] };
  const source = manifest.sources?.find((row) => row.id === id && row.status === 200 && row.sha256 === lock.sha256);
  if (!source) throw new Error(`Missing locked HUST Wave 37 evidence: ${id}`);
  const bytes = await readFile(resolve(runRoot, source.artifactPath));
  if (createHash("sha256").update(bytes).digest("hex") !== lock.sha256) throw new Error(`HUST Wave 37 evidence hash mismatch: ${id}`);
  evidence.set(id, source);
}

const admissions = evidence.get("hust-international-exchange-programs-2027")!;
const catalog = evidence.get("hust-visiting-student-english-programs-2027")!;
const baseline = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const schoolSlug = "huazhong-university-of-science-and-technology";
const school = baseline.schools?.find((row) => row.slug === schoolSlug);
const city = baseline.cities?.find((row) => row.slug === "wuhan");
if (!school || !city) throw new Error("Wave 37 HUST dependencies are missing from the reviewed 100-school release.");

const sourceFields = (source: ManifestSource) => ({
  sourceUrl: source.finalUrl ?? source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
});
const slugify = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const specs = [
  ["Chemistry", "Science & Technology"],
  ["Mechanical Engineering", "Science & Technology"],
  ["Materials Science", "Science & Technology"],
  ["Materials Processing Engineering", "Science & Technology"],
  ["New Energy Science and Engineering", "Science & Technology"],
  ["Naval Architecture and Ocean Engineering", "Science & Technology"],
  ["Biochemistry and Molecular Biology", "Science & Technology"],
  ["Biomedical Engineering", "Science & Technology"],
  ["Information and Communication Engineering", "Science & Technology"],
  ["Intelligent Science and Technology", "Science & Technology"],
  ["Control Science and Engineering", "Science & Technology"],
  ["Computer Science and Technology", "Science & Technology"],
  ["Management Science and Engineering", "Management & Economics"],
  ["Science of Business Administration", "Management & Economics"],
  ["Finance", "Management & Economics"],
  ["International Trade", "Management & Economics"],
  ["Public Administration", "Management & Economics"],
] as const;

const durationOptions: Array<{ slug: string; label: string; durationMonths?: number; durationYears?: number }> = [
  { slug: "one-semester", label: "One Semester", durationMonths: 5 },
  { slug: "one-academic-year", label: "One Academic Year", durationYears: 1 },
];

const programs: CatalogSeedProgram[] = specs.flatMap(([nameEn, fieldCategory]) => durationOptions.map((duration) => ({
  slug: `${schoolSlug}-exchange-${slugify(nameEn)}-${duration.slug}-2027`,
  schoolSlug,
  citySlug: city.slug,
  nameEn: `${nameEn} (International Exchange - ${duration.label})`,
  degreeLevel: "Non-degree",
  ...(duration.durationMonths ? { durationMonths: duration.durationMonths } : {}),
  ...(duration.durationYears ? { durationYears: duration.durationYears } : {}),
  fieldCategory,
  subjectArea: nameEn,
  teachingLanguage: "English",
  englishRequirement: "TOEFL 80, IELTS 6.0, an accepted equivalent certificate, or proof that the previous degree was taught in English.",
  tuitionText: "Registration fees, tuition and other institutional fees are governed by the applicable inter-university exchange agreement; HUST does not publish a numeric amount on this route.",
  applicationUrl: admissions.finalUrl ?? admissions.url,
  applicationNote: `Applicants must be non-Chinese citizens currently enrolled at a university with a valid HUST exchange agreement and be formally nominated by their home university for ${duration.label.toLowerCase()}. Required materials are the nomination letter, current study-status certificate, transcript, CV, one-page study or research plan, language proof, passport, physical examination form and non-criminal record certificate. Fees follow the applicable exchange agreement and are therefore not published as numeric catalog fields.`,
  badgeText: "2027 partner exchange",
  displayGroup: "International Exchange",
  displayGroupLabel: "2027 English-medium visiting programs",
  status: "active",
  verificationStatus: "verified",
  lastVerifiedAt: admissions.fetchedAt,
  ...sourceFields(catalog),
  sourceFieldLineage: {
    nameEn: "official 2027 English-medium visiting-program table",
    degreeLevel: "official exchange and visiting-student wording",
    ...(duration.durationMonths ? { durationMonths: "official one-semester option and published five-month semester dates" } : {}),
    ...(duration.durationYears ? { durationYears: "official one-academic-year option" } : {}),
    fieldCategory: "official discipline heading",
    subjectArea: "official program row",
    teachingLanguage: "official English-medium catalog title",
    englishRequirement: "official exchange guide, language-proficiency section",
    tuitionText: "official exchange guide, fees section referring applicants to the applicable exchange agreement",
    applicationUrl: "registered official exchange guide",
    applicationNote: "official eligibility, duration, application-materials and fees sections",
    badgeText: "official 2027 exchange guide",
    displayGroup: "official exchange-program category",
    displayGroupLabel: "official program-catalog title",
  },
})));

const intake = (programSlug: string, term: "Spring" | "Fall", deadlineDate: string, deadlineLabel: string): CatalogSeedProgramIntake => ({
  programSlug,
  intakeTerm: term,
  intakeYear: 2027,
  openDate: "2026-10-14T16:00:00.000Z",
  deadlineDate,
  deadlineLabel,
  applicationRound: "HUST 2027 International Exchange Programs",
  status: "open",
  ...sourceFields(admissions),
  sourceFieldLineage: {
    intakeTerm: "official program-duration section",
    intakeYear: "official guide title and semester dates",
    openDate: "official application-open date",
    deadlineDate: "official application deadline",
    deadlineLabel: "official application deadline and semester dates",
    applicationRound: "official guide title",
    status: "application period compared with capturedAt",
  },
});
const programIntakes = programs.flatMap((program) => [
  intake(program.slug, "Spring", "2026-12-15T15:59:59.000Z", "Apply by December 15, 2026; semester runs February 15-July 15, 2027."),
  intake(program.slug, "Fall", "2027-05-31T15:59:59.000Z", "Apply by May 31, 2027; semester runs September 1, 2027-January 31, 2028."),
]);

const generatedAt = [...evidence.values()].map((row) => row.fetchedAt).sort().at(-1)!;
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
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`2027 wave 37 validation failed:\n${validation.errors.join("\n")}`);
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { schoolSlugs: [schoolSlug], refreshedPrograms: programs.length, new2027Intakes: programIntakes.length, refreshedScholarships: 0, sourceSnapshots: evidence.size },
  evidence: [...evidence.values()].map(({ id, label, url, fetchedAt, sha256 }) => ({ id, label, url, fetchedAt, sha256 })).sort((a, b) => a.id.localeCompare(b.id)),
  unresolved: [
    "The guide publishes registration fee, tuition and other institutional fees only by reference to each exchange agreement, so no numeric tuition or application fee is emitted.",
    "Applicants must confirm the exact program name before applying; the 17 program names are limited to the official linked 2027 English-medium catalog. Each program is separated into the officially selectable one-semester and one-academic-year duration options.",
    "The route is available only to students at partner universities who receive an official home-university nomination.",
    "This update does not establish HUST's general Fall 2027 degree admissions.",
  ],
  notes: ["The one-semester option is represented as five months from the official February-July and September-January semester dates; the one-academic-year option is represented as one year.", "No applicant, account, passport, payment or other personal data is included."],
};

const stem = resolve(root, "seeds/catalog.2027-wave-37");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 37, candidateSha256, counts: { schools: 1, programs: programs.length, programIntakes: programIntakes.length, scholarships: 0, sourceSnapshots: evidence.size }, publicationAuthorized: false }, null, 2));
