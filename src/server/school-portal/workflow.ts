import { createHash } from "node:crypto";
import { badRequest } from "../shared/errors.ts";
import { inputEnum, inputInteger, inputRecord, inputText } from "../shared/input.ts";

export const SCHOOL_APPLICATION_WORKFLOW_STATUSES = [
  "new",
  "needs_review",
  "contact_queued",
  "contacted",
  "waiting_for_documents",
  "documents_received_by_school",
  "not_a_fit",
  "converted_to_official_application",
  "archived",
] as const;
export const SCHOOL_APPLICATION_STATUS_COMMAND_TARGETS = SCHOOL_APPLICATION_WORKFLOW_STATUSES
  .filter((status) => status !== "new");

export const SCHOOL_CONTACT_CHANNELS = ["email", "phone", "whatsapp", "in_person", "other"] as const;
export const SCHOOL_CONTACT_DIRECTIONS = ["outbound", "inbound"] as const;
export const SCHOOL_CONTACT_OUTCOMES = ["attempted", "reached", "replied", "follow_up_required"] as const;
export const MAX_SCHOOL_APPLICATION_REVISION = 2147483647;

export type SchoolApplicationWorkflowStatus = (typeof SCHOOL_APPLICATION_WORKFLOW_STATUSES)[number];
export type SchoolContactChannel = (typeof SCHOOL_CONTACT_CHANNELS)[number];
export type SchoolContactDirection = (typeof SCHOOL_CONTACT_DIRECTIONS)[number];
export type SchoolContactOutcome = (typeof SCHOOL_CONTACT_OUTCOMES)[number];

export type SchoolApplicationStatusCommand = {
  expectedRevision: number;
  status: SchoolApplicationWorkflowStatus;
  reason: string | null;
};

export type SchoolApplicationContactCommand = {
  channel: SchoolContactChannel;
  direction: SchoolContactDirection;
  outcome: SchoolContactOutcome;
  note: string;
};

const transitions: Readonly<Record<SchoolApplicationWorkflowStatus, readonly SchoolApplicationWorkflowStatus[]>> = {
  new: ["needs_review", "contact_queued", "contacted", "not_a_fit", "converted_to_official_application", "archived"],
  needs_review: ["contact_queued", "not_a_fit", "converted_to_official_application", "archived"],
  contact_queued: ["contacted", "not_a_fit", "converted_to_official_application", "archived"],
  contacted: ["waiting_for_documents", "not_a_fit", "converted_to_official_application", "archived"],
  waiting_for_documents: ["documents_received_by_school", "not_a_fit", "converted_to_official_application", "archived"],
  documents_received_by_school: ["not_a_fit", "converted_to_official_application", "archived"],
  not_a_fit: [],
  converted_to_official_application: [],
  archived: [],
};

export function parseSchoolApplicationStatusCommand(value: unknown): SchoolApplicationStatusCommand {
  const input = inputRecord(value, ["expectedRevision", "status", "reason"]);
  const status = inputEnum(input.status, "status", SCHOOL_APPLICATION_STATUS_COMMAND_TARGETS);
  const reason = input.reason === undefined || input.reason === null ? null : inputText(input.reason, "reason", 500);
  if ((status === "not_a_fit" || status === "archived") && reason === null) {
    throw badRequest("A reason is required when closing a school application.");
  }
  return {
    expectedRevision: inputInteger(input.expectedRevision, "expectedRevision", 1, MAX_SCHOOL_APPLICATION_REVISION),
    status,
    reason,
  };
}

export function parseSchoolApplicationContactCommand(value: unknown): SchoolApplicationContactCommand {
  const input = inputRecord(value, ["channel", "direction", "outcome", "note"]);
  return {
    channel: inputEnum(input.channel, "channel", SCHOOL_CONTACT_CHANNELS),
    direction: inputEnum(input.direction, "direction", SCHOOL_CONTACT_DIRECTIONS),
    outcome: inputEnum(input.outcome, "outcome", SCHOOL_CONTACT_OUTCOMES),
    note: inputText(input.note, "note", 2000),
  };
}

export function canTransitionSchoolApplication(
  fromStatus: string,
  toStatus: SchoolApplicationWorkflowStatus,
): fromStatus is SchoolApplicationWorkflowStatus {
  return SCHOOL_APPLICATION_WORKFLOW_STATUSES.includes(fromStatus as SchoolApplicationWorkflowStatus)
    && transitions[fromStatus as SchoolApplicationWorkflowStatus].includes(toStatus);
}

export function isContactableSchoolApplicationStatus(status: string): status is SchoolApplicationWorkflowStatus {
  return ["new", "needs_review", "contact_queued", "contacted", "waiting_for_documents",
    "documents_received_by_school"].includes(status);
}

export function parseSchoolWorkflowIdempotencyKey(value: unknown): string {
  if (typeof value !== "string" || value.length < 16 || value.length > 128 || /[^A-Za-z0-9_-]/.test(value)) {
    throw badRequest("Idempotency-Key must contain 16 to 128 ASCII letters, digits, underscores or hyphens.");
  }
  return value;
}

export function schoolWorkflowCommandDigests(
  operation: "status.change" | "contact.record",
  input: SchoolApplicationStatusCommand | SchoolApplicationContactCommand,
  key: unknown,
) {
  const normalizedKey = parseSchoolWorkflowIdempotencyKey(key);
  return {
    keyHash: createHash("sha256").update(normalizedKey).digest("hex"),
    requestHash: createHash("sha256").update(JSON.stringify({ version: 1, operation, input })).digest("hex"),
  };
}
