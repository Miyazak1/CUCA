import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const root = new URL("../", import.meta.url);

test("tuition formats numeric source text once and preserves unstructured official fees", async () => {
  const script = await source("public/catalog-detail.js");
  for (const [locale, expected] of [["en", "RMB 39,800/year"], ["vi", "39.800 RMB/năm"]]) {
    const format = vm.runInNewContext(`${functionBody(script, "formatMoney", "formatDuration")}\nformatMoney`, {
      detailLocale: locale, Intl,
      cleanText: value => typeof value === "string" ? value.trim() : "",
      detailUi: text => locale === "vi" && text === "year" ? "năm" : text,
    });
    assert.equal(format({ tuitionText: "RMB39,800yuan/year" }), expected);
    assert.equal(format({ tuitionAmount: 39800, tuitionCurrency: "CNY", tuitionPeriod: "year" }), expected);
    assert.equal(format({ tuitionText: "RMB 30,000–40,000/year" }), "RMB 30,000–40,000/year");
    assert.equal(format({ tuitionText: "Contact university for fees" }), "Contact university for fees");
    assert.equal(format({ displayTuition: "USD 5,000/year", tuitionAmount: 39800 }), "USD 5,000/year");
    assert.equal(format({}), "Not provided");
  }
});

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

function topLevelTypeKeys(typescript, typeName) {
  const marker = `export type ${typeName}`;
  const start = typescript.indexOf(marker);
  assert.notEqual(start, -1, `missing DTO ${typeName}`);
  const open = typescript.indexOf("{", start);
  let depth = 0;
  let close = -1;
  for (let index = open; index < typescript.length; index += 1) {
    if (typescript[index] === "{") depth += 1;
    if (typescript[index] === "}") depth -= 1;
    if (depth === 0) {
      close = index;
      break;
    }
  }
  assert.notEqual(close, -1, `unterminated DTO ${typeName}`);
  return [...typescript.slice(open + 1, close).matchAll(/^ {2}([A-Za-z][A-Za-z0-9]*)\??:/gm)]
    .map((match) => match[1]);
}

function functionBody(sourceText, functionName, nextFunctionName) {
  const start = sourceText.indexOf(`function ${functionName}`);
  const end = sourceText.indexOf(`function ${nextFunctionName}`, start + 1);
  assert.ok(start >= 0 && end > start, `missing function boundary for ${functionName}`);
  return sourceText.slice(start, end);
}

function memberKeys(sourceText, variable) {
  return new Set([...sourceText.matchAll(new RegExp(`\\b${variable}\\.([A-Za-z][A-Za-z0-9]*)`, "g"))]
    .map((match) => match[1]));
}

test("structured detail items retain DTO values and explanatory bodies without duplicates or source mutation", async () => {
  const script = await source("public/catalog-detail.js");
  const normalize = vm.runInNewContext(`${functionBody(script, "structuredItems", "titleCase")}\nstructuredItems`, {
    cleanText: value => typeof value === "string" ? value.trim() : "",
  });
  const items = [
    { label: "Master", value: "Bachelor's degree holder under age 35", body: null },
    { label: "Language", value: "HSK Level 4", body: "HSK Level 5 score 180", included: false },
    { value: "Passport" },
    { label: "Proof", value: "Proof", body: "Proof" },
    { label: "Upload", value: "PDF", note: "PDF" },
    null,
  ];
  const before = JSON.stringify(items);
  assert.deepEqual(JSON.parse(JSON.stringify(normalize(items))), [
    { label: "Master", body: "Bachelor's degree holder under age 35", included: null },
    { label: "Language", body: "HSK Level 4 HSK Level 5 score 180", included: false },
    { label: "Passport", body: "", included: null },
    { label: "Proof", body: "", included: null },
    { label: "Upload", body: "PDF", included: null },
  ]);
  assert.equal(JSON.stringify(items), before);
});

