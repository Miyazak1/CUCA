(function initCuacStudyLevels(global) {
  "use strict";

  const definitions = Object.freeze([
    { value: "", label: "All study levels" },
    { value: "undergraduate", label: "Undergraduate / Bachelor" },
    { value: "master", label: "Master" },
    { value: "doctoral", label: "Doctoral / PhD" },
    { value: "foundation", label: "Foundation / Preparatory" },
    { value: "language", label: "Chinese language" },
    { value: "visiting", label: "Visiting / Exchange" },
    { value: "associate", label: "Associate / Diploma" },
    { value: "non-degree", label: "All non-degree" },
    { value: "other-non-degree", label: "Other non-degree" },
  ]);

  const aliases = Object.freeze({
    bachelor: "undergraduate", bachelors: "undergraduate", undergraduate: "undergraduate",
    master: "master", masters: "master", postgraduate: "master",
    phd: "doctoral", doctoral: "doctoral", doctorate: "doctoral", doctor: "doctoral",
    foundation: "foundation", preparatory: "foundation", "pre-university": "foundation",
    language: "language", "chinese-language": "language",
    visiting: "visiting", exchange: "visiting", scholar: "visiting",
    associate: "associate", diploma: "associate",
    "non-degree": "non-degree", nondegree: "non-degree", "other-non-degree": "other-non-degree",
  });

  const patterns = Object.freeze({
    undergraduate: /(undergraduate|bachelor)/i,
    master: /(^|[^a-z])(master|msc|m\.sc)([^a-z]|$)/i,
    doctoral: /(doctoral|doctorate|ph\.?d)/i,
    foundation: /(foundation|preparatory|pre[- ]?university)/i,
    language: /(chinese[- ]?language|language[- ]?(student|study|program|course)|语言)/i,
    visiting: /(visiting|exchange|general scholar|senior scholar|advanced study|研修|交换)/i,
    associate: /(associate|diploma|专科)/i,
    "non-degree": /(non[- ]?degree|short[- ]?term|one[- ]?semester|one[- ]?year|four[- ]?week|foundation|preparatory|pre[- ]?university|chinese[- ]?language|language[- ]?(student|study|program|course)|visiting|exchange|general scholar|senior scholar|advanced study|语言|研修|交换)/i,
  });

  function slugify(value) {
    return String(value || "").trim().toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function normalize(value, fallback = "") {
    return aliases[slugify(value)] || fallback;
  }

  function categoriesFromText(value) {
    const text = String(value || "");
    const categories = Object.keys(patterns).filter((level) => patterns[level].test(text));
    if (patterns["non-degree"].test(text)
      && !patterns.foundation.test(text)
      && !patterns.language.test(text)
      && !patterns.visiting.test(text)) categories.push("other-non-degree");
    return [...new Set(categories)];
  }

  function categories(item, textValue) {
    return Array.isArray(item?.studyLevelCategories) && item.studyLevelCategories.length
      ? item.studyLevelCategories
      : categoriesFromText(textValue);
  }

  function matches(item, selected, textValue) {
    if (!selected) return true;
    return categories(item, textValue).includes(normalize(selected, selected));
  }

  function label(value) {
    const normalized = normalize(value, value);
    return definitions.find((entry) => entry.value === normalized)?.label || value;
  }

  global.CuacStudyLevels = Object.freeze({ definitions, normalize, categoriesFromText, categories, matches, label });
})(window);
