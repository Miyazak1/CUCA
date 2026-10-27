import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
const root = process.cwd();
const runRoot = resolve(root, "work/catalog-official/whut-degree-routes-2026-10-27");
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: Source[] };
const lock = async (id: string, sha256: string) => {
  const source = manifest.sources.find((row) => row.id === id && row.status === 200 && row.sha256 === sha256);
  if (!source) throw new Error(`Missing locked source ${id}`);
  if (createHash("sha256").update(await readFile(resolve(runRoot, source.artifactPath))).digest("hex") !== sha256) throw new Error(`Hash mismatch ${id}`);
  return source;
};
const undergraduate = await lock("whut-international-undergraduate-routes-2025", "45a3c9d6dcc6dd6517949d1300797593fb3efc996aa7788b17296f708201c3aa");
const postgraduate = await lock("whut-international-postgraduate-routes-2025", "3ca4c6ee83fce81e56817ab146571bc34067ca536ae439020b1a09dbca1a1c97");
const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-122.draft.json"), "utf8")) as CatalogSeedBundle;
const city = prior.cities?.[0], priorSchool = prior.schools?.[0];
if (!city || !priorSchool || priorSchool.slug !== "wuhan-university-of-technology") throw new Error("Missing reviewed Wuhan University of Technology dependency");

const routes = [
  { slug: "bachelor-chinese-taught", name: "Bachelor's Degree Programs (Chinese-taught)", degree: "Bachelor", language: "Chinese", years: 4, requirement: "HSK Level 4 or above", source: undergraduate },
  { slug: "bachelor-english-taught", name: "Bachelor's Degree Programs (English-taught)", degree: "Bachelor", language: "English", years: 4, requirement: "TOEFL 80 or above, IELTS 6.0 or above, another accepted English test, or a university-organized English test for non-native English speakers", source: undergraduate },
  { slug: "master-chinese-taught", name: "Master's Degree Programs (Chinese-taught)", degree: "Master", language: "Chinese", years: 3, requirement: "HSK Level 5 or above", source: postgraduate },
  { slug: "master-english-taught", name: "Master's Degree Programs (English-taught)", degree: "Master", language: "English", years: 3, requirement: "TOEFL 80 or above, IELTS 6.0 or above, another accepted English test, or a university-organized English test for non-native English speakers", source: postgraduate },
  { slug: "doctoral-chinese-taught", name: "Doctoral Degree Programs (Chinese-taught)", degree: "Doctoral", language: "Chinese", years: 4, requirement: "HSK Level 5 or above", source: postgraduate },
  { slug: "doctoral-english-taught", name: "Doctoral Degree Programs (English-taught)", degree: "Doctoral", language: "English", years: 4, requirement: "TOEFL 80 or above, IELTS 6.0 or above, another accepted English test, or a university-organized English test for non-native English speakers", source: postgraduate },
];
const programs = routes.map((route) => ({
  slug: `wuhan-university-of-technology-${route.slug}-2025`, schoolSlug: priorSchool.slug, citySlug: city.slug,
  nameEn: route.name, degreeLevel: route.degree, fieldCategory: "University-wide degree route", subjectArea: "Multiple fields",
  teachingLanguage: route.language, durationYears: route.years,
  hskRequirement: route.language === "Chinese" ? route.requirement : undefined,
  englishRequirement: route.language === "English" ? route.requirement : undefined,
  applicationUrl: route.source.finalUrl ?? route.source.url,
  applicationNote: "The official 2025 international admissions page confirms this university-wide degree route, duration and language threshold, but does not publish an explicit major-level list on the captured page. No 2027 intake, deadline, tuition or scholarship is inferred.",
  status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: route.source.fetchedAt,
  sourceUrl: route.source.finalUrl ?? route.source.url, sourceLabel: route.source.label, sourceSha256: route.source.sha256, capturedAt: route.source.fetchedAt,
  sourceFieldLineage: { nameEn: "official route heading and degree/language statements", degreeLevel: "official undergraduate or postgraduate degree statement", fieldCategory: "evidence-scope classification", subjectArea: "official page points to multiple programs without an embedded major list", teachingLanguage: "official Chinese- and English-taught route statements", durationYears: "official duration section", hskRequirement: "official language requirements", englishRequirement: "official language requirements", applicationUrl: "official captured international admissions page", applicationNote: "official page scope and unresolved-field note" },
}));
const school = { ...priorSchool,
  applicationLevel: "The official 2025 international admissions pages confirm Chinese- and English-taught bachelor's, master's and doctoral degree routes. No explicit 2027 degree-admission cycle is published in the captured pages.",
  languageOfInstruction: "Chinese and English", languageRequirement: "Undergraduate Chinese-taught routes require HSK Level 4 or above; postgraduate Chinese-taught routes require HSK Level 5 or above. English-taught routes require TOEFL 80+, IELTS 6.0+, another accepted test, or a university-organized English test for non-native English speakers.",
  hskRequirement: "HSK Level 4 or above for Chinese-taught bachelor's routes; HSK Level 5 or above for Chinese-taught master's and doctoral routes.",
  englishRequirement: "TOEFL 80 or above, IELTS 6.0 or above, another accepted English test, or a university-organized English test for non-native English speakers.",
  languageTags: ["Chinese", "English"], lastVerifiedAt: postgraduate.fetchedAt, sourceUrl: postgraduate.finalUrl ?? postgraduate.url, sourceLabel: postgraduate.label, sourceSha256: postgraduate.sha256, capturedAt: postgraduate.fetchedAt,
  sourceFieldLineage: { ...(priorSchool.sourceFieldLineage ?? {}), applicationLevel: "official 2025 undergraduate and postgraduate international admissions pages", languageOfInstruction: "official Chinese- and English-taught route statements", languageRequirement: "official language requirements", hskRequirement: "official language requirements", englishRequirement: "official language requirements", languageTags: "official route languages" },
};
const candidate: CatalogSeedBundle = { version: 1, generatedAt: postgraduate.fetchedAt, cities: [city], schools: [school], programs, programIntakes: [], scholarships: [] };
const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const text = `${JSON.stringify(candidate, null, 2)}\n`, candidateSha256 = createHash("sha256").update(text).digest("hex");
const review = { version: 1, status: "unreviewed_draft", generatedAt: postgraduate.fetchedAt, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", schoolSlugs: [school.slug], programs: programs.length, programIntakes: 0, scholarships: 0 },
  evidence: [undergraduate, postgraduate].map((source) => ({ id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 })),
  unresolved: ["The captured pages are labeled 2025 and are not relabeled as 2027.", "The pages confirm university-wide degree/language routes but do not embed a major-level international program list.", "No explicit 2027 intake, deadline, tuition or route-specific scholarship is published; those fields remain absent."],
  sensitiveDataCheck: { result: "pass", note: "Only public university-wide degree-route facts are retained; no applicant identity is included." } };
const stem = resolve(root, "seeds/catalog.2027-wave-259");
await Promise.all([
  writeFile(`${stem}.draft.json`, text, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 259, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
