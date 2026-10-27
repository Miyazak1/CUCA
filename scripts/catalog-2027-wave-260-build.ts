import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
const root = process.cwd(), runRoot = resolve(root, "work/catalog-official/bjtu-guide-pdf-2026-10-27");
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: Source[] };
const expectedSha256 = "bb8aa34047eb354bd861d1cc53cda9bda40cd385d8d1851a63ae8e1425bcbf8f";
const source = manifest.sources.find((row) => row.id === "bjtu-international-admission-guide-pdf-2023" && row.status === 200 && row.sha256 === expectedSha256);
if (!source) throw new Error("Missing locked Beijing Jiaotong University source");
if (createHash("sha256").update(await readFile(resolve(runRoot, source.artifactPath))).digest("hex") !== expectedSha256) throw new Error("Beijing Jiaotong University source hash mismatch");
const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-115.draft.json"), "utf8")) as CatalogSeedBundle;
const city = prior.cities?.[0], priorSchool = prior.schools?.[0];
if (!city || !priorSchool || priorSchool.slug !== "beijing-jiaotong-university") throw new Error("Missing reviewed Beijing Jiaotong University dependency");

const rows: Array<[string, string, number]> = [
  ["Transportation (Civil Aviation Transportation)", "Engineering", 4],
  ["Transportation (Intelligent Transportation Engineering)", "Engineering", 4],
  ["Transportation (High-Speed Railway Passenger Organization and Service)", "Engineering", 4],
  ["Transportation (Railway Transportation)", "Engineering", 4],
  ["Transportation (Urban Rail Transit)", "Engineering", 4],
  ["Traffic Engineering", "Engineering", 4], ["Electrical Engineering and Automation", "Engineering", 4],
  ["Electrical Engineering and Automation (Rail Traction Electrification)", "Engineering", 4],
  ["Railway Signaling and Control", "Engineering", 4], ["Civil Engineering", "Engineering", 4],
  ["Railway Engineering", "Engineering", 4], ["Communication Engineering", "Engineering", 4],
  ["Electronic Science and Technology", "Engineering", 4], ["Environmental Engineering", "Engineering", 4],
  ["Energy and Power Engineering", "Engineering", 4], ["Measurement and Control Technology and Instrumentation", "Engineering", 4],
  ["Mechanical Engineering", "Engineering", 4], ["Vehicle Engineering", "Engineering", 4],
  ["Computer Science and Technology", "Engineering", 4], ["Computer Science and Technology (Railway Information Technology)", "Engineering", 4],
  ["Internet of Things Engineering", "Engineering", 4], ["Architecture", "Engineering", 5],
  ["Urban and Rural Planning", "Engineering", 5], ["Software Engineering", "Engineering", 4],
  ["Nanomaterials and Technology (Intelligent Materials)", "Science and Engineering", 4],
  ["Information and Computing Science", "Science", 4], ["Statistics", "Science", 4], ["Applied Physics", "Science", 4],
  ["Optoelectronic Information Science and Engineering", "Science", 4], ["Logistics Management", "Management", 4],
  ["E-Commerce", "Management", 4], ["Logistics Engineering", "Management", 4], ["Accounting", "Management", 4],
  ["Business Administration", "Management", 4], ["Engineering Management", "Management", 4],
  ["Financial Management", "Management", 4], ["Information Management and Information Systems", "Management", 4],
  ["Economics", "Economics", 4], ["Finance", "Economics", 4], ["Communication Studies", "Literature", 4],
  ["Network and New Media", "Literature", 4], ["Digital Media Art", "Art", 4], ["Environmental Design", "Art", 4],
  ["Visual Communication Design", "Art", 4], ["Law", "Law", 4],
];
const slugify = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const programs = rows.map(([name, category, years], index) => ({
  slug: `beijing-jiaotong-university-undergraduate-${slugify(name)}-${index + 1}`, schoolSlug: priorSchool.slug, citySlug: city.slug,
  nameEn: name, degreeLevel: "Undergraduate", durationYears: years, fieldCategory: category, subjectArea: name, teachingLanguage: "Chinese",
  hskRequirement: "HSK Level 5 with a score of 180 or above, or another published qualifying Chinese-study condition",
  tuitionAmount: 24800, tuitionCurrency: "RMB", tuitionPeriod: "year", tuitionText: "RMB 24,800/year in the official 2023 guide",
  applicationUrl: source.finalUrl ?? source.url,
  applicationNote: "The official 2023 international admission guide lists this Chinese-taught undergraduate program. The route is historical evidence only; no current 2027 intake or deadline is inferred.",
  status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: source.fetchedAt,
  sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt,
  sourceFieldLineage: { nameEn: `official undergraduate catalog row ${index + 1}`, degreeLevel: "official undergraduate catalog heading", durationYears: `official undergraduate catalog row ${index + 1}`, fieldCategory: `official catalog discipline group for row ${index + 1}`, subjectArea: `official undergraduate catalog row ${index + 1}`, teachingLanguage: `official undergraduate catalog row ${index + 1}`, hskRequirement: "official eligibility language section", tuitionAmount: "official fee table", tuitionCurrency: "official fee table", tuitionPeriod: "official fee table", tuitionText: "official fee table", applicationUrl: "official captured guide", applicationNote: "official guide year and evidence limitation" },
}));
const school = { ...priorSchool,
  applicationLevel: `The official 2023 international admission guide lists ${programs.length} Chinese-taught undergraduate programs and states that 102 postgraduate programs were open that year. No explicit 2027 international degree cycle is published in the captured source.`,
  languageOfInstruction: "Chinese and English", languageRequirement: "Chinese-taught applicants needed HSK Level 5 with 180 or above (or another stated qualifying Chinese-study condition); English-taught applicants needed IELTS 6.0 or TOEFL 80 or above (or another stated qualifying English-study condition) in the 2023 guide.",
  hskRequirement: "HSK Level 5 with 180 or above for Chinese-taught applications in the 2023 guide.", englishRequirement: "IELTS 6.0 or above or TOEFL 80 or above for English-taught applications in the 2023 guide.",
  tuitionSummary: "2023 guide: Chinese-taught undergraduate RMB 24,800/year; English-taught undergraduate RMB 33,800/year; Chinese-taught master's RMB 29,000/year; English-taught master's RMB 35,000/year; Chinese-taught doctoral RMB 34,000/year; English-taught doctoral RMB 40,000/year.",
  languageTags: ["Chinese", "English"], lastVerifiedAt: source.fetchedAt, sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt,
  sourceFieldLineage: { ...(priorSchool.sourceFieldLineage ?? {}), applicationLevel: "official 2023 degree catalog", languageOfInstruction: "official 2023 program and language sections", languageRequirement: "official 2023 eligibility language section", hskRequirement: "official 2023 eligibility language section", englishRequirement: "official 2023 eligibility language section", tuitionSummary: "official 2023 fee table", languageTags: "official 2023 language routes" },
};
const candidate: CatalogSeedBundle = { version: 1, generatedAt: source.fetchedAt, cities: [city], schools: [school], programs, programIntakes: [], scholarships: [] };
const validation = createCatalogMigrationValidationReport(candidate); if (!validation.ok) throw new Error(validation.errors.join("\n"));
const text = `${JSON.stringify(candidate, null, 2)}\n`, candidateSha256 = createHash("sha256").update(text).digest("hex");
const review = { version: 1, status: "unreviewed_draft", generatedAt: source.fetchedAt, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", schoolSlugs: [school.slug], programs: programs.length, programIntakes: 0, scholarships: 0 },
  evidence: [{ id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }],
  unresolved: ["The captured guide is labeled 2023 and is not relabeled as 2027.", "The guide says 102 postgraduate programs were open but only selected featured postgraduate routes are printed; unprinted routes are not inferred.", "No current 2027 intake, deadline or award decision is inferred from the historical guide."], sensitiveDataCheck: { result: "pass", note: "Only public program and institutional facts are retained; no applicant identity is included." } };
const stem = resolve(root, "seeds/catalog.2027-wave-260"); await Promise.all([
  writeFile(`${stem}.draft.json`, text, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 260, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
