import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
} from "../src/server/catalog/seed-contract.ts";

type WaveReview = {
  status?: string;
  candidateSha256?: string;
  publicationAuthorized?: boolean;
  databaseWriteAuthorized?: boolean;
  evidence?: Array<{ id: string; label: string; url: string; fetchedAt: string; sha256: string }>;
};
type RefreshStatus = {
  status?: string;
  schools?: Array<{ schoolSlug?: string; result?: string }>;
};

const root = process.cwd();
const waveNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94] as const;
const outputPath = resolve(root, "seeds/catalog.2027-release-candidate.draft.json");
const validationPath = resolve(root, "seeds/catalog.2027-release-candidate.validation.json");
const reviewPath = resolve(root, "seeds/catalog.2027-release-candidate.review.json");
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const refreshStatus = JSON.parse(await readFile(resolve(root, "catalog-sources/2027-school-refresh-status.json"), "utf8")) as RefreshStatus;
const auditedSchoolSlugs = new Set((refreshStatus.schools ?? []).map((row) => row.schoolSlug).filter((slug): slug is string => Boolean(slug)));
const refreshResultBySchool = new Map(
  (refreshStatus.schools ?? [])
    .filter((row): row is { schoolSlug: string; result?: string } => Boolean(row.schoolSlug))
    .map((row) => [row.schoolSlug, row.result ?? ""]),
);
if (refreshStatus.status !== "discovery_audit_complete" || auditedSchoolSlugs.size !== 100) {
  throw new Error(`Expected a completed 100-school 2027 source-discovery audit, found status ${refreshStatus.status ?? "missing"} and ${auditedSchoolSlugs.size} unique schools.`);
}

const waves: Array<{ number: number; bundle: CatalogSeedBundle; review: WaveReview; candidateSha256: string }> = [];
for (const number of waveNumbers) {
  const stem = `seeds/catalog.2027-wave-${String(number).padStart(2, "0")}`;
  const candidateText = await readFile(resolve(root, `${stem}.draft.json`), "utf8");
  const bundle = JSON.parse(candidateText) as CatalogSeedBundle;
  const review = JSON.parse(await readFile(resolve(root, `${stem}.review.json`), "utf8")) as WaveReview;
  const candidateSha256 = sha256(candidateText);
  if (review.candidateSha256 !== candidateSha256) throw new Error(`Wave ${number} candidate hash does not match its review artifact.`);
  if (review.status !== "unreviewed_draft" || review.publicationAuthorized !== false || review.databaseWriteAuthorized !== false) {
    throw new Error(`Wave ${number} is not an isolated unreviewed draft.`);
  }
  waves.push({ number, bundle, review, candidateSha256 });
}

const mergeByKey = <T>(rows: T[], keyOf: (row: T) => string, label: string) => {
  const merged = new Map<string, T>();
  for (const row of rows) {
    const key = keyOf(row);
    const prior = merged.get(key);
    if (prior && JSON.stringify(prior) !== JSON.stringify(row)) throw new Error(`Conflicting ${label} rows for ${key}.`);
    merged.set(key, row);
  }
  return [...merged.values()];
};

const cities = mergeByKey(waves.flatMap(({ bundle }) => bundle.cities ?? []), (row) => row.slug, "city").sort((a, b) => a.slug.localeCompare(b.slug));
const blcuSchoolSlug = "beijing-language-and-culture-university";
const authoritativeBlcuSchool = waves.find(({ number }) => number === 12)?.bundle.schools?.find((row) => row.slug === blcuSchoolSlug);
if (!authoritativeBlcuSchool) throw new Error("Wave 12 authoritative BLCU school row is missing.");
const zjgsuSchoolSlug = "zhejiang-gongshang-university";
const authoritativeZjgsuSchool = waves.find(({ number }) => number === 23)?.bundle.schools?.find((row) => row.slug === zjgsuSchoolSlug);
if (!authoritativeZjgsuSchool) throw new Error("Wave 23 authoritative ZJGSU school row is missing.");
const heuSchoolSlug = "harbin-engineering-university";
const authoritativeHeuSchool = waves.find(({ number }) => number === 61)?.bundle.schools?.find((row) => row.slug === heuSchoolSlug);
if (!authoritativeHeuSchool) throw new Error("Wave 61 authoritative HEU school row is missing.");
const cauSchoolSlug = "china-agricultural-university";
const authoritativeCauSchool = waves.find(({ number }) => number === 64)?.bundle.schools?.find((row) => row.slug === cauSchoolSlug);
if (!authoritativeCauSchool) throw new Error("Wave 64 authoritative CAU school row is missing.");
const schoolRows = waves.flatMap(({ bundle }) => bundle.schools ?? []).map((row) => {
  if (row.slug === blcuSchoolSlug) return authoritativeBlcuSchool;
  if (row.slug === zjgsuSchoolSlug) return authoritativeZjgsuSchool;
  if (row.slug === heuSchoolSlug) return authoritativeHeuSchool;
  if (row.slug === cauSchoolSlug) return authoritativeCauSchool;
  return row;
});
const schools = mergeByKey(schoolRows, (row) => row.slug, "school").sort((a, b) => a.slug.localeCompare(b.slug));
const candidateSchoolsMissing2027Audit = schools
  .filter((row) => !/2027|already_current|complete_current/.test(refreshResultBySchool.get(row.slug) ?? ""))
  .map((row) => `${row.slug} (${refreshResultBySchool.get(row.slug) || "missing result"})`);
