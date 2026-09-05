import { inputInteger, inputRecord } from "../shared/input.ts";
import { MAX_APPLICANT_REVISION } from "./applicant-profile.ts";
import { parseMaterialPreview, type MaterialPreviewInput, type MaterialVersions } from "./application-material-preview.ts";

export const MAX_MATERIAL_SELECTION_BYTES = 8192;
export type MaterialSelection = MaterialPreviewInput["selection"];

export function parseMaterialSelectionUpdate(value: unknown) {
  const fields = inputRecord(value, ["expectedRevision", "expectedVersions", "selection"]);
  return { expectedRevision: inputInteger(fields.expectedRevision, "expectedRevision", 0, MAX_APPLICANT_REVISION),
    ...parseMaterialPreview({ expectedVersions: fields.expectedVersions, selection: fields.selection }) };
}

export type MaterialSelectionDto = {
  mode: "selection_draft"; canSubmit: false; consentRecorded: false;
  target: { applicationSetId: string; choiceId: string; schoolId: string; programId: string | null; programIntakeId: string | null };
  revision: number; editable: boolean; currentVersions: MaterialVersions;
  savedVersions: MaterialVersions | null; selection: MaterialSelection | null;
  changedSources: (keyof MaterialVersions)[];
  unavailable: { educationRecordIds: string[]; assessmentRecordIds: string[] };
};
