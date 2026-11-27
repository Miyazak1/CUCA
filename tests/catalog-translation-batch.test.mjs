import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';

async function runBatch(allComplete,corruptCheckpoint=false,detailSource=false){
 const cwd=await fs.mkdtemp(join(tmpdir(),'cuac-translation-batch-'));
 await fs.mkdir(join(cwd,'.tmp/catalog-translations'),{recursive:true});await fs.mkdir(join(cwd,'scripts'));
 await fs.writeFile(join(cwd,'.tmp/catalog-body-inventory.json'),JSON.stringify([{text:'Pending source'}]));
 if(detailSource)await fs.writeFile(join(cwd,'.tmp/catalog-body-detail-inventory.json'),JSON.stringify([{text:'Missing detail source',fields:['scholarships.detail.bodySections']}]));
 for(const locale of ['vi','th','id','ms','ar'])await fs.writeFile(join(cwd,`.tmp/catalog-translations/${locale}.json`),JSON.stringify(locale==='th'&&!allComplete?{}:{'Pending source':'Translated source'}));
 if(corruptCheckpoint)await fs.writeFile(join(cwd,'.tmp/catalog-translations/th.json'),'{preserved broken checkpoint');
 await fs.writeFile(join(cwd,'scripts/catalog-translations-generate.mjs'),'process.exit(0);');
 const timers=join(cwd,'timers.mjs');await fs.writeFile(timers,'const timer=globalThis.setTimeout;globalThis.setTimeout=(fn,ms,...args)=>timer(fn,ms>=1000?0:ms,...args);');
 const child=spawn(process.execPath,['--import',pathToFileURL(timers).href,resolve('scripts/catalog-translations-batch.mjs'),'--wait-on-rate-limit'],{cwd,windowsHide:true,stdio:['ignore','pipe','pipe']});
 child.stdout.resume();child.stderr.resume();
 const code=await new Promise((resolve,reject)=>{child.on('exit',resolve);child.on('error',reject);});
 let summary=null;try{summary=JSON.parse(await fs.readFile(join(cwd,'.tmp/catalog-translations/batch-progress.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
 return {code,summary,checkpoint:await fs.readFile(join(cwd,'.tmp/catalog-translations/th.json'),'utf8')};
}
test('a stalled translation locale leaves a failed completion status instead of a false success',async()=>{
 const {code,summary}=await runBatch(false);
 assert.equal(code,1);assert.equal(summary.complete,false);assert.equal(summary.pending.th,1);assert.deepEqual(summary.stalled,['th']);
});
test('all existing complete checkpoints finish without regenerating translations',async()=>{
 const {code,summary}=await runBatch(true);
 assert.equal(code,0);assert.equal(summary.complete,true);assert.equal(summary.jobs,0);
});

test('a corrupt existing checkpoint is retained and stops the supervisor before regeneration',async()=>{
 const {code,summary,checkpoint}=await runBatch(false,true);
 assert.equal(code,1);assert.equal(summary,null);assert.equal(checkpoint,'{preserved broken checkpoint');
});

test('batch completion includes supplemental detail sources even when all legacy list checkpoints are complete',async()=>{
 const {code,summary}=await runBatch(true,false,true);
 assert.equal(code,1);assert.equal(summary.complete,false);assert.equal(summary.sourceCount,2);
 for(const locale of ['vi','th','id','ms','ar'])assert.equal(summary.pending[locale],1);
});
