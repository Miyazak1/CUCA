import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { requirementDigest, type RequirementDocument } from "../src/server/catalog/requirements.ts";
import {
  requirementCandidateOperationsSha256,
  requirementCandidateTemplatesSha256,
  stableRequirementVersionIdentity,
  validateRequirementReleaseCandidate,
  type RequirementCandidateOperation,
  type RequirementReleaseCandidate,
} from "./lib/catalog-requirement-candidate-runtime.ts";

const root = process.cwd();
const outputPath = resolve(root, "seeds/application-requirements-release-candidate.unreviewed.json");

type DraftTemplate = {
  key: string;
  schoolSlug: string;
  targetProgramSlugs: string[];
  targetIntake?: { term: string; year: number };
  targetBindingStatus: "ready" | "blocked_missing_intake";
  reviewStatus: "unreviewed";
  document: RequirementDocument;
};
type Draft = { handoff: { databaseWriteAuthorized: boolean; publicationAuthorized: boolean }; templates: DraftTemplate[] };
type Program = { slug: string; schoolSlug?: string };
type Intake = { programSlug: string; intakeTerm: string; intakeYear: number };
type CatalogSeed = { programs: Program[]; programIntakes: Intake[] };

async function json<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(resolve(root, path), "utf8")) as T;
}

const drafts = await Promise.all([
  json<Draft>("seeds/application-requirements-wave-01.draft.json"),
  json<Draft>("seeds/application-requirements-wave-02.draft.json"),
  json<Draft>("seeds/application-requirements-wave-03.draft.json"),
  json<Draft>("seeds/application-requirements-wave-04.draft.json"),
  json<Draft>("seeds/application-requirements-wave-05.draft.json"),
  json<Draft>("seeds/application-requirements-wave-06.draft.json"),
  json<Draft>("seeds/application-requirements-wave-07.draft.json"),
  json<Draft>("seeds/application-requirements-wave-08.draft.json"),
  json<Draft>("seeds/application-requirements-wave-09.draft.json"),
  json<Draft>("seeds/application-requirements-wave-10.draft.json"),
  json<Draft>("seeds/application-requirements-wave-11.draft.json"),
  json<Draft>("seeds/application-requirements-wave-12.draft.json"),
  json<Draft>("seeds/application-requirements-wave-13.draft.json"),
  json<Draft>("seeds/application-requirements-wave-14.draft.json"),
  json<Draft>("seeds/application-requirements-wave-15.draft.json"),
  json<Draft>("seeds/application-requirements-wave-16.draft.json"),
  json<Draft>("seeds/application-requirements-wave-17.draft.json"),
  json<Draft>("seeds/application-requirements-wave-18.draft.json"),
  json<Draft>("seeds/application-requirements-wave-19.draft.json"),
  json<Draft>("seeds/application-requirements-wave-20.draft.json"),
  json<Draft>("seeds/application-requirements-wave-21.draft.json"),
  json<Draft>("seeds/application-requirements-wave-22.draft.json"),
  json<Draft>("seeds/application-requirements-wave-23.draft.json"),
  json<Draft>("seeds/application-requirements-wave-24.draft.json"),
  json<Draft>("seeds/application-requirements-wave-25.draft.json"),
  json<Draft>("seeds/application-requirements-wave-26.draft.json"),
  json<Draft>("seeds/application-requirements-wave-27.draft.json"),
  json<Draft>("seeds/application-requirements-wave-28.draft.json"),
  json<Draft>("seeds/application-requirements-wave-29.draft.json"),
  json<Draft>("seeds/application-requirements-wave-30.draft.json"),
  json<Draft>("seeds/application-requirements-wave-31.draft.json"),
  json<Draft>("seeds/application-requirements-wave-32.draft.json"),
  json<Draft>("seeds/application-requirements-wave-33.draft.json"),
  json<Draft>("seeds/application-requirements-wave-34.draft.json"),
  json<Draft>("seeds/application-requirements-wave-35.draft.json"),
  json<Draft>("seeds/application-requirements-wave-36.draft.json"),
  json<Draft>("seeds/application-requirements-wave-37.draft.json"),
  json<Draft>("seeds/application-requirements-wave-38.draft.json"),
  json<Draft>("seeds/application-requirements-wave-39.draft.json"),
  json<Draft>("seeds/application-requirements-wave-40.draft.json"),
  json<Draft>("seeds/application-requirements-wave-41.draft.json"),
  json<Draft>("seeds/application-requirements-wave-42.draft.json"),
  json<Draft>("seeds/application-requirements-wave-43.draft.json"),
  json<Draft>("seeds/application-requirements-wave-44.draft.json"),
  json<Draft>("seeds/application-requirements-wave-45.draft.json"),
  json<Draft>("seeds/application-requirements-wave-46.draft.json"),
  json<Draft>("seeds/application-requirements-wave-47.draft.json"),
  json<Draft>("seeds/application-requirements-wave-48.draft.json"),
  json<Draft>("seeds/application-requirements-wave-49.draft.json"),
  json<Draft>("seeds/application-requirements-wave-50.draft.json"),
  json<Draft>("seeds/application-requirements-wave-51.draft.json"),
  json<Draft>("seeds/application-requirements-wave-52.draft.json"),
  json<Draft>("seeds/application-requirements-wave-53.draft.json"),
  json<Draft>("seeds/application-requirements-wave-54.draft.json"),
  json<Draft>("seeds/application-requirements-wave-55.draft.json"),
  json<Draft>("seeds/application-requirements-wave-56.draft.json"),
  json<Draft>("seeds/application-requirements-wave-57.draft.json"),
]);
for (const draft of drafts) {
  if (draft.handoff.databaseWriteAuthorized || draft.handoff.publicationAuthorized) throw new Error("Source draft unexpectedly authorizes a write or publication.");
}

