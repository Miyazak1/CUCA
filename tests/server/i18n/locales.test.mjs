import assert from "node:assert/strict";
import test from "node:test";
import {
  PUBLIC_UI_LOCALES, STAFF_UI_LOCALES, normalizeUiLocale, parseAcceptLanguage,
  resolveUiLocale, uiLocaleDirection,
} from "../../../src/server/i18n/locales.ts";

test("public launch locales cover English, prioritized Southeast Asian languages and Arabic", () => {
  assert.deepEqual(PUBLIC_UI_LOCALES, ["en", "vi", "th", "id", "ms", "ar"]);
  assert.deepEqual(STAFF_UI_LOCALES, ["zh-CN"]);
  assert.equal(uiLocaleDirection("ar"), "rtl");
  for (const locale of ["en", "vi", "th", "id", "ms", "zh-CN"]) assert.equal(uiLocaleDirection(locale), "ltr");
});

test("locale normalization accepts regional browser tags without inventing unsupported locales", () => {
  assert.equal(normalizeUiLocale("vi-VN"), "vi");
  assert.equal(normalizeUiLocale("th_TH"), "th");
  assert.equal(normalizeUiLocale("id-ID"), "id");
  assert.equal(normalizeUiLocale("in-ID"), "id");
  assert.equal(normalizeUiLocale("ms-MY"), "ms");
  assert.equal(normalizeUiLocale("ar-SA"), "ar");
  assert.equal(normalizeUiLocale("zh-Hans"), "zh-CN");
  assert.equal(normalizeUiLocale("fr"), null);
});

test("Accept-Language honors quality, excludes q=0 and removes duplicates", () => {
  assert.deepEqual(parseAcceptLanguage("fr-FR, th-TH;q=0.7,vi-VN;q=0.9,vi;q=0.8,ar;q=0"), ["vi", "th"]);
  assert.deepEqual(parseAcceptLanguage("x".repeat(2049)), []);
});

test("locale resolution uses explicit then account then browser and can exclude staff-only Chinese", () => {
  assert.equal(resolveUiLocale({ explicit: "ar", account: "vi", acceptLanguage: "th" }), "ar");
  assert.equal(resolveUiLocale({ explicit: "fr", account: "id-ID", acceptLanguage: "th" }), "id");
  assert.equal(resolveUiLocale({ account: "zh-CN", acceptLanguage: "ms-MY", publicOnly: true }), "ms");
  assert.equal(resolveUiLocale({ acceptLanguage: "fr-FR" }), "en");
});
