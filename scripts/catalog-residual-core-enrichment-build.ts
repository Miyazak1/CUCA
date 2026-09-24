import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedProgram,
} from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const paths = {
  uibe: resolve(root, "seeds/catalog.uibe-scholarships-programs-batch-02.approved.local.json"),
  buct: resolve(root, "seeds/catalog.buct-complete-batch-01.approved.local.json"),
  lnutcm: resolve(root, "seeds/catalog.lnutcm-complete-batch-01.draft.json"),
  uibeSilkManifest: resolve(root, "work/catalog-official/2026-09-14T06-00-52-945Z/manifest.json"),
  uibeImpaManifest: resolve(root, "work/catalog-official/2026-09-14T06-00-53-330Z/manifest.json"),
  buctManifest: resolve(root, "work/catalog-official/buct-complete-batch-01/manifest.json"),
  lnutcmManifest: resolve(root, "work/catalog-official/lnutcm-chinese-language-images-batch-01/manifest.json"),
  candidate: resolve(root, "seeds/catalog.residual-core-enrichment-batch-01.draft.json"),
  validation: resolve(root, "seeds/catalog.residual-core-enrichment-batch-01.validation.json"),
};
const inputKeys = ["uibe", "buct", "lnutcm", "uibeSilkManifest", "uibeImpaManifest", "buctManifest", "lnutcmManifest"] as const;
const fileEntries = await Promise.all(inputKeys.map(async (key) => [key, await readFile(paths[key], "utf8")] as const));
const text = Object.fromEntries(fileEntries) as Record<(typeof inputKeys)[number], string>;
const bundles = {
  uibe: JSON.parse(text.uibe) as CatalogSeedBundle,
  buct: JSON.parse(text.buct) as CatalogSeedBundle,
  lnutcm: JSON.parse(text.lnutcm) as CatalogSeedBundle,
};
type Manifest = { sources: { id: string; status: number; sha256: string; fetchedAt: string }[] };
const manifests = {
  uibeSilk: JSON.parse(text.uibeSilkManifest) as Manifest,
  uibeImpa: JSON.parse(text.uibeImpaManifest) as Manifest,
  buct: JSON.parse(text.buctManifest) as Manifest,
  lnutcm: JSON.parse(text.lnutcmManifest) as Manifest,
};
const evidence = {
  uibeSilk: {
    id: "uibe-silk-road-scholarship-2026",
    hash: "20aa01163d3d3dd229d3b05d550151db6b8c0b07b79a14f1302b0bf8d2984243",
    manifest: manifests.uibeSilk,
  },
  uibeImpa: {
    id: "uibe-youth-excellence-impa-2026",
    hash: "c9caa714c95b512997868373d7c8605c7a9bfe69761066d611f147e8534d7e64",
    manifest: manifests.uibeImpa,
  },
  buct: {
    id: "buct-master-programs-2026",
    hash: "77cb3ffbb4c86626e3c04529604fa126293a7c84c3daefa02673dbed7d928f07",
    manifest: manifests.buct,
  },
  lnutcm: {
    id: "lnutcm-chinese-language-guide-image-6-2026-2027",
    hash: "ba5d1a094d82c000968b26f2b093f3b45ac73be780cb711addb8c27753a3f2df",
    manifest: manifests.lnutcm,
  },
};
for (const [key, row] of Object.entries(evidence)) {
  const source = row.manifest.sources.find((item) => item.id === row.id);
  if (!source || source.status !== 200 || source.sha256 !== row.hash) {
    throw new Error(`${key} evidence is missing or changed.`);
  }
}

