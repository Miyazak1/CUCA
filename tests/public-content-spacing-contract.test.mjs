import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("public editorial pages use one bounded vertical rhythm and a separated footer", async () => {
  const [guides, insights, sharedShell, publicSiteShell] = await Promise.all([
    source("app/guides/guides.module.css"),
    source("app/insights/insights.module.css"),
    source("public/shared-shell.css"),
    source("app/public-site-shell.tsx"),
  ]);

  for (const css of [guides, insights]) {
    assert.match(css, /--content-main-top:/);
    assert.match(css, /--content-main-bottom:/);
    assert.match(css, /\.page\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;[^}]*min-height:\s*100vh;/s);
    assert.match(css, /\.main\s*\{[^}]*flex:\s*1 0 auto;[^}]*padding:\s*var\(--content-main-top\) 0 var\(--content-main-bottom\);/s);
    assert.match(css, /\.page :global\(\.footer\)[^{]*\{[^}]*border-top:/s);
    assert.doesNotMatch(css, /padding:\s*72px 0 96px|padding:\s*64px 0 80px/);
  }

  assert.match(sharedShell, /\.nav\s*\{[^}]*width:\s*var\(--shell-page-width\);[^}]*max-width:\s*var\(--shell-page-width\);/s);
  assert.match(publicSiteShell, /SHELL_RELEASE\s*=\s*"20261020-nav-width"/);
});

test("catalog detail pages do not stack a large page gap above the shared footer", async () => {
  const css = await source("public/catalog-detail.css");
  assert.match(css, /\.catalog-detail-main\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/s);
  assert.match(css, /\.catalog-detail-main > \[data-cuac-footer\][^{]*\{[^}]*margin-top:\s*auto;[^}]*border-top:/s);
  assert.match(css, /\.catalog-detail-shell\s*\{[^}]*padding:\s*26px 0 44px;/s);
  assert.doesNotMatch(css, /padding:\s*26px 0 76px/);
});
