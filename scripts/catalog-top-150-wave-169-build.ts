import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = {
  id: string;
  label: string;
  url: string;
  finalUrl?: string;
  fetchedAt: string;
  status: number;
  contentType: string;
  sha256: string;
  artifactPath: string;
};

const root = process.cwd();
const evidenceRuns = [
  {
    run: "2026-10-26T10-30-15-888Z",
    locks: new Map([
      ["wust-international-college-home-current", "8d54aeab1fdeb28dc239dbd24e3bdd1cd252e62a1e0df2ca2e315778db6d96c3"],
      ["wust-international-program-index-current", "d247534b68e53a08e61e9f961a9d84bcc093fdf58a0f8faf7dc7c49b3e3d6b2c"],
      ["wust-international-admission-guide-page-2026", "99ac26c735f0aafad31fadfb5f4b089fcab7b2dea2f6b7efbf6534a3d174ffe2"],
      ["wust-international-admission-guide-attachment-2026", "1ce26a5ea2f0a11f2be936f7b352b002a599b1eef3cc8494f6ab3df2db3f20d4"],
    ]),
  },
  {
    run: "2026-10-26T10-31-08-619Z",
    locks: new Map([
      ["wust-international-college-profile-current", "8887b00eaa2158fad9e10dd65e9d92274262f121180574a8f06b8d4343cb7a6c"],
    ]),
  },
];

const sources = new Map<string, Source>();
for (const evidenceRun of evidenceRuns) {
  const directory = resolve(root, "work/catalog-official", evidenceRun.run);
  const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8")) as { sources: Source[] };
  for (const [id, expectedSha256] of evidenceRun.locks) {
    const source = manifest.sources.find((entry) => entry.id === id && entry.status === 200 && entry.sha256 === expectedSha256);
    if (!source) throw new Error(`Missing locked WUST source: ${id}`);
    const actualSha256 = createHash("sha256").update(await readFile(resolve(directory, source.artifactPath))).digest("hex");
    if (actualSha256 !== expectedSha256) throw new Error(`WUST evidence hash mismatch: ${id}`);
    sources.set(id, source);
  }
}

const home = sources.get("wust-international-college-home-current")!;
const profile = sources.get("wust-international-college-profile-current")!;
const programIndex = sources.get("wust-international-program-index-current")!;
const guidePage = sources.get("wust-international-admission-guide-page-2026")!;
const attachment = sources.get("wust-international-admission-guide-attachment-2026")!;
const base = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const city = base.cities?.find((entry) => entry.slug === "wuhan");
if (!city) throw new Error("Reviewed Wuhan dependency missing");

const sourceFields = {
  sourceUrl: guidePage.finalUrl ?? guidePage.url,
  sourceLabel: guidePage.label,
  sourceSha256: guidePage.sha256,
  capturedAt: guidePage.fetchedAt,
};
const school = {
  slug: "wuhan-university-of-science-and-technology",
  nameEn: "Wuhan University of Science and Technology",
  nameZh: "武汉科技大学",
  citySlug: "wuhan",
  schoolType: "Public science and engineering university",
  region: "Wuhan, Hubei, Central China",
  applicationLevel: "The official International Education College profile confirms inbound international undergraduate and postgraduate enrollment. A 2026 international student admission guide is published, but its attachment is protected by an official verification-code page and cannot be lawfully collected without user interaction.",
  languageOfInstruction: "Not available from the captured public HTML pages.",
  deadlineSummary: "No public HTML deadline is published, and the protected 2026 guide attachment is not bypassed. No 2027 application deadline is inferred.",
  tuitionSummary: "Not available from the captured public HTML pages.",
  websiteUrl: home.finalUrl ?? home.url,
  admissionsUrl: programIndex.finalUrl ?? programIndex.url,
  subjectTags: [],
  languageTags: [],
  campusHighlights: [
    "Official International Education College for international cooperation and inbound study",
    "Inbound international undergraduate enrollment since 2016 and postgraduate enrollment since 2017",
    "Official college profile reports nearly 400 long-term international students",
  ],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: guidePage.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    nameEn: "official university identity and ranking target identity",
    nameZh: "official International Education College pages",
    citySlug: "official college address plus reviewed Wuhan dependency",
    schoolType: "official university identity plus CUAC taxonomy",
    region: "official college address plus CUAC taxonomy",
    applicationLevel: "official college profile and 2026 guide announcement",
    languageOfInstruction: "explicitly unresolved because the protected attachment was not bypassed",
    deadlineSummary: "explicitly unresolved because no public HTML deadline or 2027 guide is available",
    tuitionSummary: "explicitly unresolved because no public HTML fee schedule is available",
    websiteUrl: "official International Education College home",
    admissionsUrl: "official inbound international program index",
    campusHighlights: "official International Education College profile",
  },
};

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: guidePage.fetchedAt,
  cities: [city],
  schools: [school],
  programs: [],
  programIntakes: [],
  scholarships: [],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const evidence = [...sources.values()].map((source) => ({
  id: source.id,
  label: source.label,
  url: source.finalUrl ?? source.url,
  contentType: source.contentType,
  fetchedAt: source.fetchedAt,
  sha256: source.sha256,
}));
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: guidePage.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: {
    target: "2026 ShanghaiRanking BCUR top 150",
    targetPosition: 124,
    schoolSlugs: [school.slug],
    newSchools: 1,
    programs: 0,
    programIntakes: 0,
    scholarships: 0,
  },
  evidence,
  unresolved: [
    "The official May 22, 2026 announcement links an admission-guide PDF, but the official download endpoint returns a verification-code page. The collector does not bypass CAPTCHA or access controls, so no attachment-only program, tuition, deadline, language, material or scholarship field is imported.",
    "The public inbound-program index exposes the 2026 announcement and two 2023 guides but no explicit 2027 applicant-facing guide. No historic field is relabeled as 2027.",
    "The official English subsite was not retrievable through the approved discovery channel; no unverified mirror or aggregator is substituted.",
  ],
  sensitiveDataCheck: {
    result: "pass",
    note: "No applicant data, personal contacts, recipient lists, payment instructions or verification-code interaction is present.",
  },
  attachmentAccess: {
    expectedLabel: "国际学生招生简章.pdf",
    capturedContentType: attachment.contentType,
    result: "verification_code_required_no_bypass",
  },
  profileEvidenceSha256: profile.sha256,
};

const stem = resolve(root, "seeds/catalog.2027-wave-169");
await Promise.all([
  writeFile(`${stem}.draft.json`, candidateText, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 169, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
