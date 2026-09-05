import { resolveRequestContextFromRequest, type AuthSessionRepository } from "../auth/session.ts";
import { badRequest, toErrorEnvelope } from "../shared/errors.ts";
import { inputRecord } from "../shared/input.ts";
import { parseApplicationIdempotencyKey } from "./application-commands.ts";
import { APPLICATION_CHOICE_INPUT_FIELDS } from "./input.ts";
import type { ApplicantProfileUpdate } from "./applicant-profile.ts";
import type { AddEducationRecordInput, UpdateEducationRecordInput } from "./education.ts";
import type { AddAssessmentRecordInput, UpdateAssessmentRecordInput } from "./assessments.ts";
import type {
  AddApplicationChoiceInput,
  CreateApplicationSetInput,
  ReorderApplicationChoicesInput,
  SaveItemInput,
  StudentCoreService,
  StudentProfileUpdate,
  UpdateApplicationChoiceInput,
} from "./service.ts";

type StudentRouteName =
  | "getAssessmentHistory"
  | "addAssessmentRecord"
  | "updateAssessmentRecord"
  | "removeAssessmentRecord"
  | "getEducationHistory"
  | "addEducationRecord"
  | "updateEducationRecord"
  | "removeEducationRecord"
  | "getApplicantProfile"
  | "updateApplicantProfile"
  | "getProfile"
  | "updateProfile"
  | "listSavedItems"
  | "saveItem"
  | "removeSavedItem"
  | "listApplicationSets"
  | "getApplicationSet"
  | "createApplicationSet"
  | "addApplicationChoice"
  | "removeApplicationChoice"
  | "updateApplicationChoice"
  | "reorderApplicationChoices";

type StudentService = Pick<StudentCoreService, keyof StudentCoreService>;

export function createStudentHttpHandlers(service: StudentService, authRepository: AuthSessionRepository) {
  return {
    getAssessmentHistory: (request: Request) => handleStudentRoute(request, service, authRepository, "getAssessmentHistory"),
    addAssessmentRecord: (request: Request) => handleStudentRoute(request, service, authRepository, "addAssessmentRecord"),
    updateAssessmentRecord: (request: Request, recordId: string) => handleStudentRoute(request, service, authRepository, "updateAssessmentRecord", recordId),
    removeAssessmentRecord: (request: Request, recordId: string) => handleStudentRoute(request, service, authRepository, "removeAssessmentRecord", recordId),
    getEducationHistory: (request: Request) => handleStudentRoute(request, service, authRepository, "getEducationHistory"),
    addEducationRecord: (request: Request) => handleStudentRoute(request, service, authRepository, "addEducationRecord"),
    updateEducationRecord: (request: Request, recordId: string) => handleStudentRoute(request, service, authRepository, "updateEducationRecord", recordId),
    removeEducationRecord: (request: Request, recordId: string) => handleStudentRoute(request, service, authRepository, "removeEducationRecord", recordId),
    getApplicantProfile: (request: Request) => handleStudentRoute(request, service, authRepository, "getApplicantProfile"),
    updateApplicantProfile: (request: Request) => handleStudentRoute(request, service, authRepository, "updateApplicantProfile"),
    getProfile: (request: Request) => handleStudentRoute(request, service, authRepository, "getProfile"),
    updateProfile: (request: Request) => handleStudentRoute(request, service, authRepository, "updateProfile"),
    listSavedItems: (request: Request) => handleStudentRoute(request, service, authRepository, "listSavedItems"),
    saveItem: (request: Request) => handleStudentRoute(request, service, authRepository, "saveItem"),
    removeSavedItem: (request: Request, savedItemId: string) =>
      handleStudentRoute(request, service, authRepository, "removeSavedItem", savedItemId),
    listApplicationSets: (request: Request) => handleStudentRoute(request, service, authRepository, "listApplicationSets"),
    createApplicationSet: (request: Request) => handleStudentRoute(request, service, authRepository, "createApplicationSet"),
    getApplicationSet: (request: Request, applicationSetId: string) =>
      handleStudentRoute(request, service, authRepository, "getApplicationSet", applicationSetId),
    addApplicationChoice: (request: Request, applicationSetId: string) =>
      handleStudentRoute(request, service, authRepository, "addApplicationChoice", applicationSetId),
    removeApplicationChoice: (request: Request, applicationSetId: string, choiceId: string) =>
      handleStudentRoute(request, service, authRepository, "removeApplicationChoice", applicationSetId, choiceId),
    updateApplicationChoice: (request: Request, applicationSetId: string, choiceId: string) =>
      handleStudentRoute(request, service, authRepository, "updateApplicationChoice", applicationSetId, choiceId),
    reorderApplicationChoices: (request: Request, applicationSetId: string) =>
      handleStudentRoute(request, service, authRepository, "reorderApplicationChoices", applicationSetId),
  };
}

