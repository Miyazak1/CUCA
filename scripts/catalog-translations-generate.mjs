import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {ProxyAgent} from "undici";
import {CATALOG_FACT_PATTERN,missingCatalogFacts} from './lib/catalog-translation-validation.mjs';
import {catalogTranslationRetryDelay,catalogTranslationResumeState} from './lib/catalog-translation-retry.mjs';
import {loadCatalogTranslationInventory,loadCatalogTranslationOverrides} from './lib/catalog-translation-inventory.mjs';

// Offline authoring only. The website never calls this public translation service.
// Input is the published catalog inventory, never users or application materials.
const source=await loadCatalogTranslationInventory();
const probe=process.argv.includes("--probe");
const maxNew=Number(process.argv.find(arg=>arg.startsWith("--max-new="))?.split("=")[1])||Infinity;
const waitOnRateLimit=process.argv.includes("--wait-on-rate-limit");
const locales=process.env.CUAC_TRANSLATION_LOCALES?.split(",")||["vi","th","id","ms","ar"];
assert.ok(locales.every(locale=>["vi","th","id","ms","ar"].includes(locale)),"Unsupported catalog translation locale");
const normalize=s=>String(s).normalize("NFC").replace(/\s+/g," ").trim();
const texts=[...new Set((probe?source.filter(r=>r.fields.some(f=>/englishRequirement|applicationNote/.test(f))).slice(0,12):source).map(r=>normalize(r.text)))];
const dir=".tmp/catalog-translations";await fs.mkdir(dir,{recursive:true});
const overrides=await loadCatalogTranslationOverrides();
let proxy=process.env.HTTPS_PROXY||process.env.HTTP_PROXY;
if(proxy&&!/^https?:/.test(proxy))proxy="http://"+proxy;
const dispatcher=proxy?new ProxyAgent(proxy):undefined;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let nextRequestAt=0;
let requestInterval=Math.max(1100,Number(process.env.CUAC_TRANSLATION_REQUEST_INTERVAL_MS)||1100);
const factPattern=CATALOG_FACT_PATTERN;
function protect(text){const facts=[];const protectedText=text.replace(factPattern,match=>{const token=`[91357${String(facts.length).padStart(4,"0")}]`;facts.push(match);return token;});return {protectedText,facts};}
function restore(text,facts){
 const matches=[...text.matchAll(/\[\s*91357(\d{4})\s*\]/g)].map(m=>Number(m[1]));
 assert.equal(matches.length,facts.length,"A source fact was omitted or duplicated");
 assert.equal(new Set(matches).size,facts.length,"Source fact duplication");
 assert.ok(matches.every(n=>n<facts.length),"Unexpected source fact");
 return text.replace(/\[\s*91357(\d{4})\s*\]/g,(_,n)=>facts[Number(n)]).trim();
}
async function request(text,locale){
 const wait=Math.max(0,nextRequestAt-Date.now());nextRequestAt=Math.max(Date.now(),nextRequestAt)+requestInterval;if(wait)await sleep(wait);
 const u=new URL("https://translate.googleapis.com/translate_a/single");for(const[k,v]of Object.entries({client:"gtx",sl:"auto",tl:locale,dt:"t",q:text}))u.searchParams.set(k,v);
 const r=await fetch(u,{dispatcher,signal:AbortSignal.timeout(30000)});
 if(r.status===429){const error=new Error("Translation service rate limit"),header=r.headers.get("retry-after");error.retryAfter=Math.max(60,Number(header)||Math.ceil((Date.parse(header)-Date.now())/1000)||60);await r.body?.cancel();throw error;}
 if(!r.ok){await r.body?.cancel();throw new Error(`Translation HTTP ${r.status}`);}
 const j=await r.json();assert.ok(Array.isArray(j[0]));return j[0].map(row=>row[0]||"").join("");
}
let stopped=false;
const missingByLocale={};
for(const locale of locales){
 const file=path.join(dir,`${locale}${probe?"-probe":""}.json`);let dictionary={};
 try{dictionary=JSON.parse(await fs.readFile(file,"utf8"));}catch(error){if(error.code!=="ENOENT")throw error;}
 const statusFile=path.join(dir,`${locale}-status.json`);let previousStatus=null;
 if(waitOnRateLimit&&!probe)try{previousStatus=JSON.parse(await fs.readFile(statusFile,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
 const resumed=waitOnRateLimit?catalogTranslationResumeState(previousStatus):null;
 let rateLimitStreak=resumed?.retry||0,statusCheckpoint=Promise.resolve();
 const saveStatus=value=>{statusCheckpoint=statusCheckpoint.then(async()=>{await fs.writeFile(statusFile+'.next',JSON.stringify(value,null,2));await fs.rename(statusFile+'.next',statusFile);});return statusCheckpoint;};
 const languageIndex=["en","vi","th","id","ms","ar"].indexOf(locale);
 // Old English-only coverage could leave Chinese clauses in an otherwise
 // translated sentence. Such candidates must be regenerated or reviewed.
 for(const [source,translation]of Object.entries(dictionary))if(/\p{Script=Han}/u.test(translation))delete dictionary[source];
 for(const row of overrides)dictionary[normalize(row[0])]=row[languageIndex];
 // PDF character IDs are opaque source data, not translatable prose. Retain
 // them exactly and report the source-quality exception in the final audit.
 for(const text of texts.filter(t=>t.includes("(cid:")))dictionary[text]=text;
 await fs.writeFile(file+'.next',JSON.stringify(dictionary));await fs.rename(file+'.next',file);
 const pending=texts.filter(text=>!dictionary[text]).slice(0,maxNew);const batches=[];
 if(resumed&&pending.length){
  nextRequestAt=Math.max(nextRequestAt,resumed.notBefore);requestInterval=Math.max(requestInterval,60000);
  await saveStatus({...previousStatus,resumeAt:new Date(resumed.notBefore).toISOString(),requestIntervalMs:requestInterval,retainedEntries:Object.keys(dictionary).length,remaining:texts.filter(text=>!dictionary[text]).length});
  console.log(`${locale}: resumed retry ${rateLimitStreak}; next request not before ${new Date(nextRequestAt).toISOString()}; checkpoints retained`);
 }
 // Mixed-language requests can make source-language detection leave Chinese
 // clauses untouched and repeatedly split otherwise valid English batches.
 // Keep those inputs separate without changing rate limits or fact checks.
 for(const group of [pending.filter(text=>! /\p{Script=Han}/u.test(text)),pending.filter(text=>/\p{Script=Han}/u.test(text))]){
  let batch=[],size=0;
  for(const text of group){const p=protect(text),cost=p.protectedText.length+24;if(size+cost>3300&&batch.length){batches.push(batch);batch=[];size=0;}batch.push({source:text,...p});size+=cost;}
  if(batch.length)batches.push(batch);
 }
 let checkpoint=Promise.resolve();
 await Promise.all(Array.from({length:waitOnRateLimit?1:Math.min(2,Math.max(1,Number(process.env.CUAC_TRANSLATION_CONCURRENCY)||2))},async()=>{while(batches.length&&!stopped){
  const items=batches.shift();
  try{
   const input=items.map((item,i)=>`[98271${String(i).padStart(4,"0")}]\n${item.protectedText}`).join("\n\n");
   const translated=(await request(input,locale)).replace(/[\u061c\u200e\u200f\u2066-\u2069]/g,"").replace(/[\u0660-\u0669\u06f0-\u06f9]/g,c=>String(c.charCodeAt(0)-(c<="\u0669"?0x660:0x6f0)));
   rateLimitStreak=0;
   const parts=[...translated.matchAll(/\[\s*98271(\d{4})\s*\]\s*([\s\S]*?)(?=\[\s*98271\d{4}\s*\]|$)/g)];
   if(parts.length!==items.length){await fs.writeFile(path.join(dir,`${locale}-failed-boundaries.txt`),translated);throw new Error("Translation row boundaries were changed");}
   const results=parts.map((m,i)=>{
    assert.equal(Number(m[1]),i);const result=restore(m[2],items[i].facts),original=items[i].source;
    assert.ok(!/\p{Script=Han}/u.test(result),'Untranslated Chinese remains');
    assert.deepEqual(missingCatalogFacts(original,result),[],'Source facts changed after token restoration');
    assert.ok(result!==original||original.split(/\s+/).length<8||original.includes('(cid:'),'Untranslated source prose remains');
    return result;
   });
   for(let i=0;i<items.length;i++)dictionary[items[i].source]=results[i];
   // One JS isolate serializes checkpoints; all current successful batches are retained.
   checkpoint=checkpoint.then(async()=>{await fs.writeFile(file+".next",JSON.stringify(dictionary));await fs.rename(file+".next",file);});await checkpoint;
   await saveStatus({state:'translating',updatedAt:new Date().toISOString(),requestIntervalMs:requestInterval,retainedEntries:Object.keys(dictionary).length,remaining:texts.filter(text=>!dictionary[text]).length});
   console.log(`${locale}: ${Object.keys(dictionary).length}/${texts.length}; remaining batches=${batches.length}`);
   await sleep(250);
  }catch(error){
   if(/rate limit/.test(error.message)){
    rateLimitStreak++;
    if(rateLimitStreak>3&&!waitOnRateLimit){stopped=true;console.log(`${locale}: rate limit persists; checkpoints retained`);}
    else{
     const pause=catalogTranslationRetryDelay(rateLimitStreak,error.retryAfter,waitOnRateLimit);
     if(waitOnRateLimit)requestInterval=Math.max(requestInterval,60000);
     nextRequestAt=Math.max(nextRequestAt,Date.now()+pause);
     await saveStatus({state:'rate-limited',updatedAt:new Date().toISOString(),resumeAt:new Date(nextRequestAt).toISOString(),retry:rateLimitStreak,requestIntervalMs:requestInterval,retainedEntries:Object.keys(dictionary).length,remaining:texts.filter(text=>!dictionary[text]).length});
     console.log(`${locale}: rate-limited; waiting ${pause/1000}s before the next batch; checkpoints retained`);
     await sleep(pause);batches.unshift(items);
    }
   }
   else if(/HTTP 403/.test(error.message)){stopped=true;console.log(`${locale}: stopped: ${error.message}; successful rows retained`);}
   else if(/fetch failed|timed out|HTTP (?:5\d\d|408)/.test(error.message)){
    items.retryCount=(items.retryCount||0)+1;
    if(items.retryCount>2){stopped=true;console.log(`${locale}: connection stopped; checkpoints retained`);}
    else {await sleep(1500*items.retryCount);batches.push(items);}
   }
   else if(items.length>1){const mid=Math.ceil(items.length/2);batches.push(items.slice(0,mid),items.slice(mid));console.log(`${locale}: splitting a batch for validation: ${error.message}`);}
   else{
    await fs.appendFile(path.join(dir,"needs-review.jsonl"),JSON.stringify({locale,source:items[0].source,error:error.message})+"\n");
    console.log(`${locale}: source requires review; continuing other records`);
   }
  }
 }}));
 if(stopped)throw new Error("Translation stopped; inspect checkpoints without serving incomplete translations");
 missingByLocale[locale]=texts.filter(t=>!dictionary[t]).length;
 await saveStatus({state:missingByLocale[locale]?'batch-complete':'candidate-complete',updatedAt:new Date().toISOString(),requestIntervalMs:requestInterval,retainedEntries:Object.keys(dictionary).length,remaining:missingByLocale[locale]});
}
await fs.writeFile(path.join(dir,probe?"probe-manifest.json":"manifest.json"),JSON.stringify({generatedAt:new Date().toISOString(),source:"Published local catalog only",provider:"Google Translate public reference translations; offline generation",sourceCount:texts.length,sourceHash:createHash("sha256").update(JSON.stringify(texts)).digest("hex"),locales,factsProtected:true,runtimeTranslationService:false},null,2));
const complete=Object.values(missingByLocale).every(count=>count===0);
console.log(JSON.stringify({batchValidated:true,complete,probe,sourceCount:texts.length,locales,missingByLocale}));
if(maxNew===Infinity)assert.ok(complete,JSON.stringify({missingByLocale}));
