import {localAcceptanceBrowser} from './lib/local-browser-acceptance.mjs';
import { observeBrowserErrors } from './lib/browser-error-acceptance.mjs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertLocalDevelopmentState} from './lib/local-development.ts';
const projectDir=resolve(dirname(fileURLToPath(import.meta.url)),'..');
process.chdir(projectDir);
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {EDITORIAL_LOCALES,editorial,localizeGuide,localizeInsight} from '../src/content/editorial.ts';
import {listInsights,insightCategories} from '../src/content/insights.ts';
const {chromium,executablePath}=localAcceptanceBrowser();
const state=JSON.parse(await fs.readFile('.cuac-local/runtime.json','utf8'));
assertLocalDevelopmentState(state);
const origin=`http://127.0.0.1:${state.applicationPort}`;
await fs.mkdir('output/feedback-20261112',{recursive:true});
const guideResponse=await fetch(origin+'/api/v1/catalog/guides?limit=100');
assert.equal(guideResponse.status,200);
const guides=(await guideResponse.json()).data;
const posts=listInsights();
const report={scope:'Real local server-rendered pages and browser; six locales; published local catalog',ssr:[],browser:[],passed:false};
const escape=text=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#x27;'}[c]));
const browser=await chromium.launch({headless:true,executablePath});
try{
 const context=await browser.newContext();
 for(const locale of EDITORIAL_LOCALES){
  const entries=[
   {path:'/guides/',texts:guides.map(g=>localizeGuide(g,locale).titleEn)},
   ...guides.map(g=>{const translated=localizeGuide(g,locale);assert.equal(translated.translationMissing,false,`${g.slug}/${locale}`);return {path:`/guides/${g.slug}`,texts:[translated.titleEn,...translated.content.sections.flatMap(s=>[s.headingEn,s.bodyEn])]};}),
   {path:'/insights/',texts:posts.map(p=>localizeInsight(p,locale).title)},
   ...posts.map(p=>{const translated=localizeInsight(p,locale);assert.equal(translated.translationMissing,false);return {path:`/insights/${p.slug}`,texts:[translated.title,...translated.sections.flatMap(s=>[s.heading,...s.paragraphs,...s.bullets||[]])]};}),
   ...insightCategories.map(c=>({path:`/insights/category/${c.slug}`,texts:[editorial(locale)(c.name)]})),
  ];
  for(const entry of entries){
   const response=await context.request.get(origin+entry.path+`?lang=${locale}`);assert.equal(response.status(),200,`${locale}:${entry.path}`);const html=await response.text();
   for(const text of entry.texts)assert.ok(html.includes(escape(text)),`SSR ${locale} ${entry.path} missing: ${text.slice(0,90)}`);
   assert.ok(html.includes(`lang="${locale}"`));assert.ok(html.includes(`dir="${locale==='ar'?'rtl':'ltr'}"`));
   report.ssr.push({path:entry.path,locale,verifiedTextFields:entry.texts.length});
  }
  console.log(`${locale}: ${entries.length} real server-rendered pages passed`);
 }
 for(const [index,locale]of EDITORIAL_LOCALES.entries()){
  const page=await context.newPage();await page.setViewportSize({width:locale==='ar'?375:1280,height:812});
  const browserErrors = await observeBrowserErrors(page);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const [path,title]of [[`/guides/${guides[5].slug}`,localizeGuide(guides[5],locale).titleEn],[`/insights/${posts[0].slug}`,localizeInsight(posts[0],locale).title]]){
    await page.goto(`${origin}${path}?lang=${locale}`);
    await page.waitForFunction(l=>document.documentElement.lang===l,locale,{timeout:30000});
    assert.equal((await page.locator('main h1').textContent()).trim(),title);
    for(const width of [375,1280]){
    await page.setViewportSize({width,height:812});
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false,`${path}/${locale}/${width}: horizontal overflow`);
    const links=await page.locator('main a[href]').evaluateAll(items=>items.map(a=>a.getAttribute('href')).filter(h=>/^\/(guides|insights|programs|universities|scholarships)/.test(h)&&!h.includes('rss.xml')));
    for(const href of links)assert.equal(new URL(href,'https://ucac.cn').searchParams.get('lang'),locale);
    if(locale==='ar')await page.screenshot({path:`output/feedback-20261112/arabic-${path.startsWith('/guides')?'guide':'insight'}-${width}.png`,fullPage:true});
    report.browser.push({path,locale,width,overflow,links:links.length});
    }
  }
  const next=EDITORIAL_LOCALES[(index+1)%EDITORIAL_LOCALES.length];
  await page.locator('.language-selector-trigger').first().click();
  await page.locator(`[data-locale="${next}"]`).first().click();
  await page.waitForURL(url=>url.searchParams.get('lang')===next);
  await page.waitForFunction(l=>document.documentElement.lang===l,next);
  assert.equal((await page.locator('main h1').textContent()).trim(),localizeInsight(posts[0],next).title);
  assert.deepEqual(errors,[]);report.browser.push({locale,switchedTo:next,browserErrors:await browserErrors.assertClean()});await page.close();
 }
 report.passed=true;
}finally{await browser.close();await fs.writeFile('output/feedback-20261112/editorial-e2e.json',JSON.stringify(report,null,2));}
console.log(JSON.stringify({passed:report.passed,serverPages:report.ssr.length,browserChecks:report.browser.length}));
