import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
} from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const manifestPath = resolve(root, "work/catalog-official/2026-09-22T12-34-41-222Z/manifest.json");
const cityPath = resolve(root, "seeds/catalog.beijing-city-rich-batch-01.draft.json");
const candidatePath = resolve(root, "seeds/catalog.pkuhsc-complete-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.pkuhsc-complete-batch-01.validation.json");
const [manifestText, cityText] = await Promise.all([readFile(manifestPath, "utf8"), readFile(cityPath, "utf8")]);
const manifest = JSON.parse(manifestText);
const cityBundle = JSON.parse(cityText);
type SourceRecord = { id: string; status: number; url: string; label: string; sha256: string; fetchedAt: string };
const sources = new Map<string, SourceRecord>((manifest.sources as SourceRecord[]).map((row) => [row.id, row]));
const expected = {
  "pkuhsc-international-undergraduate-admissions-zh-2026": "13450df25f70871a250857002b68b56079ab87f087cdfbb857dd00e7f97e75dd",
  "pkuhsc-international-undergraduate-admissions-en-2026": "cf89bf997f91f61caaabee5f197c6cc9d1d5691a16f0fd38cc0a3c3a1342db35",
  "pkuhsc-international-undergraduate-prearrival-2026": "242e16f7d18bee5074516de6064cb245170c0230b40ee4bed5ef22646ab73278",
} as const;
for (const [id, digest] of Object.entries(expected)) {
  const source = sources.get(id);
  if (!source || source.status !== 200 || source.sha256 !== digest) throw new Error(`PKUHSC evidence mismatch: ${id}`);
}
const zh = sources.get("pkuhsc-international-undergraduate-admissions-zh-2026")!;
const en = sources.get("pkuhsc-international-undergraduate-admissions-en-2026")!;
const prearrival = sources.get("pkuhsc-international-undergraduate-prearrival-2026")!;
const schoolSlug = "peking-university-health-science-center";
const citySlug = "beijing";

