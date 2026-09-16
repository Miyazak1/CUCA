import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { createCatalogMigrationValidationReport, type CatalogSeedBundle } from "../src/server/catalog/seed-contract.ts";

const sha=(v:string)=>createHash("sha256").update(v).digest("hex");
const htmlManifestText=await readFile("work/catalog-official/blcu-school-programs-batch-01/manifest.json","utf8");
const pdfManifestText=await readFile("work/catalog-official/blcu-school-programs-attachments-batch-01/manifest.json","utf8");
const base=JSON.parse(await readFile("seeds/catalog.scholarships-rich-batch-01.approved-verified.local.json","utf8"));
const hm=JSON.parse(htmlManifestText),pm=JSON.parse(pdfManifestText);
const pdf=pm.sources.find((x:any)=>x.id==="blcu-graduate-programs-pdf-2026"),requirements=hm.sources.find((x:any)=>x.id==="blcu-graduate-entry-requirements-current");
if(pdf?.sha256!=="9c6ab72ff83e883f151475e74a55f61b0066f7ff58a5175951a582c062a3d237"||pdf?.contentType!=="application/pdf"||requirements?.sha256!=="ef75e4913a3aa08a07383a529622be9dd19ccc5745cfa0adeb7312667a487695")throw new Error("BLCU evidence mismatch");
const schoolSlug="beijing-language-and-culture-university",slugify=(v:string)=>v.toLowerCase().replace(/&/g," and ").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
type R={en:string;zh:string;school:string;years:number;hsk:string;english?:string};
const rows:R[]=[
 ["International Chinese Language Education","国际中文教育","International Chinese College",2,"HSK Level 5, 180 or above"],
 ["English Written Translation","英语笔译","International Chinese College",2,"HSK Level 5, 180 or above; other language at native or C1 level","Native/C1 level in the translation language"],
 ["Japanese Written Translation","日语笔译","International Chinese College",2,"HSK Level 5, 180 or above; other language at native or C1 level","Native/C1 level in the translation language"],
 ["Korean Written Translation","朝鲜语笔译","International Chinese College",2,"HSK Level 5, 180 or above; other language at native or C1 level","Native/C1 level in the translation language"],
 ["Russian Written Translation","俄语笔译","International Chinese College",2,"HSK Level 5, 180 or above; other language at native or C1 level","Native/C1 level in the translation language"],
 ["Arabic Written Translation","阿拉伯语笔译","International Chinese College",2,"HSK Level 5, 180 or above; other language at native or C1 level","Native/C1 level in the translation language"],
 ["Linguistics and Applied Linguistics","语言学及应用语言学","School of Chinese Studies and China Studies",3,"HSK Level 5, 210 or above; each section at least 60"],
 ["World Sinology and China Studies","世界汉学与中国学","School of Chinese Studies and China Studies",2,"HSK Level 5, 180 or above"],
 ["English Language and Literature","英语语言文学","School of English and Advanced Translation",3,"HSK Level 5, 180 or above; each section at least 60","IELTS 6.5, TOEFL 100, or native English"],
 ["Foreign Linguistics and Applied Linguistics","外国语言学及应用语言学","School of English and Advanced Translation",3,"HSK Level 5, 180 or above; each section at least 60","IELTS 6.5, TOEFL 100, or native English"],
 ["International Language Services","国际语言服务","School of English and Advanced Translation",3,"HSK Level 5, 180 or above"],
 ["Russian Language and Literature","俄语语言文学","School of Foreign Languages and Cultures",3,"HSK Level 5, 180 or above; each section at least 60","TORFL Level 2 or native Russian"],
 ["French Language and Literature","法语语言文学","School of Foreign Languages and Cultures",3,"HSK Level 5, 180 or above; each section at least 60","French C1 or native French"],
 ["German Language and Literature","德语语言文学","School of Foreign Languages and Cultures",3,"HSK Level 5, 180 or above; each section at least 60","German B2 or above, or native German"],
 ["Japanese Language and Literature","日语语言文学","School of Foreign Languages and Cultures",3,"HSK Level 5, 180 or above; each section at least 60","JLPT N1 or native Japanese"],
 ["Spanish Language and Literature","西班牙语语言文学","School of Foreign Languages and Cultures",3,"HSK Level 5, 180 or above; each section at least 60","DELE C1 or native Spanish"],
 ["Arabic Language and Literature","阿拉伯语语言文学","School of Foreign Languages and Cultures",3,"HSK Level 5, 180 or above","BLCU subject examination and interview"],
 ["European Languages and Literatures","欧洲语言文学","School of Foreign Languages and Cultures",3,"HSK Level 5, 180 or above; each section at least 60","Italian C1 or native Italian"],
 ["Asian and African Languages and Literatures","亚非语言文学","School of Foreign Languages and Cultures",3,"HSK Level 5, 180 or above; each section at least 60","TOPIK Level 5 or native Korean"],
 ["Area and Country Studies","区域国别学","School of Foreign Languages and Cultures",3,"HSK Level 5, 180 or above","IELTS 6.5, TOEFL 90, or native English"],
].map(([en,zh,school,years,hsk,english])=>({en,zh,school,years,hsk,english} as R));
if(rows.length!==20)throw new Error("route count");
const programs=rows.map(r=>({slug:`${schoolSlug}-master-${slugify(r.en)}-chinese-2026`,schoolSlug,citySlug:"beijing",nameEn:r.en,nameZh:r.zh,degreeLevel:"Master",durationYears:r.years,fieldCategory:r.school,subjectArea:r.school,teachingLanguage:"Chinese",hskRequirement:r.hsk,...(r.english?{englishRequirement:r.english}:{}),tuitionAmount:30000,tuitionCurrency:"RMB",tuitionPeriod:"year",tuitionText:"CNY 30,000 per academic year",applicationUrl:"https://apply.blcu.edu.cn",applicationNote:"Official BLCU 2026 Chinese-taught master's route; route-specific interview or examination may apply.",status:"draft",sourceUrl:pdf.url,sourceLabel:pdf.label,sourceSha256:pdf.sha256,capturedAt:pdf.fetchedAt,sourceFieldLineage:{nameZh:"2026 graduate catalog PDF page 1",nameEn:"editorial English translation of the official Chinese program title",degreeLevel:"2026 graduate catalog PDF page 1 heading",durationYears:"2026 graduate catalog PDF page 1 program group",teachingLanguage:"2026 graduate catalog PDF page 1 heading",tuitionAmount:"2026 graduate catalog PDF page 1",hskRequirement:`maintained graduate entry requirement table, row ${r.zh}（硕士）`,applicationUrl:"2026 graduate catalog PDF page 2"}}));
const candidate:CatalogSeedBundle={version:1,generatedAt:pm.generatedAt,cities:[base.cities.find((x:any)=>x.slug==="beijing")],schools:[base.schools.find((x:any)=>x.slug===schoolSlug)],programs,programIntakes:programs.map(p=>({programSlug:p.slug,intakeTerm:"Fall",intakeYear:2026,deadlineDate:"2026-07-30T00:00:00.000Z",deadlineLabel:"July 30, 2026",applicationRound:"2026 international graduate admissions",status:"closed",sourceUrl:pdf.url,sourceLabel:pdf.label,sourceSha256:pdf.sha256,capturedAt:pdf.fetchedAt,sourceFieldLineage:{deadlineDate:"2026 graduate catalog PDF page 2"}})),scholarships:[]};
const text=JSON.stringify(candidate,null,2)+"\n",validation=createCatalogMigrationValidationReport(candidate);if(!validation.ok)throw new Error(validation.errors.join("\n"));
await Promise.all([writeFile("seeds/catalog.blcu-graduate-safe-batch-01.draft.json",text),writeFile("seeds/catalog.blcu-graduate-safe-batch-01.validation.json",JSON.stringify({...validation,candidateSha256:sha(text),sourceManifestSha256:sha(pdfManifestText),requirementsManifestSha256:sha(htmlManifestText)},null,2)+"\n")]);
console.log(JSON.stringify({ok:true,summary:validation.summary,bundleSha256:validation.bundleSha256},null,2));
