import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const manifestPath = resolve(root, "work/catalog-official/ahu-scholarship-batch-01/manifest.json");
const sourceBundlePath = resolve(root, "seeds/catalog.cscalite-online-20260910.published.json");
const outputPath = resolve(root, "seeds/catalog.ahu-scholarship-safe-new-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.ahu-scholarship-safe-new-batch-01.validation.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const sourceBundle = JSON.parse(await readFile(sourceBundlePath, "utf8")) as CatalogSeedBundle;
const source = manifest.sources.find((row: any) => row.id === "ahu-cgs-university-program-2026");
const city = sourceBundle.cities?.find((row) => row.slug === "hefei");
const school = sourceBundle.schools?.find((row) => row.slug === "anhui-university");
if (!source || source.contentType !== "application/pdf" || source.byteLength > 15 * 1024 * 1024 || !city || !school) throw new Error("AHU official evidence or dependencies are incomplete.");

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: manifest.generatedAt,
  cities: [city],
  schools: [school],
  programs: [],
  programIntakes: [],
  scholarships: [{
    slug: "official-2026-ahu-cgs-university-program",
    schoolSlug: "anhui-university",
    title: "Anhui University 2026/2027 Chinese Government Scholarship - University Program",
    nameZh: "安徽大学2026-2027学年中国政府奖学金高水平研究生项目",
    type: "government",
    typeLabel: "Chinese Government Scholarship - University Program",
    providerName: "国家留学基金管理委员会",
    providerNameEn: "China Scholarship Council",
    providerLocation: "China",
    fundingLevel: "Not itemized in the AHU brochure",
    coverage: "The official AHU brochure does not itemize the award coverage or allowance amounts.",
    applicableDegree: "Master, Doctoral",
    applicableProgram: "AHU master's and doctoral majors available in the CSC application system; the brochure does not reproduce the major list.",
    amountText: "Not published in this AHU brochure",
    requirementText: "Master applicants need a bachelor's degree and are generally under 35; doctoral applicants need a master's degree and are generally under 40. Chinese-taught routes require HSK 5 (210+); non-native English speakers applying to English-taught routes need TOEFL 75+ or IELTS 6.0+.",
    deadlineDate: "2026-03-15",
    deadlineLabel: "08:00 Jan 15, 2026 to 17:00 Mar 15, 2026 (UTC+08:00)",
    applicationRound: "2026/2027 Chinese Government Scholarship - University Program",
    eligibilityItems: [
      { label: "Citizenship and health", value: "Non-Chinese citizen in good mental and physical health" },
      { label: "Master applicant", value: "Bachelor's degree holder, generally under age 35" },
      { label: "Doctoral applicant", value: "Master's degree holder, generally under age 40" },
      { label: "Chinese-taught route", value: "HSK Level 5 with a score of 210 or above" },
      { label: "English-taught route", value: "For non-native English speakers: TOEFL 75 or IELTS 6.0 or above" },
    ],
    applicationMaterials: [
      { label: "Chinese Government Scholarship application form" },
      { label: "Highest diploma or expected-graduation evidence and academic transcripts" },
      { label: "Language proficiency certificate for the selected teaching language" },
      { label: "AHU supervisor acceptance letter and pre-admission notice" },
      { label: "Study plan in Chinese or English (more than 1,000 characters or words)" },
      { label: "Two recommendation letters from professors or associate professors" },
      { label: "Physical examination and recent non-criminal-record certificate" },
    ],
    applicationSteps: [
      { label: "Step 1", value: "Prepare the AHU pre-admission and scholarship materials for the selected master's or doctoral route" },
      { label: "Step 2", value: "Submit the required applications within the Jan 15 to Mar 15, 2026 application window" },
      { label: "Step 3", value: "AHU conducts document review and may arrange an online interview before nomination" },
      { label: "Step 4", value: "CSC conducts the final eligibility review; AHU then issues the result and admission documents" },
    ],
    actionLinks: [{ label: "Official AHU scholarship brochure", url: source.finalUrl, kind: "official" }],
    bodySections: [
      { title: "Award coverage", body: "Coverage and allowance amounts are not itemized in this AHU brochure; applicants should verify the current applicable CSC standard before deciding." },
      { title: "Selection", body: "AHU performs the initial review and nomination. CSC makes the final scholarship decision." },
      { title: "Renewal", body: "Award holders study full-time and must pass the annual scholarship review to continue receiving the award." },
    ],
    tags: ["2026", "Chinese Government Scholarship", "Master", "Doctoral", "AHU"],
    summary: "AHU's 2026/2027 Chinese Government Scholarship university route for master's and doctoral applicants, with published eligibility, language requirements, timeline and review process.",
    sortOrder: 10,
    status: "draft",
    sourceUrl: source.finalUrl,
    sourceLabel: source.label,
    sourceSha256: source.sha256,
    capturedAt: source.fetchedAt,
    sourceFieldLineage: {
      title: "PDF pages 1 and 7, document title",
      applicableDegree: "PDF pages 1 and 7, section 1 Category",
      deadlineDate: "PDF pages 1 and 7, section 2 Application Time",
      eligibilityItems: "PDF pages 1 and 7, section 3 Eligibility",
      applicableProgram: "PDF pages 1 and 7, section 4 Majors and Teaching Language",
      applicationMaterials: "PDF pages 2-3 and 7-9, section 5; public material categories only",
      applicationSteps: "PDF pages 4-5 and 9-10, sections 7-8",
      coverage: "explicit omission: no coverage or allowance section appears in the 10-page brochure",
    },
  }],
};
const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok || validation.summary.scholarships !== 1) throw new Error(`Invalid AHU scholarship candidate: ${validation.errors.join(" ")}`);
await writeFile(outputPath, `${JSON.stringify(candidate, null, 2)}\n`, "utf8");
await writeFile(validationPath, `${JSON.stringify(validation, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, validationPath, bundleSha256: validation.bundleSha256 }, null, 2));