const tjuLanguageSeed = await json<CatalogSeed>("seeds/catalog.tju-language-spring-2027.draft.json");
const tjuCompleteSeed = await json<CatalogSeed>("seeds/catalog.tju-complete-batch-01.draft.json");
const tjuSeed: CatalogSeed = {
  programs: [...tjuLanguageSeed.programs, ...tjuCompleteSeed.programs],
  programIntakes: [...tjuLanguageSeed.programIntakes, ...tjuCompleteSeed.programIntakes],
};
const lnutcmLanguageSeed = await json<CatalogSeed>("seeds/catalog.lnutcm-language-spring-2027.draft.json");
const lnutcmCompleteSeed = await json<CatalogSeed>("seeds/catalog.lnutcm-complete-batch-01.draft.json");
const lnutcmSeed: CatalogSeed = {
  programs: [...lnutcmLanguageSeed.programs, ...lnutcmCompleteSeed.programs],
  programIntakes: [...lnutcmLanguageSeed.programIntakes, ...lnutcmCompleteSeed.programIntakes],
};
const beihangLanguageSeed = await json<CatalogSeed>("seeds/catalog.beihang-language-spring-2027.draft.json");
const beihangUndergraduateSeed = await json<CatalogSeed>("seeds/catalog.beihang-school-program-batch-01.approved.local.json");
const beihangGraduateSeed = await json<CatalogSeed>("seeds/catalog.beihang-graduate-batch-01.approved.local.json");
const beihangSeed: CatalogSeed = {
  programs: [...beihangLanguageSeed.programs, ...beihangUndergraduateSeed.programs, ...beihangGraduateSeed.programs],
  programIntakes: [...beihangLanguageSeed.programIntakes, ...beihangUndergraduateSeed.programIntakes, ...beihangGraduateSeed.programIntakes],
};
const blcuLanguageSeed = await json<CatalogSeed>("seeds/catalog.blcu-language-spring-2027.draft.json");
const blcuUndergraduateSeed = await json<CatalogSeed>("seeds/catalog.blcu-undergraduate-safe-batch-01.approved.local.json");
const blcuSeed: CatalogSeed = {
  programs: [...blcuLanguageSeed.programs, ...blcuUndergraduateSeed.programs],
  programIntakes: [...blcuLanguageSeed.programIntakes, ...blcuUndergraduateSeed.programIntakes],
};
const bnuLanguageSeed = await json<CatalogSeed>("seeds/catalog.bnu-language-spring-2027.draft.json");
const bnuUndergraduateSeed = await json<CatalogSeed>("seeds/catalog.bnu-school-program-batch-01.approved.local.json");
const bnuSeed: CatalogSeed = {
  programs: [...bnuLanguageSeed.programs, ...bnuUndergraduateSeed.programs],
  programIntakes: [...bnuLanguageSeed.programIntakes, ...bnuUndergraduateSeed.programIntakes],
};

