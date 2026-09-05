import { inputEnum, inputInteger, inputList, inputRecord, inputUuid } from "./input.ts";

export const DEGREE_LEVELS = ["associate", "bachelor", "master", "doctoral", "diploma", "certificate", "foundation", "language", "non_degree"] as const;
export const SUBJECT_AREAS = ["computer_science", "engineering", "business", "economics", "medicine", "health_sciences", "natural_sciences", "social_sciences", "humanities", "law", "arts", "education", "agriculture", "architecture", "mathematics", "interdisciplinary"] as const;
const LANGUAGES = ["english", "chinese", "bilingual"] as const;
const FUNDING_INTENTS = ["scholarship_required", "scholarship_possible", "self_funded", "undecided"] as const;
const INTAKE_TERMS = ["spring", "summer", "fall", "winter"] as const;

export type StudyPreferences = {
  degreeLevel?: typeof DEGREE_LEVELS[number];
  subjectAreas?: typeof SUBJECT_AREAS[number][];
  teachingLanguage?: typeof LANGUAGES[number];
  preferredCityIds?: string[];
  fundingIntent?: typeof FUNDING_INTENTS[number];
  intakeYear?: number;
  intakeTerm?: typeof INTAKE_TERMS[number];
};

export function parseStudyPreferences(value: unknown): StudyPreferences {
  const input = inputRecord(value, ["degreeLevel", "subjectAreas", "teachingLanguage", "preferredCityIds", "fundingIntent", "intakeYear", "intakeTerm"]);
  const output: StudyPreferences = {};
  if (Object.hasOwn(input, "degreeLevel")) output.degreeLevel = inputEnum(input.degreeLevel, "degreeLevel", DEGREE_LEVELS);
  if (Object.hasOwn(input, "subjectAreas")) output.subjectAreas = inputList(input.subjectAreas, "subjectAreas", 8, (v) => inputEnum(v, "subjectArea", SUBJECT_AREAS));
  if (Object.hasOwn(input, "teachingLanguage")) output.teachingLanguage = inputEnum(input.teachingLanguage, "teachingLanguage", LANGUAGES);
  if (Object.hasOwn(input, "preferredCityIds")) output.preferredCityIds = inputList(input.preferredCityIds, "preferredCityIds", 10, (v) => inputUuid(v, "cityId"));
  if (Object.hasOwn(input, "fundingIntent")) output.fundingIntent = inputEnum(input.fundingIntent, "fundingIntent", FUNDING_INTENTS);
  if (Object.hasOwn(input, "intakeYear")) output.intakeYear = inputInteger(input.intakeYear, "intakeYear", 2000, 2100);
  if (Object.hasOwn(input, "intakeTerm")) output.intakeTerm = inputEnum(input.intakeTerm, "intakeTerm", INTAKE_TERMS);
  return output;
}
