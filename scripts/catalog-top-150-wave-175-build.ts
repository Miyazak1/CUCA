import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = { id: string; label: string; url: string; finalUrl?: string; fetchedAt: string; status: number; contentType: string; sha256: string; artifactPath: string };
const root = process.cwd();
const run = "2026-10-26T11-44-20-243Z";
const directory = resolve(root, "work/catalog-official", run);
const locks = new Map([
  ["sicau-international-office-home-current", "62349f2d786be0fcb543ef97acb65e5a205bf4e72be764acb65eaca9664531dc"],
  ["sicau-international-undergraduate-index-current", "4c8852c75f27bce66c9aa84539a86611a9c924b296581abe4f5599fc07cabc02"],
  ["sicau-international-graduate-index-current", "37094bd1d7a7eb7ef81d946542e4a4f2695bc7db68f4cd12737186a2a9dbbb30"],
  ["sicau-international-undergraduate-guide-2026", "0cfa11007326d540e3e9e0b6a193f4d71bb1df21c3acbb3d7f6028d261ff5a41"],
  ["sicau-international-master-guide-2026", "eb8688028549d5665447f90cae7fd96bf6a45adfb730ce48cc0849440e4d351f"],
  ["sicau-international-doctoral-guide-2026", "ee6c94d3a0540d5202d34edaa9f9c2fc9cf6489047f21570e59c183afb44fea5"],
  ["sicau-international-scholarship-index-current", "745483bb42910362a15dedbeddf1c3d2d0c47762cb0c3c89aa7fb1b9263d2eea"],
]);
const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8")) as { sources: Source[] };
const sources = new Map<string, Source>();
for (const [id, expectedSha256] of locks) {
  const source = manifest.sources.find((entry) => entry.id === id && entry.status === 200 && entry.sha256 === expectedSha256);
  if (!source) throw new Error(`Missing locked SICAU source: ${id}`);
  if (createHash("sha256").update(await readFile(resolve(directory, source.artifactPath))).digest("hex") !== expectedSha256) throw new Error(`SICAU evidence hash mismatch: ${id}`);
  sources.set(id, source);
}
const home = sources.get("sicau-international-office-home-current")!;
const undergraduate = sources.get("sicau-international-undergraduate-guide-2026")!;
const doctoral = sources.get("sicau-international-doctoral-guide-2026")!;
const sf = (source: Source) => ({ sourceUrl: source.finalUrl ?? source.url, sourceLabel: source.label, sourceSha256: source.sha256, capturedAt: source.fetchedAt });
const base = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const city = base.cities?.find((entry) => entry.slug === "chengdu");
if (!city) throw new Error("Reviewed Chengdu dependency missing");

const school = {
  slug: "sichuan-agricultural-university", nameEn: "Sichuan Agricultural University", nameZh: "四川农业大学", citySlug: city.slug,
  schoolType: "Public agricultural university", region: "Chengdu and Ya'an, Sichuan, Southwest China",
  applicationLevel: "The latest official inbound guides cover bachelor, master and doctoral study for the closed 2026 cycle. The current indexes expose no applicant-facing 2027 international guide.",
  languageOfInstruction: "Chinese for the 2026 bachelor guide; Chinese- and English-taught graduate routes are supported by the 2026 master and doctoral guides.",
  languageRequirement: "Closed 2026 bachelor study requires HSK 4 score 180. Chinese-taught master and doctoral study requires HSK 5; English-taught graduate study requires IELTS 5.5, TOEFL 70 or Duolingo 100, with documented exemptions or assessment alternatives.",
  hskRequirement: "Closed 2026: HSK 4 score 180 for bachelor study and HSK 5 for Chinese-taught master or doctoral study.",
  englishRequirement: "Closed 2026 graduate study: IELTS 5.5, TOEFL 70 or Duolingo 100 for English-taught routes, subject to documented exemptions or assessment alternatives.",
  deadlineSummary: "Closed 2026 international bachelor, master and doctoral applications ran from December 1, 2025 through May 31, 2026. No 2027 international deadline is published.",
  tuitionSummary: "Closed 2026 annual tuition: bachelor CNY 12,000; master CNY 16,000; doctoral CNY 20,000.",
  applicationFee: "CNY 600, nonrefundable", websiteUrl: home.finalUrl ?? home.url, admissionsUrl: undergraduate.finalUrl ?? undergraduate.url,
  cscaRequired: true, cscaRequirement: "Closed 2026 bachelor applicants must submit a CSCA report. Route-specific tested subjects remain in a CAPTCHA-protected attachment and are not inferred.",
  subjectTags: ["Agriculture", "Forestry", "Life Sciences", "Veterinary Medicine", "Engineering", "Economics and Management"], languageTags: ["Chinese", "English"],
  tuitionBandLabel: "Closed 2026: CNY 12,000-20,000/year by degree level",
  campusHighlights: ["Official 2026 guides cover bachelor, master and doctoral international study", "Graduate routes require prior supervisor acceptance", "Current indexes still expose 2026 as the latest inbound cycle"],
  status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: doctoral.fetchedAt, ...sf(home),
  sourceFieldLineage: { nameEn: "official International Office site", nameZh: "official International Office site", citySlug: "official Chengdu office address plus reviewed Chengdu dependency", applicationLevel: "official 2026 degree guides", languageOfInstruction: "official 2026 degree guides", languageRequirement: "official 2026 degree guides", hskRequirement: "official 2026 degree guides", englishRequirement: "official 2026 graduate guides", deadlineSummary: "official 2026 application windows and current indexes", tuitionSummary: "official 2026 fee sections", applicationFee: "official 2026 fee sections", websiteUrl: "official International Office home", admissionsUrl: "official undergraduate guide", cscaRequired: "official 2026 undergraduate guide", cscaRequirement: "official guide with protected route table limitation", subjectTags: "university identity taxonomy; not route rows", languageTags: "official 2026 guides", tuitionBandLabel: "official 2026 fee sections", campusHighlights: "official 2026 guides and current indexes" },
};

