import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = path => readFile(new URL(path, root), "utf8");

test("public and Hub app routes redirect away from the local-storage prototype", async () => {
  const routes = await Promise.all([
    source("app/page.tsx"),
    source("app/programs/page.tsx"),
    source("app/programs/[programId]/page.tsx"),
    source("app/hub/page.tsx"),
    source("app/hub/applications/[applicationId]/page.tsx"),
  ]);
  const combined = routes.join("\n");

  assert.match(combined, /redirect\("\/home-v3\.html"\)/);
  assert.match(combined, /redirect\("\/programs\.html"\)/);
  assert.match(combined, /redirect\(`\/program-detail\.html\?program=\$\{encodeURIComponent\(programId\)\}`\)/);
  assert.match(combined, /redirect\("\/hub-api\.html"\)/);
  assert.match(combined, /redirect\(`\/application\.html\?applicationSet=\$\{encodeURIComponent\(applicationId\)\}`\)/);
  assert.doesNotMatch(combined, /CuacApp|localStorage|mock-fields/);
});

test("application route locator selects only an exact owned application set", async () => {
  const script = await source("public/application.js");

  assert.match(script, /APPLICATION_SET_LOCATOR_PATTERN/);
  assert.match(script, /const routeParams = new URLSearchParams\(location\.search\)/);
  assert.match(script, /routeParams\.get\("applicationSet"\)/);
  assert.match(script, /routeParams\.get\("invoiceId"\)/);
  assert.match(script, /requestedInvoice\?\.applicationSetId \|\| directApplicationSetLocator/);
  assert.match(script, /sets\.find\(\(applicationSet\) => applicationSet\?\.id === applicationSetLocator\)/);
  assert.match(script, /requested application set is not available to this student account/);
  assert.doesNotMatch(script, /applicationSetLocator[^\n]+\|\| sets\[0\]/);
});
