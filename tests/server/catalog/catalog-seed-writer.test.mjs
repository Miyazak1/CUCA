import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { CatalogSeedWriter } from "../../../src/server/index.ts";

test("catalog seed writer performs fixed-order parameterized upserts with source evidence", async () => {
  const sample = JSON.parse(await readFile(new URL("../../../seeds/catalog.sample.json", import.meta.url), "utf8"));
  const calls = [];
  const ids = ["city-id", "school-id", "program-id", "scholarship-id"];
  const writer = new CatalogSeedWriter({
    async query(statement, params) {
      calls.push({ statement, params });

      if (/returning id/.test(statement)) {
        return [{ id: ids.shift() }];
      }

      return [];
    },
  });

  const result = await writer.writeBundle(sample);

  assert.equal(result.ok, true);
  assert.deepEqual(
    result.written.map((entity) => `${entity.entityType}:${entity.slug}:${entity.id}`),
    [
      "city:beijing:city-id",
      "school:sample-university:school-id",
      "program:sample-university-computer-science-bachelor:program-id",
      "scholarship:sample-scholarship:scholarship-id",
    ],
  );
  assert.equal(result.summary.evidence, 4);
  assert.equal(calls.length, 8);
  assert.match(calls[0].statement, /insert into cities/);
  assert.match(calls[1].statement, /insert into catalog_source_evidence/);
  assert.match(calls[2].statement, /insert into schools/);
  assert.match(calls[4].statement, /insert into programs/);
  assert.match(calls[6].statement, /insert into scholarships/);
  assert.equal(calls[0].params[0], "beijing");
  assert.equal(calls[2].params[5], "beijing");
  assert.equal(calls[4].params[1], "sample-university");
  assert.equal(calls[6].params[3], "sample-university");
  assert.equal(calls[6].params[4], "sample-university-computer-science-bachelor");
  assert.match(calls[6].statement, /body_sections/);
  assert.match(calls[6].statement, /application_materials/);
  assert.match(calls[6].statement, /deadline_date/);
});

test("catalog seed writer does not issue SQL for invalid bundles", async () => {
  const calls = [];
  const writer = new CatalogSeedWriter({
    async query(statement, params) {
      calls.push({ statement, params });
      return [];
    },
  });

  const result = await writer.writeBundle({
    version: 1,
    generatedAt: "2026-08-28T00:00:00.000Z",
    programs: [{ slug: "program-a", schoolSlug: "missing-school", nameEn: "Program A", degreeLevel: "bachelor" }],
  });

  assert.equal(result.ok, false);
  assert.equal(calls.length, 0);
});

