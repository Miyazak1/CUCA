import assert from "node:assert/strict";
import test from "node:test";
import {
  diffOfficialCatalogManifests,
  fetchOfficialCatalogSource,
  validateOfficialCatalogSourceRegistry,
} from "../../../src/server/index.ts";

const validSource = {
  id: "official-admissions",
  label: "Official admissions",
  url: "https://admissions.example.edu/2026",
  allowedHosts: ["admissions.example.edu"],
  sourceRole: "school-admissions",
  schoolSlug: "example-university",
};

test("official source registry requires exact HTTPS public hosts", () => {
  assert.deepEqual(validateOfficialCatalogSourceRegistry({ version: 1, sources: [validSource] }), []);
  const errors = validateOfficialCatalogSourceRegistry({
    version: 1,
    sources: [{ ...validSource, url: "https://evil.example/2026", allowedHosts: ["*.example.edu", "localhost"] }],
  });
  assert.ok(errors.some((error) => error.includes("without wildcards")));
  assert.ok(errors.some((error) => error.includes("hostname is not in allowedHosts")));
});

test("official source fetch follows only allowlisted redirects and hashes the snapshot", async () => {
  const calls = [];
  const snapshot = await fetchOfficialCatalogSource(validSource, {
    now: () => new Date("2026-09-10T00:00:00.000Z"),
    fetchImpl: async (url, init) => {
      calls.push({ url, redirect: init.redirect, userAgent: init.headers["user-agent"] });
      if (url.endsWith("/2026")) return new Response(null, { status: 302, headers: { location: "/2026/index.html" } });
      return new Response("<h1>Official 2026 admissions</h1>", { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
    },
  });
  assert.equal(snapshot.metadata.finalUrl, "https://admissions.example.edu/2026/index.html");
  assert.equal(snapshot.metadata.fetchedAt, "2026-09-10T00:00:00.000Z");
  assert.match(snapshot.metadata.sha256, /^[a-f0-9]{64}$/);
  assert.equal(calls.length, 2);
  assert.ok(calls.every((call) => call.redirect === "manual"));
  assert.match(calls[0].userAgent, /no recursive crawling/);
});

test("official source fetch fails closed on cross-host redirects and unsupported content", async () => {
  await assert.rejects(
    fetchOfficialCatalogSource(validSource, {
      fetchImpl: async () => new Response(null, { status: 302, headers: { location: "https://mirror.example/2026" } }),
    }),
    /hostname is not in allowedHosts/,
  );
  await assert.rejects(
    fetchOfficialCatalogSource(validSource, {
      fetchImpl: async () => new Response("{}", { status: 200, headers: { "content-type": "application/json" } }),
    }),
    /unsupported content type/,
  );
  await assert.rejects(
    fetchOfficialCatalogSource(validSource, {
      fetchImpl: async () => new Response("not a PDF", { status: 200, headers: { "content-type": "application/octet-stream" } }),
    }),
    /unsupported content type/,
  );
});

test("official source fetch accepts an octet-stream only when its bytes are a PDF", async () => {
  const snapshot = await fetchOfficialCatalogSource(validSource, {
    fetchImpl: async () => new Response(new TextEncoder().encode("%PDF-1.7\n% official"), {
      status: 200,
      headers: { "content-type": "application/octet-stream" },
    }),
  });
  assert.equal(snapshot.metadata.contentType, "application/pdf");
});

test("official source fetch accepts a DOCX MIME type and recognizes a DOCX octet-stream by ZIP entries", async () => {
  const declared = await fetchOfficialCatalogSource(validSource, {
    fetchImpl: async () => new Response(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), {
      status: 200,
      headers: { "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
    }),
  });
  assert.equal(declared.metadata.contentType, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");

  const disguisedBytes = new TextEncoder().encode("PK\u0003\u0004mock archive data word/document.xml");
  const disguised = await fetchOfficialCatalogSource(validSource, {
    fetchImpl: async () => new Response(disguisedBytes, {
      status: 200,
      headers: { "content-type": "application/octet-stream" },
    }),
  });
  assert.equal(disguised.metadata.contentType, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
});

test("official source fetch accepts declared images and recognizes JPEG octet-stream bytes", async () => {
  const declared = await fetchOfficialCatalogSource(validSource, {
    fetchImpl: async () => new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), {
      status: 200,
      headers: { "content-type": "image/jpeg" },
    }),
  });
  assert.equal(declared.metadata.contentType, "image/jpeg");

  const disguised = await fetchOfficialCatalogSource(validSource, {
    fetchImpl: async () => new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0, 0]), {
      status: 200,
      headers: { "content-type": "application/octet-stream" },
    }),
  });
  assert.equal(disguised.metadata.contentType, "image/jpeg");
});

test("official source manifests produce deterministic content-level diffs", () => {
  const source = (id, sha256) => ({ id, sha256 });
  const before = { version: 1, generatedAt: "before", registrySha256: "a", sources: [source("same", "1"), source("changed", "2"), source("removed", "3")] };
  const after = { version: 1, generatedAt: "after", registrySha256: "b", sources: [source("same", "1"), source("changed", "4"), source("added", "5")] };
  assert.deepEqual(diffOfficialCatalogManifests(before, after), {
    added: ["added"],
    removed: ["removed"],
    changed: [{ id: "changed", beforeSha256: "2", afterSha256: "4" }],
    unchanged: ["same"],
  });
});
