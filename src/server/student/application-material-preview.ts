import { createHash } from "node:crypto";
import { badRequest, serviceUnavailable } from "../shared/errors.ts";
import { inputEnum, inputInteger, inputList, inputRecord, inputUuid } from "../shared/input.ts";
import { APPLICANT_FIELDS, MAX_APPLICANT_REVISION, parseApplicantProfileUpdate } from "./applicant-profile.ts";
import { EDUCATION_FIELDS, MAX_EDUCATION_RECORDS, parseAddEducationRecord, toEducationRecordDto, type EducationRecordDto } from "./education.ts";
import { MAX_ASSESSMENT_RECORDS, toAssessmentRecordDto, type AssessmentRecordDto } from "./assessments.ts";

export const MATERIAL_VERSION_FIELDS = ["applicationSet", "applicant", "education", "assessments"] as const;
export const MAX_MATERIAL_PREVIEW_BYTES = 384 * 1024;
export type MaterialVersions = Record<typeof MATERIAL_VERSION_FIELDS[number], number>;
export type MaterialTarget = { applicationSetId: string; choiceId: string; schoolId: string; programId: string; programIntakeId: string };
export type MaterialSources = { applicant: Record<string, unknown>; education: EducationRecordDto[]; assessments: AssessmentRecordDto[] };

export function parseMaterialPreview(value: unknown) {
  const input = inputRecord(value, ["expectedVersions", "selection"]);
  const versions = inputRecord(input.expectedVersions, MATERIAL_VERSION_FIELDS);
  const selected = inputRecord(input.selection, ["applicantFields", "educationRecordIds", "assessmentRecordIds"]);
  const fields = inputList(selected.applicantFields, "applicantFields", APPLICANT_FIELDS.length,
    entry => inputEnum(entry, "Applicant field", APPLICANT_FIELDS));
  return {
    expectedVersions: Object.fromEntries(MATERIAL_VERSION_FIELDS.map(field => [field,
      inputInteger(versions[field], field, field === "applicationSet" ? 1 : 0, MAX_APPLICANT_REVISION)])) as MaterialVersions,
    selection: {
      applicantFields: APPLICANT_FIELDS.filter(field => fields.includes(field)),
      educationRecordIds: inputList(selected.educationRecordIds, "educationRecordIds", MAX_EDUCATION_RECORDS, entry => inputUuid(entry)).sort(),
      assessmentRecordIds: inputList(selected.assessmentRecordIds, "assessmentRecordIds", MAX_ASSESSMENT_RECORDS, entry => inputUuid(entry)).sort(),
    },
  };
}
export type MaterialPreviewInput = ReturnType<typeof parseMaterialPreview>;

export function requireMaterialPreviewQuery(url: string) {
  if ([...new URL(url).searchParams].length) throw badRequest("Material previews do not accept query parameters.");
}

export function buildMaterialPreview(ownerUserId: string, target: MaterialTarget, checkedAt: Date,
  input: MaterialPreviewInput, sources: MaterialSources) {
  try {
    const owner = inputUuid(ownerUserId);
    const scope = { applicationSetId: inputUuid(target.applicationSetId), choiceId: inputUuid(target.choiceId),
      schoolId: inputUuid(target.schoolId), programId: inputUuid(target.programId), programIntakeId: inputUuid(target.programIntakeId) };
    const request = parseMaterialPreview(input);
    if (!(checkedAt instanceof Date) || !Number.isFinite(checkedAt.getTime())) throw new Error("Invalid stored clock.");
    const applicant: Partial<Record<typeof APPLICANT_FIELDS[number], string | null>> = {};
    for (const field of request.selection.applicantFields) {
      const value = sources.applicant[field];
      const parsed = parseApplicantProfileUpdate({ expectedRevision: request.expectedVersions.applicant, [field]: value });
      if (parsed[field] !== value || (request.expectedVersions.applicant === 0 && value !== null)) throw new Error("Invalid stored applicant field.");
      applicant[field] = parsed[field];
    }
    const selectedRecords = <T extends { id: string }>(rows: T[], ids: string[], version: number, parse: (row: T) => T) => {
      if (!Array.isArray(rows) || rows.length !== ids.length || (rows.length && version === 0)) throw new Error("Invalid stored collection.");
      const map = new Map(rows.map(row => [inputUuid(row.id), row]));
      if (map.size !== ids.length || ids.some(id => !map.has(id))) throw new Error("Invalid stored selection.");
      return ids.map(id => parse(map.get(id)!));
    };
    const education = selectedRecords(sources.education, request.selection.educationRecordIds, request.expectedVersions.education, row => {
      const fields = Object.fromEntries(EDUCATION_FIELDS.map(field => [field, row[field]]));
      const parsed = parseAddEducationRecord({ expectedRevision: 0, ...fields });
      for (const field of EDUCATION_FIELDS) if (parsed[field] !== row[field]) throw new Error("Invalid stored education field.");
      return toEducationRecordDto({ id: inputUuid(row.id), ...parsed });
    });
    const assessments = selectedRecords(sources.assessments, request.selection.assessmentRecordIds, request.expectedVersions.assessments, toAssessmentRecordDto);
    const content = { format: "cuac.application-material-preview.v1" as const, ...scope,
      sourceVersions: request.expectedVersions, selection: request.selection, materials: { applicant, education, assessments } };
    const serialized = JSON.stringify({ ownerUserId: owner, content });
    if (Buffer.byteLength(serialized, "utf8") > MAX_MATERIAL_PREVIEW_BYTES) throw new Error("Preview too large.");
    return { mode: "self_review" as const, canSubmit: false as const, persisted: false as const, consentRecorded: false as const,
      checkedAt: checkedAt.toISOString(), contentSha256: createHash("sha256").update(serialized).digest("hex"), content };
  } catch { throw serviceUnavailable("Application material data requires reconciliation."); }
}
export type MaterialPreviewDto = ReturnType<typeof buildMaterialPreview>;