if (candidateSchoolsMissing2027Audit.length > 0) {
  throw new Error(`2027 release candidate schools are not reflected in the discovery audit: ${candidateSchoolsMissing2027Audit.join(", ")}.`);
}
const zjgsuIcltsProgramSlug = "zhejiang-gongshang-university-iclts-chinese-language-study-spring-2027";
const authoritativeZjgsuIcltsProgram = waves.find(({ number }) => number === 23)?.bundle.programs?.find((row) => row.slug === zjgsuIcltsProgramSlug);
if (!authoritativeZjgsuIcltsProgram) throw new Error("Wave 23 authoritative ZJGSU ICLTS program row is missing.");
const gdufsProgramSlugs = new Set([
  "guangdong-university-of-foreign-studies-chinese-language-business-chinese-spring-2027",
  "guangdong-university-of-foreign-studies-chinese-language-culture-communication-spring-2027",
]);
const authoritativeGdufsPrograms = new Map((waves.find(({ number }) => number === 44)?.bundle.programs ?? []).map((row) => [row.slug, row]));
if (authoritativeGdufsPrograms.size !== 2) throw new Error("Wave 44 authoritative GDUFS program rows are missing.");
const csuIcltsProgramSlug = "central-south-university-iclts-one-semester-chinese-language-spring-2027";
const authoritativeCsuIcltsProgram = waves.find(({ number }) => number === 54)?.bundle.programs?.find((row) => row.slug === csuIcltsProgramSlug);
if (!authoritativeCsuIcltsProgram) throw new Error("Wave 54 authoritative CSU Spring 2027 scholarship program row is missing.");
const authoritativeTsinghuaSigsPrograms = new Map((waves.find(({ number }) => number === 58)?.bundle.programs ?? []).map((row) => [row.slug, row]));
if (authoritativeTsinghuaSigsPrograms.size !== 13) throw new Error("Wave 58 authoritative Tsinghua SIGS program rows are missing.");
const tsinghuaMiaProgramSlug = "tsinghua-university-2027-master-master-of-international-affairs-global-governance-mia-gg-program-part-time";
const authoritativeTsinghuaMiaProgram = waves.find(({ number }) => number === 62)?.bundle.programs?.find((row) => row.slug === tsinghuaMiaProgramSlug);
if (!authoritativeTsinghuaMiaProgram) throw new Error("Wave 62 authoritative Tsinghua MIA-GG program row is missing.");
const tsinghuaGbjProgramSlug = "tsinghua-university-master-school-of-journalism-and-communication-master-s-program-in-global-business-journalism-gbj-english";
const authoritativeTsinghuaGbjProgram = waves.find(({ number }) => number === 63)?.bundle.programs?.find((row) => row.slug === tsinghuaGbjProgramSlug);
if (!authoritativeTsinghuaGbjProgram) throw new Error("Wave 63 authoritative Tsinghua GBJ program row is missing.");
const tsinghuaGlobalMbaProgramSlug = "tsinghua-university-master-school-of-economics-and-management-tsinghua-global-mba-program-gmba-english";
const authoritativeTsinghuaGlobalMbaProgram = waves.find(({ number }) => number === 65)?.bundle.programs?.find((row) => row.slug === tsinghuaGlobalMbaProgramSlug);
if (!authoritativeTsinghuaGlobalMbaProgram) throw new Error("Wave 65 authoritative Tsinghua Global MBA program row is missing.");
const tsinghuaImapProgramSlug = "tsinghua-university-master-department-of-psychological-and-cognitive-sciences-international-master-of-applied-psychology-imap-program-english";
const authoritativeTsinghuaImapProgram = waves.find(({ number }) => number === 66)?.bundle.programs?.find((row) => row.slug === tsinghuaImapProgramSlug);
if (!authoritativeTsinghuaImapProgram) throw new Error("Wave 66 authoritative Tsinghua IMAP program row is missing.");
const authoritativeTsinghuaComputerSciencePrograms = new Map((waves.find(({ number }) => number === 67)?.bundle.programs ?? []).map((row) => [row.slug, row]));
if (authoritativeTsinghuaComputerSciencePrograms.size !== 2) throw new Error("Wave 67 authoritative Tsinghua Computer Science program rows are missing.");
const tsinghuaCpfpProgramSlug = "tsinghua-university-master-sch-ool-of-social-sciences-master-s-program-in-chinese-politics-foreign-policy-and-international-relations-cpfp-english";
const authoritativeTsinghuaCpfpProgram = waves.find(({ number }) => number === 68)?.bundle.programs?.find((row) => row.slug === tsinghuaCpfpProgramSlug);
if (!authoritativeTsinghuaCpfpProgram) throw new Error("Wave 68 authoritative Tsinghua CPFP program row is missing.");
const authoritativeTsinghuaIndustrialEngineeringPrograms = new Map((waves.find(({ number }) => number === 69)?.bundle.programs ?? []).map((row) => [row.slug, row]));
if (authoritativeTsinghuaIndustrialEngineeringPrograms.size !== 2) throw new Error("Wave 69 authoritative Tsinghua Industrial Engineering program rows are missing.");
const tsinghuaEnvironmentMasterProgramSlug = "tsinghua-university-2027-master-master-program-in-environmental-science-engineering-and-management";
const authoritativeTsinghuaEnvironmentMasterProgram = waves.find(({ number }) => number === 70)?.bundle.programs?.find((row) => row.slug === tsinghuaEnvironmentMasterProgramSlug);
if (!authoritativeTsinghuaEnvironmentMasterProgram) throw new Error("Wave 70 authoritative Tsinghua Environment master's program row is missing.");
const tsinghuaArchitectureMasterProgramSlug = "tsinghua-university-2027-master-master-of-architecture-english";
const authoritativeTsinghuaArchitectureMasterProgram = waves.find(({ number }) => number === 71)?.bundle.programs?.find((row) => row.slug === tsinghuaArchitectureMasterProgramSlug);
if (!authoritativeTsinghuaArchitectureMasterProgram) throw new Error("Wave 71 authoritative Tsinghua Architecture master's program row is missing.");
const programRows = waves.flatMap(({ bundle }) => bundle.programs ?? []).map((row) => {
  const authoritativeBlcuProgram = waves.find(({ number }) => number === 57)?.bundle.programs?.find((candidate) => candidate.slug === row.slug);
  if (row.schoolSlug === blcuSchoolSlug && authoritativeBlcuProgram) return authoritativeBlcuProgram;
  if (row.slug === zjgsuIcltsProgramSlug) return authoritativeZjgsuIcltsProgram;
  if (gdufsProgramSlugs.has(row.slug)) return authoritativeGdufsPrograms.get(row.slug)!;
  if (row.slug === csuIcltsProgramSlug) return authoritativeCsuIcltsProgram;
  if (authoritativeTsinghuaSigsPrograms.has(row.slug)) return authoritativeTsinghuaSigsPrograms.get(row.slug)!;
  if (row.slug === tsinghuaMiaProgramSlug) return authoritativeTsinghuaMiaProgram;
  if (row.slug === tsinghuaGbjProgramSlug) return authoritativeTsinghuaGbjProgram;
  if (row.slug === tsinghuaGlobalMbaProgramSlug) return authoritativeTsinghuaGlobalMbaProgram;
  if (row.slug === tsinghuaImapProgramSlug) return authoritativeTsinghuaImapProgram;
  if (authoritativeTsinghuaComputerSciencePrograms.has(row.slug)) return authoritativeTsinghuaComputerSciencePrograms.get(row.slug)!;
  if (row.slug === tsinghuaCpfpProgramSlug) return authoritativeTsinghuaCpfpProgram;
  if (authoritativeTsinghuaIndustrialEngineeringPrograms.has(row.slug)) return authoritativeTsinghuaIndustrialEngineeringPrograms.get(row.slug)!;
  if (row.slug === tsinghuaEnvironmentMasterProgramSlug) return authoritativeTsinghuaEnvironmentMasterProgram;
  if (row.slug === tsinghuaArchitectureMasterProgramSlug) return authoritativeTsinghuaArchitectureMasterProgram;
  return row;
});
const programs = mergeByKey(programRows, (row) => row.slug, "program").sort((a, b) => a.slug.localeCompare(b.slug));
const authoritativeGdufsIntakes = new Map(
  (waves.find(({ number }) => number === 44)?.bundle.programIntakes ?? []).map((row) => [`${row.programSlug}\u0000${row.intakeTerm}\u0000${row.intakeYear}`, row]),
);
if (authoritativeGdufsIntakes.size !== 2) throw new Error("Wave 44 authoritative GDUFS intake rows are missing.");
const csuIcltsIntakeKey = `${csuIcltsProgramSlug}\u0000Spring\u00002027`;
const authoritativeCsuIcltsIntake = waves.find(({ number }) => number === 54)?.bundle.programIntakes?.find((row) => `${row.programSlug}\u0000${row.intakeTerm}\u0000${row.intakeYear}` === csuIcltsIntakeKey);
if (!authoritativeCsuIcltsIntake) throw new Error("Wave 54 authoritative CSU Spring 2027 scholarship intake row is missing.");
const authoritativeTsinghuaSigsIntakes = new Map(
  (waves.find(({ number }) => number === 58)?.bundle.programIntakes ?? []).map((row) => [`${row.programSlug}\u0000${row.intakeTerm}\u0000${row.intakeYear}`, row]),
);
if (authoritativeTsinghuaSigsIntakes.size !== 13) throw new Error("Wave 58 authoritative Tsinghua SIGS intake rows are missing.");
const tsinghuaMiaIntakeKey = `${tsinghuaMiaProgramSlug}\u0000Fall\u00002027`;
const authoritativeTsinghuaMiaIntake = waves.find(({ number }) => number === 62)?.bundle.programIntakes?.find((row) => `${row.programSlug}\u0000${row.intakeTerm}\u0000${row.intakeYear}` === tsinghuaMiaIntakeKey);
if (!authoritativeTsinghuaMiaIntake) throw new Error("Wave 62 authoritative Tsinghua MIA-GG intake row is missing.");
const tsinghuaGbjIntakeKey = `${tsinghuaGbjProgramSlug}\u0000Fall\u00002027`;
const authoritativeTsinghuaGbjIntake = waves.find(({ number }) => number === 63)?.bundle.programIntakes?.find((row) => `${row.programSlug}\u0000${row.intakeTerm}\u0000${row.intakeYear}` === tsinghuaGbjIntakeKey);
if (!authoritativeTsinghuaGbjIntake) throw new Error("Wave 63 authoritative Tsinghua GBJ intake row is missing.");
const tsinghuaGlobalMbaIntakeKey = `${tsinghuaGlobalMbaProgramSlug}\u0000Fall\u00002027`;
const authoritativeTsinghuaGlobalMbaIntake = waves.find(({ number }) => number === 65)?.bundle.programIntakes?.find((row) => `${row.programSlug}\u0000${row.intakeTerm}\u0000${row.intakeYear}` === tsinghuaGlobalMbaIntakeKey);
if (!authoritativeTsinghuaGlobalMbaIntake) throw new Error("Wave 65 authoritative Tsinghua Global MBA intake row is missing.");
const authoritativeTsinghuaComputerScienceIntakes = new Map(
  (waves.find(({ number }) => number === 67)?.bundle.programIntakes ?? []).map((row) => [`${row.programSlug}\u0000${row.intakeTerm}\u0000${row.intakeYear}`, row]),
);
if (authoritativeTsinghuaComputerScienceIntakes.size !== 2) throw new Error("Wave 67 authoritative Tsinghua Computer Science intake rows are missing.");
const authoritativeTsinghuaIndustrialEngineeringIntakes = new Map(
  (waves.find(({ number }) => number === 69)?.bundle.programIntakes ?? []).map((row) => [`${row.programSlug}\u0000${row.intakeTerm}\u0000${row.intakeYear}`, row]),
);
if (authoritativeTsinghuaIndustrialEngineeringIntakes.size !== 2) throw new Error("Wave 69 authoritative Tsinghua Industrial Engineering intake rows are missing.");
const tsinghuaEnvironmentMasterIntakeKey = `${tsinghuaEnvironmentMasterProgramSlug}\u0000Fall\u00002027`;
const authoritativeTsinghuaEnvironmentMasterIntake = waves.find(({ number }) => number === 70)?.bundle.programIntakes?.find((row) => `${row.programSlug}\u0000${row.intakeTerm}\u0000${row.intakeYear}` === tsinghuaEnvironmentMasterIntakeKey);
if (!authoritativeTsinghuaEnvironmentMasterIntake) throw new Error("Wave 70 authoritative Tsinghua Environment master's intake row is missing.");
const programIntakes = mergeByKey(
  waves.flatMap(({ bundle }) => bundle.programIntakes ?? []).map((row) => {
    const key = `${row.programSlug}\u0000${row.intakeTerm}\u0000${row.intakeYear}`;
    if (key === csuIcltsIntakeKey) return authoritativeCsuIcltsIntake;
    if (authoritativeTsinghuaSigsIntakes.has(key)) return authoritativeTsinghuaSigsIntakes.get(key)!;
    if (key === tsinghuaMiaIntakeKey) return authoritativeTsinghuaMiaIntake;
    if (key === tsinghuaGbjIntakeKey) return authoritativeTsinghuaGbjIntake;
    if (key === tsinghuaGlobalMbaIntakeKey) return authoritativeTsinghuaGlobalMbaIntake;
    if (authoritativeTsinghuaComputerScienceIntakes.has(key)) return authoritativeTsinghuaComputerScienceIntakes.get(key)!;
    if (authoritativeTsinghuaIndustrialEngineeringIntakes.has(key)) return authoritativeTsinghuaIndustrialEngineeringIntakes.get(key)!;
    if (key === tsinghuaEnvironmentMasterIntakeKey) return authoritativeTsinghuaEnvironmentMasterIntake;
    return authoritativeGdufsIntakes.get(key) ?? row;
  }),
  (row) => `${row.programSlug}\u0000${row.intakeTerm}\u0000${row.intakeYear}`,
  "program intake",
).sort((a, b) => `${a.programSlug}\u0000${a.intakeTerm}\u0000${a.intakeYear}`.localeCompare(`${b.programSlug}\u0000${b.intakeTerm}\u0000${b.intakeYear}`));
const scholarships = mergeByKey(waves.flatMap(({ bundle }) => bundle.scholarships ?? []), (row) => row.slug, "scholarship").sort((a, b) => a.slug.localeCompare(b.slug));