const program = (slug: string, nameEn: string, nameZh: string, durationYears: number, hskRequirement: string): CatalogSeedProgram => ({
  slug,
  schoolSlug,
  citySlug,
  nameEn,
  nameZh,
  degreeLevel: "Undergraduate",
  durationYears,
  fieldCategory: "Medicine",
  subjectArea: nameEn,
  teachingLanguage: "Chinese",
  cscaSubjects: ["STEM Chinese", "Mathematics", "Physics", "Chemistry"],
  cscaRequirement: "Submit CSCA results for STEM Chinese, Mathematics in Chinese, Physics in Chinese and Chemistry in Chinese.",
  hskRequirement,
  tuitionAmount: 45000,
  tuitionCurrency: "CNY",
  tuitionPeriod: "year",
  tuitionText: "CNY 45,000/academic year",
  applicationUrl: zh.url,
  applicationNote: "Fall 2026 self-funded international undergraduate route. The final published application batch is closed.",
  hasScholarship: true,
  scholarshipText: "The 2026 guide directs Chinese Government Scholarship applicants to the relevant Chinese embassy or consulate; it does not establish a university-award entitlement or current university scholarship deadline.",
  status: "draft",
  sourceUrl: zh.url,
  sourceLabel: zh.label,
  sourceSha256: zh.sha256,
  capturedAt: zh.fetchedAt,
  sourceFieldLineage: {
    nameEn: `official English translation ${en.sha256}`,
    nameZh: "official Chinese 2026 undergraduate guide",
    degreeLevel: "official 2026 undergraduate guide",
    durationYears: "official 2026 undergraduate guide program section",
    teachingLanguage: "official 2026 undergraduate guide program section",
    cscaSubjects: "official 2026 undergraduate guide application section",
    hskRequirement: `official 2026 undergraduate guide and pre-arrival guide ${prearrival.sha256}`,
    tuitionAmount: "official 2026 undergraduate guide fee section",
    applicationUrl: "registered authoritative Chinese 2026 guide",
  },
});
const programs = [
  program(`${schoolSlug}-clinical-medicine`, "Clinical Medicine", "临床医学", 6, "HSK Level 5 certificate."),
  program(`${schoolSlug}-oral-medicine`, "Oral Medicine", "口腔医学", 5, "HSK Level 6 certificate."),
];
const programIntakes = programs.map((row) => ({
  programSlug: row.slug,
  intakeTerm: "Fall",
  intakeYear: 2026,
  deadlineDate: "2026-04-30T15:59:59.000Z",
  deadlineLabel: "April 30, 2026 (final application batch)",
  applicationRound: "2026 self-funded international undergraduate second batch",
  status: "closed" as const,
  sourceUrl: zh.url,
  sourceLabel: zh.label,
  sourceSha256: zh.sha256,
  capturedAt: zh.fetchedAt,
  sourceFieldLineage: {
    deadlineDate: "official 2026 guide: second and final online-application batch",
    intakeYear: "official 2026 guide enrollment section",
  },
}));

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: manifest.generatedAt,
  cities: [cityBundle.cities[0]],
  schools: [{
    slug: schoolSlug,
    nameEn: "Peking University Health Science Center",
    nameZh: "北京大学医学部",
    citySlug,
    schoolType: "Public",
    region: "Beijing, North China",
    applicationLevel: "Undergraduate, Master, Doctoral, Advanced and Preparatory",
    languageOfInstruction: "Chinese for the reviewed 2026 undergraduate routes",
    languageRequirement: "Clinical Medicine requires HSK 5; Oral Medicine requires HSK 6.",
    hskRequirement: "HSK Level 5 for Clinical Medicine and HSK Level 6 for Oral Medicine.",
    deadlineSummary: "The final Fall 2026 self-funded undergraduate application batch closed April 30, 2026. No 2027 date is inferred.",
    tuitionSummary: "Reviewed 2026 undergraduate tuition is CNY 45,000 per academic year.",
    applicationFee: "CNY 800",
    websiteUrl: "https://www.bjmu.edu.cn/",
    admissionsUrl: zh.url,
    cscaRequired: true,
    cscaRequirement: "Undergraduate applicants submit CSCA STEM Chinese, Mathematics, Physics and Chemistry results in Chinese.",
    cscaSubjects: ["STEM Chinese", "Mathematics", "Physics", "Chemistry"],
    subjectTags: ["Clinical Medicine", "Oral Medicine", "Medical Sciences"],
    languageTags: ["Chinese"],
    campusHighlights: ["Peking University's health-sciences center", "Clinical Medicine and Oral Medicine routes for international undergraduates", "Affiliated teaching-hospital network"],
    status: "draft",
    sourceUrl: zh.url,
    sourceLabel: zh.label,
    sourceSha256: zh.sha256,
    capturedAt: zh.fetchedAt,
    sourceFieldLineage: {
      nameEn: `official English guide ${en.sha256}`,
      nameZh: "official Chinese guide identity",
      citySlug: "official guide contact address",
      applicationLevel: `official institutional overview and program scope ${prearrival.sha256}`,
      languageOfInstruction: "official 2026 undergraduate program section",
      languageRequirement: "official 2026 undergraduate materials section",
      deadlineSummary: "official 2026 online-application batches",
      tuitionSummary: "official 2026 fee section",
      applicationFee: "official 2026 application procedure",
      admissionsUrl: "authoritative Chinese 2026 guide",
      cscaRequirement: "official 2026 application procedure",
    },
  }],
  programs,
  programIntakes,
  scholarships: [],
};

const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok || validation.summary.programs !== 2 || validation.summary.programIntakes !== 2) {
  throw new Error(`PKUHSC candidate invalid:\n${validation.errors.join("\n")}`);
}
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const validationArtifact = {
  ...validation,
  candidateSha256: sha(candidateText),
  manifestSha256: sha(manifestText),
  sourceReview: {
    status: "unreviewed_draft",
    notes: [
      "The current official guide says only Clinical Medicine and Oral Medicine are open to international undergraduates in 2026.",
      "The four prohibited-source legacy Law, Economics and Physics records are not medical-center routes and remain quarantined; they are not force-mapped to these new programs.",
      "The generic prohibited-source university-scholarship record remains quarantined because the guide only refers applicants to Chinese Government Scholarship channels and publishes no equivalent university-award terms.",
      "Both 2026 self-funded application batches are closed and no 2027 date is inferred.",
    ],
  },
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
};
await Promise.all([
  writeFile(candidatePath, candidateText, "utf8"),
  writeFile(validationPath, `${JSON.stringify(validationArtifact, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({
  ok: true,
  candidatePath,
  validationPath,
  summary: validation.summary,
  candidateSha256: validationArtifact.candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
}, null, 2));
