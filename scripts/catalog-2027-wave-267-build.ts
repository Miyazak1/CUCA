import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
const root = process.cwd();

async function lockedSource(run: string, id: string, sha256: string): Promise<Source> {
  const directory = resolve(root, "work/catalog-official", run);
  const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8")) as { sources: Source[] };
  const source = manifest.sources.find((row) => row.id === id && row.status === 200 && row.sha256 === sha256);
  if (!source) throw new Error(`Missing locked source: ${id}`);
  const actual = createHash("sha256").update(await readFile(resolve(directory, source.artifactPath))).digest("hex");
  if (actual !== sha256) throw new Error(`Evidence hash mismatch: ${id}`);
  return source;
}

const [wustIndex, wustGuide, nucIndex, nucGuide] = await Promise.all([
  lockedSource("2026-10-26T10-30-15-888Z", "wust-international-program-index-current", "d247534b68e53a08e61e9f961a9d84bcc093fdf58a0f8faf7dc7c49b3e3d6b2c"),
  lockedSource("2026-10-26T10-30-15-888Z", "wust-international-admission-guide-page-2026", "99ac26c735f0aafad31fadfb5f4b089fcab7b2dea2f6b7efbf6534a3d174ffe2"),
  lockedSource("2026-10-26T12-39-44-184Z", "nuc-international-admissions-index-current", "89110f61726fcef191b1fb7b9c907914c5c43a8a1649e2459907cafa21e3d88d"),
  lockedSource("2026-10-26T12-39-44-184Z", "nuc-international-graduate-guide-page-2026", "7e37a36c2b3a263ebc513e12f36c14cb475d8c201f4a8e3273ffea56dc8457e2"),
]);

const [wustPrior, nucPrior] = await Promise.all([
  readFile(resolve(root, "seeds/catalog.2027-wave-169.draft.json"), "utf8").then((text) => JSON.parse(text) as CatalogSeedBundle),
  readFile(resolve(root, "seeds/catalog.2027-wave-182.draft.json"), "utf8").then((text) => JSON.parse(text) as CatalogSeedBundle),
]);
const wustCity = wustPrior.cities?.[0], wustSchoolPrior = wustPrior.schools?.[0];
const nucCity = nucPrior.cities?.[0], nucSchoolPrior = nucPrior.schools?.[0];
if (!wustCity || !wustSchoolPrior || wustSchoolPrior.slug !== "wuhan-university-of-science-and-technology") throw new Error("Missing WUST dependency");
if (!nucCity || !nucSchoolPrior || nucSchoolPrior.slug !== "north-university-of-china") throw new Error("Missing NUC dependency");

