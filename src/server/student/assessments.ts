import { badRequest } from "../shared/errors.ts";
import { inputEnum, inputInteger, inputRecord, inputText, inputUuid } from "../shared/input.ts";

export const MAX_ASSESSMENT_REVISION = 2147483647;
export const MAX_ASSESSMENT_RECORDS = 40;
export const MAX_ASSESSMENT_COMPONENTS = 20;
export const MAX_ASSESSMENT_BYTES = 8192;
export const ASSESSMENT_CATEGORIES = ["language", "admissions", "other"] as const;
export const ASSESSMENT_STATUSES = ["planned", "awaiting_result", "reported"] as const;
export const ASSESSMENT_FORMS = ["unspecified", "single_sitting", "combined", "partial_retake"] as const;
export const ASSESSMENT_FIELDS = ["assessmentCategory", "assessmentName", "assessmentVariant", "resultStatus", "resultForm", "testDate", "reportDate", "components"] as const;

export type AssessmentComponent = { name: string; value: string; scale: string | null; testDate: string | null };
export type AssessmentRecordData = {
  assessmentCategory: typeof ASSESSMENT_CATEGORIES[number];
  assessmentName: string;
  assessmentVariant: string | null;
  resultStatus: typeof ASSESSMENT_STATUSES[number];
  resultForm: typeof ASSESSMENT_FORMS[number];
  testDate: string | null;
  reportDate: string | null;
  components: AssessmentComponent[];
};
export type AssessmentRecordDto = AssessmentRecordData & { id: string; evidenceStatus: "unverified" };
export type AssessmentHistoryDto = { revision: number; records: AssessmentRecordDto[] };
export type AddAssessmentRecordInput = Partial<AssessmentRecordData> & Pick<AssessmentRecordData, "assessmentCategory" | "assessmentName" | "resultStatus"> & { expectedRevision: number };
export type UpdateAssessmentRecordInput = Partial<AssessmentRecordData> & { expectedRevision: number };
export type AssessmentMutationResult = { history: AssessmentHistoryDto; recordId: string; changed: boolean };

function text(value: unknown, field: string, max: number): string {
  const result = inputText(value, field, max);
  if (Array.from(value as string).some(character => {
    const code = character.codePointAt(0)!;
    return code < 32 || (code >= 0x7f && code <= 0x9f) || code === 0x2028 || code === 0x2029 || (code >= 0xd800 && code <= 0xdfff);
  })) throw badRequest(`${field} must be valid single-line text.`);
  return result;
}

function date(value: unknown, field: string): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !/^(19|20|21)\d{2}-\d{2}-\d{2}$/.test(value)) throw badRequest(`${field} must be a calendar date or null.`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) throw badRequest(`${field} must be a real calendar date.`);
  return value;
}

function components(value: unknown): AssessmentComponent[] {
  if (!Array.isArray(value) || value.length > MAX_ASSESSMENT_COMPONENTS) throw badRequest("Assessment components must be a bounded list.");
  const identities = new Set<string>();
  return Array.from(value, entry => {
    const input = inputRecord(entry, ["name", "value", "scale", "testDate"]);
    const item = { name: text(input.name, "component.name", 80), value: text(input.value, "component.value", 80),
      scale: input.scale === undefined || input.scale === null ? null : text(input.scale, "component.scale", 80),
      testDate: input.testDate === undefined ? null : date(input.testDate, "component.testDate") };
    // A report can contain the same component on two explicitly different scales.
    const identity = JSON.stringify([item.name.normalize("NFKC").toLowerCase(), item.scale?.normalize("NFKC").toLowerCase() ?? null]);
    if (identities.has(identity)) throw badRequest("Assessment component and scale pairs must be unique.");
    identities.add(identity);
    return item;
  });
}

