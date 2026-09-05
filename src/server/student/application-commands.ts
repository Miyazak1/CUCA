import { createHash } from "node:crypto";
import { badRequest } from "../shared/errors.ts";
import type { RequestContext } from "../shared/request-context.ts";
import type { AddApplicationChoiceInput, CreateApplicationSetInput } from "./service.ts";
import type { ApplicationAuthorizationCommandInput } from "./application-submission-authorization.ts";
import type { ApplicationMaterialSnapshotCommandInput } from "./application-material-snapshot.ts";
import type { ApplicationSubmissionCommandInput } from "./application-submission.ts";

export type ApplicationCommand = "application_set.create" | "application_choice.add" | "application_authorization.record"
  | "application_material_snapshot.create" | "application.submit";
export type ApplicationCommandOptions = { idempotencyKey?: string };
export type ApplicationCommandInput = CreateApplicationSetInput | AddApplicationChoiceInput | ApplicationAuthorizationCommandInput
  | ApplicationMaterialSnapshotCommandInput | ApplicationSubmissionCommandInput;

export type ApplicationCommandExecutor = {
  authorizeMutation(context: RequestContext): Promise<void>;
  execute<T extends { id: string }>(
    context: RequestContext, operation: ApplicationCommand, input: ApplicationCommandInput,
    key: string | undefined, create: () => Promise<T>, reload: (id: string) => Promise<T | null>,
  ): Promise<T>;
};

export function parseApplicationIdempotencyKey(value: unknown): string {
  if (typeof value !== "string" || value.length < 16 || value.length > 128 || /[^A-Za-z0-9_-]/.test(value)) {
    throw badRequest("Idempotency-Key must contain 16 to 128 ASCII letters, digits, underscores or hyphens.");
  }
  return value;
}

export function applicationCommandDigests(operation: ApplicationCommand, input: ApplicationCommandInput, key: string) {
  // Input must be parsed in fixed field order. Route-bound choices use v3 while legacy v1/v2 hashes remain recoverable.
  const version = operation === "application_choice.add" && "admissionRouteKey" in input && input.admissionRouteKey != null ? 3
    : operation === "application_choice.add" && "programIntakeId" in input && input.programIntakeId != null ? 2 : 1;
  return {
    keyHash: createHash("sha256").update(parseApplicationIdempotencyKey(key)).digest("hex"),
    requestHash: createHash("sha256").update(JSON.stringify({ version, operation, input })).digest("hex"),
  };
}
