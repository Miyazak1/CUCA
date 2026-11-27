import fs from "node:fs/promises";
import {spawn} from "node:child_process";
import {loadCatalogTranslationInventory} from './lib/catalog-translation-inventory.mjs';
let texts=[];
async function refreshInventory(){texts=[...new Set((await loadCatalogTranslationInventory()).map(row=>row.text))];}
await refreshInventory();
const locales=["vi","th","id","ms","ar"],stalled=new Set(),results=[];
async function missing(locale){let data={};try{data=JSON.parse(await fs.readFile(`.tmp/catalog-translations/${locale}.json`,"utf8"));}catch(error){if(error.code!=='ENOENT')throw error;}return texts.filter(t=>!data[t]).length;}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const waitOnRateLimit=process.argv.includes('--wait-on-rate-limit');
async function saveProgress(value){const file='.tmp/catalog-translations/batch-progress.json';await fs.writeFile(file+'.next',JSON.stringify(value,null,2));await fs.rename(file+'.next',file);}
let jobs=0,blocked=false;
while(jobs<200){
 await refreshInventory();
 let pending=false;
 for(const locale of locales){
  const before=await missing(locale);if(!before||stalled.has(locale))continue;pending=true;jobs++;
  await saveProgress({date:new Date().toISOString(),state:'running',activeLocale:locale,jobs,sourceCount:texts.length,results,pending:Object.fromEntries(await Promise.all(locales.map(async l=>[l,await missing(l)])))});
  const chunks=[];
  const code=await new Promise(resolve=>{const child=spawn(process.execPath,["scripts/catalog-translations-generate.mjs","--max-new=500",...(waitOnRateLimit?['--wait-on-rate-limit']:[])],{env:{...process.env,CUAC_TRANSLATION_LOCALES:locale},stdio:["ignore","pipe","pipe"],windowsHide:true});child.stdout.on("data",b=>{chunks.push(b);process.stdout.write(b);});child.stderr.on("data",b=>{chunks.push(b);process.stderr.write(b);});child.on("error",()=>resolve(1));child.on("exit",resolve);});
  await fs.appendFile(".tmp/catalog-translation-batches.log",Buffer.concat(chunks));
  await refreshInventory();const after=await missing(locale);results.push({date:new Date().toISOString(),locale,before,after,completed:before-after,exitCode:code});
  await saveProgress({date:new Date().toISOString(),state:'between-batches',activeLocale:null,jobs,sourceCount:texts.length,results,pending:Object.fromEntries(await Promise.all(locales.map(async l=>[l,await missing(l)])))});
  console.log(JSON.stringify(results.at(-1)));
  if(code!==0){blocked=true;break;}
  if(after>=before)stalled.add(locale);
  await sleep(5000);
 }
 if(blocked||!pending)break;
}
await refreshInventory();const remaining=Object.fromEntries(await Promise.all(locales.map(async l=>[l,await missing(l)])));
const complete=Object.values(remaining).every(count=>count===0);
const summary={date:new Date().toISOString(),state:complete?'complete':'incomplete',activeLocale:null,jobs,blocked,stalled:[...stalled],pending:remaining,complete,sourceCount:texts.length,results};
await saveProgress(summary);
console.log(JSON.stringify(summary));
if(blocked||!complete)process.exitCode=1;