const findProgram = (bundle: CatalogSeedBundle, slug: string) => {
  const program = bundle.programs.find((row) => row.slug === slug);
  if (!program) throw new Error(`Missing program dependency: ${slug}`);
  return program;
};
const silkSlugs = [
  "uibe-silk-road-international-business-cross-border-ecommerce-master",
  "uibe-silk-road-public-administration-custom-management-master",
  "uibe-silk-road-wto-laws-and-economics-master",
];
const programs: CatalogSeedProgram[] = silkSlugs.map((slug) => {
  const program = findProgram(bundles.uibe, slug);
  return {
    ...program,
    teachingLanguage: "English",
    tuitionText: "Tuition is covered by the full scholarship for awardees; the official notice does not publish a self-funded tuition amount.",
    displayTuition: "Tuition covered for scholarship awardees",
    status: "draft",
    sourceFieldLineage: {
      ...program.sourceFieldLineage,
      teachingLanguage: `${evidence.uibeSilk.id} ${evidence.uibeSilk.hash}: all three listed routes are explicitly described as English-taught master's programs`,
      tuitionText: `${evidence.uibeSilk.id} ${evidence.uibeSilk.hash}: full scholarship explicitly includes tuition; no self-funded amount is published`,
    },
  };
});
const impa = findProgram(bundles.uibe, "uibe-youth-excellence-impa-global-development-governance-master");
programs.push({
  ...impa,
  teachingLanguage: "English",
  tuitionText: "One academic year is funded by a full scholarship; the official notice does not itemize a tuition amount.",
  displayTuition: "Full scholarship for one academic year",
  status: "draft",
  sourceFieldLineage: {
    ...impa.sourceFieldLineage,
    teachingLanguage: `${evidence.uibeImpa.id} ${evidence.uibeImpa.hash}: Language of Instruction is explicitly English`,
    tuitionText: `${evidence.uibeImpa.id} ${evidence.uibeImpa.hash}: one academic year with full scholarship; no itemized tuition amount is published`,
  },
});
const buct = findProgram(
  bundles.buct,
  "beijing-university-of-chemical-technology-master-materials-science-and-chemical-engineering-chimie-p-kin-paris-curie-engineer-school-french",
);
if (buct.teachingLanguage !== "French") throw new Error("BUCT French-route precondition changed.");
programs.push({
  ...buct,
  tuitionText: "The official 2026 fee table does not publish a tuition amount for this French-instructed master's route; confirm the applicable amount with BUCT.",
  displayTuition: "Contact BUCT for French-route tuition",
  status: "draft",
  sourceFieldLineage: {
    ...buct.sourceFieldLineage,
    tuitionText: `${evidence.buct.id} ${evidence.buct.hash}: French route is listed, while the fee table publishes only Chinese- and English-instructed master's rates`,
  },
});
const lnutcm = findProgram(
  bundles.lnutcm,
  "liaoning-university-of-traditional-chinese-medicine-non-degree-chinese-language-one-semester-spring-2027",
);
programs.push({
  ...lnutcm,
  tuitionAmount: 6500,
  tuitionCurrency: "CNY",
  tuitionPeriod: "semester",
  tuitionText: "CNY 6,500 per semester",
  displayTuition: "CNY 6,500/semester",
  status: "draft",
  sourceFieldLineage: {
    ...lnutcm.sourceFieldLineage,
    tuitionAmount: `${evidence.lnutcm.id} ${evidence.lnutcm.hash}: official guide fee section, long-term class tuition per semester`,
    tuitionText: `${evidence.lnutcm.id} ${evidence.lnutcm.hash}: official guide fee section, long-term class tuition per semester`,
  },
});

const dependencies = new Map<string, { school: CatalogSeedBundle["schools"][number]; city: CatalogSeedBundle["cities"][number] }>();
for (const [bundleKey, bundle] of Object.entries(bundles)) {
  for (const program of programs.filter((row) => bundle.programs.some((candidate) => candidate.slug === row.slug))) {
    const school = bundle.schools.find((row) => row.slug === program.schoolSlug);
    if (!school) throw new Error(`Missing ${bundleKey} school dependency: ${program.schoolSlug}`);
    const city = bundle.cities.find((row) => row.slug === school.citySlug);
    if (!city) throw new Error(`Missing ${bundleKey} city dependency: ${school.citySlug}`);
    dependencies.set(school.slug, { school, city });
  }
}
const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt: new Date(Math.max(...Object.values(evidence).map((row) => Date.parse(row.manifest.sources.find((item) => item.id === row.id)!.fetchedAt)))).toISOString(),
  cities: [...new Map([...dependencies.values()].map(({ city }) => [city.slug, city])).values()],
  schools: [...dependencies.values()].map(({ school }) => school),
  programs,
  programIntakes: [],
  scholarships: [],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok || validation.summary.programs !== 6 || validation.summary.schools !== 3) {
  throw new Error(`Residual core enrichment invalid:\n${validation.errors.join("\n")}`);
}
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const validationArtifact = {
  ...validation,
  candidateSha256: sha(candidateText),
  inputBundleSha256: {
    uibe: sha(text.uibe),
    buct: sha(text.buct),
    lnutcm: sha(text.lnutcm),
  },
  sourceManifestSha256: {
    uibeSilk: sha(text.uibeSilkManifest),
    uibeImpa: sha(text.uibeImpaManifest),
    buct: sha(text.buctManifest),
    lnutcm: sha(text.lnutcmManifest),
  },
  sourceReview: {
    status: "unreviewed_draft",
    notes: [
      "UIBE scholarship-only routes preserve coverage wording when an itemized self-funded tuition amount is not published.",
      "The BUCT French route explicitly preserves the unresolved rate instead of borrowing a Chinese- or English-instructed fee.",
      "The LNUTCM one-semester route uses the official long-term semester fee shown in the 2026-2027 guide.",
      "No intake, deadline, program identity, application URL or scholarship state is changed.",
      "This draft does not authorize publication or database writes.",
    ],
  },
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
};
await Promise.all([
  writeFile(paths.candidate, candidateText, "utf8"),
  writeFile(paths.validation, `${JSON.stringify(validationArtifact, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({
  ok: true,
  candidatePath: paths.candidate,
  validationPath: paths.validation,
  summary: validation.summary,
  candidateSha256: validationArtifact.candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
}, null, 2));
