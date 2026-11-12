import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { localAcceptanceBrowser } from "./lib/local-browser-acceptance.mjs";
import { assertLocalDevelopmentState } from "./lib/local-development.ts";
import { insightCategories, listInsights } from "../src/content/insights.ts";
const state=JSON.parse(await fs.readFile(".cuac-local/runtime.json","utf8"));
assertLocalDevelopmentState(state);
const origin=`http://127.0.0.1:${state.applicationPort}`;
const dir="output/feedback-20261112";
const data={};
for(const resource of ["programs","schools","scholarships","cities"]) data[resource]=(await(await fetch(`${origin}/api/v1/catalog/${resource}?limit=1`)).json()).data[0];
const details=[`/program-detail.html?program=${data.programs.id}`,`/university-detail.html?university=${data.schools.id}`,`/scholarship-detail.html?scholarship=${data.scholarships.id}`,`/city-detail.html?city=${data.cities.slug}`];
const sample=process.argv.includes("--sample");
const tabletOnly=process.argv.includes("--details-tablet");
const locales=["en","vi","th","id","ms","ar"];
const routes=[];
if(sample||tabletOnly) for(const path of ["/home-v3.html",...details]) routes.push({path,locales});
else{
 const manifest=JSON.parse(await fs.readFile("config/public-release-assets.json","utf8"));
 const files=manifest.files.filter(file=>file.endsWith(".html"));
 files.sort((a,b)=>a==="home-v3.html"?-1:b==="home-v3.html"?1:a.localeCompare(b));
 for(const file of files){
  const source=await fs.readFile(`public/${file}`,"utf8");
  if(!source.includes("data-cuac-footer"))continue;
  routes.push({path:details.find(path=>path.startsWith("/"+file+"?"))||"/"+file,locales:source.includes('data-i18n-locales="en,vi,th,id,ms,ar"')?locales:["en"]});
 }
 const guides=(await(await fetch(`${origin}/api/v1/catalog/guides?limit=100`)).json()).data;
 for(const path of ["/guides/",...guides.map(g=>`/guides/${g.slug}`),"/insights/",...insightCategories.map(c=>`/insights/category/${c.slug}`),...listInsights().map(p=>`/insights/${p.slug}`)])routes.push({path,locales});
}
const report={date:new Date().toISOString(),scope:"All released HTML templates with shared footer and every published editorial route. Signed-out private gates included; compact workspace variant checked for outer width. Pages without shared footer excluded. Content widths remain independent.",checks:[],failed:[],passed:false,deployed:false};
function expectedDetailWidth(width){return width<=560?width:width<=1040?width-32:Math.min(1180,width-64);}
function valid(check,baseline){
 const h=check.categoryHeading;
 return Math.abs(check.footer.width-baseline.footer.width)<=1&&(!check.grid||Math.abs(check.grid.width-baseline.grid.width)<=1)&&Math.abs(check.footer.left-check.nav.left)<=1&&Math.abs(check.footer.right-check.nav.right)<=1&&!check.overflow&&(check.variant==="workspace"||check.links===12)&&(!check.detail||Math.abs(check.detail.width-expectedDetailWidth(check.width))<=1)&&(!h||(h.scrollWidth<=h.clientWidth+1&&h.left>=h.main.left-1&&h.right<=h.main.right+1));
}
if(process.argv.includes("--revalidate-recorded")){
 const recorded=JSON.parse(await fs.readFile(dir+"/footer-width-e2e.json","utf8"));
 const confirmation=JSON.parse(await fs.readFile(dir+"/footer-tablet-confirmation-e2e.json","utf8"));
 assert.equal(confirmation.passed,true);
 for(const check of recorded.checks){
  const baseline=recorded.checks.find(item=>item.width===check.width&&item.locale===check.locale&&item.path==="/home-v3.html");
  check.passed=valid(check,baseline);
  if(check.width===768&&check.detail){
   const fresh=confirmation.checks.find(item=>item.locale===check.locale&&item.path===check.path);
   assert.ok(fresh?.passed);
   assert.ok(Math.abs(fresh.detail.width-check.detail.width)<=1&&Math.abs(fresh.footer.width-check.footer.width)<=1);
  }
 }
 recorded.failed=recorded.checks.filter(check=>!check.passed);
 recorded.passed=recorded.failed.length===0;
 recorded.expectationCorrection="Original CSS uses viewport minus 32px up to 1040px; the initial assertion incorrectly expected minus 64px at 768px. Browser measurements were unchanged and revalidated; tablet combinations were freshly rerun.";
 recorded.tabletConfirmation="footer-tablet-confirmation-e2e.json";
 assert.equal(recorded.passed,true);
 await fs.writeFile(dir+"/footer-width-e2e.json",JSON.stringify(recorded,null,2));
 console.log(JSON.stringify({passed:true,uniqueCombinations:recorded.checks.length,freshTabletCombinations:confirmation.checks.length}));
 process.exit(0);
}
const {chromium,executablePath}=localAcceptanceBrowser();
const browser=await chromium.launch({headless:true,executablePath});
try{
 for(const width of sample?[1920]:tabletOnly?[768]:[375,768,1280,1920]) for(const locale of sample?["vi"]:locales){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:"reduce"});
  let baseline;
  for(const entry of routes.filter(entry=>entry.locales.includes(locale))){
   const path=entry.path;
   const page=await context.newPage();
   try{
    const response=await page.goto(`${origin}${path}${path.includes("?")?"&":"?"}lang=${locale}`,{waitUntil:"domcontentloaded"});
    assert.equal(response.status(),200);
    if(/^\/(?:favourites-api|hub-api|onboarding-api|preferences-api|notifications|ops-admin-api|school-portal|school-settings-api)\.html/.test(path)) await page.waitForURL(url=>url.pathname==="/auth.html");
    await page.waitForFunction(locale=>document.documentElement.lang===locale&&document.querySelector(".footer"),locale);
    if(path.includes("-detail.html")) await page.locator("[data-catalog-detail-root] h1").waitFor({state:"attached"});
    await page.evaluate(()=>document.fonts.ready);
    const measured=await page.evaluate(()=>{
      const rect=node=>{const r=node.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width};};
      const footer=document.querySelector(".footer");
      const heading=location.pathname.startsWith("/insights/category/")?document.querySelector("main h1"):null;
      return {footer:rect(footer),grid:footer.querySelector(".footer-grid")?rect(footer.querySelector(".footer-grid")):null,nav:rect(document.querySelector("header.nav")),parent:rect(footer.parentElement),parentDisplay:getComputedStyle(footer.parentElement).display,computedWidth:getComputedStyle(footer).width,variant:footer.classList.contains("footer-workspace")?"workspace":"public",finalPath:location.pathname,detail:document.querySelector(".catalog-detail-shell")?rect(document.querySelector(".catalog-detail-shell")):null,categoryHeading:heading?{...rect(heading),clientWidth:heading.clientWidth,scrollWidth:heading.scrollWidth,main:rect(document.querySelector("main"))}:null,overflow:document.documentElement.scrollWidth>innerWidth+1,links:footer.querySelectorAll(".footer-col a").length};
    });
    if(path==="/home-v3.html") baseline=measured;
    const passed=valid({...measured,width},baseline);
    const check={width,locale,path,baseline:baseline.footer,...measured,passed};
    report.checks.push(check);
    if(!passed) report.failed.push(check);
    if(width===1920&&locale==="vi"&&path.includes("university-detail")){
      await page.locator(".footer").scrollIntoViewIfNeeded();
      await page.screenshot({path:`${dir}/footer-width-${passed?"after":"before"}-university-1920.png`});
      if(!passed) check.widthOnlyProbe=await page.evaluate(()=>{const footer=document.querySelector(".footer");footer.style.width="var(--shell-page-width)";const r=footer.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width};});
    }
   }finally{await page.close();}
  }
  await context.close();
  console.log(`Footer width checked: ${width}/${locale}`);
 }
 report.passed=report.failed.length===0;
 assert.equal(report.passed,true,"Footer geometry differs from the homepage/header; inspect evidence");
}finally{await browser.close();await fs.writeFile(dir+"/"+(tabletOnly?"footer-tablet-confirmation-e2e.json":sample?"footer-width-sample-e2e.json":"footer-width-e2e.json"),JSON.stringify(report,null,2));}
console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,failures:report.failed.length}));