test("detail lists render degree labels and full conditions safely in every supported locale", async () => {
  const script = await source("public/catalog-detail.js");
  const labels = { en: "Master", vi: "Thạc sĩ", th: "ปริญญาโท", id: "Magister", ms: "Sarjana", ar: "ماجستير" };
  for (const [locale, label] of Object.entries(labels)) {
    const render = vm.runInNewContext(`${functionBody(script, "structuredItems", "titleCase")}\n${functionBody(script, "renderTextList", "renderScholarship")}\nrenderTextList`, {
      cleanText: value => typeof value === "string" ? value.trim() : "",
      detailUi: value => value === "Master" ? label : value,
      escapeHtml: value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"),
      renderEmpty: value => value,
    });
    const html = render([{ label: "Master", value: "Bachelor's degree holder under age 35", body: '<img src=x onerror="bad()">', included: false }], "Empty", true);
    assert.ok(html.includes(`<strong>${label}</strong>`), locale);
    assert.ok(html.includes("Bachelor's degree holder under age 35"), locale);
    assert.ok(html.includes("&lt;img"), locale);
    assert.ok(html.includes("catalog-item-excluded"), locale);
    assert.doesNotMatch(html, /<img/);
    assert.equal(render([], "Empty"), "Empty");
  }
});

function assertAllowedMembers(sourceText, variable, allowed, label) {
  const unexpected = [...memberKeys(sourceText, variable)].filter((field) => !allowed.has(field));
  assert.deepEqual(unexpected, [], `${label} uses fields outside its published DTO`);
}

test("catalog detail pages stay on published API fields", async () => {
  const [script, dto, requirements] = await Promise.all([
    source("public/catalog-detail.js"),
    source("src/server/catalog/dto.ts"),
    source("src/server/catalog/requirements.ts"),
  ]);

  const allowedRecordFields = new Set([
    ...topLevelTypeKeys(dto, "PublicProgramDto"),
    ...topLevelTypeKeys(dto, "PublicProgramDetailDto"),
    ...topLevelTypeKeys(dto, "PublicSchoolDto"),
    ...topLevelTypeKeys(dto, "PublicSchoolDetailDto"),
    ...topLevelTypeKeys(dto, "PublicScholarshipDto"),
    ...topLevelTypeKeys(dto, "PublicScholarshipDetailDto"),
    ...topLevelTypeKeys(dto, "PublicCityDto"),
    ...topLevelTypeKeys(dto, "PublicCityDetailDto"),
    ...topLevelTypeKeys(dto, "PublicGuideDto"),
  ]);
  const usedRecordFields = new Set([...script.matchAll(/\brecord\.([A-Za-z][A-Za-z0-9]*)/g)]
    .map((match) => match[1]));
  assert.deepEqual([...usedRecordFields].filter((field) => !allowedRecordFields.has(field)), []);

  for (const endpoint of [
    "/api/v1/catalog/${config.collection}?limit=100",
    "/api/v1/catalog/${config.collection}/${encodeURIComponent(identifier)}",
    "/api/v1/catalog/programs/${encodeURIComponent(record.id)}/intakes?limit=20",
  ]) {
    assert.ok(script.includes(endpoint), `missing ${endpoint}`);
  }

  for (const field of [
    "record.displayGroupLabel",
    "record.applicationNote",
    "record.tuitionBandLabel",
    "record.eligibilityItems",
    "record.summary",
    "record.tags",
    "record.references",
  ]) {
    assert.ok(script.includes(field), `missing published DTO field ${field}`);
  }

  assert.match(script, /typeof value === "boolean"/);
  assert.match(script, /item\.label \|\| item\.title \|\| item\.name \|\| item\.value/);
  assert.match(script, /item\.body \|\| item\.note \|\| item\.text \|\| item\.description/);
  assert.match(script, /typeof item\.included === "boolean"/);
  assert.match(script, /textItems\(item\.paragraphs\)/);
  assert.match(script, /if \(!content\) return ""/);
  assert.match(script, /formatDate\(firstIntake\.deadlineDate, firstIntake\.deadlineLabel \|\| "Not provided"\)/);
  assert.match(script, /formatDate\(item\.deadlineDate, item\.deadlineLabel \|\| "Deadline not provided"\)/);
  assert.doesNotMatch(script, /deadlineLabel \|\| formatDate\([^)]*deadlineDate/);
  assert.doesNotMatch(script, /actualSchoolCount|actualProgramCount|contactInfo|qualityScore|missingFields|fitNotes|CuacDataClient|localStorage|sessionStorage/);
  assert.doesNotMatch(script, /Verified source|Source-backed tags and highlights/);
  assert.match(script, /class="catalog-source-link"/);

  assertAllowedMembers(functionBody(script, "renderIntakes", "renderRequirements"), "intake",
    new Set(topLevelTypeKeys(dto, "PublicProgramIntakeDto")), "program intake rendering");
  assertAllowedMembers(functionBody(script, "renderRequirements", "renderProgram"), "item",
    new Set(topLevelTypeKeys(requirements, "RequirementItem")), "program requirement rendering");
  assertAllowedMembers(functionBody(script, "renderDeadlineItems", "renderSchool"), "item",
    new Set(topLevelTypeKeys(dto, "PublicSchoolUpcomingDeadlineDto")), "school deadline rendering");
});

