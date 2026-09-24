import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCatalogMigrationValidationReport,
  type CatalogSeedBundle,
  type CatalogSeedSchool,
} from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const candidatePath = resolve(root, "seeds/catalog.school-access-enrichment-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.school-access-enrichment-batch-01.validation.json");
const specs = [
  {
    path: "seeds/catalog.bnu-scholarships-batch-01.draft.json",
    slug: "beijing-normal-university",
    sha256: "ac577f79869863eddb3fec145b7a5e59c542386bea1f61a2ca50906ee78c14e3",
    websiteUrl: "https://admission-is.bnu.edu.cn/",
  },
  {
    path: "seeds/catalog.bsu-school-undergraduate-cleanup.draft.json",
    slug: "beijing-sport-university",
    sha256: "205f0d5e7615133fa201d100f81539d64ce24056f4c116fdf82e9a281fc02056",
    websiteUrl: "https://zs.bsu.edu.cn/",
    admissionsUrl: "https://zs.bsu.edu.cn/lxszsw/lxstzgg/66d8ebf30f85422688e099f28f51b58e.htm",
  },
  {
    path: "seeds/catalog.nju-complete-batch-02.draft.json",
    slug: "nanjing-university",
    sha256: "aef8f2b6536b3e3f2daf916d725328f6b858a49c0ea1472a537b8ede69638625",
    websiteUrl: "https://hwxy.nju.edu.cn/",
  },
  {
    path: "seeds/catalog.zjsu-cleanup-batch-01.draft.json",
    slug: "zhejiang-gongshang-university",
    sha256: "3b520372be31475bcd3f48e1877086d74d4bc4c5cbbc8ce05c345dc48284b0d4",
    websiteUrl: "https://sie.zjgsu.edu.cn/",
    admissionsUrl: "https://sie.zjgsu.edu.cn/gjen/_t75/2128/listm.htm",
  },
  {
    path: "seeds/catalog.zjut-school-program-cleanup-batch-01.draft.json",
    slug: "zhejiang-university-of-technology",
    sha256: "1b59188e03b8c3f97877f7d4bac0a77ec529ff7fe82af30585ccf072174cba79",
    websiteUrl: "https://www.gjxy.zjut.edu.cn/",
    admissionsUrl: "https://www.gjxy.zjut.edu.cn/ueditor/upload/file/20251125/1764050265176062.pdf",
  },
] as const;

const loaded = await Promise.all(specs.map(async (spec) => {
  const text = await readFile(resolve(root, spec.path), "utf8");
  return { spec, text, bundle: JSON.parse(text) as CatalogSeedBundle };
}));

const cities = [...new Map(loaded.flatMap(({ bundle }) => bundle.cities ?? []).map((city) => [city.slug, city])).values()];
const schools: CatalogSeedSchool[] = loaded.map(({ spec, bundle }) => {
  const school = bundle.schools.find((row) => row.slug === spec.slug);
  if (!school) throw new Error(`Missing school ${spec.slug} in ${spec.path}`);
  if (school.sourceSha256 !== spec.sha256) throw new Error(`School evidence digest changed: ${spec.slug}`);
  const sourceOrigin = new URL(school.sourceUrl).origin;
  if (new URL(spec.websiteUrl).origin !== sourceOrigin) throw new Error(`Website origin differs from official evidence: ${spec.slug}`);
  if ("admissionsUrl" in spec && new URL(spec.admissionsUrl).origin !== sourceOrigin) {
    throw new Error(`Admissions origin differs from official evidence: ${spec.slug}`);
  }
  return {
    ...school,
    websiteUrl: spec.websiteUrl,
    ...(school.admissionsUrl ? {} : "admissionsUrl" in spec ? { admissionsUrl: spec.admissionsUrl } : {}),
    status: "draft",
    sourceFieldLineage: {
      ...school.sourceFieldLineage,
      websiteUrl: "derived: official HTTPS origin of the hash-pinned school admission source",
      ...(school.admissionsUrl ? {} : "admissionsUrl" in spec ? { admissionsUrl: "explicit: registered official admission page or guide URL" } : {}),
    },
  };
});

const generatedAt = new Date(Math.max(...schools.map((school) => Date.parse(school.capturedAt)))).toISOString();
const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt,
  cities,
  schools,
  programs: [],
  programIntakes: [],
  scholarships: [],
};
const candidateText = `${JSON.stringify(candidate, null, 2)}\n`;
const validation = createCatalogMigrationValidationReport(JSON.parse(candidateText));
if (!validation.ok || validation.summary.schools !== specs.length) {
  throw new Error(`School access enrichment invalid:\n${validation.errors.join("\n")}`);
}
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const validationArtifact = {
  ...validation,
  candidateSha256: sha(candidateText),
  inputBundles: loaded.map(({ spec, text }) => ({ path: spec.path, sha256: sha(text) })),
  sourceReview: {
    status: "unreviewed_draft",
    notes: [
      "This draft fills only missing school website and admissions entry fields.",
      "Every website value is the HTTPS origin of that record's existing hash-pinned official admissions source.",
      "Every added admissions value is the same registered official page or guide already used as the record source.",
      "No school profile, ranking, fee, deadline, program or scholarship claim is added.",
      "The batch remains unreviewed and does not authorize publication or database writes.",
    ],
  },
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
};

await Promise.all([
  writeFile(candidatePath, candidateText, "utf8"),
  writeFile(validationPath, `${JSON.stringify(validationArtifact, null, 2)}\n`, "utf8"),
]);
console.log(JSON.stringify({
  ok: true,
  candidatePath,
  validationPath,
  summary: validation.summary,
  candidateSha256: validationArtifact.candidateSha256,
  publicationAuthorized: false,
  databaseWriteAuthorized: false,
}, null, 2));
