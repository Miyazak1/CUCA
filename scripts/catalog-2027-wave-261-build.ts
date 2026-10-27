import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
const root = process.cwd(), runRoot = resolve(root, "work/catalog-official/2026-10-26T12-59-51-758Z");
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: Source[] };
const expectedSha256 = "d7d8f761b965c448d1222d8c259d44418cae50cdc247f7dec90ea66071c105c4";
const source = manifest.sources.find((row) => row.id === "henau-international-admission-guide-pdf-2022" && row.status === 200 && row.sha256 === expectedSha256);
if (!source) throw new Error("Missing locked Henan Agricultural University source");
if (createHash("sha256").update(await readFile(resolve(runRoot, source.artifactPath))).digest("hex") !== expectedSha256) throw new Error("Henan Agricultural University source hash mismatch");
const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-184.draft.json"), "utf8")) as CatalogSeedBundle;
const city = prior.cities?.[0], priorSchool = prior.schools?.[0];
if (!city || !priorSchool || priorSchool.slug !== "henan-agricultural-university") throw new Error("Missing reviewed Henan Agricultural University dependency");

const masters = ["Crop Science", "Ecology", "Forestry", "Urban and Rural Planning", "Landscape Architecture", "Veterinary Medicine", "Animal Husbandry", "Agricultural Engineering", "Agricultural and Forestry Economics and Management", "Tobacco Studies", "Tobacco Science and Engineering", "Plant Protection", "Horticulture", "Computer Science and Technology", "Management Science and Engineering", "Botany", "Zoology", "Microbiology", "Genetics", "Cell Biology", "Biochemistry and Molecular Biology", "Food Science and Engineering", "Agricultural Resources and Environment", "Land Resource Management", "Chemistry"];
const doctorals = ["Crop Science", "Forestry", "Landscape Architecture", "Veterinary Medicine", "Animal Husbandry", "Agricultural Engineering", "Agricultural Products Processing Engineering and Technology", "Agricultural Economics and Management", "Tobacco Studies", "Plant Protection", "Horticulture", "Agricultural Biotechnology", "Agricultural Resources and Environment"];
const slugify = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const makeProgram = (name: string, degreeLevel: "Master" | "Doctoral", index: number) => ({
  slug: `henan-agricultural-university-${degreeLevel.toLowerCase()}-${slugify(name)}-${index + 1}`, schoolSlug: priorSchool.slug, citySlug: city.slug,
  nameEn: name, degreeLevel, durationYears: degreeLevel === "Master" ? 3 : 4, fieldCategory: "International graduate degree program", subjectArea: name, teachingLanguage: "English",
  englishRequirement: "TOEFL 72 or above or IELTS 5.5 or above; applicants from countries where English is a native or official language were exempt in the 2022 guide",
  tuitionText: degreeLevel === "Master" ? "2022 guide: RMB 21,000/year for agriculture, RMB 28,000/year for arts, and RMB 22,000/year for other master's programs" : "2022 guide: RMB 26,000/year for agriculture and RMB 27,000/year for other doctoral programs",
  applicationUrl: source.finalUrl ?? source.url,
  applicationNote: "The official 2022 international guide lists this full-time graduate discipline. It is retained as historical program evidence only; no 2027 intake, deadline or exact category-specific tuition is inferred.",
  status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: source.fetchedAt,
  sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt,
  sourceFieldLineage: { nameEn: `official ${degreeLevel.toLowerCase()} discipline table`, degreeLevel: `official ${degreeLevel.toLowerCase()} table heading`, durationYears: "official guide duration section and discipline table", fieldCategory: "evidence-scope classification", subjectArea: `official ${degreeLevel.toLowerCase()} discipline table`, teachingLanguage: "official guide statement that graduate programs other than MTCSOL are English-taught", englishRequirement: "official language requirement section", tuitionText: "official fee section with category-dependent rates", applicationUrl: "official captured guide", applicationNote: "official guide year and evidence limitation" },
});
const programs = [...masters.map((name, index) => makeProgram(name, "Master", index)), ...doctorals.map((name, index) => makeProgram(name, "Doctoral", index))];
const school = { ...priorSchool,
  applicationLevel: `The official 2022 international guide lists ${masters.length} master's disciplines and ${doctorals.length} doctoral disciplines for international students. No explicit 2027 degree-admission cycle is published in the captured source.`,
  languageOfInstruction: "English for the listed graduate disciplines", languageRequirement: "TOEFL 72 or above or IELTS 5.5 or above for English-taught routes; applicants from countries where English is a native or official language were exempt in the 2022 guide.",
  englishRequirement: "TOEFL 72 or above or IELTS 5.5 or above in the 2022 guide.",
  deadlineSummary: "The historical guide required materials by April 30 of the enrollment year; no 2027 calendar date is inferred.",
  tuitionSummary: "2022 guide: master's RMB 21,000/year for agriculture, RMB 28,000/year for arts and RMB 22,000/year for other fields; doctoral RMB 26,000/year for agriculture and RMB 27,000/year for other fields.",
  languageTags: ["English"], lastVerifiedAt: source.fetchedAt, sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt,
  sourceFieldLineage: { ...(priorSchool.sourceFieldLineage ?? {}), applicationLevel: "official 2022 graduate discipline tables", languageOfInstruction: "official graduate-program language statement", languageRequirement: "official language requirement section", englishRequirement: "official language requirement section", deadlineSummary: "official historical application process distinguished from a current deadline", tuitionSummary: "official fee section", languageTags: "official route language" },
};
const candidate: CatalogSeedBundle = { version: 1, generatedAt: source.fetchedAt, cities: [city], schools: [school], programs, programIntakes: [], scholarships: [] };
const validation = createCatalogMigrationValidationReport(candidate); if (!validation.ok) throw new Error(validation.errors.join("\n"));
const text = `${JSON.stringify(candidate, null, 2)}\n`, candidateSha256 = createHash("sha256").update(text).digest("hex");
const review = { version: 1, status: "unreviewed_draft", generatedAt: source.fetchedAt, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", schoolSlugs: [school.slug], programs: programs.length, programIntakes: 0, scholarships: 0 },
  evidence: [{ id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }],
  unresolved: ["The captured guide is labeled 2022 and is not relabeled as 2027.", "All undergraduate majors were described as potentially available but no year-specific international undergraduate catalog was printed, so no undergraduate program rows are inferred.", "No 2027 intake, calendar deadline or discipline-specific tuition category is inferred from the historical guide."], sensitiveDataCheck: { result: "pass", note: "Only public discipline and institutional facts are retained; supervisor names and applicant forms are excluded." } };
const stem = resolve(root, "seeds/catalog.2027-wave-261"); await Promise.all([
  writeFile(`${stem}.draft.json`, text, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 261, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
