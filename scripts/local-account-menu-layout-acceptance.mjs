import fs from "node:fs/promises";
import assert from "node:assert/strict";
import {localAcceptanceBrowser} from "./lib/local-browser-acceptance.mjs";
import {assertLocalDevelopmentState} from "./lib/local-development.ts";
import {localLayoutLogin} from "./lib/local-layout-login.mjs";
const state=JSON.parse(await fs.readFile(".cuac-local/runtime.json","utf8"));assertLocalDevelopmentState(state);
const origin=`http://127.0.0.1:${state.applicationPort}`;
const {chromium,executablePath}=localAcceptanceBrowser();const browser=await chromium.launch({headless:true,executablePath});
const report={date:new Date().toISOString(),deployed:false,scope:"Actual signed-in account popovers on every released student, school and operations workspace, declared languages, six widths, 667px height. No logout or workspace mutation.",checks:[],failed:[],passed:false};
try{
 for(const role of ["student","school","ops"]){
  const context=await browser.newContext({reducedMotion:"reduce"});context.setDefaultTimeout(8000);
  const page=await context.newPage();await localLayoutLogin(page,state,role);await page.close();
  const names=role==="student"?["hub-api","favourites-api","preferences-api","onboarding-api","notifications","billing-api","application"]:role==="school"?["school-portal","school-settings-api"]:["ops-admin-api"];
  const jobs=[];
  for(const name of names){
   const source=await fs.readFile(`public/${name}.html`,"utf8");
   const locales=source.includes('data-i18n-locales="en,vi,th,id,ms,ar"')?["en","vi","th","id","ms","ar"]:[source.match(/<html\b[^>]*\blang="([^"]+)"/)?.[1]||"en"];
   for(const width of [320,375,768,1024,1280,1920])for(const locale of locales)jobs.push({role,name,width,locale});
  }
  await Promise.all(Array.from({length:3},async()=>{while(jobs.length){
   const meta=jobs.shift(),page=await context.newPage();await page.setViewportSize({width:meta.width,height:667});
   try{
    const url=new URL(`${origin}/${meta.name}.html`);url.searchParams.set("lang",meta.locale);if(meta.name==="application")url.searchParams.set("applicationSet",state.applicationSetId);
    await page.goto(String(url),{waitUntil:"networkidle"});
    await page.waitForFunction(()=>document.querySelector("[data-account-menu-trigger]"));
    const trigger=page.locator("[data-account-menu-trigger]");await trigger.click();
    await page.locator("[data-account-menu-popover]").evaluate(n=>Promise.all(n.getAnimations().map(animation=>animation.finished)));
    const geometry=await page.locator("[data-account-menu-popover]").evaluate(n=>{
     const r=n.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,client:n.clientWidth,scroll:n.scrollWidth,hidden:n.hidden,links:[...n.querySelectorAll("a")].map(a=>{const r=a.getBoundingClientRect(),u=new URL(a.href);return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,locale:u.searchParams.get("lang"),path:u.pathname};})};
    });
    await page.keyboard.press("Escape");const closed=await trigger.getAttribute("aria-expanded")==="false";
    const passed=!geometry.hidden&&geometry.width>0&&geometry.left>=-1&&geometry.right<=meta.width+1&&geometry.top>=-1&&geometry.bottom<=668&&geometry.scroll<=geometry.client+1&&geometry.links.every(a=>a.left>=geometry.left-1&&a.right<=geometry.right+1&&a.top>=geometry.top-1&&a.bottom<=geometry.bottom+1&&(meta.role!=="student"||a.locale===meta.locale||meta.locale==="en"&&!a.locale))&&closed;
    const result={...meta,...geometry,viewportWidth:meta.width,menuWidth:geometry.width,escapeCloses:closed,passed};report.checks.push(result);if(!passed){report.failed.push(result);console.log(JSON.stringify(result));}
   }catch(error){const result={...meta,error:String(error.message),passed:false};report.checks.push(result);report.failed.push(result);console.log(JSON.stringify(result));}finally{await page.close();}
  }}));
  await context.close();console.log(`Account menu layout: ${role}; checks=${report.checks.length}; failures=${report.failed.length}`);
 }
 report.passed=report.failed.length===0;assert.equal(report.passed,true,"Account popover layout failed");
}finally{await browser.close();await fs.writeFile("output/feedback-20261112/account-menu-layout-e2e.json",JSON.stringify(report,null,2));}
console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,failures:report.failed.length}));
