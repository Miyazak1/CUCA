import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type ManifestSource = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
type LockedSource = { run: string; id: string; sha256: string };
const root = process.cwd();
const lockedSources: LockedSource[] = [
  { run: "2026-10-26T05-52-54-787Z", id: "shanghaitech-oia-home-current", sha256: "7295499019086a07a8fbc47e766dbd9e5d1dbb3f72f8e12b0c273e0114020331" },
  { run: "2026-10-26T05-52-58-133Z", id: "shanghaitech-international-admission-index-current", sha256: "f040d01628612b2abb7b91c44b8db5f7182ec59d60f321ac184ab328f127346c" },
  { run: "2026-10-26T05-53-01-636Z", id: "shanghaitech-international-summer-lab-2026", sha256: "aecd520d7a7548b1a44607847023c06e943d78d21688491b180682a65151f385" },
];
const sources = new Map<string, ManifestSource>();
for (const locked of lockedSources) {
  const runRoot = resolve(root, "work/catalog-official", locked.run);
  const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: ManifestSource[] };
  const source = manifest.sources.find((row) => row.id === locked.id && row.status === 200 && row.sha256 === locked.sha256);
  if (!source) throw new Error(`Missing locked official evidence ${locked.id}.`);
  const artifact = await readFile(resolve(runRoot, source.artifactPath));
  if (createHash("sha256").update(artifact).digest("hex") !== locked.sha256) throw new Error(`Evidence hash mismatch: ${locked.id}.`);
  sources.set(locked.id, source);
}
const oiaSource = sources.get("shanghaitech-oia-home-current")!;
const indexSource = sources.get("shanghaitech-international-admission-index-current")!;
const programSource = sources.get("shanghaitech-international-summer-lab-2026")!;
const sourceFields = (source: ManifestSource) => ({ sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt });
const dependency = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const schoolSlug = "shanghaitech-university";
const citySlug = "shanghai";
if (dependency.schools?.some((row) => row.slug === schoolSlug)) throw new Error("ShanghaiTech University already exists in the reviewed base.");
const city = dependency.cities?.find((row) => row.slug === citySlug);
if (!city) throw new Error("Shanghai city dependency is missing.");

const school = {
  slug: schoolSlug,
  nameEn: "ShanghaiTech University",
  nameZh: "上海科技大学",
  citySlug,
  schoolType: "Public research university",
  region: "Shanghai, East China",
  applicationLevel: "International visiting study is officially documented; current 2027 international degree admission levels are unresolved",
  languageOfInstruction: "English is used for the captured international Summer Lab route; degree-program teaching languages are unresolved",
  deadlineSummary: "The official international admission-guide index is currently empty. No 2027 international degree deadline is asserted; the latest captured international route closed April 30, 2026.",
  tuitionSummary: "Tuition and registration fees were waived for the invitation-only 2026 Summer Lab. Current international degree tuition is not published in the captured official sources.",
  websiteUrl: "https://www.shanghaitech.edu.cn/en/",
  admissionsUrl: indexSource.finalUrl ?? indexSource.url,
  subjectTags: ["Physical Science", "Life Science", "Information Science", "Biomedical Engineering", "Mathematics", "Research Training"],
  languageTags: ["English"],
  campusHighlights: ["Official international-affairs office captured", "Current international admission index contains no published guide", "Latest explicit international route retained as closed 2026 evidence"],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: oiaSource.fetchedAt,
  ...sourceFields(oiaSource),
  sourceFieldLineage: {
    nameEn: "official English university and Summer Lab identity", nameZh: "official international-affairs site identity", citySlug: "official OIA address plus reviewed Shanghai dependency", schoolType: "official university profile plus CUAC classification", region: "official OIA address plus CUAC taxonomy", applicationLevel: "official international route plus explicit empty current admission index", languageOfInstruction: "official 2026 Summer Lab eligibility and delivery context", deadlineSummary: "official current admission index and 2026 Summer Lab deadline", tuitionSummary: "official 2026 Summer Lab fee section with current-degree limitation", admissionsUrl: "official current international admission index", subjectTags: "official university academic structure and Summer Lab research scope", campusHighlights: "captured official freshness evidence",
  },
};

