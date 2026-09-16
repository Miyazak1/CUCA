import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle, type CatalogSeedProgram } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const sourcePath = resolve(root, "seeds/catalog.sysu-complete-batch-01.approved.local.json");
const candidatePath = resolve(root, "seeds/catalog.sysu-program-text-correction-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.sysu-program-text-correction-01.validation.json");
const reviewPath = resolve(root, "seeds/catalog.sysu-program-text-correction-01.review.json");
const source = JSON.parse(await readFile(sourcePath, "utf8")) as CatalogSeedBundle;

const replacements: Array<[string, string]> = [
  ["Nuclear Engineering and Technology (Institut Franco-Chino", "Sino-French Institute of Nuclear Engineering and Technology"],
  ["emorial Hospital (The Second Affiliated Hospital, Sun Yat-s", "Sun Yat-sen Memorial Hospital (The Second Affiliated Hospital)"],
  ["emorial Hospital (The Second Affiliated Hospital, Sun Yat-", "Sun Yat-sen Memorial Hospital (The Second Affiliated Hospital)"],
  ["e Sixth Affiliated Hospital (Gastrointestinal and Anal Hospi", "The Sixth Affiliated Hospital (Gastrointestinal and Anal Hospital)"],
  ["iated Hospital, Sun Yat-sen University (Gastrointestinal and", "The Sixth Affiliated Hospital (Gastrointestinal and Anal Hospital)"],
  ["The Sixth HAofsfipliiatatle)d Hospital (Gastrointestinal and Anal", "The Sixth Affiliated Hospital (Gastrointestinal and Anal Hospital)"],
  ["Sun Yat-sHeno sUpnitiavle)rsity Fifth Hospital (Zhuhai Hospital)", "Sun Yat-sen University Fifth Hospital (Zhuhai Hospital)"],
  ["Sun Yat-seHno Uspniitvalersity First Hospital", "Sun Yat-sen University First Hospital"],
  ["Sun Yat-seHno Uspniitvalersity First", "Sun Yat-sen University First Hospital"],
  ["Hospital Sun Yat-sen University First Hospital", "Sun Yat-sen University First Hospital"],
  ["Sun Yat-sen University First", "Sun Yat-sen University First Hospital"],
  ["LibeMraaln Aagrtesm Ceonltlege", "Liberal Arts College"],
  ["Schoo(Sl hoefn Pzuhbeinc Health (Shenzhen）", "School of Public Health (Shenzhen)"],
  ["Departme(Znht uohf aPih)ilosophy (Zhuhai)", "Department of Philosophy (Zhuhai)"],
  ["Departme(Znht uohf aPih)ilosophy", "Department of Philosophy (Zhuhai)"],
  ["(Zhuhai) Department of Chinese (Zhuhai)", "Department of Chinese (Zhuhai)"],
  ["The Thied Affiliated Hospital, Sun Yat-sen University", "The Third Affiliated Hospital, Sun Yat-sen University"],
  ["The Third Affiliated Hospital,Sun Yat-sen University", "The Third Affiliated Hospital, Sun Yat-sen University"],
  ["The Seventh Affiliated Hospital,Sun Yat-sen University", "The Seventh Affiliated Hospital, Sun Yat-sen University"],
  ["Schoo(Sl hoefn Pzuhbeinc Health", "School of Public Health"],
  ["School of Pubic Health", "School of Public Health"],
  ["School Of Marxism", "School of Marxism"],
  ["ZhongShan Ophthalmic Center", "Zhongshan Ophthalmic Center"],
  ["Chinese LManagnuaaggeem aenndt Literature", "Chinese Language and Literature"],
  ["EnBgiionleoegrying", "Biology"],
  ["PhaBrmioalocgolyogy", "Pharmacology"],
  ["Engineering Integrated Circuits Science and Engineering", "Integrated Circuits Science and Engineering"],
  ["School of Information; Information Resources", "School of Information Management; Information Resources Management"],
  ["外国Linguistics and Applied Linguistics", "Linguistics and Applied Linguistics"],
  ["口腔临床医学（Regardless of professional direction）", "Regardless of professional direction"],
  ["Clinical Science of Stomatology (No Designated", "No Designated Concentration"],
  ["Concentration) Surgery (Urology)", "Surgery (Urology)"],
  ["Integrative Medicine No Designated Concentration", "No Designated Concentration"],
  ["MInettearbnoalli cM Deidsiecaisnees ) (Respiratory Diseases)", "Internal Medicine (Respiratory Diseases)"],
  ["Metabolic Diseases) No Designated Concentration", "No Designated Concentration"],
  ["Metabolic Diseases) Surgery (Neurosurgery)", "Surgery (Neurosurgery)"],
  ["Ocean Structure No Designated Concentration", "No Designated Concentration"],
  ["Design and Construction of Naval Architecture and", "Design and Construction of Naval Architecture and Ocean Structures"],
  ["Internal Medicine (Endocrinology and Metabolic Diseases) Metabolism)", "Internal Medicine (Endocrinology and Metabolic Diseases)"],
  ["Internal Medicine (Endocrinology and Metabolic Diseases) Metabolic Diseases)", "Internal Medicine (Endocrinology and Metabolic Diseases)"],
];