if (schools.length !== 99) throw new Error(`Expected 99 updated or dependency schools after the final nine-school official freshness recheck, found ${schools.length} schools.`);
if (programs.length !== 2031) throw new Error(`Expected 2031 refreshed program rows after adding Tianjin University's 325 routes, found ${programs.length}.`);
if (programIntakes.length !== 1958) throw new Error(`Expected 1958 2027 intake rows after adding Tianjin University's 325 intakes, found ${programIntakes.length}.`);
if (programIntakes.some((row) => row.intakeYear !== 2027)) throw new Error("Release candidate contains a non-2027 intake.");
if (scholarships.length !== 95) throw new Error(`Expected 95 current scholarships after adding five Shandong University of Finance and Economics scholarship schemes, found ${scholarships.length}.`);

const programSlugs = new Set(programs.map((row) => row.slug));
const intakeProgramSlugs = new Set(programIntakes.map((row) => row.programSlug));
const refreshedWithoutNewIntake = [...programSlugs].filter((slug) => !intakeProgramSlugs.has(slug)).sort();
const hustShortTermWithoutFixedIntake = new Set([
  "huazhong-university-of-science-and-technology-short-term-chinese-language-traditional-sports-2027",
  "huazhong-university-of-science-and-technology-short-term-chinese-language-urbanization-2027",
  "huazhong-university-of-science-and-technology-youth-excellence-international-business-2027",
  "huazhong-university-of-science-and-technology-youth-excellence-public-administration-impa-2027",
]);
const tsinghuaWithoutNewIntake = refreshedWithoutNewIntake.filter((slug) => slug.startsWith("tsinghua-university-"));
const pkuShenzhenWithoutNewIntake = refreshedWithoutNewIntake.filter((slug) => slug.startsWith("peking-university-shenzhen-see-"));
const xjtuWithoutNewIntake = refreshedWithoutNewIntake.filter((slug) => slug.startsWith("xi-an-jiaotong-university-2027-"));
if (refreshedWithoutNewIntake.length !== 164 || tsinghuaWithoutNewIntake.length !== 8 || pkuShenzhenWithoutNewIntake.length !== 5 || xjtuWithoutNewIntake.length !== 147 || refreshedWithoutNewIntake.some((slug) => !slug.startsWith("tsinghua-university-") && !slug.startsWith("peking-university-shenzhen-see-") && !slug.startsWith("xi-an-jiaotong-university-2027-") && !hustShortTermWithoutFixedIntake.has(slug))) {
  throw new Error(`Expected eight Tsinghua routes with preserved intakes, five PKU Shenzhen programs, 147 XJTU degree programs, two HUST short-term routes and two HUST Youth of Excellence routes without fixed new intakes, found ${refreshedWithoutNewIntake.length}.`);
}

