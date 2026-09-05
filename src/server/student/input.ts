import { badRequest } from "../shared/errors.ts";
import { inputEnum, inputInteger, inputList, inputRecord, inputText, inputUuid } from "../shared/input.ts";
import { DEGREE_LEVELS, parseStudyPreferences } from "../shared/study-preferences.ts";
import { officialSubmissionPolicyKey } from "../submission-policy/official-submission-policy.ts";
import type { AddApplicationChoiceInput, CreateApplicationSetInput, ReorderApplicationChoicesInput, SaveItemInput, StudentProfileUpdate, UpdateApplicationChoiceInput } from "./service.ts";

export const MAX_APPLICATION_REVISION = 2147483647;
export const APPLICATION_CHOICE_INPUT_FIELDS = ["applicationSetId", "schoolId", "programId", "programIntakeId", "admissionRouteKey",
  "scholarshipId", "rankOrder", "studentNotes"] as const;

function nullableText(value: unknown, field: string, maxLength: number): string | null {
  if (typeof value === "string" && value.length > maxLength) throw badRequest(`${field} exceeds its length limit.`);
  return value === null || (typeof value === "string" && !value.trim()) ? null : inputText(value, field, maxLength);
}

export function parseProfileUpdate(value: unknown): StudentProfileUpdate {
  const input = inputRecord(value, ["displayName", "citizenshipCountry", "targetDegreeLevel", "targetIntake", "preferences"], true);
  const output: StudentProfileUpdate = {};
  if (Object.hasOwn(input, "displayName")) output.displayName = nullableText(input.displayName, "displayName", 120);
  if (Object.hasOwn(input, "citizenshipCountry")) {
    const country = nullableText(input.citizenshipCountry, "citizenshipCountry", 2);
    if (country !== null && !/^[A-Z]{2}$/.test(country)) throw badRequest("citizenshipCountry must be an uppercase two-letter country code.");
    output.citizenshipCountry = country;
  }
  if (Object.hasOwn(input, "targetDegreeLevel")) output.targetDegreeLevel = input.targetDegreeLevel === null ? null : inputEnum(input.targetDegreeLevel, "targetDegreeLevel", DEGREE_LEVELS);
  if (Object.hasOwn(input, "targetIntake")) output.targetIntake = nullableText(input.targetIntake, "targetIntake", 40);
  if (Object.hasOwn(input, "preferences")) output.preferences = parseStudyPreferences(input.preferences);
  if (!Object.keys(output).length) throw badRequest("At least one profile field is required.");
  return output;
}

export function parseSavedItem(value: unknown): SaveItemInput {
  const input = inputRecord(value, ["entityType", "entityId", "notes"], true);
  return {
    entityType: inputEnum(input.entityType, "entityType", ["school", "program", "scholarship", "city"] as const),
    entityId: inputUuid(input.entityId, "entityId"),
    notes: input.notes === undefined ? null : nullableText(input.notes, "notes", 2000),
  };
}

export function parseApplicationSet(value: unknown): CreateApplicationSetInput {
  const input = inputRecord(value, ["name", "targetIntake"], true);
  return { name: inputText(input.name, "name", 120), targetIntake: input.targetIntake === undefined ? null : nullableText(input.targetIntake, "targetIntake", 40) };
}

export function parseApplicationChoice(value: unknown): AddApplicationChoiceInput {
  const input = inputRecord(value, APPLICATION_CHOICE_INPUT_FIELDS, true);
  const output: AddApplicationChoiceInput = {
    applicationSetId: inputUuid(input.applicationSetId, "applicationSetId"),
    schoolId: inputUuid(input.schoolId, "schoolId"),
    programId: input.programId === undefined || input.programId === null ? null : inputUuid(input.programId, "programId"),
    scholarshipId: input.scholarshipId === undefined || input.scholarshipId === null ? null : inputUuid(input.scholarshipId, "scholarshipId"),
    rankOrder: input.rankOrder === undefined ? 0 : inputInteger(input.rankOrder, "rankOrder", 0, 1000),
    studentNotes: input.studentNotes === undefined ? null : nullableText(input.studentNotes, "studentNotes", 2000),
  };
  // Absent/null intake preserves the original v1 normalized input and receipt hash.
  if (input.programIntakeId !== undefined && input.programIntakeId !== null) {
    output.programIntakeId = inputUuid(input.programIntakeId, "programIntakeId");
    if (!output.programId) throw badRequest("programIntakeId requires programId.");
  }
  // Omitted/null preserves legacy command digests and means no route has been selected.
  if (input.admissionRouteKey !== undefined && input.admissionRouteKey !== null) {
    if (!output.programId || !output.programIntakeId) throw badRequest("admissionRouteKey requires programId and programIntakeId.");
    output.admissionRouteKey = officialSubmissionPolicyKey(input.admissionRouteKey, "admissionRouteKey");
  }
  return output;
}

export function parseApplicationChoiceUpdate(value: unknown): UpdateApplicationChoiceInput {
  const input = inputRecord(value, ["expectedRevision", "admissionRouteKey", "scholarshipId", "studentNotes"]);
  const output: UpdateApplicationChoiceInput = {
    expectedRevision: inputInteger(input.expectedRevision, "expectedRevision", 1, MAX_APPLICATION_REVISION),
  };
  if (Object.hasOwn(input, "admissionRouteKey")) output.admissionRouteKey = input.admissionRouteKey === null
    ? null : officialSubmissionPolicyKey(input.admissionRouteKey, "admissionRouteKey");
  if (Object.hasOwn(input, "scholarshipId")) output.scholarshipId = input.scholarshipId === null ? null : inputUuid(input.scholarshipId, "scholarshipId");
  if (Object.hasOwn(input, "studentNotes")) output.studentNotes = nullableText(input.studentNotes, "studentNotes", 2000);
  if (Object.keys(output).length === 1) throw badRequest("At least one choice field is required.");
  return output;
}

export function parseApplicationChoiceOrder(value: unknown): ReorderApplicationChoicesInput {
  const input = inputRecord(value, ["expectedRevision", "choiceIds"]);
  return {
    expectedRevision: inputInteger(input.expectedRevision, "expectedRevision", 1, MAX_APPLICATION_REVISION),
    choiceIds: inputList(input.choiceIds, "choiceIds", 1000, value => inputUuid(value, "choiceId")),
  };
}
