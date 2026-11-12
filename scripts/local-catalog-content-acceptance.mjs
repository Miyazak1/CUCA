import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {localAcceptanceBrowser} from './lib/local-browser-acceptance.mjs';
const origin=process.env.CUAC_ACCEPTANCE_ORIGIN||'http://127.0.0.1:61344';
assert.match(origin,/^http:\/\/127\.0\.0\.1:\d+$/);
const {chromium,executablePath}=localAcceptanceBrowser();
const browser=await chromium.launch({headless:true,executablePath});
const report={date:new Date().toISOString(),pages:[],fallbacks:[],originalLinks:[],requirements:[],switches:[],passed:false};
const definitions=[
 ['program-detail.html?program=565f3bbb-a268-416f-a3c0-8d78c5ba1daa','IELTS 5.5 or TOEFL 60 or above; native English speakers are exempt.'],
 ['university-detail.html?university=f4b01e0e-9373-4f39-bd79-12adc139d6bb','All applicants must submit CSCA results by May 30, 2026.'],
 ['scholarship-detail.html?scholarship=3c3623de-fc4c-4b00-b504-21c58a174fa0','2026 Shandong Provincial Government Scholarship at SDNU'],
 ['city-detail.html?city=beijing','North China'],
];
try{
 for(const width of [320,1280])for(const route of [...['programs','universities','scholarships','cities'].map(s=>s+'.html'),...definitions.map(d=>d[0]),'search.html?q=medicine']){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${origin}/${route}${route.includes('?')?'&':'?'}lang=vi`,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.CUACCatalogContent?.state==='ready');
  if(route.includes('-detail'))await page.waitForFunction(()=>document.querySelector('[data-catalog-detail-root] h1')&&!document.querySelector('.catalog-loading-line'));
  else if(!route.startsWith('search'))await page.locator('[data-program-card],[data-university-card],[data-scholarship-card],[data-city-card]').first().waitFor();
  const result=await page.evaluate(()=>({h1:document.querySelector('h1')?.textContent,missing:window.CUACCatalogContent.missing,overflow:document.documentElement.scrollWidth>innerWidth+1,translated:document.querySelectorAll('[data-catalog-content-translated]').length,originalHref:document.querySelector('[data-catalog-translation-notice] a')?.href,text:document.querySelector('main').innerText}));
  assert.equal(errors.length,0,errors.join(';'));assert.equal(result.overflow,false,route+' overflow');
  assert.ok(result.h1&&result.text.length>100,route);
  const source=definitions.find(d=>d[0]===route)?.[1];
  if(source)assert.ok(!result.text.replace(/.*(?:Official|chính thức).*\n/g,'').includes(source)||route.startsWith('scholarship'),route+' untranslated body');
  assert.equal(new URL(result.originalHref).searchParams.get('lang'),'en',route+' original link');
  if(route===definitions[0][0]){
   assert.match(result.text,/IELTS 5.5 hoặc TOEFL 60/);assert.match(result.text,/SUEP/);assert.ok(!result.text.includes('Apply in the SUEP international student application system'));
   if(width===1280)await page.screenshot({path:'output/feedback-20261112/catalog-program-vi-after.png',fullPage:true});
  }
  report.pages.push({route,width,h1:result.h1,missing:result.missing,overflow:result.overflow,translatedNodes:result.translated,browserErrors:errors,passed:true});
  if(width===1280&&route===definitions[0][0]){
   await page.locator('[data-catalog-translation-notice] a').click();await page.waitForLoadState('networkidle');
   assert.equal(new URL(page.url()).searchParams.get('lang'),'en');assert.match(await page.locator('main').innerText(),/IELTS 5.5 or TOEFL 60/);
   report.originalLinks.push({route,clickPassed:true});
  }
  await page.close();
 }
 for(const mode of ['pending','unavailable']){
  const page=await browser.newPage();
  await page.route('**/catalog-content-manifest.json*',route=>mode==='pending'?route.fulfill({json:{locales:{}}}):route.fulfill({status:503,body:'unavailable'}));
  await page.goto(`${origin}/${definitions[0][0]}&lang=vi`,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.querySelector('[data-catalog-detail-root] h1')&&!document.querySelector('.catalog-loading-line'));
  assert.equal(await page.evaluate(()=>window.CUACCatalogContent.state),mode);
  assert.match(await page.locator('main').innerText(),/IELTS 5.5 or TOEFL 60/);
  assert.equal(await page.locator('[data-catalog-translation-notice]').getAttribute('data-translation-state'),mode);
  report.fallbacks.push({mode,recordVisible:true,noticePresent:true,passed:true});await page.close();
 }
 const page=await browser.newPage();
 await page.goto(`${origin}/program-detail.html?program=75fc9d8a-90e3-4b6c-ba38-dc6b019b0545&lang=en`,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>document.querySelector('[data-catalog-detail-root] h1')&&!document.querySelector('.catalog-loading-line'));assert.equal(await page.locator('h1').innerText(),'Artificial Intelligence');assert.doesNotMatch(await page.locator('main').innerText(),/\(cid:/);
 report.sourceRepair={programId:'75fc9d8a-90e3-4b6c-ba38-dc6b019b0545',exactName:'Artificial Intelligence',passed:true};await page.close();
 // Approved requirement rendering is fixture-tested: there are no approved
 // requirement documents in this local published catalog snapshot.
 const overrides=JSON.parse(await fs.readFile('src/content/catalog-translation-overrides.json','utf8'));
 for(const locale of ['vi','th','id','ms','ar']){
  const page=await browser.newPage({viewport:{width:320,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const index=['en','vi','th','id','ms','ar'].indexOf(locale);
  const ruleRow=overrides.find(row=>row[0].startsWith('IELTS 5.5 or TOEFL 60'));
  const rule=ruleRow[0],translated=ruleRow[index];
  const id='00000000-0000-4000-8000-000000000001';
  await page.route('**/catalog-content-manifest.json*',r=>r.fulfill({json:{locales:{[locale]:{ready:true,sha256:'fixture'}}}}));
  await page.route(`**/catalog-content-${locale}.json*`,r=>r.fulfill({json:Object.fromEntries(overrides.map(row=>[row[0],row[index]]))}));
  await page.route('**/api/v1/catalog/programs/*/intakes?*',r=>r.fulfill({json:{data:[{id,intakeTerm:'spring',intakeYear:2027,openDate:'2026-11-01',deadlineDate:'2027-02-28',applicationRound:'First round'}]}}));
  const categories=['education','language','academic_results','documents','identity','application_policy','other'],levels=['required','conditional','recommended'],stages=['preparation','submission','enrollment'],evidence=['self_report','document','official_result','school_review'];
  const requirements=Array.from({length:12},(_,i)=>({category:categories[i%categories.length],level:levels[i%3],ruleText:rule,stage:stages[i%3],evidenceType:evidence[i%4]}));
  await page.route('**/api/v1/catalog/programs/*/intakes/*/requirements',r=>r.fulfill({json:{data:{document:{requirements}}}}));
  await page.goto(`${origin}/${definitions[0][0]}&lang=${locale}`,{waitUntil:'networkidle'});
  const rules=page.locator('.catalog-requirement-level').locator('..');await rules.first().waitFor();
  const text=(await rules.allInnerTexts()).join('\n');assert.ok(text.includes(translated),locale+' fixture rule');assert.doesNotMatch(text,/\b(?:Required|Conditional|Recommended|Preparation|Submission|Enrollment|Self Report|Official Result|School Review)\b/);
  assert.equal(await page.locator('html').getAttribute('dir'),locale==='ar'?'rtl':'ltr');assert.equal(errors.length,0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  report.requirements.push({locale,fixture:true,ruleText:text,browserErrors:errors,passed:true});await page.close();
 }
 for(const [route]of definitions){
  const page=await browser.newPage();await page.goto(`${origin}/${route}&lang=en`,{waitUntil:'networkidle'});
  for(const locale of ['vi','th','id','ms','ar','en']){
   await page.locator('.language-selector-trigger').first().click();
   await page.locator(`.language-selector-option[data-locale="${locale}"]`).click();await page.waitForLoadState('networkidle');
   assert.equal(new URL(page.url()).searchParams.get('lang'),locale);
   assert.equal(new URL(page.url()).searchParams.get(new URL(`${origin}/${route}`).searchParams.keys().next().value),new URL(`${origin}/${route}`).searchParams.values().next().value);
   await page.waitForFunction(()=>window.CUACCatalogContent?.state!=='loading');
   report.switches.push({route,locale,state:await page.evaluate(()=>window.CUACCatalogContent.state),passed:true});
  }
  await page.close();
 }
 report.passed=true;
}finally{await browser.close();await fs.writeFile('output/feedback-20261112/catalog-content-e2e.json',JSON.stringify(report,null,2));}
console.log(JSON.stringify({passed:report.passed,pages:report.pages.length,fallbacks:report.fallbacks.length,originalLinks:report.originalLinks.length,requirements:report.requirements.length,switches:report.switches.length,sourceRepair:report.sourceRepair?.passed}));
