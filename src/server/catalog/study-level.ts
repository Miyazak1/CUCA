export const STUDY_LEVEL_SLUGS = [
  "undergraduate",
  "master",
  "doctoral",
  "foundation",
  "language",
  "visiting",
  "associate",
  "non-degree",
  "other-non-degree",
] as const;

export type StudyLevelSlug = typeof STUDY_LEVEL_SLUGS[number];

const aliases: Record<string, StudyLevelSlug> = {
  bachelor: "undergraduate",
  bachelors: "undergraduate",
  undergraduate: "undergraduate",
  master: "master",
  masters: "master",
  postgraduate: "master",
  phd: "doctoral",
  doctoral: "doctoral",
  doctorate: "doctoral",
  doctor: "doctoral",
  foundation: "foundation",
  preparatory: "foundation",
  "pre-university": "foundation",
  language: "language",
  "chinese-language": "language",
  visiting: "visiting",
  exchange: "visiting",
  scholar: "visiting",
  associate: "associate",
  diploma: "associate",
  "non-degree": "non-degree",
  nondegree: "non-degree",
  "other-non-degree": "other-non-degree",
};

const patterns: Record<Exclude<StudyLevelSlug, "other-non-degree">, string> = {
  undergraduate: "(undergraduate|bachelor)",
  master: "(^|[^a-z])(master|msc|m\\.sc)([^a-z]|$)",
  doctoral: "(doctoral|doctorate|ph[.]?d)",
  foundation: "(foundation|preparatory|pre[- ]?university)",
  language: "(chinese[- ]?language|language[- ]?(student|study|program|course)|语言)",
  visiting: "(visiting|exchange|general scholar|senior scholar|advanced study|研修|交换)",
  associate: "(associate|diploma|专科)",
  "non-degree": "(non[- ]?degree|short[- ]?term|one[- ]?semester|one[- ]?year|four[- ]?week|foundation|preparatory|pre[- ]?university|chinese[- ]?language|language[- ]?(student|study|program|course)|visiting|exchange|general scholar|senior scholar|advanced study|语言|研修|交换)",
};

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function normalizeStudyLevel(value?: string): StudyLevelSlug | undefined {
  if (!value) return undefined;
  return aliases[slugify(value)];
}

export function studyLevelSqlPredicate(expression: string, value?: string): string | undefined {
  const level = normalizeStudyLevel(value);
  if (!level) return undefined;
  const text = `lower(coalesce(${expression}, ''))`;
  if (level !== "other-non-degree") return `${text} ~ '${patterns[level]}'`;
  return `(${text} ~ '${patterns["non-degree"]}'
    and ${text} !~ '${patterns.foundation}'
    and ${text} !~ '${patterns.language}'
    and ${text} !~ '${patterns.visiting}')`;
}

export function studyLevelCountsSql(expression: string) {
  const count = (level: Exclude<StudyLevelSlug, "other-non-degree">) =>
    `count(*) filter (where ${studyLevelSqlPredicate(expression, level)})::int`;
  return `jsonb_build_object(
    'undergraduate', ${count("undergraduate")},
    'master', ${count("master")},
    'doctoral', ${count("doctoral")},
    'foundation', ${count("foundation")},
    'language', ${count("language")},
    'visiting', ${count("visiting")},
    'associate', ${count("associate")},
    'non-degree', ${count("non-degree")},
    'other-non-degree', count(*) filter (where ${studyLevelSqlPredicate(expression, "other-non-degree")})::int
  )`;
}

export function classifyStudyLevels(value?: string | null): StudyLevelSlug[] {
  const text = String(value || "").toLowerCase();
  const matches = STUDY_LEVEL_SLUGS.filter(level => {
    if (level === "other-non-degree") {
      return new RegExp(patterns["non-degree"], "i").test(text)
        && !new RegExp(patterns.foundation, "i").test(text)
        && !new RegExp(patterns.language, "i").test(text)
        && !new RegExp(patterns.visiting, "i").test(text);
    }
    return new RegExp(patterns[level], "i").test(text);
  });
  return matches;
}