const program = {
  slug: `${schoolSlug}-summer-lab-international-visiting-2026`, schoolSlug, citySlug,
  nameEn: "Summer Lab for International Students", nameZh: "国际学生暑期科研项目", degreeLevel: "Visiting Program", durationMonths: 2, fieldCategory: "Interdisciplinary Research", subjectArea: "Laboratory Research", teachingLanguage: "English", englishRequirement: "Good English communication skills; no numeric test threshold was published.", tuitionText: "Tuition and registration fees were waived for students from partner institutions and institutions by invitation.", applicationUrl: programSource.finalUrl ?? programSource.url,
  applicationNote: "Closed 2026 invitation-based route. Applicant had to be a current non-Chinese undergraduate at a ShanghaiTech partner institution or institution by invitation, have completed at least one academic year, hold a cumulative GPA of at least 3.0/4.0, and identify a host laboratory. The official duration was 6-8 weeks; durationMonths is normalized to the two-month upper bound for catalog filtering.",
  hasScholarship: false, badgeText: "2026 official visiting route", displayTuition: "Tuition and registration waived (2026)", displaySubjects: ["Laboratory Research"], status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: programSource.fetchedAt,
  ...sourceFields(programSource),
  sourceFieldLineage: { nameEn: "official program title", nameZh: "standard Chinese rendering of official title", degreeLevel: "official visiting-student eligibility", durationMonths: "official 6-8 week duration normalized to two-month upper bound", fieldCategory: "official laboratory-research scope mapped to CUAC taxonomy", subjectArea: "official research-lab model", teachingLanguage: "official English communication requirement and English guide", englishRequirement: "official eligibility section", tuitionText: "official fee section", applicationUrl: "official program page", applicationNote: "official duration, eligibility and application process plus closed-cycle label", badgeText: "official program cycle" },
};
const intake = {
  programSlug: program.slug, intakeTerm: "Summer 2026", intakeYear: 2026, deadlineDate: "2026-04-30T15:59:59.000Z", deadlineLabel: "Applications closed April 30, 2026; the program began June 29, 2026.", applicationRound: "2026 Summer Lab for International Students", status: "closed" as const,
  ...sourceFields(programSource),
  sourceFieldLineage: { intakeTerm: "official program title and start date", intakeYear: "official program title", deadlineDate: "official deadline converted from Beijing end-of-day", deadlineLabel: "official deadline and start date plus closed-cycle label", applicationRound: "official program title" },
};

const candidate: CatalogSeedBundle = { version: 1, generatedAt: programSource.fetchedAt, cities: [city], schools: [school], programs: [program], programIntakes: [intake], scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`Top-150 Wave 118 validation failed:\n${validation.errors.join("\n")}`);
const evidence = lockedSources.map((locked) => { const source = sources.get(locked.id)!; return { id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }; });
const review = {
  version: 1, status: "unreviewed_draft", generatedAt: programSource.fetchedAt, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 47, schoolSlugs: [schoolSlug], newSchools: 1, programs: 1, programIntakes: 1, scholarships: 0 },
  evidence,
  unresolved: [
    "The official OIA international admission-guide index is currently empty. No 2027 inbound international degree guide, program catalog, application deadline, tuition schedule or scholarship route was found.",
    "Indexed 2027 ShanghaiTech admissions pages concern China's domestic graduate-admission system and are excluded from the international catalog.",
    "Only the official 2026 Summer Lab for International Students is structured. It is a closed invitation-based visiting route and must not be presented as currently available or as a degree program.",
    "The official duration is 6-8 weeks. The catalog durationMonths value is normalized to two months solely for filtering; the exact duration remains in applicationNote.",
  ],
  sensitiveDataCheck: { result: "pass", note: "The named program coordinator and contact details printed on the source page were excluded. No applicant data is present." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-118");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 118, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
