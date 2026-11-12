import fs from 'node:fs/promises';
import {isCatalogDisplayText} from './lib/catalog-translation-validation.mjs';
const origin=process.env.CUAC_ACCEPTANCE_ORIGIN||'http://127.0.0.1:61344';
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin))throw new Error('Use the owned loopback catalog preview');
await fs.mkdir('.tmp',{recursive:true});
const data=process.argv.includes('--cached')?JSON.parse(await fs.readFile('.tmp/catalog-body-data.json','utf8')):{};
for(const type of process.argv.includes('--cached')?[]:['programs','schools','scholarships','cities']){
 const first=await(await fetch(`${origin}/api/v1/catalog/${type}?limit=100`)).json();data[type]=first.data;
 const offsets=Array.from({length:Math.ceil(first.pagination.total/100)-1},(_,i)=>(i+1)*100);
 await Promise.all(Array.from({length:4},async()=>{while(offsets.length){const offset=offsets.shift(),j=await(await fetch(`${origin}/api/v1/catalog/${type}?limit=100&offset=${offset}`)).json();data[type].push(...j.data);}}));
 console.log(`${type}: ${data[type].length}/${first.pagination.total}`);
}
const fields={programs:['fieldCategory','subjectArea','teachingLanguage','cscaSubjects','cscaRequirement','hskRequirement','englishRequirement','tuitionText','deadlineLabel','applicationRound','applicationNote','scholarshipText','badgeText','displayGroupLabel'],schools:['schoolType','region','province','regionLabel','ranking','cscaRequirement','cscaSubjects','applicationLevel','languageOfInstruction','languageRequirement','hskRequirement','englishRequirement','deadlineSummary','tuitionSummary','applicationFee','subjectTags','languageTags','tuitionBandLabel','campusHighlights'],scholarships:['typeLabel','fundingLevel','coverage','amountText','summary','requirementText','applicableDegree','applicableProgram','applicationRound','deadlineLabel','bodySections','benefitItems','benefits','eligibilityItems','applicationMaterials','applicationSteps','tags','targetCountries','targetRegions'],cities:['regionLabel','description','livingCostLabel','content']};
for(const type of ['programs','schools'])fields[type].push('nameEn');
fields.schools.push('city','cityZh');
fields.scholarships.push('title','providerNameEn','providerName','providerLocation');fields.cities.push('nameEn','province','region');
if(process.argv.includes('--requirements')){
 data.requirements=[];const pending=data.programs.filter(p=>['open','upcoming'].includes(p.intakeAvailability));
 await Promise.all(Array.from({length:4},async()=>{while(pending.length){const p=pending.shift();const intakes=await(await fetch(`${origin}/api/v1/catalog/programs/${p.id}/intakes?limit=100`)).json();for(const intake of intakes.data||[]){const response=await fetch(`${origin}/api/v1/catalog/programs/${p.id}/intakes/${intake.id}/requirements`);if(!response.ok)throw new Error(`Requirements snapshot HTTP ${response.status}`);const j=await response.json();if(j.data?.document)data.requirements.push(j.data);}}}));
 console.log(`Approved requirement documents: ${data.requirements.length}`);
}
if(data.requirements)fields.requirements=['document'];
const texts=new Map();
function add(v,type,field,id){if(Array.isArray(v))return v.forEach(x=>add(x,type,field,id));if(v&&typeof v==='object')return Object.entries(v).filter(([k])=>!['key','id','url','sourceUrl','capturedAt','schemaVersion'].includes(k)).forEach(([,x])=>add(x,type,field,id));if(!isCatalogDisplayText(v))return;const text=v.normalize('NFC').replace(/\s+/g,' ').trim();if(!texts.has(text))texts.set(text,{text,count:0,fields:new Set(),sampleIds:[]});const row=texts.get(text);row.count++;row.fields.add(`${type}.${field}`);if(row.sampleIds.length<2)row.sampleIds.push(id);}
for(const[type,records]of Object.entries(data))for(const r of records)for(const f of fields[type]){
 add(r[f],type,f,r.id||r.slug);
 if(['region','regionLabel'].includes(f)&&typeof r[f]==='string')r[f].split(/[,，]/).forEach(part=>add(part,type,f,r.id||r.slug));
}
for(const school of data.schools)for(const intake of school.upcomingDeadlines||[])for(const field of ['programNameEn','intakeTerm','deadlineLabel','applicationRound'])add(intake[field],'schools',`upcomingDeadlines.${field}`,school.id);
const rows=[...texts.values()].map(r=>({...r,fields:[...r.fields]})).sort((a,b)=>b.count-a.count);
await fs.writeFile('.tmp/catalog-body-data.json',JSON.stringify(data));await fs.writeFile('.tmp/catalog-body-inventory.json',JSON.stringify(rows,null,2));
console.log(JSON.stringify({unique:rows.length,words:rows.reduce((n,r)=>n+r.text.split(/\s+/).length,0),byField:Object.fromEntries(Object.entries(fields).flatMap(([type,names])=>names.map(f=>[`${type}.${f}`,rows.filter(r=>r.fields.includes(`${type}.${f}`)).length])))}));
