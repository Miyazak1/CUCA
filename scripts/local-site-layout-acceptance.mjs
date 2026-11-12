import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { localAcceptanceBrowser } from "./lib/local-browser-acceptance.mjs";
import { assertLocalDevelopmentState } from "./lib/local-development.ts";
import { localLayoutLogin } from "./lib/local-layout-login.mjs";
import { insightCategories, listInsights } from "../src/content/insights.ts";

const state = JSON.parse(await fs.readFile(".cuac-local/runtime.json", "utf8"));
assertLocalDevelopmentState(state);
const origin = `http://127.0.0.1:${state.applicationPort}`;
const dir = "output/feedback-20261112";
const locales=["en","vi","th","id","ms","ar"];
const data={};for(const resource of ["programs","schools","scholarships","cities","guides"])data[resource]=(await(await fetch(`${origin}/api/v1/catalog/${resource}?limit=100`)).json()).data;
const details={"program-detail.html":`program=${data.programs[0].id}`,"university-detail.html":`university=${data.schools[0].id}`,"scholarship-detail.html":`scholarship=${data.scholarships[0].id}`,"city-detail.html":`city=${data.cities[0].slug}`};
const routes=[];
const manifest=JSON.parse(await fs.readFile("config/public-release-assets.json","utf8"));
for(const file of manifest.files.filter(f=>f.endsWith(".html")&&f!=="auth-guardian-consent.html")){
 const source=await fs.readFile(`public/${file}`,"utf8");
 routes.push({path:`/${file}${details[file]?`?${details[file]}`:""}`,locales:source.includes('data-i18n-locales="en,vi,th,id,ms,ar"')?locales:["en"]});
}
for(const path of ["/guides/",...data.guides.map(g=>`/guides/${g.slug}`),"/insights/",...insightCategories.map(c=>`/insights/category/${c.slug}`),...listInsights().map(i=>`/insights/${i.slug}`)])routes.push({path,locales});
routes.push({path:"/auth-guardian-consent.html",locales:["en","vi","th","id","ms","ar"]});
for (const action of ["verify-email","reset-password","school-invite"]) routes.push({path:`/auth/${action}`,locales:action==="school-invite"?["en"]:locales});
const widths = process.argv.includes("--sample") ? [375,1024] : [320,375,768,1024,1280,1920];
const filter = process.env.CUAC_LAYOUT_FILTER;
const studentPages=["hub-api","favourites-api","preferences-api","onboarding-api","notifications","billing-api","application"];
const resumed=process.argv.includes("--resume-staff")?JSON.parse(await fs.readFile(`${dir}/site-layout-e2e.json`,"utf8")):null;
if(resumed){
 const observations=entries=>entries.reduce((sum,r)=>sum+r.locales.length+(r.locales.length===6?1:0),0);
 const studentRoutes=studentPages.map(name=>routes.find(r=>r.path===`/${name}.html`));assert.ok(studentRoutes.every(Boolean));
 assert.equal(resumed.failures.length,0);assert.equal(resumed.checks.length,widths.length*(observations(routes)+observations(studentRoutes)));assert.ok(resumed.checks.every(c=>c.passed));
}
const checks = resumed?.checks||[], switches = resumed?.switches||[], menus = resumed?.menus||[], failures = [];
const report = {date:new Date().toISOString(),deployed:false,scope:"Released public HTML and all published editorial routes, anonymous private gates, invalid credential account-action routes, plus actual signed-in workspaces. Six supported languages only where offered. RTL columns may mirror; bounded single-column account panels remain centered. Chromium viewport emulation; no real iPhone or production 301 claim.",checks,switches,menus,failures,passed:false};
const {chromium,executablePath}=localAcceptanceBrowser();
const browser=await chromium.launch({headless:true,executablePath});
const addFailure=(type,meta,details)=>{failures.push({type,...meta,details});console.log(JSON.stringify({failure:type,...meta,details}));};

