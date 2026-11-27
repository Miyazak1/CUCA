import fs from "node:fs/promises";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {catalogFacts} from './lib/catalog-translation-validation.mjs';
import {loadCatalogTranslationInventory,loadCatalogTranslationOverrides} from './lib/catalog-translation-inventory.mjs';
const locale=process.argv.find(arg=>arg.startsWith("--locale="))?.split("=")[1]||"vi";
assert.ok(["vi","th","id","ms","ar"].includes(locale));
const normalize=s=>String(s).normalize("NFC").replace(/\s+/g," ").trim();
const inventory=await loadCatalogTranslationInventory();
const rows=inventory.filter(row=>!row.fields.every(field=>field.startsWith("ui.")));
const candidate=JSON.parse(await fs.readFile(`.tmp/catalog-translations/${locale}.json`,"utf8"));
const overrides=await loadCatalogTranslationOverrides();
for(const row of overrides)candidate[normalize(row[0])]=row[["en","vi","th","id","ms","ar"].indexOf(locale)];
const facts=catalogFacts;
const missing=[],factFailures=[],untranslatedProse=[],chineseResiduals=[];let protectedFacts=0;
for(const row of rows){
 const source=normalize(row.text),translation=candidate[source];
 if(!translation){missing.push(source);continue;}
 assert.ok(!/91357\d{4}|98271\d{4}|ZXQ\d{4}QXZ/.test(translation),"Unrestored authoring token");
 const available=facts(translation);for(const fact of facts(source)){protectedFacts++;const i=available.indexOf(fact);if(i<0)factFailures.push({source,fact});else available.splice(i,1);}
 if(source===translation&&source.split(/\s+/).length>=8&&!source.includes("(cid:"))untranslatedProse.push(source);
 if(/\p{Script=Han}/u.test(translation))chineseResiduals.push({source,translation});
}
const summary={date:new Date().toISOString(),locale,sourceCount:rows.length,translated:rows.length-missing.length,missing:missing.length,protectedFacts,factFailures:factFailures.length,untranslatedProse:untranslatedProse.length,chineseResiduals:chineseResiduals.length,sourceQualityExceptions:rows.filter(r=>r.text.includes("(cid:")).map(r=>({source:r.text,ids:r.sampleIds,displayRepair:"Registered AHU PDF page 2, printed major row 79, Artificial Intelligence; exact display alias only."})),runtimeExternalService:false,provider:"Offline machine reference translations; reviewed overrides and source repairs",passed:missing.length===0&&factFailures.length===0&&untranslatedProse.length===0&&chineseResiduals.length===0};
await fs.writeFile(`output/feedback-20261112/catalog-content-${locale}-coverage.json`,JSON.stringify({...summary,missingSources:missing,factFailureDetails:factFailures,unchangedProse:untranslatedProse,chineseResidualDetails:chineseResiduals},null,2));
console.log(JSON.stringify(summary));assert.equal(summary.passed,true,"Candidate translations require review");
if(process.argv.includes("--publish-local")){
 const output=Object.fromEntries(Object.entries(candidate).sort(([a],[b])=>a.localeCompare(b)));
 await fs.writeFile(`public/catalog-content-${locale}.json`,JSON.stringify(output));
 let manifest={schemaVersion:1,sourceHash:createHash("sha256").update(JSON.stringify(rows.map(r=>normalize(r.text)).sort())).digest("hex"),sourceCount:rows.length,locales:{}};
 try{const old=JSON.parse(await fs.readFile("public/catalog-content-manifest.json","utf8"));if(old.sourceHash===manifest.sourceHash)manifest=old;}catch{ /* No reusable manifest; create a new coverage snapshot. */ }
 manifest.locales[locale]={ready:true,sourceCount:rows.length,sha256:createHash("sha256").update(JSON.stringify(output)).digest("hex"),validation:"Required source numbers, exam labels and URLs retained; no unchanged long prose",referenceTranslation:true};
 await fs.writeFile("public/catalog-content-manifest.json",JSON.stringify(manifest,null,2));
 const file="config/public-release-assets.json",release=JSON.parse(await fs.readFile(file,"utf8"));release.files=[...new Set([...release.files,"catalog-content-i18n.js","catalog-content-manifest.json",`catalog-content-${locale}.json`])].sort((a,b)=>a.localeCompare(b));await fs.writeFile(file,JSON.stringify(release,null,2)+"\n");
}
