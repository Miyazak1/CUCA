import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import test from "node:test";
import { EDITORIAL_LOCALES, editorial, editorialHref, editorialLocale, editorialMetadata, hasEditorialTranslation, localizeGuide, localizeInsight } from "../src/content/editorial.ts";
import { listInsights } from "../src/content/insights.ts";
import { GET as legacyGuide } from "../app/guide-detail.html/route.ts";

const directory = new URL("../src/content/editorial-translations/", import.meta.url);
test("every editorial message and paragraph has all five translations tied to the source catalog", async () => {
  const bytes = await readFile(new URL("en.json", directory));
  const source = JSON.parse(bytes);
  const manifest = JSON.parse(await readFile(new URL("manifest.json", directory), "utf8"));
  assert.equal(manifest.sourceSha256, createHash("sha256").update(bytes).digest("hex"));
  for (const locale of EDITORIAL_LOCALES.filter(l => l !== "en")) {
    const bundle = JSON.parse(await readFile(new URL(`${locale}.json`, directory), "utf8"));
    for (const [group, texts] of Object.entries(source)) {
      assert.equal(Object.keys(bundle[group]).length, texts.length, `${locale}/${group}`);
      texts.forEach((text, index) => {
        assert.ok(bundle[group][index]?.trim(), `${locale}/${group}/${index}`);
        assert.equal(hasEditorialTranslation(text, locale), true, text);
        assert.notEqual(editorial(locale)(text), text === "UCAC" ? "" : text, `${locale}: ${text}`);
      });
    }
  }
});

test("all published baseline insight bodies localize without changing evidence or structure", () => {
  for (const post of listInsights()) for (const locale of EDITORIAL_LOCALES) {
    const result = localizeInsight(post, locale);
    assert.equal(result.translationMissing, false, `${post.slug}/${locale}`);
    assert.equal(result.slug, post.slug);
    assert.deepEqual(result.sources, post.sources);
    assert.equal(result.publishedAt, post.publishedAt);
    assert.equal(result.updatedAt, post.updatedAt);
    assert.deepEqual(result.sections.map(s => [s.id, s.paragraphs.length, s.bullets?.length, s.contentOrder]), post.sections.map(s => [s.id, s.paragraphs.length, s.bullets?.length, s.contentOrder]));
    if (locale !== "en") {
      assert.notEqual(result.title, post.title);
      for (let i = 0; i < post.sections.length; i++) {
        assert.notEqual(result.sections[i].heading, post.sections[i].heading);
        result.sections[i].paragraphs.forEach((p, j) => assert.notEqual(p, post.sections[i].paragraphs[j]));
      }
    }
  }
});

test("changed editorial sources fall back visibly instead of reusing an old translation", () => {
  const post = structuredClone(listInsights()[0]);
  post.sections[0].paragraphs[0] = "A newly revised paragraph not yet translated.";
  const result = localizeInsight(post, "vi");
  assert.equal(result.translationMissing, true);
  assert.equal(result.sections[0].paragraphs[0], post.sections[0].paragraphs[0]);
  assert.equal(result.title, post.title);
});

test("guide translations cover summary-only records and prefer governed document translations", () => {
  const guide = { slug: "timeline", titleEn: "China Application Timeline", subtitleEn: "Fall, spring, and late intake planning", summaryEn: "Plan application windows, requirement checks, school follow-up, and arrival steps while confirming each official deadline.", content: { sections: [] } };
  for (const locale of EDITORIAL_LOCALES) {
    const translated = localizeGuide(guide, locale);
    assert.equal(translated.translationMissing, false);
    assert.equal(translated.content.sections.length, 0, "translation must not fabricate missing sections");
  }
  const governed = { ...guide, content: { sections: [], translations: { vi: { title: "Tiêu đề đã rà soát", subtitle: null, summary: null, sections: [], searchTerms: [] } } } };
  assert.equal(localizeGuide(governed, "vi").titleEn, "Tiêu đề đã rà soát");
});

test("editorial URL locale handling preserves anchors, excludes external and RSS destinations", async () => {
  for (const locale of EDITORIAL_LOCALES) {
    const href = editorialHref("/guides/documents?section=passport#files", locale);
    const url = new URL(href, "https://ucac.cn");
    assert.equal(url.searchParams.get("lang"), locale);
    assert.equal(url.searchParams.get("section"), "passport");
    assert.equal(url.hash, "#files");
    assert.equal(editorialHref("https://example.org/source", locale), "https://example.org/source");
    assert.equal(editorialHref("/insights/rss.xml", locale), "/insights/rss.xml");
    const response = await legacyGuide(new Request(`https://ucac.cn/guide-detail.html?guide=documents&lang=${locale}`));
    assert.equal(response.headers.get("location"), `/guides/documents?lang=${locale}`);
  }
  assert.equal(await editorialLocale(Promise.resolve({ lang: "ar-SA" })), "ar");
  assert.equal(await editorialLocale(Promise.resolve({ lang: "unknown" })), "en");
  const metadata = editorialMetadata({ title: "China application guides | UCAC", alternates: { canonical: "https://ucac.cn/guides/" } }, "ar");
  assert.equal(metadata.alternates.canonical, "https://ucac.cn/guides/?lang=ar");
  assert.ok(metadata.alternates.languages.vi.endsWith("?lang=vi"));
});