const generatedAt = waves.map(({ bundle }) => bundle.generatedAt).filter((value): value is string => Boolean(value)).sort().at(-1)!;
const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt,
  cities,
  schools,
  programs,
  programIntakes,
  scholarships,
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = sha256(candidateText);
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(`Unified 2027 candidate validation failed:\n${validation.errors.join("\n")}`);

const evidenceById = new Map<string, NonNullable<WaveReview["evidence"]>[number]>();
for (const { number, review } of waves) {
  for (const row of review.evidence ?? []) {
    const prior = evidenceById.get(row.id);
    if (prior) {
      const sameImmutableEvidence = prior.sha256 === row.sha256 && prior.url === row.url && prior.label === row.label;
      if (!sameImmutableEvidence) throw new Error(`Wave ${number} has conflicting evidence metadata for ${row.id}.`);
      if (row.fetchedAt > prior.fetchedAt) evidenceById.set(row.id, row);
      continue;
    }
    evidenceById.set(row.id, row);
  }
}
const evidence = [...evidenceById.values()].sort((a, b) => a.id.localeCompare(b.id));
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  target: {
    requestedSchoolCoverage: 100,
    sourceDiscoveryAuditedSchoolCount: auditedSchoolSlugs.size,
    updatedSchoolCount: schools.length,
    alreadyCurrentSchoolSlugs: ["qingdao-university", "tianjin-university", "zhejiang-university-of-technology"],
    completedSchoolCoverage: 100,
  },
  scope: {
    updatedSchoolSlugs: schools.map((row) => row.slug),
    cityDependencies: cities.length,
    refreshedPrograms: programs.length,
    newOrReplacement2027Intakes: programIntakes.length,
    refreshedWithoutNewIntakeProgramSlugs: refreshedWithoutNewIntake,
    scholarships: scholarships.length,
    sourceSnapshots: evidence.length,
  },
  componentWaves: waves.map(({ number, candidateSha256: waveCandidateSha256 }) => ({ number, candidateSha256: waveCandidateSha256 })),
  evidence,
  notes: [
    "All 100 schools in the existing directory have completed the official-source discovery audit. Fifty-six schools currently have explicit 2027 routes or a current 2026/2027 academic-year update in this candidate plus the already-current prerequisite bundle; schools whose official 2027 cycle is unpublished remain absent rather than inheriting 2026 dates.",
    "This is a targeted 2027 delta bundle. It does not replay unchanged schools or replace the already-current Qingdao University, Tianjin University and Zhejiang University of Technology 2027 routes.",
    "The HUST school and Wuhan city rows are dependency records retained with their original evidence; Wave 06 refreshes only explicitly published 2027 non-degree programs, intakes and scholarship routes.",
    "Eight Tsinghua program records are refreshed while their existing 2027 intake rows are deliberately preserved rather than duplicated.",
    "Two HUST short-term programs have no fixed published intake dates, so the candidate does not invent intake rows for them.",
    "NPU 2027 bilingual-medium graduate catalog rows are represented as separate Chinese and English application routes; its 2027 undergraduate guide is still unresolved and is not relabeled.",
    "XJTU 2027 foundation IFP and 1+4 tracks are represented across the three officially published durations; its general 2027 degree guides remain unresolved.",
    "BNU and BIT Wave 09 records cover explicit Spring/Fall 2027 non-degree routes only. BIT one-academic-year options carry a structured one-year duration; one-semester options remain non-numeric because the brochure gives no exact month/week count. Their general 2027 degree guides remain unresolved.",
    "DUT Wave 10 covers verified 2027 degree-level, duration, teaching-language and tuition-category routes plus the Type A bilateral and Type B scholarships. The Type A authority-specific early-November-to-early-April window is preserved without inventing one universal deadline; CAPTCHA-protected exact-major and CSCA-subject attachments are not inferred.",
    "GDUFS Wave 11 covers the two Chinese-language undergraduate routes explicitly named for Spring 2027; the current program page supplies route descriptions and fees.",
    "BLCU Wave 12 covers the image-only 2027 undergraduate and non-degree program tables. Explicit four-year, two-year, one-semester and one-academic-year durations are structured; shorter week-based routes remain exact in names/notes because the contract cannot represent weeks. The current official entry-requirement page supplies the bachelor CSCA policy, application fee and only exactly matched route-level language thresholds; stale deadline rows and unmatched requirements are not used. Associate tuition remains unresolved because the printed figures require confirmation.",
    "Nankai Wave 13 covers the explicitly published 2027 undergraduate group, intake requirements and four scholarship routes. Its 46-major XLSX is CAPTCHA-protected, so exact majors, per-major tuition and CSCA subject mappings remain unresolved.",
    "Tongji Wave 14 covers the explicitly published Spring 2027 non-degree and exchange application category, ChinaLink deadline, and the separate March 2027 one-semester International Chinese Language Teachers Scholarship route with its exact language threshold and coverage. The grouped course list, grouped-route tuition and Fall 2027 degree rounds remain unpublished on the captured sources.",
    "ECNU Wave 15 adds four explicitly published Winter/Spring 2027 non-degree routes with route-level dates, fees, structured language/placement policies and application materials, plus current school-level undergraduate and graduate language requirements. The three semester routes use their published March-to-June schedules as four-month durations; the three-week winter route remains non-numeric because the contract cannot represent weeks. Fall 2027 degree rounds remain unpublished on these sources.",
    "Wave 16 aggregates eight previously built Spring 2027 Chinese-language routes and re-verifies every locked source artifact. Seven are March 2027 scholarship routes and one is an LNUTCM self-funded route; none is treated as a general Fall 2027 degree guide.",
    "SYSU Wave 17 adds the explicit February 2027 one-semester foundation option and the Spring/Summer 2027 China Link research-exchange scholarship route; neither source establishes general Fall 2027 degree admissions.",
    "Wave 18 adds HIT's winter 2026-2027 short-term Chinese-language session and SCU's China Link research-exchange route with entry through August 2027. Neither source establishes general Fall 2027 degree admissions.",
    "Wave 19 adds BFSU's explicitly published January 2027 four-week and March 2027 one-semester International Chinese Language Teachers Scholarship routes, including official coverage and application-material appendices; general Fall 2027 degree admissions remain unresolved.",
    "Wave 20 adds Donghua and UIBE March 2027 one-semester scholarship routes, SISU's complete 2027 graduate catalog of 64 master's and 25 doctoral rows, SISU Chinese Government Scholarship Type B, and the rolling China Link route. UIBE's internal category-year conflict remains an explicit review note, and SISU's relative China Link lead time is not converted into a fixed deadlineDate.",
    "Wave 21 adds USTB's 2027 master's and doctoral admissions across four published degree-and-medium tuition categories, plus PKUHSC's Clinical Medicine and Stomatology undergraduate routes with exact HSK, CSCA or equivalent-exam, application-round and fee requirements.",
    "Wave 22 adds Tianjin Normal University's explicitly published March 2027 one-semester International Chinese Language Teachers Scholarship route. Its guide does not restate the monetary coverage package, so those fields remain absent.",
    "Wave 23 adds Tianjin University of Technology's March 2027 self-funded Chinese-language route, Chang'an University's China Link and self-funded Chinese-language routes plus two structured scholarships, Zhejiang Gongshang University's Spring 2027 Chinese Language and Culture route, and BLCU's March 2027 Beijing International Students Scholarship. Printed source conflicts and unpublished fee or deadline fields remain explicit and unresolved.",
    "Wave 24 adds NUAA's six 2027 English-taught bachelor's routes, the one-semester March foundation and Chinese-language route, fifteen Spring/Fall intake rows and four current scholarship schemes. The refreshed foundation publishes CNY 8,400 tuition including medical insurance, a USD 65 application fee and a December 30, 2026 deadline. The visible May 30 Fall deadline is used instead of the conflicting June 1 JSON-LD value; exact bachelor CSCA subjects remain unresolved.",
    "Wave 25 adds all 25 master's routes in NUAA's current official international catalog, each with its separately acquired September 2027 page, tuition and deadline metadata. Visible program content establishes a 2.5-year duration for all 25 routes. Seven pages reproduce contradictory undergraduate prerequisites; that copied material is discarded, master's-specific FAQ requirements are used where present, and three unresolved language thresholds remain absent.",
    "Wave 26 adds Tianjin Foreign Studies University's Spring 2027 Chinese-language semester and academic-year routes with official eligibility, materials, tuition, insurance, accommodation, deadline and registration details. Its degree-program cycles remain unchanged until separate 2027 sources are published.",
    "Wave 27 adds Central China Normal University's March 2027 one-semester International Chinese Language Teachers Scholarship route with its HSK/HSKK threshold, five-month term, full published coverage, application materials and application window. The official page does not publish monetary allowance amounts, so none are inferred.",
    "Wave 28 adds Sichuan International Studies University's March 2027 one-semester International Chinese Language Teachers Scholarship route with its HSK/HSKK threshold, five-month term, published coverage and application deadline. The source does not establish monetary allowance amounts or general 2027 degree rounds, so those fields remain absent.",
    "Wave 29 adds Shandong University's March 2027 one-semester International Chinese Language Teachers Scholarship route from the official image-only guide, preserving the published track-specific HSK/HSKK distinctions and October 31 deadline.",
    "Wave 30 adds Harbin Engineering University's two Fall 2027 Atomic Energy Scholarship degree routes with the published application window, registration window, English threshold, duration and master/doctoral benefit amounts. The CAPTCHA-protected PDF endpoint was not bypassed; evidence is limited to the official page and its six images.",
    "Wave 31 adds Wenzhou University's China Link short-term research-exchange route with year-round application access and entry no later than August 31, 2027, plus the current official undergraduate and master's language thresholds and the mandatory undergraduate CSCA policy effective from the 2026/2027 academic year. Because no single China Link calendar deadline or route-level CSCA subject table is published, deadlineDate and cscaSubjects remain absent.",
    "Wave 32 adds Chongqing Normal University's March 2027 one-semester International Chinese Language Teachers Scholarship route with its track-specific HSK/HSKK thresholds, five-month duration, published coverage, CNY 2,500 monthly allowance and October 31 deadline.",
    "Wave 33 adds China Academy of Art's March 2027 China Link short-term exchange route with the published art-course scope, teaching languages, full funding and stipend amounts. Its relative three-month lead time is preserved without inventing a calendar deadline.",
    "Wave 34 adds Wuhan University's Spring 2027 self-funded non-degree application window. The source does not name programs, tuition, duration or route-specific language requirements, so those fields remain absent.",
    "Wave 35 adds Jinan University's three explicitly scheduled 2027 summer visiting-student sessions with published English eligibility, duration, credit and fee information. The source does not publish a fixed application deadline or establish general Fall 2027 degree admissions.",
    "Wave 36 adds USTC's CAS-funded international visiting-student research route for one- to six-month visits scheduled through June 30, 2027. Its March 21, 2026 deadline has passed, so the intake is explicitly closed; the source does not establish general Fall 2027 degree admissions.",
    "Wave 37 adds HUST's 17 officially listed English-medium partner-exchange subjects, each separated into the published one-semester and one-academic-year options, with Spring and Fall 2027 application rounds, structured durations, language thresholds and materials. Agreement-specific registration and tuition amounts remain absent.",
    "Wave 38 adds Peking University's February-March 2027 four-week Chinese-language route with its published application period, eligibility, document list, CNY 8,000 tuition, CNY 400 application fee, insurance requirement and accommodation reference price. The four-week duration is preserved in the name and schedule because the catalog contract has no duration-weeks field.",
    "Wave 39 adds Nankai University's 2027 master's and doctoral admissions as four degree-and-medium groups covering the officially published totals of 163 master's and 129 doctoral programs, plus four Fall 2027 intake rows and eleven degree-specific scholarship routes. Exact program catalogs and program-specific tuition remain unresolved because the university XLSX downloads require a CAPTCHA; the doctoral Type B guide's conflicting March 10 and March 20 dates are preserved without inventing a deadlineDate.",
    "Wave 40 adds Shanghai Jiao Tong University's full-time long-term Chinese-language route for Spring and Fall 2027 with exact study periods, eligibility, required documents, tuition, application fee, insurance and accommodation policy. The official DOCX and webpage disagree on the Fall deadline, so the conflict is retained in deadlineLabel and no deadlineDate is emitted.",
    "Wave 41 adds Xi'an Jiaotong University's 2027 Xi'an-campus Chinese-language program as one-semester and one-academic-year routes with four Spring/Fall intake options, exact application deadlines, published fees, eligibility, materials, placement levels and the separate International Chinese Language Teachers Scholarship reference. Exact start days remain deferred to admission letters.",
    "Wave 42 adds USTB's 44 standard, bilingual and special undergraduate routes for Fall 2027 with official program names, teaching-medium distinctions, tuition, language, CSCA, application-material and scholarship information. A stale 2026-intake disclaimer in the page titled 2027 Undergraduate Admission Brochure is retained as an unresolved conflict and is not used to override the separate 2027 program list and application guide.",
    "Wave 43 adds Beijing Normal University's Chinese-taught Graduate Credit Program for Spring 2027 as four explicitly priced liberal-arts or science/engineering/arts/physical-education semester and academic-year categories, with detailed HSK thresholds, materials and application dates. The linked 2026 major catalogs and still-2026 English-taught page are not rolled forward.",
    "Wave 44 upgrades GDUFS's two existing Spring 2027 Chinese-language bachelor's routes with CSCA Professional Chinese and Mathematics rules, the published HSK-based Professional Chinese exemption, required materials and an exact December 10 application deadline. It supersedes matching Wave 11 rows without increasing route counts.",
    "Wave 45 adds Tsinghua University's Spring 2027 non-degree visiting-student route with its October 15-November 30 application window, General/Senior visitor eligibility, language thresholds, application materials, application fee, insurance and accommodation reference prices. The linked major, tuition and scholarship attachments returned unsupported responses to the controlled collector, so exact attachment-only fields remain absent.",
    "Wave 46 adds Shanghai University's Spring 2027 one-semester pre-university program as separate Science and Engineering and Humanities, Economics and Management tracks, with exact application dates, HSK and subsequent CSCA rules, materials, curriculum, tuition, application fee, insurance and accommodation prices. The guide publishes no exact semester end date, route-level CSCA subject mapping or scholarship criteria, so those fields remain absent.",
    "Wave 47 adds GDUFS's distinct Spring 2027 semester Chinese-language route and one-month Winter 2027 Chinese-language route with official schedules, eligibility, curriculum levels, tuition, fees, accommodation policies and application deadlines. The winter opening date, route-specific scholarships and a separately scheduled academic-year intake remain absent because the official notices do not publish them.",
    "Wave 48 adds Fudan University's Spring 2027 Chinese-language semester and academic-year routes with exact study schedules, application dates, eligibility, materials, placement policy, curriculum, application fee and qualified reference tuition. The guide publishes no fixed HSK threshold, route-specific scholarship, accommodation price or exact registration date, so those fields remain absent.",
    "Wave 49 adds Beijing Language and Culture University's 58 master's and 19 doctoral Fall 2027 routes from its official two-page program table, including teaching language, duration, campus, annual tuition and the July 31 deadline. Route-specific language scores, opening dates, registration dates, scholarships and accommodation prices remain absent because the table does not publish them.",
    "Wave 50 adds Tsinghua University's 41 explicitly listed English-taught master's and doctoral program rows for Fall 2027, preserving annual versus full-program tuition and the university-level application and scholarship rules. Department-specific deadlines, language thresholds, durations and additional materials remain absent until their interactive catalog rows are locked individually.",
    "Wave 51 adds Tianjin Foreign Studies University's 2027-2028 Chinese Government Scholarship High-Level Graduate Program Type B with exact coverage, monthly allowances, degree-level eligibility, language thresholds, materials and the February 21, 2027 university deadline. The CAPTCHA-protected major-list attachment was not bypassed, so exact eligible program rows and durations remain absent.",
    "Wave 52 adds five current international graduate program-and-medium combinations from Peking University Shenzhen School of Environment and Energy with exact names and durations. The page is a current program overview rather than a cycle-specific admission guide, so no intake, application dates, language-score thresholds or pending 2027 tuition amounts are inferred.",
    "Wave 53 adds BUCT's narrowly scoped Korean-student preparatory and undergraduate pathway with its eight-month preparation period, CSCA progression condition and application window ending January 10, 2027. The page publishes no tuition amount or named scholarship terms and does not establish BUCT's general 2027 degree cycle.",
    "Wave 54 upgrades CSU's existing March 2027 one-semester Chinese-language route from a 2026 umbrella source to the dedicated Spring 2027 guide and adds its structured full-scholarship record. The guide does not publish the application-fee amount or establish CSU's general Fall 2027 degree cycle.",
    "Wave 55 adds Xi'an Jiaotong University's 73 master's and 74 doctoral 2027 program routes from the official October 19, 2026 workbooks, preserving program codes, teaching languages, exact durations, academic/professional degree types and supervisor acceptance-letter requirements. The catalogs do not publish a general application window, intake term, tuition schedule or general language-score threshold, so those fields remain absent.",
    "Wave 57 enriches 56 exact Beijing Language and Culture University graduate-route matches with current official HSK or English requirements while leaving unmatched or renamed routes absent.",
    "Wave 58 upgrades ten explicitly matched Tsinghua SIGS master's routes and three existing SIGS-labelled doctoral routes with Shenzhen location and the exact May 15, 2027 deadline. The ten master's routes receive the published general two-year duration; doctoral ranges remain in notes because the schema has no duration-range field. Two SIGS scholarship rows are added without inventing award-specific deadlines or ambiguous allowance assignments.",
    "Wave 59 adds XJTU's newly published 2027 General Visiting Scholar, Senior Visiting Scholar and Student Exchange routes with six Spring/Fall intake rows. Agreement-specific exchange duration and fees and relative visiting-scholar deadlines remain unstructured rather than being inferred.",
    "Wave 60 adds Beijing Normal University's Chinese-taught Undergraduate Credit Program and English-taught Graduate Credit Program for Spring 2027 as six semester or academic-year routes. Undergraduate category tuition and HSK rules are structured exactly; graduate tuition remains per-credit and no total is inferred. Unpublished route-level majors, numeric semester duration, English-score threshold and scholarship package remain absent.",
    "Wave 61 adds Harbin Engineering University's three explicitly eligible March 2027 one-semester International Chinese Language Teachers Scholarship directions with five-month duration, route-specific HSK/HSKK requirements, full coverage, CNY 2,500 monthly allowance and the October 31, 2026 deadline. No self-funded tuition, numeric Taiji HSK threshold or general Fall 2027 degree round is inferred.",
    "Wave 62 upgrades Tsinghua University's existing MIA-GG 2027 route with the official two-year duration, three-year work-experience rule, exact IELTS/TOEFL thresholds, materials and two published application rounds ending March 1, 2027. A possible third round remains unstructured because no dates are published.",
    "Wave 63 upgrades Tsinghua University's existing Global Business Journalism route with the official two-year duration, IELTS 7.0 and TOEFL thresholds, application materials and all three application rounds ending March 31, 2027. The intake status is intentionally absent until the first round opens because the current contract cannot represent an upcoming state.",
    "Wave 64 adds China Agricultural University's complete official 2027 graduate workbook as 77 degree-and-language-specific master's and doctoral routes, with exact program durations, teaching languages, tuition and entry requirements. Month-only scholarship and self-funded closing windows remain labels without invented deadline dates or award coverage.",
    "Wave 65 upgrades Tsinghua University's existing Global MBA route with its two-year full-time mode, exact 2027 English thresholds, work-experience rule, materials, scholarship categories and all four application rounds ending March 31, 2027. The IMAP notice is excluded because its official article URL returned HTTP 404 during controlled collection.",
    "Wave 66 upgrades Tsinghua University's existing IMAP route with its standard two-year full-time design, English-medium instruction, exact IELTS and old/new TOEFL thresholds, applicant profile and assessment method. Its program article has no exact deadline, so the existing general 2027 intake remains unchanged.",
    "Wave 67 upgrades Tsinghua University's existing Advanced Computing master's and Computer Science doctoral routes with the department's exact two-round 2027 calendar, English thresholds, published duration ranges, materials, tuition and scholarship guidance. Numeric duration stores each range's lower bound while the full range remains visible in applicationNote.",
    "Wave 68 upgrades Tsinghua University's existing CPFP route with its two-year full-time design, Master of International Affairs classification, exact IELTS and old/new TOEFL thresholds, materials, tuition and scholarship guidance. The guide does not print a department-specific deadline, so the existing general 2027 intake remains unchanged.",
    "Wave 69 upgrades Tsinghua University's existing GMA and IMEM routes with the Industrial Engineering department's exact three-round 2027 calendar, English thresholds, program-specific academic and work-experience qualifications, durations, materials and full-program tuition. GMA's numeric duration stores the lower bound of its published two-to-three-year range.",
    "Wave 70 upgrades Tsinghua University's existing School of Environment English master's route with its exact academic-performance and English thresholds, two application rounds ending February 27, 2027, and scholarship guidance. The department page does not publish a numeric duration, so none is inferred; tuition remains sourced from the separately locked official 2027 university fee schedule.",
    "Wave 71 upgrades Tsinghua University's existing English Master of Architecture route with the current official two-year curriculum, professional architecture bachelor's prerequisite, mandatory portfolio and full-program tuition. The page's stale 2024 application calendar is excluded, so the existing university-level 2027 intake remains unchanged and no English-test threshold is inferred.",
    "Wave 72 adds Jilin University's Spring 2027 Bridging Medicine pre-medical route with its March-June schedule, CNY 12,000 tuition, accommodation range and December 31, 2026 deadline. It also adds HUST's two English-taught Youth of Excellence master's routes and the associated first-year full scholarship with March 2027 pre-admission and CSC deadlines. Unpublished Jilin language thresholds and HUST tuition, allowance and enrollment-term fields remain absent.",
    "Wave 78 adds GDUFS's current provincial-government and university scholarship routes. Explicit award values and four university tuition-waiver categories are retained, while the recurring May 1-June 30 timing remains a label because the pages do not assign it to a specific 2027 cycle.",
    "Wave 79 adds ZJGSU's current General, President and Zhejiang Provincial Government scholarship routes. The refreshed pages no longer publish the former percentage tiers, stipends or provincial amounts, so those superseded values are omitted and the current applicant scope, eligibility, materials and process are retained.",
    "Wave 80 adds Beihang's maintained Self-Supported, Program and Cooperation, Distinguished Foreign Students and bilateral Chinese Government scholarship policies, plus its explicit March 2027 International Chinese Language Teachers Scholarship route. Recurring policy dates remain labels, authority-dependent fields stay unresolved and 2026-only notices are not rolled forward.",
    "Wave 81 adds Tianjin University's complete official 2027 degree catalog: 80 undergraduate, 119 master's and 125 doctoral routes, plus its March 2027 one-semester Chinese-language scholarship route. Six 2026-cycle scholarship notices are excluded rather than relabeled as 2027.",
    "Wave 82 adds XJTU's maintained Five Central Asian Countries, Shaanxi Sanqin and XJTU Excellent Student scholarship policies. Their current page publishes no application calendar, so none is relabeled as a 2027-cycle deadline and no missing award amount is inferred.",
    "Wave 83 adds Xiangtan University's official 2026/2027 Chinese Government Scholarship Silk Road Program for ten named African countries, with the published master's and doctoral fields, full coverage, stipend amounts, language thresholds, materials and May 20, 2026 deadline. The closed scholarship round is not relabeled as a Fall 2027 intake.",
    "Wave 84 adds Ocean University of China's official 2026/2027 Chinese Government Marine Scholarship as a distinct route. Its short official notice explicitly incorporates the already verified High-Level Graduate Student Program guide, so only those referenced requirements and benefits are reused; the closed round is not relabeled as a Fall 2027 intake.",
    "Wave 85 adds the five scholarship schemes in Shandong University of Finance and Economics' official one-page scholarship table. Unpublished deadlines and scheme-specific Huawen or Special Scholarship amounts remain absent, and the April 2026 overview is not relabeled as a Fall 2027 intake.",
    "Wave 86 refreshes Beijing Forestry University's current school-level tuition, accommodation and application workflow while preserving its separately verified 2026 undergraduate deadline, language and CSCA fields. The generic current pages are not relabeled as a Fall 2027 intake.",
    "Wave 87 refreshes Southern University of Science and Technology's current international undergraduate tuition and total-cost breakdown. The dynamically loaded requirements page is not bypassed, and the generic cost API is not relabeled as a Fall 2027 intake.",
    "Wave 88 rechecks Anhui Agricultural University, Fuzhou University, Yanshan University, Beijing Sport University and Beijing University of Posts and Telecommunications against newly captured official snapshots. Their latest public international guides remain the 2026 cycle, so only current source verification and supported tuition display bands are refreshed; no 2026 date is relabeled as 2027.",
    "Wave 89 rechecks South China University of Technology, Central University of Finance and Economics, East China University of Science and Technology, Anhui University and Tianjin University of Finance and Economics against newly captured official sources. Supported tuition display bands and verification metadata are refreshed, while unresolved 2027 intakes and dates remain absent.",
    "Wave 90 rechecks Shandong Normal University, Harbin University of Science and Technology, East China University of Political Science and Law, Xinjiang Agricultural University and University of Sanya against newly captured official sources. The sources remain tied to 2026 or a 2026-2027 academic cycle; supported tuition bands are refreshed without inventing a distinct 2027 intake.",
    "Wave 91 rechecks Beijing Polytechnic University, East China Jiaotong University, Hangzhou Dianzi University, Hunan University of Technology and Business and Jiangsu University of Science and Technology against newly captured official 2026 guides. Supported tuition bands and verification metadata are refreshed without carrying domestic or recurring dates into a 2027 international intake.",
    "Wave 92 rechecks Guizhou Medical University, Harbin Institute of Technology Shenzhen, Shanghai Jiao Tong University School of Medicine, Shanghai University of Political Science and Law and South China Normal University against newly captured official 2026 sources. Supported tuition bands and verification metadata are refreshed while domestic and outbound 2027 notices remain excluded.",
    "Wave 93 rechecks Guangxi Medical University, Luzhou Vocational and Technical College, Southwestern University of Finance and Economics Tianfu College, University of Chinese Academy of Sciences and Wuchang University of Technology against newly captured official sources. Supported current tuition bands are refreshed without substituting domestic, outbound or individual-supervisor notices for institution-wide 2027 evidence.",
    "Wave 94 rechecks the final nine schools against hash-locked official 2026 or current-cycle sources captured on October 20, 2026. Supported tuition bands and verification metadata are refreshed; unavailable 2027 dates and requirements remain absent rather than inferred.",
    "Fields not explicitly published by the registered official sources remain absent; no 2026 date is rolled forward by assumption.",
    "No applicant, account, passport, payment, or other personal data is present.",
    "Publication remains disabled until a separate completed human review and publication authorization are supplied.",
  ],
};

await Promise.all([
  writeFile(outputPath, candidateText, "utf8"),
  writeFile(validationPath, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);

console.log(JSON.stringify({
  ok: true,
  outputPath,
  validationPath,
  reviewPath,
  candidateSha256,
  counts: {
    cities: cities.length,
    schools: schools.length,
    programs: programs.length,
    programIntakes: programIntakes.length,
    scholarships: scholarships.length,
    sourceSnapshots: evidence.length,
  },
  targetSchoolCoverage: 100,
  publicationAuthorized: false,
}, null, 2));