async function ready(page,locale){
 await page.waitForFunction(l=>document.documentElement.lang===l&&document.querySelector("main"),locale);
 if(await page.locator("[data-catalog-detail-root]").count()) await page.locator("[data-catalog-detail-root] h1").waitFor({state:"attached"});
 if(await page.locator("main[data-home-summary-ready]").count()) await page.waitForFunction(()=>document.querySelector("main").dataset.homeSummaryReady==="true");
 await page.evaluate(()=>document.fonts.ready);
}

async function measure(page){return page.evaluate(()=>{
 const rect=n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
 const visible=n=>{const s=getComputedStyle(n),r=n.getBoundingClientRect();return s.visibility!=="hidden"&&s.display!=="none"&&r.width>0&&r.height>0&&!n.closest("[hidden]");};
 const nav=document.querySelector("header.nav"), main=document.querySelector("main");
 const roots=[...main.children].filter(n=>visible(n)&&!n.matches(".footer,[data-cuac-footer],script,style,a,button"));
 const brand=nav?.querySelector(".brand-wordmark");
 const footer=document.querySelector(".footer");
 const badStyles=[...document.querySelectorAll('link[rel="stylesheet"]')].filter(n=>!n.sheet||/[\s<>"]/.test(decodeURI(n.href))).map(n=>n.getAttribute("href"));
 const clippedHeadings=[...main.querySelectorAll("h1,h2,h3,strong")].filter(visible).filter(n=>n.clientWidth>0&&n.scrollWidth>n.clientWidth+1&&getComputedStyle(n).overflowX==="visible").map(n=>({tag:n.tagName,text:n.textContent.trim().slice(0,90),client:n.clientWidth,scroll:n.scrollWidth}));
 const badText=[...main.querySelectorAll("h1,h2,h3,p,dt,dd,label,button,a,input,select,textarea")].filter(visible).filter(n=>{
  // Offscreen columns inside an explicitly scrollable table are intentional.
  for(let p=n.parentElement;p&&p!==main;p=p.parentElement)if(["auto","scroll"].includes(getComputedStyle(p).overflowX)&&p.scrollWidth>p.clientWidth)return false;
  const r=rect(n);return r.left< -1||r.right>innerWidth+1;
 }).slice(0,15).map(n=>({tag:n.tagName,class:n.className,text:(n.textContent||n.getAttribute("placeholder")||"").trim().slice(0,90),rect:rect(n)}));
 const group=nav?[nav.querySelector(".brand-lockup"),nav.querySelector(".nav-links"),nav.querySelector(".nav-actions")].filter(n=>n&&visible(n)):[];
 const navOverlap=group.flatMap((a,i)=>group.slice(i+1).filter(b=>{const x=rect(a),y=rect(b);return Math.min(x.right,y.right)-Math.max(x.left,y.left)>1&&Math.min(x.bottom,y.bottom)-Math.max(x.top,y.top)>1;}).map(b=>[a.className,b.className]));
 return {finalPath:location.pathname,lang:document.documentElement.lang,dir:getComputedStyle(main).direction,viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,main:rect(main),nav:nav?rect(nav):null,brand:brand?rect(brand):null,footer:footer?rect(footer):null,roots:roots.map(n=>({tag:n.tagName,class:n.className,rect:rect(n)})),badStyles,navOverlap,badText,clippedHeadings,h1:main.querySelectorAll("h1").length,navDestinations:nav?[...nav.querySelectorAll(".nav-links a")].map(n=>{const u=new URL(n.href);u.searchParams.delete("lang");return u.pathname+u.search+u.hash;}):[],footerLinks:document.querySelectorAll(".footer-col a").length};
 });}

async function inspect(page,meta,baseline){
 const m=await measure(page);const issues=[];
 if(m.documentWidth>meta.width+1)issues.push("document-overflow");
 if(m.badText.length)issues.push("content-outside-viewport");
 if(m.clippedHeadings.length)issues.push("heading-text-overflow");
 if(m.navOverlap.length)issues.push("navigation-overlap");
 if(meta.role!=="anonymous"&&m.finalPath!==new URL(meta.path,origin).pathname)issues.push("signed-in-workspace-redirected");
 if(m.badStyles.length)issues.push("stylesheet-missing-or-malformed");
 const authCard=m.roots.find(r=>r.class.includes("auth-card"));
 if(m.finalPath==="/auth.html"&&meta.width<=1080&&authCard&&Math.abs(authCard.rect.left+authCard.rect.right-meta.width)>2)issues.push("single-column-account-panel-off-center");
 if(Math.abs(m.main.left+m.main.right-meta.width)>2)issues.push("main-off-center");
 if(meta.path==="/auth-guardian-consent.html"&&Math.abs(m.main.width-Math.min(680,meta.width-32))>1)issues.push("account-content-width");
 if(m.brand&&m.brand.width<Math.min(300,meta.width-32)-1)issues.push("navigation-brand-compressed");
 if(m.footer&&m.nav&&(Math.abs(m.footer.left-m.nav.left)>1||Math.abs(m.footer.right-m.nav.right)>1))issues.push("footer-header-width");
 if(m.dir!==(meta.locale==="ar"?"rtl":"ltr"))issues.push("wrong-direction");
 if(m.nav){const expected=Math.min(1440,meta.width-(meta.width<=560?32:64));if(Math.abs(m.nav.width-expected)>1||Math.abs(m.nav.left-(meta.width-expected)/2)>1)issues.push("navigation-width");}
 if(baseline&&m.finalPath===baseline.finalPath){
  if(JSON.stringify(m.navDestinations)!==JSON.stringify(baseline.navDestinations))issues.push("language-navigation-parity");
  if(m.roots.length!==baseline.roots.length)issues.push("language-content-root-count");
  else if(m.roots.some((r,i)=>Math.abs(r.rect.width-baseline.roots[i].rect.width)>1||Math.abs((meta.locale==="ar"?2*meta.width-r.rect.left-r.rect.right:r.rect.left+r.rect.right)-(baseline.roots[i].rect.left+baseline.roots[i].rect.right))>2))issues.push("language-content-width");
 }
 const result={...meta,...m,issues,passed:issues.length===0};checks.push(result);
 if(issues.length)addFailure("layout",meta,{issues,badText:m.badText,clippedHeadings:m.clippedHeadings,navOverlap:m.navOverlap,roots:m.roots});
 return m;
}

async function checkMenus(page,meta){
 const toggle=page.locator("[data-primary-nav-toggle]");
 const mobile=await toggle.count()&&await toggle.isVisible();
 if(mobile)await toggle.click();
 for(const trigger of await page.locator(".nav-group-trigger").all()){
  await trigger.click();
  const result=await trigger.evaluate(n=>{
   const menu=n.closest(".nav-group").querySelector(".nav-dropdown"),r=menu.getBoundingClientRect();
   const links=[...menu.querySelectorAll("a")];
   const publicLocale=document.documentElement.lang==="zh-CN"?"en":document.documentElement.lang;
   return {expanded:n.getAttribute("aria-expanded"),left:r.left,right:r.right,width:r.width,links:links.length,badLocales:links.filter(a=>{const u=new URL(a.href);return u.origin===location.origin&&u.searchParams.get("lang")!==publicLocale&&!(publicLocale==="en"&&!u.searchParams.has("lang"));}).map(a=>a.getAttribute("href"))};
  });
  const passed=result.expanded==="true"&&result.width>0&&result.left>=-1&&result.right<=meta.width+1&&result.badLocales.length===0;
  menus.push({...meta,kind:"navigation",...result,passed});if(!passed)addFailure("navigation-menu",meta,result);
  await trigger.click();
 }
 if(mobile)await toggle.click();
 const language=page.locator(".language-selector-trigger");
 if(await language.count()){
  await language.click();
  const result=await page.locator(".language-selector-menu").evaluate(n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,options:n.querySelectorAll("[data-locale]").length};});
  const passed=result.left>=-1&&result.right<=meta.width+1&&result.options===6;
  menus.push({...meta,kind:"language",...result,passed});if(!passed)addFailure("language-menu",meta,result);
  await language.click();
 }
}

