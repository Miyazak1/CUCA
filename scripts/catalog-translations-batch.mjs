import fs from "node:fs/promises";
import {spawn} from "node:child_process";
const inventory=JSON.parse(await fs.readFile(".tmp/catalog-body-inventory.json","utf8"));
const texts=[...new Set(inventory.map(row=>row.text.normalize("NFC").replace(/\s+/g," ").trim()))];
const locales=["vi","th","id","ms","ar"],stalled=new Set(),results=[];
async function missing(locale){let data={};try{data=JSON.parse(await fs.readFile(`.tmp/catalog-translations/${locale}.json`,"utf8"));}catch{}return texts.filter(t=>!data[t]).length;}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let jobs=0,blocked=false;
while(jobs<200){
 let pending=false;
 for(const locale of locales){
  const before=await missing(locale);if(!before||stalled.has(locale))continue;pending=true;jobs++;
  const chunks=[];
  const code=await new Promise(resolve=>{const child=spawn(process.execPath,["scripts/catalog-translations-generate.mjs","--max-new=500"],{env:{...process.env,CUAC_TRANSLATION_LOCALES:locale},stdio:["ignore","pipe","pipe"],windowsHide:true});child.stdout.on("data",b=>{chunks.push(b);process.stdout.write(b);});child.stderr.on("data",b=>{chunks.push(b);process.stderr.write(b);});child.on("error",()=>resolve(1));child.on("exit",resolve);});
  await fs.appendFile(".tmp/catalog-translation-batches.log",Buffer.concat(chunks));
  const after=await missing(locale);results.push({date:new Date().toISOString(),locale,before,after,completed:before-after,exitCode:code});
  await fs.writeFile(".tmp/catalog-translations/batch-progress.json",JSON.stringify({date:new Date().toISOString(),jobs,sourceCount:texts.length,results,pending:Object.fromEntries(await Promise.all(locales.map(async l=>[l,await missing(l)])))},null,2));
  console.log(JSON.stringify(results.at(-1)));
  if(code!==0){blocked=true;break;}
  if(after>=before)stalled.add(locale);
  await sleep(5000);
 }
 if(blocked||!pending)break;
}
console.log(JSON.stringify({jobs,blocked,stalled:[...stalled],pending:Object.fromEntries(await Promise.all(locales.map(async l=>[l,await missing(l)])))}));
if(blocked)process.exitCode=1;
