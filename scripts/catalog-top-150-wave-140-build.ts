import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
const root = process.cwd();
const run = "2026-10-26T07-46-15-088Z";
const locks = [
  ["gxu-international-english-home-current", "080ca0b50e7053a8eeaa8a4f98bd1af4518de4618ddea68fcbcbe1a87c52b467"],
  ["gxu-chinese-language-program-march-2027", "a1a2bb8ab8acd034c614f6922f54733b7e33042eb768db87b551dde0290a3e08"],
] as const;
const directory = resolve(root, "work/catalog-official", run);
const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8")) as { sources: Source[] };
const sources = new Map<string, Source>();
for (const [id, sha256] of locks) {
  const source = manifest.sources.find((row) => row.id === id && row.status === 200 && row.sha256 === sha256);
  if (!source) throw new Error(`Missing locked source ${id}`);
  if (createHash("sha256").update(await readFile(resolve(directory, source.artifactPath))).digest("hex") !== sha256) throw new Error(`Hash mismatch ${id}`);
  sources.set(id, source);
}
const primary = sources.get("gxu-international-english-home-current")!;
const sourceFields = { sourceUrl: primary.finalUrl ?? primary.url, sourceLabel: primary.label, sourceSha256: primary.sha256, capturedAt: primary.fetchedAt };
const base = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const city = base.cities?.find((row) => row.slug === "nanning");
if (!city) throw new Error("Nanning dependency missing");

const school = {
  slug: "guangxi-university",
  nameEn: "Guangxi University",
  nameZh: "广西大学",
  citySlug: "nanning",
  schoolType: "Comprehensive university",
  region: "Nanning, Guangxi, South China",
  applicationLevel: "International degree, scholarship and Chinese-language study; the current official index explicitly lists a 2027 Chinese Language Program (March Intake).",
  languageOfInstruction: "Not published at route level in the accessible locked source.",
  deadlineSummary: "A March 2027 Chinese-language intake is confirmed by the current official index, but its application deadline is not available in the accessible locked source.",
  tuitionSummary: "Not available in the accessible locked source.",
  websiteUrl: "https://www.gxu.edu.cn/en/",
  admissionsUrl: primary.finalUrl ?? primary.url,
  subjectTags: ["Chinese Language", "Comprehensive University"],
  languageTags: ["Chinese"],
  campusHighlights: [
    "Official international education site based in Nanning",
    "Current official index lists a March 2027 Chinese Language Program",
    "Chinese Government, International Chinese Language Teachers and Guangxi Government scholarship categories are indexed",
  ],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: primary.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    nameEn: "official international education site",
    nameZh: "official university identity",
    citySlug: "official site address plus reviewed Nanning dependency",
    schoolType: "official university identity plus CUAC classification",
    region: "official site address plus CUAC taxonomy",
    applicationLevel: "current official index and navigation",
    languageOfInstruction: "accessible-source limitation",
    deadlineSummary: "current official index title and inaccessible linked article limitation",
    tuitionSummary: "accessible-source limitation",
    websiteUrl: "official university English domain",
    admissionsUrl: "official international education site",
    subjectTags: "current official index title and institutional classification",
    languageTags: "current official index title",
    campusHighlights: "current official international education index and navigation",
  },
};
const candidate: CatalogSeedBundle = { version: 1, generatedAt: primary.fetchedAt, cities: [city], schools: [school], programs: [], programIntakes: [], scholarships: [] };
const text = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(text).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(text));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const evidence = locks.map(([id]) => { const source = sources.get(id)!; return { id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }; });
const review = {
  version: 1, status: "unreviewed_draft", generatedAt: primary.fetchedAt, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 86, schoolSlugs: [school.slug], newSchools: 1, programs: 0, programIntakes: 0, scholarships: 0 },
  evidence,
  unresolved: [
    "The official index confirms the title '2027 Chinese Language Program (March Intake)', but the linked WeChat article returned a platform CAPTCHA page rather than its article body.",
    "Because the article body is unavailable, no deadline, fee, eligibility, material, duration, program or intake row is inferred from the title alone.",
    "The scholarship menu names categories but does not establish current cycle-specific award coverage; no scholarship record is inferred.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Published office contacts are excluded. No applicant data is present." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-140");
await Promise.all([
  writeFile(`${stem}.draft.json`, text, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 140, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
