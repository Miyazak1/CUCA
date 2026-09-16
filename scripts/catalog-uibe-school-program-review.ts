import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

const root = process.cwd();
const sourcePath = resolve(root, "seeds/catalog.uibe-rich.review.json");
const indexManifestPath = resolve(root, "work/catalog-official/2026-09-11T05-18-46-068Z/manifest.json");
const jointManifestPath = resolve(root, "work/catalog-official/2026-09-11T05-18-37-054Z/manifest.json");
const candidatePath = resolve(root, "seeds/catalog.uibe-school-program-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.uibe-school-program-batch-01.validation.json");
const reviewPath = resolve(root, "seeds/catalog.uibe-school-program-batch-01.review.json");

const parse = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const source = await parse(sourcePath) as CatalogSeedBundle;
const indexManifest = await parse(indexManifestPath);
const jointManifest = await parse(jointManifestPath);
const indexEvidence = indexManifest.sources?.[0];
const jointEvidence = jointManifest.sources?.[0];

const expectedIndexSha = "b77856a6ce97b5493fba22f07a8faa2248cfb843ff2d01ad9081ee716eaee2f2";
const expectedJointSha = "ba5b9827a856ad10df967b121ed510af186d7460d9b56291f84b0e27aa9aba06";
if (indexEvidence?.id !== "uibe-undergraduate-english-index" || indexEvidence.sha256 !== expectedIndexSha) {
  throw new Error("The refreshed UIBE English program index does not match the reviewed snapshot.");
}
if (jointEvidence?.id !== "uibe-undergraduate-2026" || jointEvidence.sha256 !== expectedJointSha) {
  throw new Error("The refreshed UIBE joint-program page does not match the reviewed snapshot.");
}

const jointSlug = "uibe-international-economic-development-cooperation-polymer-materials-bachelor";
const generalApplicationUrl = "https://sie.uibe.edu.cn/en/AppEnr/ApOn/index.htm";
const jointApplicationUrl = "https://isa.uibe.edu.cn/";
const generatedAt = indexEvidence.fetchedAt as string;

const candidate: CatalogSeedBundle = {
  version: 1,
  generatedAt,
  cities: (source.cities ?? []).map(city => ({
    ...city,
    status: "draft",
    capturedAt: indexEvidence.fetchedAt,
    sourceSha256: expectedIndexSha,
  })),
  schools: (source.schools ?? []).map(school => ({
    ...school,
    status: "draft",
    capturedAt: indexEvidence.fetchedAt,
    sourceSha256: expectedIndexSha,
  })),
  programs: (source.programs ?? []).map(program => {
    const joint = program.slug === jointSlug;
    return {
      ...program,
      status: "draft" as const,
      applicationUrl: joint ? jointApplicationUrl : generalApplicationUrl,
      capturedAt: joint ? jointEvidence.fetchedAt : indexEvidence.fetchedAt,
      sourceSha256: joint ? expectedJointSha : expectedIndexSha,
      sourceFieldLineage: {
        ...(program.sourceFieldLineage ?? {}),
        applicationUrl: joint
          ? "explicit: Apply online and upload all documents; UIBE https://isa.uibe.edu.cn/"
          : "explicit: official navigation link labelled Apply Online",
      },
    };
  }),
  programIntakes: (source.programIntakes ?? []).map(intake => ({
    ...intake,
    capturedAt: jointEvidence.fetchedAt,
    sourceSha256: expectedJointSha,
  })),
  scholarships: [],
};

const validation = createCatalogMigrationValidationReport(candidate);
if (!validation.ok) throw new Error(`UIBE candidate is invalid: ${validation.errors.join(" ")}`);

const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
};
const candidateSensitiveText = canonical(candidate);
const prohibitedValuePatterns = [
  /passport(?:Number)?/i,
  /personalEmail/i,
  /personalPhone/i,
  /cardNumber/i,
  /cvv/i,
  /passwordHash/i,
  /sessionToken/i,
];
if (prohibitedValuePatterns.some(pattern => pattern.test(candidateSensitiveText))) {
  throw new Error("The UIBE candidate contains a prohibited-data marker.");
}

const legacyAliasesToArchive = [
  "university-of-international-business-and-economics-business-administration",
  "university-of-international-business-and-economics-economics",
  "university-of-international-business-and-economics-finance",
  "university-of-international-business-and-economics-international-economics-and-trade",
  "university-of-international-business-and-economics-international-politics",
  "university-of-international-business-and-economics-marketing",
];
const review = {
  version: 1,
  status: "awaiting_user_approval",
  generatedAt,
  scope: {
    schoolSlug: "university-of-international-business-and-economics",
    schoolCount: candidate.schools?.length ?? 0,
    programCount: candidate.programs?.length ?? 0,
    intakeCount: candidate.programIntakes?.length ?? 0,
  },
  snapshotComparison: {
    result: "unchanged",
    indexSha256: expectedIndexSha,
    jointProgramSha256: expectedJointSha,
    comparedWithReviewedCapture: "2026-09-10",
  },
  additions: {
    applicationUrl: {
      generalPrograms: generalApplicationUrl,
      jointProgram: jointApplicationUrl,
      evidence: "Explicit Apply Online links in the registered UIBE official pages.",
    },
  },
  reconciliation: {
    actionAfterApproval: "archive_legacy_duplicate_aliases",
    legacyAliasesToArchive,
    unverifiedChineseTaughtRecordsPreserved: true,
    destructiveDeletion: false,
  },
  sensitiveDataCheck: {
    result: "pass",
    scope: "candidate bundle only",
    note: "No applicant, account, payment, private-file or personal-contact fields are present. Raw official snapshots remain ignored and are not imported.",
  },
  candidateBundleSha256: validation.bundleSha256,
  operationPlanSha256: validation.operationPlanSha256,
};

await writeFile(candidatePath, `${JSON.stringify(candidate, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
await writeFile(validationPath, `${JSON.stringify(validation, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
await writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`, { encoding: "utf8", flag: "wx" });

console.log(JSON.stringify({
  ok: true,
  candidatePath,
  validationPath,
  reviewPath,
  candidateBundleSha256: validation.bundleSha256,
  operationPlanSha256: validation.operationPlanSha256,
  reviewSha256: createHash("sha256").update(JSON.stringify(review)).digest("hex"),
  summary: validation.summary,
  legacyAliasesToArchive: legacyAliasesToArchive.length,
}, null, 2));
