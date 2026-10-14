import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { requirementDigest, type RequirementDocument } from "../src/server/catalog/requirements.ts";
import {
  requirementCandidateOperationsSha256,
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
]);
for (const draft of drafts) {
  if (draft.handoff.databaseWriteAuthorized || draft.handoff.publicationAuthorized) throw new Error("Source draft unexpectedly authorizes a write or publication.");
}

const seedBySchool = new Map<string, CatalogSeed>([
  ["university-of-international-business-and-economics", await json<CatalogSeed>("seeds/catalog.uibe-school-program-batch-01.approved.local.json")],
  ["qingdao-university", await json<CatalogSeed>("seeds/catalog.qdu-complete-batch-01.draft.json")],
  ["sichuan-international-studies-university", await json<CatalogSeed>("seeds/catalog.sisu-complete-batch-01.draft.json")],
  ["tianjin-foreign-studies-university", await json<CatalogSeed>("seeds/catalog.tjfsu-complete-batch-01.draft.json")],
  ["south-china-university-of-technology", await json<CatalogSeed>("seeds/catalog.scut-undergraduate-batch-01.approved.local.json")],
  ["zhejiang-university-of-technology", await json<CatalogSeed>("seeds/catalog.zjut-language-spring-2027.draft.json")],
  ["liaoning-university-of-traditional-chinese-medicine", await json<CatalogSeed>("seeds/catalog.lnutcm-language-spring-2027.draft.json")],
]);

const readyTemplates = drafts.flatMap((draft) => draft.templates).filter((template) => template.targetBindingStatus === "ready");
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
      document: template.document,
    });
  }
}
operations.sort((left, right) => left.operationKey.localeCompare(right.operationKey));

const candidate: RequirementReleaseCandidate = {
  version: 1,
  generatedAt: new Date().toISOString(),
  status: "unreviewed_non_public_requirement_candidate",
  authorization: {
    candidatePreparationAuthorized: true,
    executionAuthorized: false,
    persistentDatabaseWriteAuthorized: false,
    publicationAuthorized: false,
  },
  decision: { humanReviewCompleted: false },
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
  hashes: { operationsSha256: requirementCandidateOperationsSha256(operations) },
};

validateRequirementReleaseCandidate(candidate);
await writeFile(outputPath, `${JSON.stringify(candidate, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, summary: candidate.summary, authorization: candidate.authorization }, null, 2));
