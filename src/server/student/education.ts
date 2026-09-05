import { badRequest } from "../shared/errors.ts";
import { inputEnum, inputInteger, inputRecord, inputText } from "../shared/input.ts";

export const MAX_EDUCATION_REVISION = 2147483647;
export const MAX_EDUCATION_RECORDS = 20;
export const EDUCATION_LEVELS = ["secondary", "vocational", "associate", "bachelor", "master", "doctorate", "other"] as const;
export const ATTENDANCE_STATUSES = ["unknown", "in_progress", "completed", "discontinued"] as const;
export const EDUCATION_FIELDS = ["institutionName", "institutionCountry", "educationLevel", "qualificationName", "fieldOfStudy", "attendanceStatus", "startYear", "endYear", "expectedCompletionYear"] as const;

export type EducationRecordData = {
  institutionName: string;
  institutionCountry: string | null;
  educationLevel: typeof EDUCATION_LEVELS[number];
  qualificationName: string | null;
  fieldOfStudy: string | null;
  attendanceStatus: typeof ATTENDANCE_STATUSES[number];
  startYear: number | null;
  endYear: number | null;
  expectedCompletionYear: number | null;
};
export type EducationRecordDto = EducationRecordData & { id: string };
export type EducationHistoryDto = { revision: number; records: EducationRecordDto[] };
export type AddEducationRecordInput = Partial<EducationRecordData> & Pick<EducationRecordData, "institutionName" | "educationLevel"> & { expectedRevision: number };
export type UpdateEducationRecordInput = Partial<EducationRecordData> & { expectedRevision: number };
export type EducationMutationResult = { history: EducationHistoryDto; recordId: string; changed: boolean };

function text(value: unknown, field: string, max: number): string {
  const result = inputText(value, field, max);
  if (Array.from(value as string).some(c => {
    const code = c.codePointAt(0)!;
    return code < 32 || (code >= 0x7f && code <= 0x9f) || code === 0x2028 || code === 0x2029 || (code >= 0xd800 && code <= 0xdfff);
  })) throw badRequest(`${field} must be valid single-line text.`);
  return result;
}

function parseFields(input: Record<string, unknown>): Partial<EducationRecordData> {
  const output: Partial<EducationRecordData> = {};
  if (Object.hasOwn(input, "institutionName")) output.institutionName = text(input.institutionName, "institutionName", 200);
  if (Object.hasOwn(input, "educationLevel")) output.educationLevel = inputEnum(input.educationLevel, "educationLevel", EDUCATION_LEVELS);
  if (Object.hasOwn(input, "attendanceStatus")) output.attendanceStatus = inputEnum(input.attendanceStatus, "attendanceStatus", ATTENDANCE_STATUSES);
  for (const field of ["institutionCountry", "qualificationName", "fieldOfStudy"] as const) {
    if (!Object.hasOwn(input, field)) continue;
    output[field] = input[field] === null ? null : text(input[field], field, field === "institutionCountry" ? 2 : 200);
    if (field === "institutionCountry" && output[field] !== null && !/^[A-Z]{2}$/.test(output[field]!)) throw badRequest("institutionCountry must be an uppercase two-letter code.");
  }
  for (const field of ["startYear", "endYear", "expectedCompletionYear"] as const) {
    if (Object.hasOwn(input, field)) output[field] = input[field] === null ? null : inputInteger(input[field], field, 1900, 2199);
  }
  return output;
}

export function validateEducationRecord(record: EducationRecordData): EducationRecordData {
  if (record.startYear !== null && [record.endYear, record.expectedCompletionYear].some(year => year !== null && year < record.startYear!)) {
    throw badRequest("Education end years cannot precede the start year.");
  }
  if (record.attendanceStatus === "in_progress" && record.endYear !== null) throw badRequest("In-progress education cannot have an actual end year.");
  if (record.expectedCompletionYear !== null && record.attendanceStatus !== "in_progress") throw badRequest("Expected completion requires in-progress education.");
  return record;
}

export function parseAddEducationRecord(value: unknown): AddEducationRecordInput & EducationRecordData {
  const input = inputRecord(value, ["expectedRevision", ...EDUCATION_FIELDS]);
  const fields = parseFields(input);
  const record = validateEducationRecord({ institutionName: text(input.institutionName, "institutionName", 200),
    educationLevel: inputEnum(input.educationLevel, "educationLevel", EDUCATION_LEVELS), institutionCountry: null,
    qualificationName: null, fieldOfStudy: null, attendanceStatus: "unknown", startYear: null, endYear: null, expectedCompletionYear: null, ...fields });
  return { expectedRevision: inputInteger(input.expectedRevision, "expectedRevision", 0, MAX_EDUCATION_REVISION), ...record };
}

export function parseUpdateEducationRecord(value: unknown): UpdateEducationRecordInput {
  const input = inputRecord(value, ["expectedRevision", ...EDUCATION_FIELDS]);
  const fields = parseFields(input);
  if (!Object.keys(fields).length) throw badRequest("At least one education field is required.");
  return { expectedRevision: inputInteger(input.expectedRevision, "expectedRevision", 1, MAX_EDUCATION_REVISION), ...fields };
}

export function parseRemoveEducationRecord(value: unknown): { expectedRevision: number } {
  const input = inputRecord(value, ["expectedRevision"]);
  return { expectedRevision: inputInteger(input.expectedRevision, "expectedRevision", 1, MAX_EDUCATION_REVISION) };
}

export function toEducationRecordDto(row: EducationRecordDto): EducationRecordDto {
  return { id: row.id, institutionName: row.institutionName, institutionCountry: row.institutionCountry,
    educationLevel: row.educationLevel, qualificationName: row.qualificationName, fieldOfStudy: row.fieldOfStudy,
    attendanceStatus: row.attendanceStatus, startYear: row.startYear, endYear: row.endYear, expectedCompletionYear: row.expectedCompletionYear };
}