const seedBySchool = new Map<string, CatalogSeed>([
  ["university-of-international-business-and-economics", await json<CatalogSeed>("seeds/catalog.uibe-school-program-batch-01.approved.local.json")],
  ["qingdao-university", await json<CatalogSeed>("seeds/catalog.qdu-complete-batch-01.draft.json")],
  ["sichuan-international-studies-university", await json<CatalogSeed>("seeds/catalog.sisu-complete-batch-01.draft.json")],
  ["tianjin-foreign-studies-university", await json<CatalogSeed>("seeds/catalog.tjfsu-complete-batch-01.draft.json")],
  ["south-china-university-of-technology", await json<CatalogSeed>("seeds/catalog.scut-undergraduate-batch-01.approved.local.json")],
  ["zhejiang-university-of-technology", await json<CatalogSeed>("seeds/catalog.zjut-language-spring-2027.draft.json")],
  ["liaoning-university-of-traditional-chinese-medicine", lnutcmSeed],
  ["beihang-university", beihangSeed],
  ["central-south-university", await json<CatalogSeed>("seeds/catalog.csu-language-spring-2027.draft.json")],
  ["chang-an-university", await json<CatalogSeed>("seeds/catalog.changan-language-spring-2027.draft.json")],
  ["jilin-university", await json<CatalogSeed>("seeds/catalog.jilin-language-spring-2027.draft.json")],
  ["tianjin-university", tjuSeed],
  ["beijing-language-and-culture-university", blcuSeed],
  ["beijing-normal-university", bnuSeed],
  ["shanghai-university", await json<CatalogSeed>("seeds/catalog.shu-language-spring-2027.draft.json")],
  ["huazhong-university-of-science-and-technology", await json<CatalogSeed>("seeds/catalog.hust-language-spring-2027.draft.json")],
  ["zhejiang-gongshang-university", await json<CatalogSeed>("seeds/catalog.zjsu-language-spring-2027.draft.json")],
  ["zhejiang-university", await json<CatalogSeed>("seeds/catalog.zju-language-spring-2027.draft.json")],
  ["peking-university-health-science-center", await json<CatalogSeed>("seeds/catalog.pkuhsc-complete-batch-01.draft.json")],
  ["central-university-of-finance-and-economics", await json<CatalogSeed>("seeds/catalog.cufe-complete-batch-01.draft.json")],
  ["harbin-institute-of-technology-shenzhen", await json<CatalogSeed>("seeds/catalog.hitsz-complete-batch-01.draft.json")],
  ["harbin-university-of-science-and-technology", await json<CatalogSeed>("seeds/catalog.hrbust-complete-batch-01.draft.json")],
  ["guizhou-medical-university", await json<CatalogSeed>("seeds/catalog.gmcu-complete-batch-01.draft.json")],
  ["guangxi-medical-university", await json<CatalogSeed>("seeds/catalog.gxmu-complete-batch-01.draft.json")],
  ["yanshan-university", await json<CatalogSeed>("seeds/catalog.yanshan-complete-batch-01.draft.json")],
  ["nanjing-university-of-aeronautics-and-astronautics", await json<CatalogSeed>("seeds/catalog.nuaa-complete-batch-01.draft.json")],
  ["university-of-science-and-technology-of-china", await json<CatalogSeed>("seeds/catalog.ustc-complete-batch-01.draft.json")],
  ["shandong-university", await json<CatalogSeed>("seeds/catalog.sdu-complete-batch-01.draft.json")],
  ["university-of-science-and-technology-beijing", await json<CatalogSeed>("seeds/catalog.ustb-complete-batch-01.draft.json")],
  ["xiamen-university", await json<CatalogSeed>("seeds/catalog.xmu-complete-batch-01.draft.json")],
  ["nankai-university", await json<CatalogSeed>("seeds/catalog.nankai-complete-batch-01.draft.json")],
  ["harbin-institute-of-technology", await json<CatalogSeed>("seeds/catalog.hit-complete-batch-01.draft.json")],
  ["northwestern-polytechnical-university", await json<CatalogSeed>("seeds/catalog.nwpu-complete-batch-01.draft.json")],
  ["sichuan-university", await json<CatalogSeed>("seeds/catalog.scu-complete-batch-01.draft.json")],
  ["sun-yat-sen-university", await json<CatalogSeed>("seeds/catalog.sysu-complete-batch-01.draft.json")],
  ["southeast-university", await json<CatalogSeed>("seeds/catalog.seu-complete-batch-02.draft.json")],
  ["beijing-university-of-chemical-technology", await json<CatalogSeed>("seeds/catalog.buct-complete-batch-01.draft.json")],
  ["harbin-engineering-university", await json<CatalogSeed>("seeds/catalog.heu-complete-batch-01.draft.json")],
  ["beijing-university-of-posts-and-telecommunications", await json<CatalogSeed>("seeds/catalog.bupt-complete-batch-01.draft.json")],
  ["xi-an-jiaotong-university", await json<CatalogSeed>("seeds/catalog.xjtu-complete-batch-01.draft.json")],
  ["shandong-normal-university", await json<CatalogSeed>("seeds/catalog.sdnu-complete-batch-01.draft.json")],
  ["tianjin-university-of-finance-and-economics", await json<CatalogSeed>("seeds/catalog.tjufe-complete-batch-01.draft.json")],
  ["east-china-university-of-political-science-and-law", await json<CatalogSeed>("seeds/catalog.ecupl-complete-batch-01.draft.json")],
  ["wuhan-university", await json<CatalogSeed>("seeds/catalog.whu-complete-batch-01.draft.json")],
  ["university-of-chinese-academy-of-sciences", await json<CatalogSeed>("seeds/catalog.ucas-complete-batch-01.draft.json")],
  ["tsinghua-university", await json<CatalogSeed>("seeds/catalog.tsinghua-complete-batch-01.draft.json")],
  ["ocean-university-of-china", await json<CatalogSeed>("seeds/catalog.ouc-international-batch-01.draft.json")],
  ["xiangtan-university", await json<CatalogSeed>("seeds/catalog.xtu-safe-new-batch-01.draft.json")],
  ["east-china-normal-university", await json<CatalogSeed>("seeds/catalog.ecnu-safe-new-batch-01.draft.json")],
  ["donghua-university", await json<CatalogSeed>("seeds/catalog.dhu-complete-batch-01.draft.json")],
  ["china-agricultural-university", await json<CatalogSeed>("seeds/catalog.cau-complete-batch-01.draft.json")],
  ["guangdong-university-of-foreign-studies", await json<CatalogSeed>("seeds/catalog.gdufs-complete-batch-01.draft.json")],
  ["shanghai-international-studies-university", await json<CatalogSeed>("seeds/catalog.shisu-complete-batch-01.draft.json")],
]);

