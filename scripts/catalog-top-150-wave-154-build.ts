import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

type Source = { id:string; label:string; url:string; finalUrl?:string; fetchedAt:string; status:number; contentType:string; sha256:string; artifactPath:string };
const root = process.cwd();
const run = "2026-10-26T08-58-14-466Z";
const locks = [
  ["scau-university-home-current", "971def0559b4fb21a26bbf4d2b676455fd157bea25ec64f0439f1ee2d848454c"],
  ["scau-international-education-home-current", "c2061264bd4dee035176e52ada02dea7303c36d0a563e8017c3a2f10dcdfc142"],
  ["scau-international-application-procedure-current", "90b00e7f410f66c3f8eac8e36e3d5fb0360ab1c2141858aaf35f64fd69d6fe06"],
  ["scau-international-student-profile-current", "dd627ea18579a61159a360a02a0e7a36b0a9a6c60ad437f05d169c80ed2c96d6"],
  ["scau-international-funding-costs-current", "05f110f3a9597e8458a306b1af2d0355e73af666de0a556e0f98ccecad26318d"],
] as const;
const directory = resolve(root, "work/catalog-official", run);
const manifest = JSON.parse(await readFile(resolve(directory, "manifest.json"), "utf8")) as { sources:Source[] };
const sources = new Map<string, Source>();
for (const [id, sha256] of locks) {
  const source = manifest.sources.find((item) => item.id === id && item.status === 200 && item.sha256 === sha256);
  if (!source) throw new Error(`Missing locked SCAU source: ${id}`);
  if (createHash("sha256").update(await readFile(resolve(directory, source.artifactPath))).digest("hex") !== sha256) throw new Error(`SCAU evidence hash mismatch: ${id}`);
  sources.set(id, source);
}
const primary = sources.get("scau-international-application-procedure-current")!;
const sf = { sourceUrl:primary.finalUrl ?? primary.url, sourceLabel:primary.label, sourceSha256:primary.sha256, capturedAt:primary.fetchedAt };
const base = JSON.parse(await readFile(resolve(root, "seeds/catalog.reviewed-100-official-release.json"), "utf8")) as CatalogSeedBundle;
const city = base.cities?.find((item) => item.slug === "guangzhou");
if (!city) throw new Error("Reviewed Guangzhou dependency missing");

const school = {
  slug:"south-china-agricultural-university",
  nameEn:"South China Agricultural University",
  nameZh:"华南农业大学",
  citySlug:"guangzhou",
  schoolType:"Agriculture-focused comprehensive university",
  region:"Guangzhou, Guangdong, South China",
  applicationLevel:"Bachelor, Master, Doctoral, advanced study, general study and Chinese-language international study",
  languageOfInstruction:"Chinese and English, subject to program; the current application page publishes HSK and English thresholds but no route table.",
  deadlineSummary:"The undated current procedure page gives March 1-June 30 for self-funded applications and January 1-March 31 for the university-handled Chinese Government Scholarship route. These dates are not assigned to 2027 without a cycle label.",
  tuitionSummary:"Not published in the locked current sources.",
  websiteUrl:"https://www.scau.edu.cn/",
  admissionsUrl:primary.finalUrl ?? primary.url,
  subjectTags:["Agriculture","Forestry","Veterinary Medicine","Life Sciences","Engineering","Economics and Management"],
  languageTags:["Chinese","English"],
  campusHighlights:["International students across bachelor, postgraduate, doctoral and non-degree categories","Chinese Government Scholarship host institution","Guangdong Government Outstanding International Student Scholarship host institution"],
  status:"active" as const,
  verificationStatus:"verified" as const,
  lastVerifiedAt:primary.fetchedAt,
  ...sf,
  sourceFieldLineage:{
    nameEn:"official university and international-school pages",
    nameZh:"official university page title",
    citySlug:"official international-school address plus reviewed Guangzhou dependency",
    schoolType:"official institutional identity plus CUAC classification",
    region:"official address plus CUAC taxonomy",
    applicationLevel:"official international-student profile",
    languageOfInstruction:"official current application requirements with route-table limitation",
    deadlineSummary:"official current application procedure; missing cycle label disclosed",
    tuitionSummary:"official-source limitation",
    websiteUrl:"official university home",
    admissionsUrl:"official current application procedure",
    subjectTags:"official institutional faculty scope plus CUAC taxonomy",
    languageTags:"official application requirements",
    campusHighlights:"official current international-student profile",
  },
};
const candidate:CatalogSeedBundle = { version:1, generatedAt:primary.fetchedAt, cities:[city], schools:[school], programs:[], programIntakes:[], scholarships:[] };
const text = `${JSON.stringify(candidate, null, 2)}\n`;
const candidateSha256 = createHash("sha256").update(text).digest("hex");
const validation = createCatalogMigrationValidationReport(JSON.parse(text));
if (!validation.ok) throw new Error(validation.errors.join("\n"));
const evidence = locks.map(([id]) => { const item=sources.get(id)!; return { id:item.id, label:item.label, url:item.finalUrl ?? item.url, contentType:item.contentType, fetchedAt:item.fetchedAt, sha256:item.sha256 }; });
const review = {
  version:1,
  status:"unreviewed_draft",
  generatedAt:primary.fetchedAt,
  candidateSha256,
  publicationAuthorized:false,
  databaseWriteAuthorized:false,
  scope:{ target:"2026 ShanghaiRanking BCUR top 150", targetPosition:103, schoolSlugs:[school.slug], newSchools:1, programs:0, programIntakes:0, scholarships:0 },
  evidence,
  unresolved:[
    "No explicit inbound international 2027 guide, program catalog, fee schedule or cycle-labeled deadline was found in the locked current sources.",
    "The generic March-June self-funded window is retained only in the school summary and is not converted into a 2027 intake.",
    "The current funding page contains historical 2024 markers. Scholarship categories are therefore kept at institutional-context level and no current award record is inferred.",
    "The linked application system is HTTP-only, so it is not written into HTTPS-only application URL fields.",
  ],
  sensitiveDataCheck:{ result:"pass", note:"Named contacts, telephone/email details and applicant personal-document contents are excluded. No applicant data is present." },
};
const stem=resolve(root,"seeds/catalog.2027-wave-154");
await Promise.all([
  writeFile(`${stem}.draft.json`,text,"utf8"),
  writeFile(`${stem}.validation.json`,`${JSON.stringify({...validation,candidateSha256,publicationAuthorized:false,databaseWriteAuthorized:false},null,2)}\n`,"utf8"),
  writeFile(`${stem}.review.json`,`${JSON.stringify(review,null,2)}\n`,"utf8"),
]);
console.log(JSON.stringify({ok:true,wave:154,candidateSha256,counts:validation.summary,publicationAuthorized:false,databaseWriteAuthorized:false},null,2));
