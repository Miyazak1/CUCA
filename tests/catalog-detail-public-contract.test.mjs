import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

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
    assert.match(html, /href="catalog-detail\.css"/);
    assert.match(html, /src="catalog-detail\.js"/);
    assert.doesNotMatch(html, /cuac-data\.js|cuac-actions\.js|completion\.js|data-cuac-agent/);
  }
});
