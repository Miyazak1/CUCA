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
  assert.equal(calls[6].params[2], "sample-university");
  assert.equal(calls[6].params[3], "sample-university-computer-science-bachelor");
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