const sourceFields = (source: Source) => ({ sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt });
const programs = [
  {
    slug: "wuhan-university-of-science-and-technology-international-undergraduate-route-current-2026",
    schoolSlug: wustSchoolPrior.slug,
    citySlug: wustCity.slug,
    nameEn: "International Undergraduate Programs (current 2026 guide)",
    degreeLevel: "Bachelor",
    fieldCategory: "University-wide degree route",
    subjectArea: "Multiple fields",
    applicationUrl: wustGuide.finalUrl ?? wustGuide.url,
    applicationNote: "The official current index publishes a 2026 international student guide and separately identifies international undergraduate study. The guide attachment is protected by an official verification-code page, so program names, teaching language, duration, tuition, deadline and any 2027 intake remain absent.",
    status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: wustGuide.fetchedAt,
    ...sourceFields(wustGuide),
    sourceFieldLineage: { nameEn: "official current guide plus undergraduate route label", degreeLevel: "official undergraduate admissions label", fieldCategory: "evidence-scope classification", subjectArea: "university-wide route because protected attachment was not bypassed", applicationUrl: "official captured 2026 guide page", applicationNote: "captured official index and documented protected-attachment limitation" },
  },
  {
    slug: "wuhan-university-of-science-and-technology-international-postgraduate-route-current-2026",
    schoolSlug: wustSchoolPrior.slug,
    citySlug: wustCity.slug,
    nameEn: "International Postgraduate Programs (current 2026 guide)",
    degreeLevel: "Master",
    fieldCategory: "University-wide degree route",
    subjectArea: "Multiple fields",
    applicationUrl: wustGuide.finalUrl ?? wustGuide.url,
    applicationNote: "The official current index publishes a 2026 international student guide and separately identifies international postgraduate study. The guide attachment is protected by an official verification-code page, so program names, teaching language, duration, tuition, deadline and any 2027 intake remain absent. This generic record does not assert doctoral availability.",
    status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: wustGuide.fetchedAt,
    ...sourceFields(wustGuide),
    sourceFieldLineage: { nameEn: "official current guide plus postgraduate route label", degreeLevel: "normalized conservatively to Master; doctoral availability is not asserted", fieldCategory: "evidence-scope classification", subjectArea: "university-wide route because protected attachment was not bypassed", applicationUrl: "official captured 2026 guide page", applicationNote: "captured official index and documented protected-attachment limitation" },
  },
  ...(["Master", "Doctoral"] as const).map((degreeLevel) => ({
    slug: `north-university-of-china-international-${degreeLevel.toLowerCase()}-route-current-2026`,
    schoolSlug: nucSchoolPrior.slug,
    citySlug: nucCity.slug,
    nameEn: `International ${degreeLevel} Programs (2026 graduate guide)`,
    degreeLevel,
    fieldCategory: "University-wide degree route",
    subjectArea: "Multiple fields",
    applicationUrl: nucGuide.finalUrl ?? nucGuide.url,
    applicationNote: "The official current admissions index publishes a 2026 international graduate guide and separately indexes master and doctoral program catalogs. Its current program attachment requires a verification code and the indexed direct PDF returned HTTP 404, so program names, language, duration, tuition, deadline and any 2027 intake remain absent.",
    status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: nucGuide.fetchedAt,
    ...sourceFields(nucGuide),
    sourceFieldLineage: { nameEn: "official 2026 graduate guide and indexed degree catalogs", degreeLevel: "official master or doctoral catalog label", fieldCategory: "evidence-scope classification", subjectArea: "university-wide route because current program attachment was not captured", applicationUrl: "official captured 2026 graduate guide page", applicationNote: "captured official index and documented protected or unavailable attachment limitation" },
  })),
];

const schools = [
  {
    ...wustSchoolPrior,
    applicationLevel: "The official current international index and 2026 guide confirm undergraduate and postgraduate routes. The protected attachment was not bypassed, and no explicit 2027 intake is inferred.",
    lastVerifiedAt: wustGuide.fetchedAt,
    ...sourceFields(wustGuide),
    sourceFieldLineage: { ...(wustSchoolPrior.sourceFieldLineage ?? {}), applicationLevel: "official current international index and 2026 guide page" },
  },
  {
    ...nucSchoolPrior,
    applicationLevel: "The official current international admissions index and 2026 graduate guide confirm master and doctoral routes. The current program attachment remains unavailable, and no explicit 2027 intake is inferred.",
    lastVerifiedAt: nucGuide.fetchedAt,
    ...sourceFields(nucGuide),
    sourceFieldLineage: { ...(nucSchoolPrior.sourceFieldLineage ?? {}), applicationLevel: "official current index and 2026 international graduate guide" },
  },
];

const candidate: CatalogSeedBundle = { version: 1, generatedAt: new Date(Math.max(Date.parse(wustGuide.fetchedAt), Date.parse(nucGuide.fetchedAt))).toISOString(), cities: [wustCity, nucCity], schools, programs, programIntakes: [], scholarships: [] };
const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const text = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(text).digest("hex");
const evidence = [wustIndex, wustGuide, nucIndex, nucGuide].map((source) => ({ id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }));
const review = {
  version: 1, status: "unreviewed_draft", generatedAt: candidate.generatedAt, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false,
  scope: { target: "2026 ShanghaiRanking BCUR top 150", schoolSlugs: schools.map((school) => school.slug), programs: programs.length, programIntakes: 0, scholarships: 0 }, evidence,
  unresolved: [
    "Neither school has a captured applicant-facing guide that establishes an explicit 2027 intake.",
    "Protected verification-code attachments were not bypassed, and the unavailable NUC PDF was not reconstructed from snippets.",
    "Program names, teaching language, duration, tuition, deadline and scholarship fields remain absent.",
    "The WUST postgraduate route is conservatively normalized as Master and does not assert a doctoral route.",
  ],
  sensitiveDataCheck: { result: "pass", note: "Only public school-level route facts are retained; no applicant data, personal contacts or payment instructions are included." },
};
const stem = resolve(root, "seeds/catalog.2027-wave-267");
await Promise.all([
  writeFile(`${stem}.draft.json`, text, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 267, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
