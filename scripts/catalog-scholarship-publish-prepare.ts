import { readFile, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { createReviewedScholarshipPublication } from "../src/server/catalog/scholarship-publication.ts";

const args = process.argv.slice(2);
const options = new Map(args.filter(arg => arg.startsWith("--")).map(arg => {
  const index = arg.indexOf("=");
  if (index < 0) throw new Error(`Option requires a value: ${arg}`);
  return [arg.slice(2, index), arg.slice(index + 1)];
}));
const allowed = new Set(["approved-hash", "review", "approved-at", "output", "approval-record"]);
const unknown = [...options.keys()].filter(key => !allowed.has(key));
if (unknown.length) throw new Error(`Unknown options: ${unknown.join(", ")}`);

const required = (name: string) => {
  const value = options.get(name);
  if (!value) throw new Error(`Missing --${name}=...`);
  return value;
};
const readJson = async (path: string) => JSON.parse(await readFile(resolve(process.cwd(), path), "utf8"));
const outputPath = resolve(process.cwd(), options.get("output") ?? "seeds/catalog.scholarships-rich-batch-01.approved.local.json");
const approvalRecordPath = resolve(process.cwd(), options.get("approval-record") ?? "seeds/catalog.scholarships-rich-batch-01.approval.json");
for (const path of [outputPath, approvalRecordPath]) {
  const relative = path.slice(resolve(process.cwd()).length + 1).replaceAll("\\", "/");
  if (!relative.startsWith("seeds/") || relative.includes("../")) throw new Error("Publication artifacts must stay inside the seeds directory.");
}

const approvedHash = required("approved-hash");
const reviewReference = required("review");
const approvalRecordedAt = required("approved-at");
const publication = createReviewedScholarshipPublication({
  draft: await readJson("seeds/catalog.cscalite-online-20260910.scholarships-rich-batch-01.draft.json"),
  review: await readJson("seeds/catalog.scholarships-rich-batch-01.review.json"),
  storedValidation: await readJson("seeds/catalog.scholarships-rich-batch-01.validation.json"),
  approvedDraftBundleSha256: approvedHash,
  reviewReference,
  approvalRecordedAt,
});

const approvalRecord = {
  version: 1,
  approvedAt: approvalRecordedAt,
  reviewReference,
  reviewedDraft: "seeds/catalog.cscalite-online-20260910.scholarships-rich-batch-01.draft.json",
  approvedDraftBundleSha256: publication.approvedDraftBundleSha256,
  publicationBundle: relative(process.cwd(), outputPath).replaceAll("\\", "/"),
  publicationBundleSha256: publication.report.bundleSha256,
  scholarshipSlugs: publication.scholarshipSlugs,
  sensitiveDataConfirmedExcluded: true,
};
await writeFile(outputPath, `${JSON.stringify(publication.bundle, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
await writeFile(approvalRecordPath, `${JSON.stringify(approvalRecord, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
console.log(JSON.stringify({
  ok: true,
  approvedDraftBundleSha256: publication.approvedDraftBundleSha256,
  publicationBundleSha256: publication.report.bundleSha256,
  summary: publication.report.summary,
  outputPath,
  approvalRecordPath,
}, null, 2));