async function handleStudentRoute(
  request: Request,
  service: StudentService,
  authRepository: AuthSessionRepository,
  routeName: StudentRouteName,
  routeId?: string,
  choiceId?: string,
): Promise<Response> {
  const context = await resolveRequestContextFromRequest(request, authRepository, { purpose: "student_action" });

  try {
    const data = await callStudentRoute(request, service, context, routeName, routeId, choiceId);
    return jsonResponse({ data });
  } catch (error) {
    return jsonResponse(toErrorEnvelope(error, context.requestId), error instanceof Error && "status" in error ? Number(error.status) : 500);
  }
}

async function callStudentRoute(
  request: Request,
  service: StudentService,
  context: Parameters<StudentCoreService["getOwnProfile"]>[0],
  routeName: StudentRouteName,
  routeId?: string,
  choiceId?: string,
) {
  switch (routeName) {
    case "getAssessmentHistory":
      return service.getOwnAssessmentHistory(context);
    case "addAssessmentRecord":
      return service.addOwnAssessmentRecord(context, await readJsonBody(request) as AddAssessmentRecordInput);
    case "updateAssessmentRecord":
      return service.updateOwnAssessmentRecord(context, requireRouteId(routeId), await readJsonBody(request) as UpdateAssessmentRecordInput);
    case "removeAssessmentRecord":
      return service.removeOwnAssessmentRecord(context, requireRouteId(routeId), await readJsonBody(request) as { expectedRevision: number });
    case "getEducationHistory":
      return service.getOwnEducationHistory(context);
    case "addEducationRecord":
      return service.addOwnEducationRecord(context, await readJsonBody(request) as AddEducationRecordInput);
    case "updateEducationRecord":
      return service.updateOwnEducationRecord(context, requireRouteId(routeId), await readJsonBody(request) as UpdateEducationRecordInput);
    case "removeEducationRecord":
      return service.removeOwnEducationRecord(context, requireRouteId(routeId), await readJsonBody(request) as { expectedRevision: number });
    case "getApplicantProfile":
      return service.getOwnApplicantProfile(context);
    case "updateApplicantProfile":
      return service.updateOwnApplicantProfile(context, await readJsonBody(request) as ApplicantProfileUpdate);
    case "getProfile":
      return service.getOwnProfile(context);
    case "updateProfile":
      return service.updateOwnProfile(context, (await readJsonBody(request)) as StudentProfileUpdate);
    case "listSavedItems":
      return service.listOwnSavedItems(context);
    case "saveItem":
      return service.saveOwnItem(context, (await readJsonBody(request)) as SaveItemInput);
    case "removeSavedItem":
      if (request.body) throw badRequest("Request body must be empty.");
      return service.removeOwnSavedItem(context, requireRouteId(routeId));
    case "listApplicationSets":
      return service.listOwnApplicationSets(context);
    case "createApplicationSet":
      return service.createOwnApplicationSet(context, (await readJsonBody(request)) as CreateApplicationSetInput, {
        idempotencyKey: parseApplicationIdempotencyKey(request.headers.get("idempotency-key")),
      });
    case "getApplicationSet":
      return service.getOwnApplicationSet(context, requireRouteId(routeId));
    case "removeApplicationChoice":
      if (request.body) throw badRequest("Request body must be empty.");
      return service.removeOwnApplicationChoice(context, requireRouteId(routeId), requireRouteId(choiceId));
    case "updateApplicationChoice":
      return service.updateOwnApplicationChoice(context, requireRouteId(routeId), requireRouteId(choiceId),
        await readJsonBody(request) as UpdateApplicationChoiceInput);
    case "reorderApplicationChoices":
      return service.reorderOwnApplicationChoices(context, requireRouteId(routeId), await readJsonBody(request) as ReorderApplicationChoicesInput);
    case "addApplicationChoice":
      return service.addOwnApplicationChoice(context, {
        ...(inputRecord(await readJsonBody(request), APPLICATION_CHOICE_INPUT_FIELDS, true) as Omit<AddApplicationChoiceInput, "applicationSetId">),
        applicationSetId: requireRouteId(routeId),
      }, { idempotencyKey: parseApplicationIdempotencyKey(request.headers.get("idempotency-key")) });
    default:
      throw new Error("Unsupported student route.");
  }
}

async function readJsonBody(request: Request): Promise<unknown> {
  if (!request.body) {
    return {};
  }

  return request.json();
}

function requireRouteId(routeId?: string): string {
  if (!routeId) {
    throw new Error("Student route id is required.");
  }

  return routeId;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}
