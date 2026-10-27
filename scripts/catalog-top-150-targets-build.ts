import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import type { CatalogSeedBundle, CatalogSeedSchool } from "../src/server/catalog/seed-contract.ts";

type RankingRow = {
  univUp: string;
  univNameCn: string;
  univNameEn: string;
  univCategory: string;
  province: string;
  score: number;
  ranking: string;
  rankOverall: string;
};

type RankingPayload = {
  data: Array<{
    year: number;
    rankId: number;
    title: string;
    univData: RankingRow[];
  }>;
};

type SchoolOccurrence = CatalogSeedSchool & { sourcePath: string; reviewedRelease: boolean };

const root = process.cwd();
const payloadPath = resolve(root, "work/ranking-targets/shanghairanking-bcur-2026-payload.js");
const payloadBytes = await readFile(payloadPath);
const payloadSha256 = createHash("sha256").update(payloadBytes).digest("hex");
let payload: RankingPayload | undefined;
runInNewContext(payloadBytes.toString("utf8"), {
  __NUXT_JSONP__: (_route: string, data: RankingPayload) => {
    payload = data;
  },
});
const ranking = payload?.data?.[0];
if (!ranking || ranking.year !== 2026 || ranking.rankId !== 11 || ranking.univData.length !== 590) {
  throw new Error("Unexpected 2026 ShanghaiRanking BCUR main-list payload.");
}

const seedNames = await readdir(resolve(root, "seeds"));
const seedPaths = [
  "seeds/catalog.reviewed-100-official-release.json",
  ...seedNames
    .filter((name) => /^catalog\.2027-wave-\d+\.draft\.json$/.test(name))
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }))
    .map((name) => `seeds/${name}`),
];
const occurrences: SchoolOccurrence[] = [];
const inputGeneratedAt: string[] = [];
for (const sourcePath of seedPaths) {
  const bundle = JSON.parse(await readFile(resolve(root, sourcePath), "utf8")) as CatalogSeedBundle;
  if (bundle.generatedAt) inputGeneratedAt.push(bundle.generatedAt);
  for (const school of bundle.schools ?? []) {
    occurrences.push({ ...school, sourcePath, reviewedRelease: sourcePath.endsWith("catalog.reviewed-100-official-release.json") });
  }
}

const normalize = (value: string | undefined) => String(value ?? "")
  .toLowerCase()
  .replace(/[^a-z0-9\u4e00-\u9fff]/g, "")
  .replace(/universityof/g, "");

const targetRows = ranking.univData.slice(0, 150).map((row, index) => {
  const matches = occurrences.filter((school) =>
    normalize(school.nameEn) === normalize(row.univNameEn)
    || normalize(school.nameZh) === normalize(row.univNameCn)
    || normalize(school.slug) === normalize(row.univUp));
  const catalogSchoolSlug = matches[0]?.slug;
  const sourcePaths = Array.from(new Set(matches.map((match) => match.sourcePath)));
  const inReviewedRelease = matches.some((match) => match.reviewedRelease);
  const candidateWavePaths = sourcePaths.filter((sourcePath) => !sourcePath.endsWith("catalog.reviewed-100-official-release.json"));
  return {
    targetPosition: index + 1,
    publishedRank: row.ranking,
    rankingSlug: row.univUp,
    nameZh: row.univNameCn,
    nameEn: row.univNameEn,
    province: row.province,
    category: row.univCategory,
    score: row.score,
    catalogSchoolSlug: catalogSchoolSlug ?? null,
    coverage: {
      inReviewedRelease,
      candidateWavePaths,
      status: inReviewedRelease ? "reviewed_release" : candidateWavePaths.length > 0 ? "unreviewed_candidate" : "missing",
    },
  };
});

const counts = {
  targetSchools: targetRows.length,
  reviewedRelease: targetRows.filter((row) => row.coverage.status === "reviewed_release").length,
  unreviewedCandidates: targetRows.filter((row) => row.coverage.status === "unreviewed_candidate").length,
  coveredIncludingCandidates: targetRows.filter((row) => row.coverage.status !== "missing").length,
  missing: targetRows.filter((row) => row.coverage.status === "missing").length,
};
if (counts.targetSchools !== 150 || counts.coveredIncludingCandidates + counts.missing !== 150) {
  throw new Error(`Invalid top-150 coverage counts: ${JSON.stringify(counts)}.`);
}

const output = {
  version: 1,
  status: "active_expansion_target",
  generatedAt: inputGeneratedAt.sort().at(-1) ?? "2026-10-26T00:00:00.000Z",
  rankingBasis: {
    publisher: "ShanghaiRanking",
    edition: "2026 Best Chinese Universities Ranking",
    list: "BCUR main list",
    rankId: 11,
    sourceUrl: "https://www.shanghairanking.cn/rankings/bcur/2026",
    payloadUrl: "https://www.shanghairanking.cn/_nuxt/static/1792567042/rankings/bcur/2026/payload.js",
    payloadSha256,
    selectionRule: "First 150 institutions in the publisher's ordered 2026 BCUR main list. Tied ranks retain publisher order; positions 149-150 are the two institutions tied at published rank 149.",
  },
  policy: {
    rankingUsedForTargetSelectionOnly: true,
    admissionsFactsRequireOfficialUniversitySources: true,
    missing2027FieldsRemainAbsent: true,
    publicationAuthorized: false,
    databaseWriteAuthorized: false,
  },
  counts,
  schools: targetRows,
};

const outputPath = resolve(root, "catalog-sources/china-top-150-targets.2026.json");
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outputPath, payloadSha256, counts }, null, 2));