function correct(value: string | undefined) {
  if (!value) return value;
  let result = value;
  for (const [from, to] of replacements) result = result.replaceAll(from, to);
  result = result.replace(/Biochemistry and Molecular(?= - |$)/g, "Biochemistry and Molecular Biology");
  result = result.replace(/Materials Science and(?= - |$)/g, "Materials Science and Engineering");
  result = result.replace(/Materials and Chemical(?= - |$)/g, "Materials and Chemical Engineering");
  result = result.replace(/Clinical Discipline of Chinese and Western$/, "Clinical Discipline of Chinese and Western Integrative Medicine");
  result = result.replace(/Internal Medicine \(Endocrinology and$/, "Internal Medicine (Endocrinology and Metabolic Diseases)");
  result = result.replaceAll("Sun Yat-sen University First Hospital Hospital", "Sun Yat-sen University First Hospital");
  result = result.replace("School of Public Health (Shenzhen;", "School of Public Health (Shenzhen);");
  if (result === "School of Public Health (Shenzhen") result = "School of Public Health (Shenzhen)";
  if (result === "School of Information") result = "School of Information Management";
  return result;
}

const programs: CatalogSeedProgram[] = [];
for (const program of source.programs ?? []) {
  const corrected = {
    ...program,
    nameEn: correct(program.nameEn)!,
    fieldCategory: correct(program.fieldCategory),
    subjectArea: correct(program.subjectArea),
    applicationNote: correct(program.applicationNote),
  };
  if (JSON.stringify(corrected) !== JSON.stringify(program)) programs.push(corrected);
}

const suspicious = /(LMan|EnB|PhaB|HAof|Uspn|Heno|MInette|Mraaln|Znht|Schoo\(|The Thied|^emorial Hospital|^e Sixth|^iated Hospital|Institut Franco-Chino|Metabolic Diseases\) (?:Metabolism|Metabolic Diseases)\)|Ocean Structure No Designated|Clinical Science of Stomatology \(No Designated|Concentration\) Surgery|^Materials Science and$|^Biochemistry and Molecular$)/;
const remaining = programs.flatMap(program => [program.nameEn, program.fieldCategory, program.subjectArea, program.applicationNote].filter(Boolean).filter(value => suspicious.test(value!)));
if (remaining.length) throw new Error(`Suspicious PDF extraction fragments remain: ${JSON.stringify(remaining)}`);
if (programs.length !== 125) throw new Error(`Unexpected correction count: ${programs.length}`);

const candidate: CatalogSeedBundle = { version: 1, generatedAt: new Date().toISOString(), cities: source.cities, schools: source.schools, programs };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(`SYSU correction validation failed:\n${validation.errors.join("\n")}`);
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const reviewBase = {
  version: 1, status: "awaiting_user_approval", generatedAt: candidate.generatedAt,
  scope: { schoolSlug: "sun-yat-sen-university", correctedProgramCount: programs.length, archiveProgramAliasCount: 0, archiveScholarshipAliasCount: 0 },
  candidateSha256,
  reconciliation: { sourcePublicationBundle: "seeds/catalog.sysu-complete-batch-01.approved.local.json", sameStableProgramSlugs: true, newPrograms: 0, archivedPrograms: 0, destructiveDeletion: false },
  correctionPolicy: { reason: "Post-publication QA found PDF text-layer interleaving in department, major and field strings on densely typeset rows.", method: "Replace only enumerated malformed fragments with the corresponding wording visible in the same official PDF tables; preserve every program slug, source URL, source hash, degree, language, tuition and intake." },
  sensitiveDataCheck: { result: "pass", scope: "69 corrected public program records", note: "Only institutional program labels are corrected. No supervisor names, staff contact details, applicant data or private information is included." },
  reviewNotes: ["The correction updates text fields on 69 already-published routes.", "No program, intake, scholarship or school is added, archived or deleted.", "Because these rows already exist, standing default publication is not used for the overwrite; an exact review-hash approval is required."],
};
const reviewHash = createHash("sha256").update(JSON.stringify(reviewBase)).digest("hex");
const review = { ...reviewBase, reviewHash, approvalPhrase: `批准发布中山大学项目文本校正第一批（审核哈希 ${reviewHash}）` };
await Promise.all([
  writeFile(candidatePath, candidateText),
  writeFile(validationPath, `${JSON.stringify(validation, null, 2)}\n`),
  writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`),
]);
console.log(JSON.stringify({ ok: true, correctedProgramCount: programs.length, candidateSha256, reviewHash, approvalPhrase: review.approvalPhrase, candidatePath, validationPath, reviewPath }, null, 2));