const readyTemplates = drafts.flatMap((draft) => draft.templates).filter((template) => template.targetBindingStatus === "ready" && template.document.coverage === "complete");
const operations: RequirementCandidateOperation[] = [];
for (const template of readyTemplates) {
  if (template.reviewStatus !== "unreviewed" || !template.targetIntake) throw new Error(`Ready template lacks an unreviewed intake binding: ${template.key}`);
  const seed = seedBySchool.get(template.schoolSlug);
  if (!seed) throw new Error(`No catalog seed registered for ${template.schoolSlug}.`);
  const programSlugs = new Set(seed.programs.map((program) => program.slug));
  const intakeBindings = new Set(seed.programIntakes.map((intake) => `${intake.programSlug}:${intake.intakeTerm}:${intake.intakeYear}`));
  const documentSha256 = requirementDigest(template.document);
  for (const programSlug of [...template.targetProgramSlugs].sort()) {
    const binding = `${programSlug}:${template.targetIntake.term}:${template.targetIntake.year}`;
    if (!programSlugs.has(programSlug)) throw new Error(`Target program is missing from its catalog seed: ${programSlug}`);
    if (!intakeBindings.has(binding)) throw new Error(`Target intake is missing from its catalog seed: ${binding}`);
    operations.push({
      operationKey: `${template.key}:${programSlug}:${template.targetIntake.term.toLowerCase()}-${template.targetIntake.year}`,
      templateKey: template.key,
      schoolSlug: template.schoolSlug,
      programSlug,
      intakeTerm: template.targetIntake.term,
      intakeYear: template.targetIntake.year,
      cycleState: template.targetIntake.year === 2027 ? "current_2027" : "historical_2026",
      targetBindingStatus: "verified",
      reviewStatus: "unreviewed",
      versionIdentity: stableRequirementVersionIdentity(`${binding}:${documentSha256}`),
      documentSha256,
    });
  }
}
operations.sort((left, right) => left.operationKey.localeCompare(right.operationKey));

