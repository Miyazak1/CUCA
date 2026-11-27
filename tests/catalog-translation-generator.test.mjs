import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const execute=promisify(execFile);
const generator=resolve('scripts/catalog-translations-generate.mjs');

async function fixture(texts,mode){
 const cwd=await fs.mkdtemp(join(tmpdir(),'cuac-translation-generator-'));
 await fs.mkdir(join(cwd,'.tmp'),{recursive:true});await fs.mkdir(join(cwd,'src/content'),{recursive:true});
 await fs.writeFile(join(cwd,'.tmp/catalog-body-inventory.json'),JSON.stringify(texts.map(text=>({text,fields:['programs.applicationNote']}))));
 await fs.writeFile(join(cwd,'src/content/catalog-translation-overrides.json'),'[]');
 if(mode==='recover-429'||mode==='resume-429'){
  await fs.mkdir(join(cwd,'.tmp/catalog-translations'),{recursive:true});
  await fs.writeFile(join(cwd,'.tmp/catalog-translations/th.json'),JSON.stringify({'Already translated':'เก็บผลเดิม'}));
  if(mode==='resume-429')await fs.writeFile(join(cwd,'.tmp/catalog-translations/th-status.json'),JSON.stringify({state:'rate-limited',retry:6,updatedAt:new Date().toISOString(),resumeAt:new Date(Date.now()+3000000).toISOString()}));
 }
 const mock=join(cwd,'mock-fetch.mjs');
 await fs.writeFile(mock,`import fs from 'node:fs/promises';
import {appendFileSync} from 'node:fs';
let calls=0;
if(['recover-429','resume-429'].includes(${JSON.stringify(mode)})){
 const originalTimer=globalThis.setTimeout;
 globalThis.setTimeout=(callback,ms,...args)=>{if(ms>=1000)appendFileSync('.tmp/waits.jsonl',JSON.stringify(ms)+'\\n');return originalTimer(callback,ms>=1000?0:ms,...args);};
}
globalThis.fetch=async url=>{
 const q=new URL(url).searchParams.get('q');
 await fs.appendFile('.tmp/requests.jsonl',JSON.stringify(q)+'\\n');
 calls++;
 if(${JSON.stringify(mode)}==='resume-429')await fs.appendFile('.tmp/resume-events.jsonl',JSON.stringify(JSON.parse(await fs.readFile('.tmp/catalog-translations/th-status.json','utf8')).retry)+'\\n');
 if((${JSON.stringify(mode)}==='recover-429'&&calls<=4)||(${JSON.stringify(mode)}==='resume-429'&&calls===1))return {status:429,headers:{get:()=> '60'},body:{cancel:async()=>{}}};
 if(/Tuition/.test(q)&&/全部/.test(q))throw new Error('mixed source batch');
 let translated=q.replace('Tuition is ','ค่าเล่าเรียน ').replace(' each year.',' ต่อปี').replace('Level ','ระดับ ').replace(' score ',' คะแนน ').replace('全部中文授课','ทุกหลักสูตรสอนเป็นภาษาจีน');
 if(${JSON.stringify(mode)}==='glued-fact')translated=translated.replace('[913570000]','X[913570000]');
 return {ok:true,json:async()=>[[[translated]]]};
};`);
 const result=await execute(process.execPath,['--import',pathToFileURL(mock).href,generator,'--max-new=10',...(['recover-429','resume-429'].includes(mode)?['--wait-on-rate-limit']:[])],{cwd,env:{...process.env,CUAC_TRANSLATION_LOCALES:'th',CUAC_TRANSLATION_CONCURRENCY:'1'},windowsHide:true,timeout:20000});
 return {cwd,result,dictionary:JSON.parse(await fs.readFile(join(cwd,'.tmp/catalog-translations/th.json'),'utf8'))};
}

test('offline generator separates mixed source batches while retaining amount and exam facts',async()=>{
 const texts=['Tuition is CNY 20,000 each year.','HSK Level 5 score 200','全部中文授课'];
 const {cwd,dictionary}=await fixture(texts,'valid');
 assert.equal(dictionary[texts[0]],'ค่าเล่าเรียน CNY 20,000 ต่อปี');
 assert.equal(dictionary[texts[1]],'HSK ระดับ 5 คะแนน 200');
 assert.equal(dictionary[texts[2]],'ทุกหลักสูตรสอนเป็นภาษาจีน');
 const requests=(await fs.readFile(join(cwd,'.tmp/requests.jsonl'),'utf8')).trim().split('\n').map(s=>JSON.parse(s));
 assert.equal(requests.length,2);assert.ok(requests.every(q=>!(/Tuition/.test(q)&&/全部/.test(q))));
});

test('a restored exam token glued to another word is rejected instead of checkpointed',async()=>{
 const text='HSK Level 5 score 200';
 const {cwd,dictionary}=await fixture([text],'glued-fact');
 assert.equal(dictionary[text],undefined);
 assert.match(await fs.readFile(join(cwd,'.tmp/catalog-translations/needs-review.jsonl'),'utf8'),/Source facts changed after token restoration/);
});

test('extended authoring recovers after four consecutive 429 responses and preserves previous checkpoint entries',async()=>{
 const {cwd,dictionary}=await fixture(['Already translated','HSK Level 5 score 200'],'recover-429');
 assert.equal(dictionary['Already translated'],'เก็บผลเดิม');
 assert.equal(dictionary['HSK Level 5 score 200'],'HSK ระดับ 5 คะแนน 200');
 const status=JSON.parse(await fs.readFile(join(cwd,'.tmp/catalog-translations/th-status.json'),'utf8'));
 assert.equal(status.state,'candidate-complete');assert.equal(status.remaining,0);
 assert.equal((await fs.readFile(join(cwd,'.tmp/requests.jsonl'),'utf8')).trim().split('\n').length,5);
});

test('a resumed authoring process honors the saved cooldown before fetching and continues the retry sequence',async()=>{
 const {cwd,dictionary}=await fixture(['Already translated','HSK Level 5 score 200'],'resume-429');
 assert.equal(dictionary['Already translated'],'เก็บผลเดิม');
 assert.equal(dictionary['HSK Level 5 score 200'],'HSK ระดับ 5 คะแนน 200');
 const events=(await fs.readFile(join(cwd,'.tmp/resume-events.jsonl'),'utf8')).trim().split('\n').map(Number);
 const waits=(await fs.readFile(join(cwd,'.tmp/waits.jsonl'),'utf8')).trim().split('\n').map(Number);
 assert.deepEqual(events,[6,7]);assert.ok(waits[0]>=2900000);assert.ok(waits.includes(3600000));
});