test("catalog seed writer avoids dynamic SQL identifiers", async () => {
  const sample = JSON.parse(await readFile(new URL("../../../seeds/catalog.sample.json", import.meta.url), "utf8"));
  const calls = [];
  const writer = new CatalogSeedWriter({
    async query(statement, params) {
      calls.push({ statement, params });
      return /returning id/.test(statement) ? [{ id: `id-${calls.length}` }] : [];
    },
  });

  await writer.writeBundle(sample);

  for (const call of calls) {
    assert.doesNotMatch(call.statement, /select \*/i);
    assert.doesNotMatch(call.statement, /\$\{|\+.*statement/);
  }
});


test("catalog seed writer persists rich UIBE fields, intake state and snapshot checksums", async () => {
  const bundle = JSON.parse(await readFile(new URL("../../../seeds/catalog.uibe-rich.review.json", import.meta.url), "utf8"));
  const calls = [];
  let id = 0;
  const writer = new CatalogSeedWriter({
    async query(statement, params) {
      calls.push({ statement, params });
      return /returning id/.test(statement) ? [{ id: `rich-id-${++id}` }] : [];
    },
  });

  const result = await writer.writeBundle(bundle);

  assert.equal(result.ok, true);
  assert.deepEqual(result.summary, {
    cities: 1,
    schools: 1,
    programs: 9,
    programIntakes: 1,
    scholarships: 0,
    evidence: 12,
  });

  const schoolDetails = calls.find(call => /update schools set/.test(call.statement));
  assert.ok(schoolDetails);
  assert.equal(schoolDetails.params[7], "The nine listed English-taught undergraduate programs publish tuition of 49,750 RMB per academic year.");
  assert.equal(schoolDetails.params[11], true);

  const programDetails = calls.find(call => /update programs set/.test(call.statement));
  assert.ok(programDetails);
  assert.equal(programDetails.params[2], 4);
  assert.equal(programDetails.params[10], 49750);

  const intake = calls.find(call => /insert into program_intakes/.test(call.statement));
  assert.ok(intake);
  assert.equal(intake.params[1], "Fall");
  assert.equal(intake.params[2], 2026);
  assert.equal(intake.params[7], "closed");

  const checksumEvidence = calls.find(call =>
    /insert into catalog_source_evidence/.test(call.statement)
    && call.params[5] === "b77856a6ce97b5493fba22f07a8faa2248cfb843ff2d01ad9081ee716eaee2f2");
  assert.ok(checksumEvidence);
  assert.match(checksumEvidence.statement, /checksum/);
  assert.equal(checksumEvidence.params.length, 8);
});

test("catalog seed writer can preserve validated city and school dependencies without replaying them", async () => {
  const sample = JSON.parse(await readFile(new URL("../../../seeds/catalog.sample.json", import.meta.url), "utf8"));
  const calls = [];
  const writer = new CatalogSeedWriter({
    async query(statement, params) {
      calls.push({ statement, params });
      if (/select id from cities/.test(statement)) return [{ id: "existing-city" }];
      if (/select id from schools/.test(statement)) return [{ id: "existing-school" }];
      if (/returning id/.test(statement)) return [{ id: `new-${calls.length}` }];
      return [];
    },
  });

  const result = await writer.writeBundle(sample, {
    preserveExistingCitySlugs: ["beijing"],
    preserveExistingSchoolSlugs: ["sample-university"],
  });

  assert.equal(result.ok, true);
  assert.equal(result.summary.evidence, 2);
  assert.equal(calls.filter(call => /insert into cities|insert into schools/.test(call.statement)).length, 0);
  assert.equal(calls.filter(call => /^select id from cities|^select id from schools/.test(call.statement)).length, 2);
  assert.equal(calls.filter(call => /insert into programs|insert into scholarships/.test(call.statement)).length, 2);
});

test("catalog seed writer persists reviewed verification for schools and programs", async () => {
  const calls = [];
  let id = 0;
  const writer = new CatalogSeedWriter({
    async query(statement, params) {
      calls.push({ statement, params });
      return /returning id/.test(statement) ? [{ id: `verified-id-${++id}` }] : [];
    },
  });
  const verifiedAt = "2026-09-11T05:18:46.068Z";
  const source = {
    sourceUrl: "https://official.example/catalog", sourceLabel: "Official catalog",
    sourceFieldLineage: { nameEn: "official heading" }, verificationStatus: "verified", lastVerifiedAt: verifiedAt,
  };

  const result = await writer.writeBundle({
    version: 1, generatedAt: verifiedAt,
    schools: [{ slug: "school-a", nameEn: "School A", ...source }],
    programs: [{ slug: "program-a", schoolSlug: "school-a", nameEn: "Program A", degreeLevel: "bachelor", ...source }],
  });

  assert.equal(result.ok, true);
  const school = calls.find(call => /insert into schools/.test(call.statement));
  const program = calls.find(call => /insert into programs/.test(call.statement));
  assert.match(school.statement, /verification_status/);
  assert.equal(school.params[10], "verified");
  assert.equal(school.params[11], verifiedAt);
  assert.match(program.statement, /is_verified/);
  assert.equal(program.params[11], true);
  assert.equal(program.params[12], "verified");
  assert.equal(program.params[13], verifiedAt);
});

test("sparse scholarship upserts preserve existing rich fields while explicit arrays can clear them", async () => {
  const calls = [];
  let id = 0;
  const writer = new CatalogSeedWriter({
    async query(statement, params) {
      calls.push({ statement, params });
      return /returning id/.test(statement) ? [{ id: `sparse-id-${++id}` }] : [];
    },
  });

  const result = await writer.writeBundle({
    version: 1,
    generatedAt: "2026-09-11T00:00:00.000Z",
    schools: [{
      slug: "school-a", nameEn: "School A",
      sourceUrl: "https://official.example/school", sourceLabel: "Official school",
      sourceFieldLineage: { nameEn: "official page heading" },
    }],
    scholarships: [{
      slug: "award-a", title: "Award A", schoolSlug: "school-a",
      benefitItems: [],
      sourceUrl: "https://official.example/award", sourceLabel: "Official award",
      sourceFieldLineage: { title: "official page heading" },
    }],
  });

  assert.equal(result.ok, true);
  const scholarship = calls.find(call => /insert into scholarships/.test(call.statement));
  assert.ok(scholarship);
  assert.equal(scholarship.params[16], null, "omitted body sections must remain distinguishable from an empty array");
  assert.equal(scholarship.params[17], "[]", "an explicit empty benefit array must remain able to clear the field");
  assert.equal(scholarship.params[31], null, "omitted status must preserve the existing status on conflict");
  assert.equal(scholarship.params[32], null, "omitted verification status must preserve the existing state on conflict");
  assert.equal(scholarship.params[33], null, "omitted verification time must preserve the existing time on conflict");
  assert.match(scholarship.statement, /body_sections = coalesce\(\$17::jsonb, scholarships\.body_sections\)/);
  assert.match(scholarship.statement, /benefit_items = coalesce\(\$18::jsonb, scholarships\.benefit_items\)/);
  assert.match(scholarship.statement, /status = coalesce\(\$32, scholarships\.status\)/);
  assert.match(scholarship.statement, /verification_status = coalesce\(\$33, scholarships\.verification_status\)/);
  assert.match(scholarship.statement, /last_verified_at = coalesce\(\$34::timestamptz, scholarships\.last_verified_at\)/);
});

test("catalog seed writer persists rich reviewed city fields", async () => {
  const calls = [];
  const writer = new CatalogSeedWriter({ async query(statement, params) {
    calls.push({ statement, params });
    return /returning id/.test(statement) ? [{ id: "city-rich-id" }] : [];
  } });
  const verifiedAt = "2026-09-22T00:00:00.000Z";
  const result = await writer.writeBundle({
    version: 1, generatedAt: verifiedAt,
    cities: [{
      slug: "beijing", nameEn: "Beijing", nameZh: "北京", monthlyCostRmb: 5500,
      tags: ["research"], nearby: ["tianjin"], content: { summary: "Reviewed summary" },
      status: "active", verificationStatus: "verified", lastVerifiedAt: verifiedAt,
      nextReviewDueAt: "2027-03-22T00:00:00.000Z",
      sourceUrl: "https://official.example/beijing", sourceLabel: "Official Beijing source",
      sourceFieldLineage: { nameEn: "heading", content: "reviewed sections" },
    }],
  });
  assert.equal(result.ok, true, result.errors?.join("\n"));
  const city = calls.find(call => /insert into cities/.test(call.statement));
  assert.ok(city);
  assert.equal(city.params[6], 5500);
  assert.equal(city.params[9], JSON.stringify(["research"]));
  assert.equal(city.params[10], JSON.stringify({ summary: "Reviewed summary" }));
  assert.equal(city.params[15], "verified");
  assert.equal(city.params[16], verifiedAt);
  assert.equal(city.params[17], "2027-03-22T00:00:00.000Z");
  assert.match(city.statement, /content_json = excluded\.content_json/);
});
