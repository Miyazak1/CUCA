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
const locks = [
  ["2026-10-26T06-31-56-425Z", "swu-international-undergraduate-current-2026-2027", "c1dc33e685135146ba7b46ee9e0d6ae604e3bb6b0f1139fd1e3104c15df3a5f7"],
  ["2026-10-26T06-34-53-748Z", "swu-undergraduate-chinese-program-catalog-xlsx-2026-2027", "3df75bb3cbf73774dda90802960fb81ab16454ba870022111b7db8c2408e77d9"],
  ["2026-10-26T06-34-53-748Z", "swu-undergraduate-english-program-catalog-xlsx-2026-2027", "6141559962cc710c953f0eeac161326ac75bb048df6d0182d1054abbc38a751d"],
  ["2026-10-26T06-34-53-748Z", "swu-undergraduate-chinese-tuition-xlsx-2026-2027", "96d1d17fcbade8ce019ea277aae983632a1eea1f7811edbb6bcee66567d653d7"],
  ["2026-10-26T06-34-53-748Z", "swu-undergraduate-english-tuition-xlsx-2026-2027", "16e49c6b9594e696ae681159d1d3b160284d5edcaaf6f8da634805c47b63a85f"],
] as const;

const sources = new Map<string, Source>();
for (const [run, id, sha] of locks) {
  const dir = resolve(root, "work/catalog-official", run);
  const manifest = JSON.parse(await readFile(resolve(dir, "manifest.json"), "utf8")) as { sources: Source[] };
  const source = manifest.sources.find((item) => item.id === id && item.status === 200 && item.sha256 === sha);
  if (!source) throw new Error(`Missing locked source ${id}.`);
  const artifact = await readFile(resolve(dir, source.artifactPath));
  if (createHash("sha256").update(artifact).digest("hex") !== sha) throw new Error(`Hash mismatch for ${id}.`);
  sources.set(id, source);
}

const page = sources.get("swu-international-undergraduate-current-2026-2027")!;
const base = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const city = base.cities?.find((item) => item.slug === "chongqing");
if (!city) throw new Error("Chongqing dependency missing.");
const sourceFields = {
  sourceUrl: page.finalUrl ?? page.url,
  sourceLabel: page.label,
  sourceSha256: page.sha256,
  capturedAt: page.fetchedAt,
};

const school = {
  slug: "southwest-university",
  nameEn: "Southwest University",
  nameZh: "西南大学",
  citySlug: "chongqing",
  schoolType: "Comprehensive national university",
  region: "Chongqing, Southwest China",
  applicationLevel: "Bachelor; the current official page also links four scholarship categories",
  languageOfInstruction: "Chinese-taught and English-taught undergraduate routes are listed in protected 2026-2027 attachments.",
  languageRequirement: "HSK Level 4 score 200 or above, or TOEFL iBT 80 with each section at least 20, IELTS 6.0 with each band at least 5.5, or Duolingo English Test 115 with each subscore at least 115.",
  hskRequirement: "HSK Level 4 score 200 or above where the Chinese-language route applies.",
  deadlineSummary: "The current official undergraduate page states an annual January 1-June 15 application period and early-September enrollment, but does not explicitly identify a 2027 intake.",
  tuitionSummary: "The official page links separate 2026-2027 Chinese-taught and English-taught tuition workbooks; both downloads are protected by a university CAPTCHA, so route-level tuition remains absent.",
  applicationFee: "CNY 500 per person, non-refundable.",
  websiteUrl: "https://www.swu.edu.cn/",
  admissionsUrl: page.finalUrl ?? page.url,
  cscaRequired: true,
  cscaRequirement: "The current undergraduate page requires a CSCA transcript. Exact route-specific CSCA subjects are not published in the accessible page.",
  subjectTags: [],
  languageTags: ["Chinese", "English", "HSK 4", "TOEFL", "IELTS", "Duolingo", "CSCA"],
  campusHighlights: [
    "Standard undergraduate study duration: 4 years",
    "Official annual application period: January 1-June 15",
    "Accommodation: CNY 6,000-12,000 per academic year depending on room type",
    "Medical insurance: CNY 800 per year",
  ],
  status: "active" as const,
  verificationStatus: "verified" as const,
  lastVerifiedAt: page.fetchedAt,
  ...sourceFields,
  sourceFieldLineage: {
    nameEn: "official international undergraduate page identity",
    nameZh: "official international undergraduate page identity",
    citySlug: "official Beibei address plus reviewed Chongqing dependency",
    schoolType: "official university identity plus CUAC classification",
    region: "official address plus CUAC taxonomy",
    applicationLevel: "current official undergraduate page and scholarship links",
    languageOfInstruction: "official 2026-2027 attachment labels; attachment contents remain protected",
    languageRequirement: "current official undergraduate page",
    hskRequirement: "current official undergraduate page",
    deadlineSummary: "current official page; no intake year inferred",
    tuitionSummary: "official attachment labels plus CAPTCHA limitation",
    applicationFee: "current official undergraduate page",
    admissionsUrl: "current official undergraduate page",
    cscaRequired: "current official undergraduate page",
    cscaRequirement: "current official undergraduate page",
    languageTags: "current official undergraduate page",
    campusHighlights: "current official undergraduate page",
  },
};

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: page.fetchedAt,
  cities: [city],
  schools: [school],
  programs: [],
  programIntakes: [],
  scholarships: [],
};
const text = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(text).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(text));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const evidence = locks.map(([, id]) => {
  const source = sources.get(id)!;
  return {
    id: source.id,
    label: source.label,
    url: source.finalUrl ?? source.url,
    contentType: source.contentType,
    fetchedAt: source.fetchedAt,
    sha256: source.sha256,
  };
});
const review = {
  version: 1,
  status: "unreviewed_draft",
  generatedAt: page.fetchedAt,
  candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
  scope: {
    target: "2026 ShanghaiRanking BCUR top 150",
    targetPosition: 61,
    schoolSlugs: [school.slug],
    newSchools: 1,
    programs: 0,
    programIntakes: 0,
    scholarships: 0,
  },
  evidence,
  unresolved: [
    "The Chinese-taught and English-taught program workbooks are protected by the university download CAPTCHA. The collector captured the protection pages rather than spreadsheet bytes; no program name is inferred from attachment labels.",
    "The Chinese-taught and English-taught tuition workbooks are protected by the same CAPTCHA. Route-level tuition remains empty.",
    "The page states an annual January 1-June 15 window and early-September enrollment but does not explicitly identify the 2027 cycle. No 2027 intake is created.",
    "Four scholarship categories are linked, but the accessible page does not publish cycle-specific award coverage, eligibility or deadlines. No scholarship record is inferred.",
    "The page requires CSCA but does not publish route-specific subject combinations. Exact CSCA subjects remain unresolved.",
  ],
  sensitiveDataCheck: {
    result: "pass",
    note: "Bank-account details and personal staff contact details printed on the source page are excluded. No applicant data is present.",
  },
};
const stem = resolve(root, "seeds/catalog.2027-wave-125");
await Promise.all([
  writeFile(`${stem}.draft.json`, text, "utf8"),
  writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"),
  writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({ ok: true, wave: 125, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