test("catalog detail layout remains restrained and responsive", async () => {
  const [css, ...pages] = await Promise.all([
    source("public/catalog-detail.css"),
    ...["program-detail.html", "university-detail.html", "scholarship-detail.html", "city-detail.html"]
      .map((file) => source(`public/${file}`)),
  ]);

  assert.match(css, /--detail-width:\s*min\(1180px/);
  assert.match(css, /\.catalog-record-code/);
  assert.match(css, /font-size:\s*44px/);
  assert.match(css, /@media \(max-width: 560px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(css, /box-shadow|linear-gradient|radial-gradient/);

  for (const html of pages) {
    assert.match(html, /<body data-agent-mode="off" data-catalog-detail-page=/);
    assert.match(html, /href="catalog-detail\.css(?:\?[^"]+)?"/);
    assert.match(html, /src="catalog-detail\.js(?:\?[^"]+)?"/);
    assert.doesNotMatch(html, /cuac-data\.js|cuac-actions\.js|completion\.js|data-cuac-agent/);
  }
});

test("core catalog detail pages preserve the selected public locale", async () => {
  const pages = await Promise.all(["program-detail.html", "university-detail.html", "scholarship-detail.html", "city-detail.html"]
    .map((file) => source(`public/${file}`)));
  for (const html of pages) {
    assert.match(html, /data-i18n-locales="en,vi,th,id,ms,ar"/);
    assert.ok(html.indexOf("i18n-runtime.js") < html.indexOf("catalog-detail-i18n.js"));
    assert.ok(html.indexOf("catalog-detail-i18n.js") < html.indexOf("shared-shell.js"));
    assert.ok(html.indexOf("shared-shell.js") < html.indexOf("catalog-detail.js"));
  }

  const script = await source("public/catalog-detail-i18n.js");
  const expected = {
    vi: "Quay lại chương trình",
    th: "กลับไปยังหลักสูตร",
    id: "Kembali ke program",
    ms: "Kembali ke program",
    ar: "العودة إلى البرامج",
  };
  for (const [locale, backLabel] of Object.entries(expected)) {
    const context = {
      URL,
      Node: { ELEMENT_NODE: 1 },
      MutationObserver: class { observe() {} },
      location: { href: "https://example.test/program-detail.html?program=one", origin: "https://example.test" },
      document: { body: {}, querySelectorAll: () => [] },
      window: { CUACI18n: { locale } },
    };
    vm.runInNewContext(script, context);
    assert.equal(context.window.CUACCatalogDetailI18n.ui("Back to programs"), backLabel);
    assert.equal(context.window.CUACCatalogDetailI18n.href("programs.html"), `/programs.html?lang=${locale}`);
    assert.notEqual(context.window.CUACCatalogDetailI18n.ui("Record unavailable"), "Record unavailable");
  }
});

test('academic detail values use body context while UI materials heading stays separate',async()=>{
 const script=await source('public/catalog-detail.js');
 const display=vm.runInNewContext(functionBody(script,'displayValue','hasDisplayValue')+'\ndisplayValue',{window:{CUACCatalogContent:{text:s=>s==='Materials'?'Vật liệu':s}},cleanText:s=>String(s??'').trim(),detailUi:s=>s==='Materials'?'Hồ sơ':s});
 assert.equal(display('Materials'),'Vật liệu');assert.equal(display(true),'Yes');assert.equal(display(null),'Not provided');
});

test('UI distinguishes unpublished CSCA requirements from no requirement in Thai and Indonesian',async()=>{
 const script=await source('public/catalog-detail-i18n.js');
 for(const [locale,marker] of [['th','เผยแพร่'],['id','dipublikasikan']]){
  const window={CUACI18n:{locale,register(){},t:(_key,fallback)=>fallback}},document={title:'UCAC',body:{dataset:{}},querySelectorAll:()=>[]};
  vm.runInNewContext(script,{window,document,MutationObserver:class{observe(){}}});
  assert.ok(window.CUACCatalogDetailI18n.ui('No CSCA requirement is published for this graduate route.').includes(marker));
 }
});
