import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
} from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const workRoot = resolve(root, "work/catalog-official");
const seedPath = resolve(root, "seeds/catalog.tsinghua-complete-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.tsinghua-complete-batch-01.validation.json");

type Source = {
  id: string;
  label: string;
  url: string;
  finalUrl?: string;
  fetchedAt: string;
  status: number;
  sha256: string;
};

const expected = new Map([
  ["tsinghua-zijing-global-talents-engineering-2027", "8fa2cbe5148d5f22bb2824a088ee26312409cea1ef7c8bca6407a70f53036473"],
  ["tsinghua-international-undergraduate-upload-documents-2027", "eea757838c711069c937b720331fa102eb947c6f57329110901c0a8a2aeb22b5"],
]);

const evidence = new Map<string, Source>();
for (const entry of await readdir(workRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  try {
    const manifest = JSON.parse(await readFile(resolve(workRoot, entry.name, "manifest.json"), "utf8")) as { sources?: Source[] };
    for (const source of manifest.sources ?? []) {
      if (source.status === 200 && expected.get(source.id) === source.sha256) evidence.set(source.id, source);
    }
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
}
if (evidence.size !== expected.size) {
  throw new Error(`Missing locked Tsinghua 2027 evidence: ${[...expected.keys()].filter((id) => !evidence.has(id)).join(", ")}`);
}

const guide = evidence.get("tsinghua-zijing-global-talents-engineering-2027")!;
const seed = JSON.parse(await readFile(seedPath, "utf8")) as CatalogSeedBundle;
const targets = seed.programs?.filter((program) =>
  program.degreeLevel === "Undergraduate"
  && program.teachingLanguage === "English"
  && program.tuitionText === "See the official English-taught program guide",
) ?? [];
if (targets.length !== 8) throw new Error(`Expected eight unresolved Zijing routes, found ${targets.length}.`);

const targetSlugs = new Set(targets.map((program) => program.slug));
seed.programs = seed.programs?.map((program): CatalogSeedProgram => {
  if (!targetSlugs.has(program.slug)) return program;
  return {
    ...program,
    durationYears: 4,
    cscaRequirement: "CSCA may be submitted as an international standardized-test result; the 2027 guide does not publish a mandatory subject combination or score threshold.",
    englishRequirement: "Applicants whose native language is not English must provide a valid English-language test report such as TOEFL or IELTS; no universal numeric minimum is published.",
    tuitionAmount: 100000,
    tuitionCurrency: "RMB",
    tuitionPeriod: "year",
    tuitionText: "RMB 100,000/year",
    displayTuition: "RMB 100,000/year",
    applicationNote: "Zijing College Global Talents in Science and Engineering Program; fully English-taught; Fall 2027 admission.",
    sourceUrl: guide.finalUrl ?? guide.url,
    sourceLabel: guide.label,
    sourceSha256: guide.sha256,
    capturedAt: guide.fetchedAt,
    sourceFieldLineage: {
      nameEn: "2027 Zijing College guide, Program Highlights",
      degreeLevel: "2027 Zijing College guide, undergraduate program description",
      fieldCategory: "2027 Zijing College guide title and Program Highlights",
      teachingLanguage: "2027 Zijing College guide, section 1.1",
      durationYears: "2027 Zijing College guide, section 1.2",
      tuitionAmount: "2027 Zijing College guide, section 5.1 fee table",
      applicationUrl: "2027 Zijing College guide, section 3.1",
      cscaRequirement: "2027 Zijing College guide, section 2.3 academic performance",
      englishRequirement: "2027 Zijing College guide, section 2.3 language proficiency",
    },
  };
});

const existingIntakes = new Set((seed.programIntakes ?? []).map((intake) => `${intake.programSlug}:${intake.intakeTerm}:${intake.intakeYear}`));
for (const program of targets) {
  const key = `${program.slug}:Fall:2027`;
  if (existingIntakes.has(key)) continue;
  seed.programIntakes ??= [];
  seed.programIntakes.push({
    programSlug: program.slug,
    intakeTerm: "Fall",
    intakeYear: 2027,
    deadlineDate: "2027-02-28T09:00:00.000Z",
    deadlineLabel: "Final deadline: February 28, 2027, 17:00 Beijing time; first-round deadline: November 20, 2026, 17:00 Beijing time",
    applicationRound: "2027 Zijing College Global Talents admission",
    status: "open",
    sourceUrl: guide.finalUrl ?? guide.url,
    sourceLabel: guide.label,
    sourceSha256: guide.sha256,
    capturedAt: guide.fetchedAt,
    sourceFieldLineage: {
      deadlineDate: "2027 Zijing College guide, section 4.2 second-round final deadline",
      deadlineLabel: "2027 Zijing College guide, sections 4.1-4.2",
    },
  });
}

seed.generatedAt = guide.fetchedAt;
const validation = createCatalogMigrationValidationReport(seed);
if (!validation.ok) throw new Error(`Tsinghua Zijing 2027 refresh failed validation:\n${validation.errors.join("\n")}`);
if ((seed.programs ?? []).filter((program) => program.tuitionText === "RMB 100,000/year" && targetSlugs.has(program.slug)).length !== 8) {
  throw new Error("The eight Zijing routes were not refreshed with exact tuition.");
}
if ((seed.programIntakes ?? []).filter((intake) => targetSlugs.has(intake.programSlug) && intake.intakeTerm === "Fall" && intake.intakeYear === 2027).length !== 8) {
  throw new Error("The eight Zijing routes do not all have a Fall 2027 intake.");
}

await writeFile(seedPath, `${JSON.stringify(seed, null, 2)}\n`, "utf8");
await writeFile(validationPath, `${JSON.stringify(validation, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  ok: true,
  seedPath,
  validationPath,
  refreshedProgramCount: targets.length,
  addedCurrentIntakeCount: 8,
  evidence: [...evidence.values()].map((source) => ({ id: source.id, sha256: source.sha256 })),
}, null, 2));