const scholarshipBase = { schoolSlug: school.slug, providerName: "四川农业大学", providerNameEn: "Sichuan Agricultural University", providerLocation: "Chengdu and Ya'an, Sichuan, China", applicableDegree: "Bachelor", applicableProgram: "Eligible new international bachelor students in the closed 2026 admission cycle.", requirementText: "Awarded through university review; recipients must pass annual review for continuation.", applicationMaterials: [], applicationSteps: [], actionLinks: [{ label: "Official 2026 undergraduate guide", url: undergraduate.finalUrl ?? undergraduate.url, kind: "official-source" }], deadlineDate: "2026-05-31", deadlineLabel: "The associated 2026 admission window closed May 31, 2026; no separate award deadline is published.", applicationRound: "Closed 2026 undergraduate admission", status: "active" as const, verificationStatus: "verified" as const, lastVerifiedAt: undergraduate.fetchedAt, ...sf(undergraduate) };
const scholarships = [
  { ...scholarshipBase, slug: "sichuan-agricultural-university-new-student-scholarship-2026", title: "Sichuan Agricultural University New Student Scholarship — 2026", nameZh: "四川农业大学学校奖学金", type: "university", typeLabel: "University scholarship", fundingLevel: "Tuition waiver", coverage: "Tuition waiver for selected new students; annual review is required for continuation.", amountText: "Tuition waiver against the published CNY 12,000 annual bachelor tuition.", benefitItems: [{ label: "Tuition", included: true, note: "Waived for selected new students" }], eligibilityItems: [{ label: "Continuation", value: "Subject to annual review" }], summary: "Closed 2026 new-student tuition-waiver scholarship.", sourceFieldLineage: { title: "official 2026 undergraduate guide", coverage: "official scholarship section", amountText: "official tuition and waiver statements", requirementText: "official annual-review statement", benefitItems: "official waiver statement", eligibilityItems: "official annual-review statement", deadlineDate: "associated official admission deadline", deadlineLabel: "official admission window with no separate award deadline", applicationRound: "official 2026 guide", summary: "official award scope" } },
  { ...scholarshipBase, slug: "sichuan-agricultural-university-academic-scholarship-2026", title: "Sichuan Agricultural University Academic Scholarship — 2026", nameZh: "四川农业大学学业奖学金", type: "university", typeLabel: "Academic scholarship", fundingLevel: "Tiered annual award", coverage: "Ten selected outstanding new students receive the first-tier award; other new students receive the third-tier award, subject to annual review.", amountText: "First tier CNY 6,000/year for ten outstanding new students; third tier CNY 2,000/year for other new students.", benefitItems: [{ label: "First tier", included: true, note: "CNY 6,000/year for ten outstanding new students" }, { label: "Third tier", included: true, note: "CNY 2,000/year for other new students" }], eligibilityItems: [{ label: "Selection", value: "University review of new students" }, { label: "Continuation", value: "Subject to annual review" }], summary: "Closed 2026 tiered academic award for new international bachelor students.", sourceFieldLineage: { title: "official 2026 undergraduate guide", coverage: "official scholarship section", amountText: "official tier values", requirementText: "official annual-review statement", benefitItems: "official tier values", eligibilityItems: "official selection and annual-review statements", deadlineDate: "associated official admission deadline", deadlineLabel: "official admission window with no separate award deadline", applicationRound: "official 2026 guide", summary: "official award scope" } },
];
const candidate: CatalogSeedBundle = { version: 1, generatedAt: doctoral.fetchedAt, cities: [city], schools: [school], programs: [], programIntakes: [], scholarships };
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(candidateText).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const evidence = [...sources.values()].map((source) => ({ id: source.id, label: source.label, url: source.finalUrl ?? source.url, contentType: source.contentType, fetchedAt: source.fetchedAt, sha256: source.sha256 }));
const review = { version: 1, status: "unreviewed_draft", generatedAt: doctoral.fetchedAt, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false, scope: { target: "2026 ShanghaiRanking BCUR top 150", targetPosition: 134, schoolSlugs: [school.slug], newSchools: 1, programs: 0, programIntakes: 0, scholarships: scholarships.length }, evidence, unresolved: ["The current official indexes still expose 2026 as their latest inbound degree cycle; no applicant-facing general 2027 international guide, route table, deadline or intake is published.", "The 2026 bachelor, master and doctoral program catalogs are CAPTCHA-protected attachments. Access controls are not bypassed, so no route row or route-specific CSCA subject array is inferred.", "Graduate scholarship categories are named but current award amounts and 2027 rules are not published; only the two undergraduate university awards with explicit 2026 terms are structured.", "Applicant documents, personal contacts, bank/payment instructions and financial-proof details are excluded."], sensitiveDataCheck: { result: "pass", note: "No applicant data, personal contacts, payment instructions or private application materials are present." } };
const stem = resolve(root, "seeds/catalog.2027-wave-175");
await Promise.all([writeFile(`${stem}.draft.json`, candidateText, "utf8"), writeFile(`${stem}.validation.json`, `${JSON.stringify({ ...validation, candidateSha256, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2)}\n`, "utf8"), writeFile(`${stem}.review.json`, `${JSON.stringify(review, null, 2)}\n`, "utf8")]);
console.log(JSON.stringify({ ok: true, wave: 175, candidateSha256, counts: validation.summary, publicationAuthorized: false, databaseWriteAuthorized: false }, null, 2));