const candidate: RequirementReleaseCandidate = {
  version: 2,
  generatedAt: new Date().toISOString(),
  status: "unreviewed_non_public_requirement_candidate",
  authorization: {
    candidatePreparationAuthorized: true,
    executionAuthorized: false,
    persistentDatabaseWriteAuthorized: false,
    publicationAuthorized: false,
  },
  decision: { humanReviewCompleted: false },
  templates: readyTemplates.map((template) => ({
    templateKey: template.key,
    documentSha256: requirementDigest(template.document),
    document: template.document,
  })).sort((left, right) => left.templateKey.localeCompare(right.templateKey)),
  summary: {
    templateCount: new Set(operations.map((operation) => operation.templateKey)).size,
    operationCount: operations.length,
    schoolCount: new Set(operations.map((operation) => operation.schoolSlug)).size,
    programCount: new Set(operations.map((operation) => operation.programSlug)).size,
    intakeBindingCount: new Set(operations.map((operation) => `${operation.programSlug}:${operation.intakeTerm}:${operation.intakeYear}`)).size,
    historicalOperationCount: operations.filter((operation) => operation.cycleState === "historical_2026").length,
    currentOperationCount: operations.filter((operation) => operation.cycleState === "current_2027").length,
  },
  operations,
  hashes: {
    templatesSha256: requirementCandidateTemplatesSha256(readyTemplates.map((template) => ({
      templateKey: template.key,
      documentSha256: requirementDigest(template.document),
      document: template.document,
    })).sort((left, right) => left.templateKey.localeCompare(right.templateKey))),
    operationsSha256: requirementCandidateOperationsSha256(operations),
  },
};

validateRequirementReleaseCandidate(candidate);
await writeFile(outputPath, `${JSON.stringify(candidate, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: candidate.summary, authorization: candidate.authorization }, null, 2));
