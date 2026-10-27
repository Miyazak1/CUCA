import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
const root = process.cwd();
const runRoot = resolve(root, "work/catalog-official/cqupt-home-2026-10-27");
const lockedSha = "38ba342d29529dd3e607b22a224306438bed807df5b298e32dcb4856778cf767";
const manifest = JSON.parse(await readFile(resolve(runRoot, "manifest.json"), "utf8")) as { sources: Source[] };
const source = manifest.sources.find((row) => row.id === "cqupt-international-college-home-current" && row.status === 200 && row.sha256 === lockedSha);
if (!source) throw new Error("Missing locked CQUPT International College home");
if (createHash("sha256").update(await readFile(resolve(runRoot, source.artifactPath))).digest("hex") !== lockedSha) throw new Error("CQUPT evidence hash mismatch");

const prior = JSON.parse(await readFile(resolve(root, "seeds/catalog.2027-wave-185.draft.json"), "utf8")) as CatalogSeedBundle;
const city = prior.cities?.[0], priorSchool = prior.schools?.[0];
if (!city || !priorSchool || priorSchool.slug !== "chongqing-university-of-posts-and-telecommunications") throw new Error("Missing CQUPT dependency");

const program = {
  slug: "chongqing-university-of-posts-and-telecommunications-international-undergraduate-route-2026-2027",
  schoolSlug: priorSchool.slug,
  citySlug: city.slug,
  nameEn: "International Undergraduate Programs (2026-2027 academic year)",
  degreeLevel: "Bachelor",
  fieldCategory: "University-wide degree route",
  subjectArea: "Multiple fields",
  applicationUrl: "https://gjc.cqupt.edu.cn/info/1022/5253.htm",
  applicationNote: "The current official International College home page explicitly lists a 2026-2027 academic-year international undergraduate admission introduction. The linked detail page remains unavailable to deterministic collection, so major names, teaching language, duration, tuition, deadline and a distinct 2027 entry term remain absent.",
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: source.fetchedAt,
  sourceUrl: source.finalUrl ?? source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
  sourceFieldLineage: {
    nameEn: "normalized from the exact current official admissions-list title",
    degreeLevel: "official international undergraduate label",
    fieldCategory: "evidence-scope classification",
    subjectArea: "official title is university-wide and the detail page was not captured",
    applicationUrl: "exact official guide link exposed by the captured home page",
    applicationNote: "captured index title and documented detail-page access limitation",
  },
};
const school = {
  ...priorSchool,
  applicationLevel: "The current official International College home page confirms a 2026-2027 academic-year international undergraduate admissions route. The linked detail page remains unavailable to deterministic collection and no separate 2027 entry window is inferred.",
  lastVerifiedAt: source.fetchedAt,
  sourceUrl: source.finalUrl ?? source.url,
  sourceLabel: source.label,
  sourceSha256: source.sha256,
  capturedAt: source.fetchedAt,
  sourceFieldLineage: { ...(priorSchool.sourceFieldLineage ?? {}), applicationLevel: "captured current official admissions-list title and documented detail-page access limitation" },
};
const candidate: CatalogSeedBundle = { version: 1, generatedAt: source.fetchedAt, cities: [city], schools: [school], programs: [program], programIntakes: [], scholarships: [] };
const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const text = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(text).digest("hex");
const review = {
  version: 1, status: "unreviewed_draft", generatedAt: source.fetchedAt, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", schoolSlugs: [school.slug], programs: 1, programIntakes: 0, scholarships: 0 },
  evidence: [{ id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }],
  unresolved: [
    "The 2026-2027 academic-year label is not treated as proof of a separate Fall or Spring 2027 entry term.",
    "The linked guide detail page remains unavailable to deterministic collection; access controls were not bypassed.",
    "No major list, teaching language, duration, tuition, deadline or scholarship detail is asserted from the index title alone.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Only the public admissions-route title is retained; no applicant identity or personal contact is included." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-265");
await Promise.all([
  writeFile(`${stem}.draft.json`, text, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 265, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
