import { badRequest, forbidden } from "../shared/errors.ts";
import { inputEnum, inputRecord } from "../shared/input.ts";
import { parseStudyPreferences, type StudyPreferences } from "../shared/study-preferences.ts";

export type AgentContextCandidateInput = { candidateType: "study_goal"; structured: StudyPreferences };

export function parseCandidateInput(value: unknown) {
  const input = inputRecord(value, ["candidateType", "structured"], true);
  const candidateType = inputEnum(input.candidateType, "candidateType", ["study_goal"] as const);
  const structured = parseStudyPreferences(input.structured);
  if (!Object.values(structured).some((v) => !Array.isArray(v) || v.length > 0)) throw badRequest("A meaningful study preference is required.");
  const parts: string[] = [];
  if (structured.degreeLevel) parts.push(`Degree: ${structured.degreeLevel}`);
  if (structured.subjectAreas?.length) parts.push(`Subjects: ${structured.subjectAreas.join(", ")}`);
  if (structured.teachingLanguage) parts.push(`Language: ${structured.teachingLanguage}`);
  if (structured.preferredCityIds?.length) parts.push(`Preferred cities: ${structured.preferredCityIds.length}`);
  if (structured.fundingIntent) parts.push(`Funding: ${structured.fundingIntent}`);
  if (structured.intakeYear) parts.push(`Intake year: ${structured.intakeYear}`);
  if (structured.intakeTerm) parts.push(`Intake term: ${structured.intakeTerm}`);
  return { candidateType, structured, summary: parts.join("; "), dataClass: "low_sensitive_preference" as const,
    confidence: "inferred" as const, sourceEntityIds: structured.preferredCityIds ?? [] };
}

export function parseStoredCandidate(candidate: { candidateType: string; structured: Record<string, unknown>; dataClass: string; contextScope: string; activeRole: string }) {
  if (candidate.dataClass !== "low_sensitive_preference"
    || !["guest_page", "student_account"].includes(candidate.contextScope)
    || candidate.activeRole !== (candidate.contextScope === "guest_page" ? "guest" : "student")) {
    throw forbidden("Stored candidate is not eligible for study memory.");
  }
  // Re-derive every content field; never promote a legacy free-text summary or source list.
  return parseCandidateInput({ candidateType: candidate.candidateType, structured: candidate.structured });
}
