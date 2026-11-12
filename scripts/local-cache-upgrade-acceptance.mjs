import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import assert from 'node:assert/strict';
import {localAcceptanceBrowser} from './lib/local-browser-acceptance.mjs';
const upstream=process.env.CUAC_ACCEPTANCE_ORIGIN||'http://127.0.0.1:61344';
assert.match(upstream,/^http:\/\/127\.0\.0\.1:\d+$/);
const stale=new Map(['i18n-runtime.js','home-i18n.js','home-v3.js'].map(name=>[name,execFileSync('git',['show',`655c494:public/${name}`],{encoding:'utf8'})]));
const beforeHtml=execFileSync('git',['show','3b6cc75:public/home-v3.html'],{encoding:'utf8'});
let phase='before',requests=[];
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');requests.push({phase,path:url.pathname,query:url.search});
  if(url.pathname==='/home-v3.html'){
   res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(phase==='before'?beforeHtml:await fs.readFile('public/home-v3.html'));return;
  }
  const file=url.pathname.slice(1);
  if(/^[a-zA-Z0-9_.-]+\.(?:js|css|svg|json)$/.test(file)){
   const body=phase==='before'&&stale.has(file)?stale.get(file):await fs.readFile(`public/${file}`);
   const type=file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':'image/svg+xml';
   res.writeHead(200,{'content-type':type,'cache-control':'public, max-age=3600'});res.end(body);return;
  }
  const response=await fetch(upstream+req.url);res.writeHead(response.status,Object.fromEntries([...response.headers].filter(([key])=>!['content-encoding','content-length','transfer-encoding'].includes(key))));res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.writeHead(500);res.end('Local cache-upgrade harness failed');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const {chromium,executablePath}=localAcceptanceBrowser(),browser=await chromium.launch({headless:true,executablePath});
const report={date:new Date().toISOString(),mechanism:'Real browser HTTP cache; no routing override, cache clear, or forced reload',observations:[],passed:false};
try{
 for(const width of [375,1280])for(const locale of ['vi','th','id','ms','ar']){
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));phase='before';requests=[];
  await page.goto(`${origin}/home-v3.html?lang=${locale}`,{waitUntil:'networkidle'});
  const broken=await page.locator('[data-home-categories] .cat').count();assert.equal(broken,0,'Reproduce the stale native homepage');
  const prime=[...requests];phase='after';requests=[];
  await page.goto(`${origin}/home-v3.html?lang=${locale}&upgrade=1`,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.querySelector('main')?.dataset.homeSummaryReady==='true');
  const snapshot=await page.evaluate(()=>({categories:document.querySelectorAll('[data-home-categories] .cat').length,images:document.querySelectorAll('main img').length,footer:document.querySelector('.footer-col strong')?.textContent,expected:window.CUACI18n.t('shell.footer.students'),lang:document.documentElement.lang,overflow:document.documentElement.scrollWidth>innerWidth+1}));
  assert.equal(snapshot.categories,7);assert.ok(snapshot.images>0);assert.equal(snapshot.footer,snapshot.expected);assert.equal(snapshot.lang,locale);assert.equal(snapshot.overflow,false);assert.deepEqual(errors,[]);
  for(const name of stale.keys()){
   const before=prime.find(r=>r.path===`/${name}`),after=requests.find(r=>r.path===`/${name}`);
   assert.ok(before&&after,`${name}: server receives changed resource URL without cache clearing`);assert.notEqual(after.query,before.query);
  }
  report.observations.push({locale,width,beforeCategories:broken,...snapshot,versionedScripts:requests.filter(r=>stale.has(r.path.slice(1))),browserErrors:errors,passed:true});
  if(locale==='vi'&&width===1280)await page.screenshot({path:'output/feedback-20261112/cache-upgrade-vi-after.png',fullPage:true});
  await context.close();
 }
 report.passed=true;
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));await fs.writeFile('output/feedback-20261112/cache-upgrade-e2e.json',JSON.stringify(report,null,2));}
console.log(JSON.stringify({passed:report.passed,observations:report.observations.length}));
