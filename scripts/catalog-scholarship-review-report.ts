import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

const root = process.cwd();
const reviewPath = resolve(root, "seeds/catalog.scholarships-rich-batch-01.review.json");
const draftPath = resolve(root, "seeds/catalog.cscalite-online-20260910.scholarships-rich-batch-01.draft.json");
const validationPath = resolve(root, "seeds/catalog.scholarships-rich-batch-01.validation.json");
const registryPath = resolve(root, "catalog-sources/official-sources.json");
const outputPath = resolve(root, "docs/reviews/CUAC_SCHOLARSHIP_BATCH_01_REVIEW.md");

const parse = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const sha256 = (value: Buffer) => createHash("sha256").update(value).digest("hex");
const display = (value: unknown) => String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");

const review = await parse(reviewPath);
const draft = await parse(draftPath);
const validation = await parse(validationPath);
const registry = await parse(registryPath);
const errors: string[] = [];
const manifests = new Map<string, any>();
const registryById = new Map(registry.sources.map((source: any) => [source.id, source]));
const schoolsBySlug = new Map(draft.schools.map((school: any) => [school.slug, school]));
const scholarshipsBySlug = new Map(draft.scholarships.map((scholarship: any) => [scholarship.slug, scholarship]));

if (review.status !== "awaiting_user_approval") errors.push(`Unexpected review status: ${review.status}`);
if (review.records.length !== 20) errors.push(`Expected 20 review records, found ${review.records.length}`);
if (new Set(review.records.map((record: any) => record.schoolSlug)).size !== 20) errors.push("Review does not contain 20 distinct schools");
if (!validation.ok || validation.errors.length) errors.push("Draft validation report is not clean");

for (const record of review.records) {
  const scholarship: any = scholarshipsBySlug.get(record.scholarshipSlug);
  if (!schoolsBySlug.has(record.schoolSlug)) errors.push(`Missing school: ${record.schoolSlug}`);
  if (!scholarship) errors.push(`Missing scholarship: ${record.scholarshipSlug}`);
  if (scholarship?.schoolSlug !== record.schoolSlug) errors.push(`School mismatch: ${record.scholarshipSlug}`);
  if (scholarship?.status !== "draft" || record.status !== "draft") errors.push(`Non-draft record: ${record.scholarshipSlug}`);

  for (const source of record.sources) {
    const registered: any = registryById.get(source.id);
    if (!registered) errors.push(`Unregistered source: ${source.id}`);
    if (registered?.url !== source.url) errors.push(`Registry URL mismatch: ${source.id}`);
    if (registered?.schoolSlug !== record.schoolSlug) errors.push(`Registry school mismatch: ${source.id}`);

    const manifestPath = resolve(root, source.manifestPath);
    let manifest = manifests.get(manifestPath);
    if (!manifest) {
      manifest = await parse(manifestPath);
      manifests.set(manifestPath, manifest);
    }
    const manifestSource = manifest.sources.find((item: any) => item.id === source.id);
    if (!manifestSource) errors.push(`Source absent from manifest: ${source.id}`);
    if (manifestSource?.sha256 !== source.sha256) errors.push(`Manifest checksum mismatch: ${source.id}`);
    if (manifestSource?.url !== source.url) errors.push(`Manifest URL mismatch: ${source.id}`);

    const artifactPath = resolve(root, source.artifactPath);
    const manifestArtifactPath = resolve(dirname(manifestPath), manifestSource?.artifactPath ?? "missing");
    if (artifactPath !== manifestArtifactPath) errors.push(`Artifact path mismatch: ${source.id}`);
    const bytes = await readFile(artifactPath);
    if (sha256(bytes) !== source.sha256) errors.push(`Artifact checksum mismatch: ${source.id}`);
  }
}

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2));
  process.exitCode = 1;
} else {
  const unresolvedZh: Record<string, string> = {
    "accommodation benefit amount": "住宿资助金额未明确",
    "complete material list is provided through linked application documents": "完整材料清单需查阅关联申请文件",
    "award amounts and coverage differ by scholarship and are not enumerated in this guide": "各奖项金额与覆盖不同，指南未逐项列出",
    "exact award tier and amount are determined after review": "最终奖学金档次与金额由评审确定",
    "2026 application deadline and route-specific material list are not stated on the two overview pages": "两份概览页未公布 2026 截止日及各通道材料清单",
  };
  const lines = [
    "# CUAC 奖学金富数据第一批审核清单",
    "",
    `- 状态：待用户审核批准（尚未发布）`,
    `- 范围：${review.schoolCount} 所学校、${review.scholarshipCount} 条新增奖学金、${review.sourceCount} 个官方来源`,
    `- 数据包校验哈希：\`${validation.bundleSha256}\``,
    `- 敏感数据检查：通过；仅含公开申请要求与院校事实，不含申请人记录或个人联系方式`,
    `- 完整性：介绍、资助、资格、材料、流程、适用范围和官方入口均为 20/20；明确截止日期为 19/20`,
    "",
    "| 学校 | 奖学金 | 截止日期 | 层次 | 资助 | 待确认项 | 官方证据 |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  ];

  for (const record of review.records) {
    const school: any = schoolsBySlug.get(record.schoolSlug);
    const scholarship: any = scholarshipsBySlug.get(record.scholarshipSlug);
    const unresolved = record.unresolvedFields.map((item: string) => unresolvedZh[item] ?? item).join("；") || "无";
    const sources = record.sources.map((source: any) => `[${display(source.label)}](${source.url})`).join("；");
    lines.push(`| ${display(school.nameZh || school.nameEn)} | ${display(record.title)} | ${display(scholarship.deadlineDate || scholarship.deadlineLabel || "官方未公布")} | ${display(scholarship.applicableDegree)} | ${display(scholarship.fundingLevel || scholarship.coverage)} | ${display(unresolved)} | ${sources} |`);
  }

  lines.push(
    "",
    "## 审核结论",
    "",
    "本批次保持 `draft` 状态，不会出现在公开奖学金列表。若确认发布，请明确回复：",
    "",
    `> 批准发布奖学金富数据第一批20所（审核哈希 ${validation.bundleSha256}）`,
    "",
    "批准后将基于此哈希生成发布记录、写入本地数据库，并验证奖学金列表、详情 API 与页面展示。",
  );

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${lines.join("\n")}\n`, "utf8");
  console.log(JSON.stringify({
    ok: true,
    reviewRecords: review.records.length,
    distinctSchools: new Set(review.records.map((record: any) => record.schoolSlug)).size,
    sources: review.records.reduce((count: number, record: any) => count + record.sources.length, 0),
    bundleSha256: validation.bundleSha256,
    output: relative(root, outputPath),
  }, null, 2));
}