function parseFields(input: Record<string, unknown>): Partial<AssessmentRecordData> {
  const fields: Partial<AssessmentRecordData> = {};
  if (Object.hasOwn(input, "assessmentCategory")) fields.assessmentCategory = inputEnum(input.assessmentCategory, "assessmentCategory", ASSESSMENT_CATEGORIES);
  if (Object.hasOwn(input, "assessmentName")) fields.assessmentName = text(input.assessmentName, "assessmentName", 120);
  if (Object.hasOwn(input, "assessmentVariant")) fields.assessmentVariant = input.assessmentVariant === null ? null : text(input.assessmentVariant, "assessmentVariant", 160);
  if (Object.hasOwn(input, "resultStatus")) fields.resultStatus = inputEnum(input.resultStatus, "resultStatus", ASSESSMENT_STATUSES);
  if (Object.hasOwn(input, "resultForm")) fields.resultForm = inputEnum(input.resultForm, "resultForm", ASSESSMENT_FORMS);
  if (Object.hasOwn(input, "testDate")) fields.testDate = date(input.testDate, "testDate");
  if (Object.hasOwn(input, "reportDate")) fields.reportDate = date(input.reportDate, "reportDate");
  if (Object.hasOwn(input, "components")) fields.components = components(input.components);
  return fields;
}

export function assessmentRecordData(row: AssessmentRecordData): AssessmentRecordData {
  return { assessmentCategory: row.assessmentCategory, assessmentName: row.assessmentName, assessmentVariant: row.assessmentVariant,
    resultStatus: row.resultStatus, resultForm: row.resultForm, testDate: row.testDate, reportDate: row.reportDate, components: row.components };
}

export function validateAssessmentRecord(value: AssessmentRecordData): AssessmentRecordData {
  const input = inputRecord(value, ASSESSMENT_FIELDS);
  const record: AssessmentRecordData = { assessmentCategory: inputEnum(input.assessmentCategory, "assessmentCategory", ASSESSMENT_CATEGORIES),
    assessmentName: text(input.assessmentName, "assessmentName", 120), resultStatus: inputEnum(input.resultStatus, "resultStatus", ASSESSMENT_STATUSES),
    assessmentVariant: null, resultForm: "unspecified", testDate: null, reportDate: null, components: [], ...parseFields(input) };
  if (record.resultStatus === "reported" ? record.components.length === 0 : record.components.length !== 0 || record.reportDate !== null) {
    throw badRequest("Reported results require components; planned or pending results cannot contain scores or a report date.");
  }
  const dates = [record.testDate, ...record.components.map(item => item.testDate)].filter((value): value is string => value !== null);
  if (record.reportDate !== null && dates.some(value => value > record.reportDate!)) throw badRequest("Test dates cannot follow the report date.");
  if (record.resultForm === "single_sitting" && new Set(dates).size > 1) throw badRequest("A single-sitting result cannot contain different test dates.");
  if (Buffer.byteLength(JSON.stringify(record), "utf8") > MAX_ASSESSMENT_BYTES) throw badRequest("Assessment record is too large.");
  return record;
}

export function parseAddAssessmentRecord(value: unknown): AssessmentRecordData & { expectedRevision: number } {
  const input = inputRecord(value, ["expectedRevision", ...ASSESSMENT_FIELDS]);
  const fields = Object.fromEntries(ASSESSMENT_FIELDS.filter(field => Object.hasOwn(input, field)).map(field => [field, input[field]]));
  return { expectedRevision: inputInteger(input.expectedRevision, "expectedRevision", 0, MAX_ASSESSMENT_REVISION),
    ...validateAssessmentRecord(fields as AssessmentRecordData) };
}

export function parseUpdateAssessmentRecord(value: unknown): UpdateAssessmentRecordInput {
  const input = inputRecord(value, ["expectedRevision", ...ASSESSMENT_FIELDS]);
  const fields = parseFields(input);
  if (!Object.keys(fields).length) throw badRequest("At least one assessment field is required.");
  if (Buffer.byteLength(JSON.stringify(fields), "utf8") > MAX_ASSESSMENT_BYTES) throw badRequest("Assessment update is too large.");
  return { expectedRevision: inputInteger(input.expectedRevision, "expectedRevision", 1, MAX_ASSESSMENT_REVISION), ...fields };
}

export function parseRemoveAssessmentRecord(value: unknown): { expectedRevision: number } {
  const input = inputRecord(value, ["expectedRevision"]);
  return { expectedRevision: inputInteger(input.expectedRevision, "expectedRevision", 1, MAX_ASSESSMENT_REVISION) };
}

export function toAssessmentRecordDto(row: AssessmentRecordData & { id: string }): AssessmentRecordDto {
  return { id: inputUuid(row.id), ...validateAssessmentRecord(assessmentRecordData(row)), evidenceStatus: "unverified" };
}
