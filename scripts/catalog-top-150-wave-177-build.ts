import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };

const root = process.cwd();
const run = "2026-10-26T11-51-24-198Z";
const directory = resolve(root, "work/catalog-official", run);
const locks = new Map([
  ["shzu-university-home-current", "a2e58a73627f132296a2aa077d9a8d37923cd823badef246891a2e1633f9b090"],
  ["shzu-international-office-home-current", "e5342fdc6438aba962b6a66dc5711d95f09057eee2951b0b83571ffb2de836d4"],
  ["shzu-study-at-shihezi-current", "8966a5cb61b7478c722967ae17891152641ca5ddbf8637ed0838eb9ead55c23f"],
  ["shzu-silk-road-cgs-award-2026", "f017066c8b6dcdac9a3b22a81d6253baf853695568fb7226c6bc1a7339414579"],
  ["shzu-international-master-recruitment-news-2026", "fcf7968432a81e41a84ef7e4dd14993557164e40e5c6ec2b42cba3abe0e0f9a5"],
]);
const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8")) as { sources: Source[] };
const sources = new Map<string, Source>();
for (const [id, expectedSha256] of locks) {
  const source = manifest.sources.find((entry) => entry.id === id && entry.status === 200 && entry.sha256 === expectedSha256);
  if (!source) throw new Error(`Missing locked SHZU source: ${id}`);
  const actualSha256 = createHash("sha256").update(await readFile(resolve(directory, source.artifactPath))).digest("hex");
  if (actualSha256 !== expectedSha256) throw new Error(`SHZU evidence hash mismatch: ${id}`);
  sources.set(id, source);
}

const home = sources.get("shzu-university-home-current")!;
const study = sources.get("shzu-study-at-shihezi-current")!;
const scholarshipNews = sources.get("shzu-silk-road-cgs-award-2026")!;
const sf = (source: Source) => ({ sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt });
const base = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
if (base.cities?.some((entry) => entry.slug === "shihezi")) throw new Error("Shihezi city already exists in the reviewed base; remove the new city record.");
if (base.schools?.some((entry) => entry.slug === "shihezi-university")) throw new Error("Shihezi University already exists in the reviewed base.");

const city = {
  slug: "shihezi",
  nameEn: "Shihezi",
  nameZh: "石河子",
  province: "Xinjiang",
  region: "Northwest China",
  tags: ["Xinjiang", "Northwest China", "official-school-evidence"],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: home.fetchedAt,
  ...sf(home),
  sourceFieldLineage: {
    nameEn: "official university address; standardized English city name",
    nameZh: "official university address",
    province: "official university location",
    region: "CUAC geographic taxonomy derived from the verified Xinjiang location",
    tags: "CUAC geographic classification and evidence-stage marker",
  },
};

const school = {
  slug: "shihezi-university",
  nameEn: "Shihezi University",
  nameZh: "石河子大学",
  citySlug: city.slug,
  schoolType: "Public comprehensive university",
  region: "Shihezi, Xinjiang, Northwest China",
  applicationLevel: "Current official university news confirms international master recruitment activity in Energy and Power and Energy Storage Technology, and a newly approved full graduate Silk Road scholarship project. The current Study at Shihezi page does not publish an applicant-facing program catalog or 2027 admission guide.",
  languageOfInstruction: "Not published in the captured current applicant-facing sources.",
  deadlineSummary: "No applicant-facing 2027 international application window or deadline is published in the captured official sources.",
  tuitionSummary: "Not published in the captured current official sources.",
  websiteUrl: home.finalUrl ?? home.url,
  admissionsUrl: study.finalUrl ?? study.url,
  subjectTags: ["Agriculture", "Engineering", "Medicine", "Energy and Power", "Energy Storage Technology", "Chemical Engineering"],
  languageTags: [],
  campusHighlights: ["Public comprehensive university in Shihezi, Xinjiang", "Official 2026 news confirms active international master recruitment", "Ten full graduate Silk Road scholarship places were approved for applicants from five Central Asian countries"],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: scholarshipNews.fetchedAt,
  ...sf(study),
  sourceFieldLineage: {
    nameEn: "official university identity",
    nameZh: "official university identity",
    citySlug: "official university and International Office address",
    schoolType: "official university identity plus CUAC taxonomy",
    region: "official address plus CUAC taxonomy",
    applicationLevel: "current official Study at Shihezi page plus 2026 international recruitment and scholarship-project news, with applicant-facing limitations stated",
    languageOfInstruction: "explicitly unresolved in captured current applicant-facing sources",
    deadlineSummary: "explicitly unresolved after current official-source review",
    tuitionSummary: "explicitly unresolved in captured current official sources",
    websiteUrl: "official university home",
    admissionsUrl: "current official Study at Shihezi page",
    subjectTags: "official university profile, recruitment activity and scholarship-project discipline scope",
    languageTags: "intentionally empty because no current teaching-language catalog or threshold is published",
    campusHighlights: "official current university and international-recruitment news",
  },
};

const candidate: CatalogSeedBundle = { version: 1, generatedAt: scholarshipNews.fetchedAt, cities: [city], schools: [school], programs: [], programIntakes: [], scholarships: [] };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const evidence = [...sources.values()].map((source) => ({ id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }));
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: scholarshipNews.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 136, schoolSlugs: [school.slug], newSchools: 1, newCities: 1, programs: 0, programIntakes: 0, scholarships: 0 },
  evidence,
  unresolved: [
    "The current official Study at Shihezi page is empty apart from navigation, and the International Office home publishes no applicant-facing 2027 guide, program table, teaching-language rules, tuition, deadline or application requirements.",
    "Official 2026 news confirms actual international master recruitment in Energy and Power and Energy Storage Technology, but a recruitment-activity story is not substituted for an applicant-facing program catalog; no program row is inferred.",
    "The official April 2026 announcement confirms ten full Silk Road Chinese Government Scholarship places for graduate study across Chemical Engineering and Technology, Agricultural Engineering and Mechanical fields for applicants from five Central Asian countries. It publishes no applicant-facing deadline, coverage breakdown, language threshold or application procedure, so no scholarship row is inferred.",
    "The university's domestic 2027 graduate catalog is excluded from inbound international-student admissions evidence.",
    "Application accounts, applicant data, personal contacts and recipient lists are excluded.",
  ],
  sensitiveDataCheck: { result: "pass", note: "No applicant data, personal contacts, recipient lists, payment instructions or private application materials are present." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-177");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 177, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
