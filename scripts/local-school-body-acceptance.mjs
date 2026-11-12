import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {localAcceptanceBrowser} from './lib/local-browser-acceptance.mjs';
const origin=process.env.CUAC_ACCEPTANCE_ORIGIN||'http://127.0.0.1:61344';
assert.match(origin,/^http:\/\/127\.0\.0\.1:\d+$/);
const snapshot=JSON.parse(await fs.readFile('output/feedback-20261112/live-school-snapshot.json','utf8'));
assert.equal(snapshot.schools.length,snapshot.total);
const records=new Map(snapshot.schools.map(record=>[record.id,record]));
const jobs=[320,1280,1920].flatMap(width=>snapshot.schools.map(record=>({width,record})));
const {chromium,executablePath}=localAcceptanceBrowser();
const browser=await chromium.launch({headless:true,executablePath});
const report={date:new Date().toISOString(),scope:'Local built renderer replaying every real school payload from the timestamped published online API snapshot; no database writes or deployment',snapshotOrigin:snapshot.origin,snapshotDate:snapshot.date,schoolCount:snapshot.total,observations:[],failures:[],passed:false};
try{
 await Promise.all(Array.from({length:4},async()=>{
  const context=await browser.newContext(),page=await context.newPage();let errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api/v1/catalog/schools/*',async route=>{
   const id=new URL(route.request().url()).pathname.split('/').at(-1),record=records.get(id);
   if(!record)return route.continue();await route.fulfill({json:{data:record}});
  });
  while(jobs.length){
   const {width,record}=jobs.shift();errors=[];
   try{
    await page.setViewportSize({width,height:900});
    await page.goto(`${origin}/university-detail.html?university=${record.id}&lang=vi`,{waitUntil:'networkidle'});
    await page.waitForFunction(()=>document.querySelector('.catalog-record-hero h1')&&window.CUACCatalogContent?.state==='ready');
    const result=await page.evaluate(()=>{
     const main=document.querySelector('main'),walker=document.createTreeWalker(main,NodeFilter.SHOW_TEXT),texts=[];
     while(walker.nextNode()){const node=walker.currentNode;if(!node.parentElement.closest('[data-catalog-original],.catalog-source-link,.footer,script,style'))texts.push(node.textContent.trim());}
     return{title:document.querySelector('h1').textContent,chinese:texts.filter(text=>/\p{Script=Han}/u.test(text)),missing:window.CUACCatalogContent.missing,overflow:document.documentElement.scrollWidth>innerWidth+1,updateHeadings:[...document.querySelectorAll('.catalog-aside-panel h3')].filter(node=>node.textContent==='Cập nhật hồ sơ').length,definitions:[...document.querySelectorAll('dl>div')].map(node=>node.textContent.trim()),text:texts.join('\n')};
    });
    assert.deepEqual(errors,[]);assert.deepEqual(result.chinese,[],record.nameEn+' Chinese body');assert.deepEqual(result.missing,[],record.nameEn+' dictionary omissions');assert.equal(result.overflow,false,record.nameEn+' overflow');assert.equal(result.updateHeadings,record.updatedAt?1:0,'One update panel in actual DOM');
    if(record.id==='5c8897cf-b024-4976-bfb6-2d4f065de3ba'){
     assert.match(result.text,/HSK4 từ 220/);assert.match(result.text,/¥15,000\/năm/);assert.ok(!result.text.includes('Hefei'));
     assert.ok(result.definitions.some(t=>t.includes('Hợp Phì, An Huy, Đông Trung Quốc')));
     if(width===1280)await page.screenshot({path:'output/feedback-20261112/anhui-school-vi-after.png',fullPage:true});
    }
    report.observations.push({id:record.id,name:record.nameEn,width,title:result.title,chineseBodyCount:result.chinese.length,missingCount:result.missing.length,overflow:result.overflow,updateHeadings:result.updateHeadings,browserErrors:errors,passed:true});
   }catch(error){report.failures.push({id:record.id,name:record.nameEn,width,error:error.message,browserErrors:errors});}
  }
  await context.close();
 }));
 report.passed=report.failures.length===0&&report.observations.length===snapshot.total*3;
}finally{await browser.close();await fs.writeFile('output/feedback-20261112/school-body-e2e.json',JSON.stringify(report,null,2));}
console.log(JSON.stringify({passed:report.passed,schools:report.schoolCount,observations:report.observations.length,failures:report.failures.slice(0,15)}));assert.equal(report.passed,true);
