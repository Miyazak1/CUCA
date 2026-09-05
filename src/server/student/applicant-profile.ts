import { authEmail } from "../auth/input.ts";
import { badRequest } from "../shared/errors.ts";
import { inputInteger, inputRecord, inputText } from "../shared/input.ts";

export const MAX_APPLICANT_REVISION = 2147483647;
export const APPLICANT_FIELDS = ["fullName", "contactEmail", "citizenshipCountry"] as const;

export type ApplicantProfileDto = {
  id: string;
  userId: string;
  revision: number;
  fullName: string | null;
  contactEmail: string | null;
  citizenshipCountry: string | null;
};

export type ApplicantProfileUpdate = {
  expectedRevision: number;
  fullName?: string | null;
  contactEmail?: string | null;
  citizenshipCountry?: string | null;
};

export function parseApplicantProfileUpdate(value: unknown): ApplicantProfileUpdate {
  const input = inputRecord(value, ["expectedRevision", ...APPLICANT_FIELDS]);
  const output: ApplicantProfileUpdate = {
    expectedRevision: inputInteger(input.expectedRevision, "expectedRevision", 0, MAX_APPLICANT_REVISION),
  };
  for (const field of APPLICANT_FIELDS) {
    if (!Object.hasOwn(input, field)) continue;
    const value = input[field];
    const max = field === "fullName" ? 200 : field === "contactEmail" ? 320 : 2;
    if (value === null) { output[field] = null; continue; }
    if (typeof value !== "string" || value.length > max) throw badRequest(`${field} must be bounded text or null.`);
    if (Array.from(value).some(c => {
      const code = c.codePointAt(0)!;
      return code < 32 || (code >= 0x7f && code <= 0x9f) || code === 0x2028 || code === 0x2029
        || (code >= 0xd800 && code <= 0xdfff);
    })) throw badRequest(`${field} must be valid single-line text without control characters.`);
    if (!value.trim()) { output[field] = null; continue; }
    const text = inputText(value, field, max);
    if (field === "contactEmail") output[field] = authEmail(text).original;
    else if (field === "citizenshipCountry") {
      if (!/^[A-Z]{2}$/.test(text)) throw badRequest("citizenshipCountry must be an uppercase two-letter code.");
      output[field] = text;
    } else output[field] = text;
  }
  if (Object.keys(output).length === 1) throw badRequest("At least one applicant field is required.");
  return output;
}

export function toApplicantProfileDto(row: ApplicantProfileDto): ApplicantProfileDto {
  return { id: row.id, userId: row.userId, revision: row.revision, fullName: row.fullName,
    contactEmail: row.contactEmail, citizenshipCountry: row.citizenshipCountry };
}