try{
 if(resumed)report.continuation={date:new Date().toISOString(),retainedChecks:resumed.checks.length,reason:"Public/student batches completed. Staff batches resumed through normal MFA; no MFA bypass. Final isolated account-popover changes are separately revalidated."};
 for(const role of resumed?["school","ops"]:["anonymous","student","school","ops"]){
  const context=await browser.newContext({reducedMotion:"reduce"});
  context.setDefaultTimeout(8000);
  context.setDefaultNavigationTimeout(15000);
  if(role!=="anonymous"){
   const login=await context.newPage();await localLayoutLogin(login,state,role);await login.close();
  }
  const selected=role==="anonymous"?routes:role==="student"?studentPages.map(name=>({path:`/${name}.html${name==="application"?`?applicationSet=${state.applicationSetId}`:""}`,locales:routes.find(r=>r.path===`/${name}.html`)?.locales||["en"]})): (role==="school"?["school-portal","school-settings-api"]:["ops-admin-api"]).map(name=>({path:`/${name}.html`,locales:["zh-CN"]}));
  for(const width of widths){
   const queue=selected.filter(r=>!filter||r.path.includes(filter));
   await Promise.all(Array.from({length:role==="anonymous"?6:1},async()=>{while(queue.length){
    const route=queue.shift();
    const page=await context.newPage();await page.setViewportSize({width,height:900});let baseline;
    for(const locale of [...route.locales,...(route.locales.length===6?["en"]:[])]){
     const meta={role,width,path:route.path,locale};
     try{
      if(!baseline){
       await page.goto(`${origin}${route.path}${route.path.includes("?")?"&":"?"}lang=${locale}`,{waitUntil:"networkidle"});
      }else{
       const before=new URL(page.url());let mode="selector";
       const selector=page.locator(".language-selector-trigger");
       if(!(await selector.count())){
        if(!/^\/auth(?:\/|-guardian)/.test(route.path)){addFailure("missing-language-selector",meta,{});continue;}
        mode="direct-language-load";
        await page.goto(`${origin}${route.path}?lang=${locale}`,{waitUntil:"networkidle"});
       }else{
        await selector.click();await page.locator(`.language-selector-option[data-locale="${locale}"]`).click();
        await page.waitForURL(u=>u.searchParams.get("lang")===locale,{waitUntil:"networkidle"});
       }
       const after=new URL(page.url());const normalize=u=>{u.searchParams.delete("lang");return u.pathname+"?"+u.searchParams+u.hash;};
       const passed=normalize(before)===normalize(after);
       switches.push({...meta,mode,passed});if(!passed)addFailure("switch-destination",meta,{before:String(before),after:String(after)});
      }
      await ready(page,locale);const m=await inspect(page,meta,baseline);if(!baseline)baseline=m;
      await checkMenus(page,meta);
     }catch(error){addFailure("execution",meta,String(error.message).slice(0,350));}
    }
    await page.close();
   }}));
   await fs.writeFile(`${dir}/site-layout-progress.json`,JSON.stringify(report,null,2));
   console.log(`Layout checked: ${role}/${width}; checks=${checks.length}; failures=${failures.length}`);
  }
  await context.close();
 }
 report.uniqueCombinations=new Set(checks.map(c=>[c.role,c.width,c.path,c.locale].join("|"))).size;
 report.selectorTransitions=switches.filter(s=>s.mode==="selector").length;
 report.directLanguageLoads=switches.filter(s=>s.mode==="direct-language-load").length;
 report.passed=failures.length===0;assert.equal(report.passed,true,"Layout/locale consistency failures; inspect site-layout-e2e.json");
}finally{
 await browser.close();await fs.writeFile(`${dir}/site-layout${filter?"-sample":""}-e2e.json`,JSON.stringify(report,null,2));
 console.log(JSON.stringify({passed:report.passed,checks:checks.length,switches:switches.length,menus:menus.length,failures:failures.length}));
}
