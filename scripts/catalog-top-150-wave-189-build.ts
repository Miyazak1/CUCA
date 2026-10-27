import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
const root = process.cwd();
const directory = resolve(root, "work/catalog-official/2026-10-26T14-10-02-762Z");
const lockedSha = "e21fb2b6de36a9708a248ee70164750d7cd621106fbad07457c7dca61560b683";
const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8")) as { sources: Source[] };
const source = manifest.sources.find((entry) => entry.id === "ruc-study-at-renmin-profile-current" && entry.status === 200 && entry.sha256 === lockedSha);
if (!source) throw new Error("Missing locked RUC profile source");
if (createHash("sha256").update(await readFile(resolve(directory, source.artifactPath))).digest("hex") !== lockedSha) throw new Error("RUC evidence hash mismatch");
const sf = { sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt };
const reviewed = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const city = reviewed.cities?.find((entry) => entry.slug === "beijing");
if (!city) throw new Error("Reviewed Beijing dependency missing");
const school = {
  slug: "renmin-university-of-china",
  nameEn: "Renmin University of China",
  nameZh: "中国人民大学",
  citySlug: city.slug,
  schoolType: "Public comprehensive research university specializing in humanities and social sciences",
  region: "Beijing, North China",
  applicationLevel: "The current official university profile confirms a complete international bachelor, master and doctoral education chain together with Chinese-language and exchange study. A separate official visiting-program guide is indexed for Fall 2026 and Spring 2027, but its source host currently presents an invalid self-signed TLS certificate, so route-level fields are not asserted in this candidate.",
  websiteUrl: "https://www.ruc.edu.cn/",
  admissionsUrl: "https://iso.ruc.edu.cn/",
  subjectTags: ["Humanities", "Social Sciences", "Economics", "Finance", "Management", "Journalism", "Law", "Artificial Intelligence"],
  languageTags: [],
  campusHighlights: ["Complete international bachelor, master and doctoral education chain", "Chinese-language and exchange study options", "Strengths in humanities and social sciences"],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: source.fetchedAt,
  ...sf,
  sourceFieldLineage: { nameEn: "official university identity normalized to English", nameZh: "official university identity", citySlug: "official campus list plus reviewed Beijing dependency", schoolType: "official institutional profile plus CUAC taxonomy", region: "official campus addresses plus CUAC taxonomy", applicationLevel: "current official Study at Renmin profile and documented TLS limitation for the cycle guide", websiteUrl: "official university domain", admissionsUrl: "official international-student office domain", subjectTags: "official profile strengths", languageTags: "empty because current route-level language rules were not hash-locked", campusHighlights: "official current profile" },
};
const candidate: CatalogSeedBundle = { version: 1, generatedAt: source.fetchedAt, cities: [city], schools: [school], programs: [], programIntakes: [], scholarships: [] };
const text = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(text).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(text));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const review = { version: 1, status: "unreviewed_draft", generatedAt: source.fetchedAt, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false, scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 17, schoolSlugs: [school.slug], newSchools: 1, programs: 0, programIntakes: 0, scholarships: 0 }, evidence: [{ id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }], unresolved: ["The official visiting-program guide explicitly indexed for Fall 2026 and Spring 2027 could not be hash-locked because iso.ruc.edu.cn served a self-signed TLS certificate; TLS verification was not bypassed.", "Current route names, intake records, tuition, deadlines, language rules and scholarships remain absent until valid official snapshots are available.", "General 2027 degree-admission guides remain unresolved.", "Applicant data, personal contacts, payment instructions and bank information are excluded."], sensitiveDataCheck: { result: "pass", note: "No applicant data, personal contacts, payment instructions or bank information are present." } };
const stem = resolve(root, "seeds/catalog.2027-wave-189");
await Promise.all([writeFile(`${stem}.draft.json`, text, "utf8"), writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"), writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8")]);
console.log(JSON.stringify({ ok: true, wave: 189, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
