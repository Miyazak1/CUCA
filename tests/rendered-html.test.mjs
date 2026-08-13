import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server redirects the root route to the CUAC static demo home", async () => {
  const response = await render();
  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "/home-v3.html");
});

test("keeps the CUAC app shell and static demo assets wired", async () => {
  const [page, layout, packageJson, home, programs, universities, sharedJs, sharedCss] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../public/home-v3.html", import.meta.url), "utf8"),
    readFile(new URL("../public/programs.html", import.meta.url), "utf8"),
    readFile(new URL("../public/universities.html", import.meta.url), "utf8"),
    readFile(new URL("../public/shared-shell.js", import.meta.url), "utf8"),
    readFile(new URL("../public/shared-shell.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /export const metadata:\s*Metadata/);
  assert.match(page, /redirect\("\/home-v3\.html"\)/);
  assert.match(page, /CUAC \| China admissions for international students/);
  assert.match(layout, /CUAC \| China university application workspace/);
  assert.match(layout, /favicon\.svg/);
  assert.match(packageJson, /"vinext": "1\.0\.0-beta\.2"/);

  assert.match(home, /data-active="home"/);
  assert.match(programs, /data-active="programs"/);
  assert.match(universities, /data-active="universities"/);
  assert.match(sharedJs, /function renderHeader/);
  assert.match(sharedJs, /function renderFooter/);
  assert.match(sharedJs, /function renderAgentShell/);
  assert.match(sharedCss, /\.cuac-agent-composer/);

  await assert.rejects(
    access(new URL("public/_sites-preview", templateRoot)),
  );
});

test("keeps the CUAC Agent scenario picker available and contained", async () => {
  const [shellJs, shellCss, spec] = await Promise.all([
    readFile(new URL("../public/shared-shell.js", import.meta.url), "utf8"),
    readFile(new URL("../public/shared-shell.css", import.meta.url), "utf8"),
    readFile(new URL("../public/AGENT_SIDEBAR_INTERACTION_SPEC.md", import.meta.url), "utf8"),
  ]);

  assert.match(shellJs, /const agentScenarios = \[/);
  assert.match(shellJs, /data-agent-scenario-trigger/);
  assert.match(shellJs, /data-agent-scenario-menu/);
  assert.match(shellJs, /data-cuac-agent-resize/);
  assert.match(shellJs, /panel\.classList\.toggle\("wide", wide\)/);
  assert.match(shellJs, /Find English-taught computer science master in Hangzhou/);
  assert.match(shellJs, /Summarize my progress and blockers/);
  assert.match(shellJs, /Will I definitely get scholarship\?/);
  assert.match(shellJs, /composer\?\.classList\.toggle\("menu-open", open\)/);

  assert.match(shellCss, /\.cuac-agent-composer\.in-panel \.cuac-scenario-menu/);
  assert.match(shellCss, /\.cuac-agent-panel\.wide\s*\{[\s\S]*width:\s*min\(760px,\s*50vw\)/);
  assert.match(shellCss, /\.cuac-agent-resize\s*\{/);
  assert.match(shellCss, /\.cuac-agent-form\s*\{[\s\S]*position:\s*relative/);
  assert.match(shellCss, /\.cuac-agent-composer\.in-panel \.cuac-scenario-picker\s*\{[\s\S]*position:\s*static/);
  assert.match(shellCss, /\.cuac-scenario-menu\[hidden\]\s*\{[\s\S]*display:\s*none/);
  assert.match(shellCss, /max-height:\s*min\(300px,\s*calc\(100vh - 360px\)\)/);
  assert.match(shellCss, /\.cuac-agent-composer\.in-panel\.menu-open \.cuac-agent-form/);
  assert.match(shellCss, /\.cuac-agent-composer\.in-panel \.cuac-scenario-trigger span\s*\{[\s\S]*display:\s*none/);

  assert.match(spec, /Demo Scenario Coverage Standard/);
  assert.match(spec, /Demo Scenario Router Requirements/);
  assert.match(spec, /\| Risk \| "Will I definitely get scholarship\?" \| Caution \+ source\/adviser step \|/);
});
