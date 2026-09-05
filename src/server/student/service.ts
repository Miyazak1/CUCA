import { buildAuditEvent, type AuditSink } from "../audit/audit.ts";
import { CuacError, forbidden, serviceUnavailable } from "../shared/errors.ts";
import type { DataClass } from "../shared/request-context.ts";
import type { RequestContext } from "../shared/request-context.ts";
import { canReadStudentOwnedResource, canWriteStudentOwnedResource } from "./ownership.ts";
import { inputUuid } from "../shared/input.ts";
import { parseApplicationChoice, parseApplicationChoiceOrder, parseApplicationChoiceUpdate, parseApplicationSet, parseProfileUpdate, parseSavedItem } from "./input.ts";
import { parseApplicationIdempotencyKey, type ApplicationCommand, type ApplicationCommandExecutor, type ApplicationCommandInput, type ApplicationCommandOptions } from "./application-commands.ts";
import { parseApplicantProfileUpdate, type ApplicantProfileDto, type ApplicantProfileUpdate } from "./applicant-profile.ts";
import { parseAddEducationRecord, parseUpdateEducationRecord, parseRemoveEducationRecord, type AddEducationRecordInput, type EducationHistoryDto, type EducationMutationResult, type EducationRecordData, type UpdateEducationRecordInput } from "./education.ts";
import { parseAddAssessmentRecord, parseUpdateAssessmentRecord, parseRemoveAssessmentRecord, type AddAssessmentRecordInput, type AssessmentHistoryDto, type AssessmentMutationResult, type AssessmentRecordData, type UpdateAssessmentRecordInput } from "./assessments.ts";

export type StudentProfileDto = {
  id: string;
  userId: string;
  displayName: string | null;
  citizenshipCountry: string | null;
  targetDegreeLevel: string | null;
  targetIntake: string | null;
  preferences: Record<string, unknown>;
  profileCompletion: Record<string, unknown>;
};

export type StudentProfileUpdate = {
  displayName?: string | null;
  citizenshipCountry?: string | null;
  targetDegreeLevel?: string | null;
  targetIntake?: string | null;
  preferences?: Record<string, unknown>;
};

export type SavedItemDto = {
  id: string;
  userId: string;
  entityType: "school" | "program" | "scholarship" | "city";
  entityId: string;
  notes: string | null;
  createdAt: Date;
  catalogItem: {
    id: string;
    slug: string;
    nameEn: string;
    nameZh: string | null;
    status: string;
    sourceStatus: string;
    lastVerifiedAt: Date | null;
  } | null;
};

export type SaveItemInput = {
  entityType: SavedItemDto["entityType"];
  entityId: string;
  notes?: string | null;
};

export type RemovedSavedItemDto = {
  id: string;
  entityType: SavedItemDto["entityType"];
  entityId: string;
  removedAt: Date;
};

export type ApplicationSetDto = {
  id: string;
  cuacId: string | null;
  userId: string;
  name: string;
  status: string;
  revision: number;
  targetIntake: string | null;
  choices: ApplicationChoiceDto[];
};

export type ApplicationChoiceDto = {
  id: string;
  applicationSetId: string;
  userId: string;
  schoolId: string;
  programId: string | null;
  programIntakeId: string | null;
  admissionRouteKey: string | null;
  scholarshipId: string | null;
  rankOrder: number;
  status: string;
  studentNotes: string | null;
};

export type CreateApplicationSetInput = {
  name: string;
  targetIntake?: string | null;
};

export type AddApplicationChoiceInput = {
  applicationSetId: string;
  schoolId: string;
  programId?: string | null;
  programIntakeId?: string | null;
  admissionRouteKey?: string | null;
  scholarshipId?: string | null;
  rankOrder?: number;
  studentNotes?: string | null;
};

export type RemovedApplicationChoiceDto = {
  id: string;
  applicationSetId: string;
  status: "removed";
};

export type UpdateApplicationChoiceInput = {
  expectedRevision: number;
  admissionRouteKey?: string | null;
  scholarshipId?: string | null;
  studentNotes?: string | null;
};

export type ReorderApplicationChoicesInput = {
  expectedRevision: number;
  choiceIds: string[];
};

export type StudentCoreRepository = {
  getAssessmentHistory(userId: string): Promise<AssessmentHistoryDto>;
  addAssessmentRecord(userId: string, expectedRevision: number, record: AssessmentRecordData): Promise<AssessmentMutationResult>;
  updateAssessmentRecord(userId: string, recordId: string, input: UpdateAssessmentRecordInput): Promise<AssessmentMutationResult>;
  removeAssessmentRecord(userId: string, recordId: string, expectedRevision: number): Promise<AssessmentMutationResult>;
  getEducationHistory(userId: string): Promise<EducationHistoryDto>;
  addEducationRecord(userId: string, expectedRevision: number, record: EducationRecordData): Promise<EducationMutationResult>;
  updateEducationRecord(userId: string, recordId: string, input: UpdateEducationRecordInput): Promise<EducationMutationResult>;
  removeEducationRecord(userId: string, recordId: string, expectedRevision: number): Promise<EducationMutationResult>;
  getApplicantProfileByUserId(userId: string): Promise<ApplicantProfileDto | null>;
  updateApplicantProfile(userId: string, input: ApplicantProfileUpdate): Promise<{ profile: ApplicantProfileDto; changed: boolean }>;
  getProfileByUserId(userId: string): Promise<StudentProfileDto | null>;
  upsertProfile(userId: string, input: StudentProfileUpdate): Promise<StudentProfileDto>;
  listSavedItemsByUserId(userId: string): Promise<SavedItemDto[]>;
  saveItem(userId: string, input: SaveItemInput): Promise<SavedItemDto>;
  removeSavedItem(userId: string, savedItemId: string): Promise<RemovedSavedItemDto | null>;
  listApplicationSetsByUserId(userId: string): Promise<ApplicationSetDto[]>;
  getApplicationSetById(applicationSetId: string, userId: string): Promise<ApplicationSetDto | null>;
  createApplicationSet(userId: string, input: CreateApplicationSetInput): Promise<ApplicationSetDto>;
  addApplicationChoice(userId: string, input: AddApplicationChoiceInput): Promise<ApplicationChoiceDto>;
  removeApplicationChoice(userId: string, applicationSetId: string, choiceId: string): Promise<RemovedApplicationChoiceDto & {
    changed: boolean; authorizationWithdrawn?: boolean;
  }>;
  updateApplicationChoice(userId: string, applicationSetId: string, choiceId: string, input: UpdateApplicationChoiceInput): Promise<{ changed: boolean }>;
  reorderApplicationChoices(userId: string, applicationSetId: string, input: ReorderApplicationChoicesInput): Promise<{ changed: boolean }>;
};

export class StudentCoreService {
  private readonly repository: StudentCoreRepository;
  private readonly auditSink: AuditSink | null;
  private readonly applicationCommands: ApplicationCommandExecutor | null;

  constructor(repository: StudentCoreRepository, auditSink: AuditSink | null = null, applicationCommands: ApplicationCommandExecutor | null = null) {
    this.repository = repository;
    this.auditSink = auditSink;
    this.applicationCommands = applicationCommands;
  }

  async getOwnProfile(context: RequestContext): Promise<StudentProfileDto | null> {
    const userId = requireAuthenticatedStudent(context);
    return this.repository.getProfileByUserId(userId);
  }

  async getOwnEducationHistory(context: RequestContext): Promise<EducationHistoryDto> {
    const userId = requireEducationStudent(context, false);
    return this.repository.getEducationHistory(userId);
  }

  async getOwnAssessmentHistory(context: RequestContext): Promise<AssessmentHistoryDto> {
    const userId = requireAssessmentStudent(context, false);
    return this.repository.getAssessmentHistory(userId);
  }

  async addOwnAssessmentRecord(context: RequestContext, input: AddAssessmentRecordInput): Promise<AssessmentHistoryDto> {
    const userId = requireAssessmentStudent(context, true);
    const normalized = parseAddAssessmentRecord(input);
    const result = await this.repository.addAssessmentRecord(userId, normalized.expectedRevision, normalized);
    await this.recordAssessmentAudit(context, "add", result, Object.keys(normalized).filter(key => key !== "expectedRevision"));
    return result.history;
  }

  async updateOwnAssessmentRecord(context: RequestContext, recordId: string, input: UpdateAssessmentRecordInput): Promise<AssessmentHistoryDto> {
    const userId = requireAssessmentStudent(context, true);
    recordId = inputUuid(recordId, "recordId");
    const normalized = parseUpdateAssessmentRecord(input);
    const result = await this.repository.updateAssessmentRecord(userId, recordId, normalized);
    await this.recordAssessmentAudit(context, "update", result, Object.keys(normalized).filter(key => key !== "expectedRevision"));
    return result.history;
  }

  async removeOwnAssessmentRecord(context: RequestContext, recordId: string, input: { expectedRevision: number }): Promise<AssessmentHistoryDto> {
    const userId = requireAssessmentStudent(context, true);
    recordId = inputUuid(recordId, "recordId");
    const normalized = parseRemoveAssessmentRecord(input);
    const result = await this.repository.removeAssessmentRecord(userId, recordId, normalized.expectedRevision);
    await this.recordAssessmentAudit(context, "remove", result, []);
    return result.history;
  }

  private async recordAssessmentAudit(context: RequestContext, operation: "add" | "update" | "remove", result: AssessmentMutationResult, fields: string[]) {
    if (result.changed) await this.recordAudit(context, { action: `student.assessment_record.${operation}`,
      resourceType: "student_assessment_record", resourceId: result.recordId, dataClasses: ["education_record"],
      metadata: { revision: result.history.revision, fields } });
  }

  async addOwnEducationRecord(context: RequestContext, input: AddEducationRecordInput): Promise<EducationHistoryDto> {
    const userId = requireEducationStudent(context, true);
    const normalized = parseAddEducationRecord(input);
    const result = await this.repository.addEducationRecord(userId, normalized.expectedRevision, normalized);
    await this.recordEducationAudit(context, "add", result, Object.keys(normalized).filter(key => key !== "expectedRevision"));
    return result.history;
  }

  async updateOwnEducationRecord(context: RequestContext, recordId: string, input: UpdateEducationRecordInput): Promise<EducationHistoryDto> {
    const userId = requireEducationStudent(context, true);
    recordId = inputUuid(recordId, "recordId");
    const normalized = parseUpdateEducationRecord(input);
    const result = await this.repository.updateEducationRecord(userId, recordId, normalized);
    await this.recordEducationAudit(context, "update", result, Object.keys(normalized).filter(key => key !== "expectedRevision"));
    return result.history;
  }

  async removeOwnEducationRecord(context: RequestContext, recordId: string, input: { expectedRevision: number }): Promise<EducationHistoryDto> {
    const userId = requireEducationStudent(context, true);
    recordId = inputUuid(recordId, "recordId");
    const normalized = parseRemoveEducationRecord(input);
    const result = await this.repository.removeEducationRecord(userId, recordId, normalized.expectedRevision);
    await this.recordEducationAudit(context, "remove", result, []);
    return result.history;
  }

  private async recordEducationAudit(context: RequestContext, operation: "add" | "update" | "remove", result: EducationMutationResult, fields: string[]) {
    if (result.changed) await this.recordAudit(context, { action: `student.education_record.${operation}`,
      resourceType: "student_education_record", resourceId: result.recordId, dataClasses: ["education_record"],
      metadata: { revision: result.history.revision, fields } });
  }

  async getOwnApplicantProfile(context: RequestContext): Promise<ApplicantProfileDto | null> {
    const userId = requireAuthenticatedStudent(context);
    if (context.tenantSchoolId !== null) throw forbidden("Applicant profiles cannot use a school tenant.");
    authorizeRead(context, { id: `applicant_profile:${userId}`, ownerUserId: userId, dataClasses: ["student_pii"] });
    return this.repository.getApplicantProfileByUserId(userId);
  }

  async updateOwnApplicantProfile(context: RequestContext, input: ApplicantProfileUpdate): Promise<ApplicantProfileDto> {
    const userId = requireAuthenticatedStudent(context);
    if (context.tenantSchoolId !== null) throw forbidden("Applicant profiles cannot use a school tenant.");
    authorizeWrite(context, { id: `applicant_profile:${userId}`, ownerUserId: userId, dataClasses: ["student_pii"] });
    const normalized = parseApplicantProfileUpdate(input);
    const result = await this.repository.updateApplicantProfile(userId, normalized);
    if (result.changed) await this.recordAudit(context, {
      action: "student.applicant_profile.update", resourceType: "student_applicant_profile", resourceId: result.profile.id,
      dataClasses: ["student_pii"], metadata: { revision: result.profile.revision, fields: Object.keys(normalized).filter(key => key !== "expectedRevision") },
    });
    return result.profile;
  }

  async updateOwnProfile(context: RequestContext, input: StudentProfileUpdate): Promise<StudentProfileDto> {
    const userId = requireAuthenticatedStudent(context);
    authorizeWrite(context, { id: `student_profile:${userId}`, ownerUserId: userId });
    const normalizedInput = parseProfileUpdate(input);
    const profile = await this.repository.upsertProfile(userId, normalizedInput);
    await this.recordAudit(context, {
      action: "student.profile.update",
      resourceType: "student_profile",
      resourceId: profile.id,
      dataClasses: ["student_pii", "low_sensitive_preference"],
      metadata: {
        updatedFields: Object.keys(normalizedInput).filter((key) => normalizedInput[key as keyof StudentProfileUpdate] !== undefined),
      },
    });
    return profile;
  }

  async listOwnSavedItems(context: RequestContext): Promise<SavedItemDto[]> {
    const userId = requireAuthenticatedStudent(context);
    return this.repository.listSavedItemsByUserId(userId);
  }

  async saveOwnItem(context: RequestContext, input: SaveItemInput): Promise<SavedItemDto> {
    const userId = requireAuthenticatedStudent(context);
    input = parseSavedItem(input);
    authorizeWrite(context, { id: `saved_item:${input.entityType}:${input.entityId}`, ownerUserId: userId, dataClasses: ["low_sensitive_preference"] });
    const savedItem = await this.repository.saveItem(userId, input);
    await this.recordAudit(context, {
      action: "student.saved_item.save",
      resourceType: "saved_item",
      resourceId: savedItem.id,
      dataClasses: ["low_sensitive_preference"],
      metadata: {
        entityType: savedItem.entityType,
        entityId: savedItem.entityId,
        hasNotes: Boolean(savedItem.notes),
      },
    });
    return savedItem;
  }

  async removeOwnSavedItem(context: RequestContext, savedItemId: string): Promise<RemovedSavedItemDto> {
    const userId = requireAuthenticatedStudent(context);
    const normalizedSavedItemId = inputUuid(savedItemId, "savedItemId");
    authorizeWrite(context, { id: `saved_item:${normalizedSavedItemId}`, ownerUserId: userId, dataClasses: ["low_sensitive_preference"] });
    const removedItem = await this.repository.removeSavedItem(userId, normalizedSavedItemId);
    if (!removedItem) throw forbidden("Saved item not found or not available to this student.");
    await this.recordAudit(context, {
      action: "student.saved_item.remove",
      resourceType: "saved_item",
      resourceId: removedItem.id,
      dataClasses: ["low_sensitive_preference"],
      metadata: {
        entityType: removedItem.entityType,
        entityId: removedItem.entityId,
      },
    });
    return removedItem;
  }

  async listOwnApplicationSets(context: RequestContext): Promise<ApplicationSetDto[]> {
    const userId = requireAuthenticatedStudent(context);
    return this.repository.listApplicationSetsByUserId(userId);
  }

  async getOwnApplicationSet(context: RequestContext, applicationSetId: string): Promise<ApplicationSetDto | null> {
    const userId = requireAuthenticatedStudent(context);
    applicationSetId = inputUuid(applicationSetId, "applicationSetId");
    const applicationSet = await this.repository.getApplicationSetById(applicationSetId, userId);

    if (!applicationSet) {
      return null;
    }

    authorizeRead(context, { id: applicationSet.id, ownerUserId: applicationSet.userId, dataClasses: ["education_record"] });
    return applicationSet;
  }

  async createOwnApplicationSet(context: RequestContext, input: CreateApplicationSetInput, options: ApplicationCommandOptions = {}): Promise<ApplicationSetDto> {
    const userId = requireAuthenticatedStudent(context);
    authorizeWrite(context, { id: "application_set:new", ownerUserId: userId, dataClasses: ["education_record"] });
    input = parseApplicationSet(input);
    return this.runApplicationCommand(context, "application_set.create", input, options, async () => {
      const applicationSet = await this.repository.createApplicationSet(userId, input);
      await this.recordAudit(context, {
        action: "student.application_set.create",
        resourceType: "application_set",
        resourceId: applicationSet.id,
        dataClasses: ["education_record"],
        metadata: {
          status: applicationSet.status,
          hasTargetIntake: Boolean(applicationSet.targetIntake),
        },
      });
      return applicationSet;
    }, (id) => this.repository.getApplicationSetById(id, userId));
  }

  async addOwnApplicationChoice(context: RequestContext, input: AddApplicationChoiceInput, options: ApplicationCommandOptions = {}): Promise<ApplicationChoiceDto> {
    const userId = requireAuthenticatedStudent(context);
    input = parseApplicationChoice(input);
    const applicationSet = await this.repository.getApplicationSetById(input.applicationSetId, userId);

    if (!applicationSet) {
      throw forbidden("Application set not found or not available to this student.");
    }

    authorizeWrite(context, { id: applicationSet.id, ownerUserId: applicationSet.userId, dataClasses: ["education_record"] });
    return this.runApplicationCommand(context, "application_choice.add", input, options, async () => {
      if (applicationSet.status !== "draft") throw new CuacError("CONFLICT", "Application set is not editable. Refresh its current state.", 409);
      const choice = await this.repository.addApplicationChoice(userId, input);
      await this.recordAudit(context, {
        action: "student.application_choice.add",
        resourceType: "application_choice",
        resourceId: choice.id,
        dataClasses: ["education_record"],
        metadata: {
          applicationSetId: choice.applicationSetId,
          schoolId: choice.schoolId,
          programId: choice.programId,
          programIntakeId: choice.programIntakeId,
          ...(choice.admissionRouteKey ? { admissionRouteKey: choice.admissionRouteKey } : {}),
          scholarshipId: choice.scholarshipId,
          hasStudentNotes: Boolean(choice.studentNotes),
        },
      });
      return choice;
    }, async (id) => {
      const current = await this.repository.getApplicationSetById(input.applicationSetId, userId);
      return current?.choices.find((choice) => choice.id === id && choice.userId === userId) ?? null;
    });
  }

  async removeOwnApplicationChoice(context: RequestContext, applicationSetId: string, choiceId: string): Promise<RemovedApplicationChoiceDto> {
    const userId = requireAuthenticatedStudent(context);
    if (context.tenantSchoolId !== null) throw forbidden("Student application commands cannot use a school tenant.");
    applicationSetId = inputUuid(applicationSetId, "applicationSetId");
    choiceId = inputUuid(choiceId, "choiceId");
    authorizeWrite(context, { id: choiceId, ownerUserId: userId, dataClasses: ["education_record"] });
    await this.applicationCommands?.authorizeMutation(context);
    const result = await this.repository.removeApplicationChoice(userId, applicationSetId, choiceId);
    if (result.changed) await this.recordAudit(context, {
      action: "student.application_choice.remove", resourceType: "application_choice", resourceId: result.id,
      dataClasses: ["education_record"], metadata: { applicationSetId: result.applicationSetId,
        disclosureEvidenceEnded: result.authorizationWithdrawn === true },
    });
    return { id: result.id, applicationSetId: result.applicationSetId, status: "removed" };
  }

  async updateOwnApplicationChoice(context: RequestContext, applicationSetId: string, choiceId: string, input: UpdateApplicationChoiceInput): Promise<ApplicationSetDto> {
    const userId = requireAuthenticatedStudent(context);
    if (context.tenantSchoolId !== null) throw forbidden("Student application commands cannot use a school tenant.");
    applicationSetId = inputUuid(applicationSetId, "applicationSetId");
    choiceId = inputUuid(choiceId, "choiceId");
    input = parseApplicationChoiceUpdate(input);
    authorizeWrite(context, { id: choiceId, ownerUserId: userId, dataClasses: ["education_record"] });
    await this.applicationCommands?.authorizeMutation(context);
    const result = await this.repository.updateApplicationChoice(userId, applicationSetId, choiceId, input);
    const current = await this.repository.getApplicationSetById(applicationSetId, userId);
    if (!current) throw serviceUnavailable("Application set could not be reloaded.");
    if (result.changed) await this.recordAudit(context, {
      action: "student.application_choice.update", resourceType: "application_choice", resourceId: choiceId,
      dataClasses: ["education_record"], metadata: { applicationSetId, revision: current.revision,
        fields: Object.keys(input).filter(field => field !== "expectedRevision") },
    });
    return current;
  }

  async reorderOwnApplicationChoices(context: RequestContext, applicationSetId: string, input: ReorderApplicationChoicesInput): Promise<ApplicationSetDto> {
    const userId = requireAuthenticatedStudent(context);
    if (context.tenantSchoolId !== null) throw forbidden("Student application commands cannot use a school tenant.");
    applicationSetId = inputUuid(applicationSetId, "applicationSetId");
    input = parseApplicationChoiceOrder(input);
    authorizeWrite(context, { id: applicationSetId, ownerUserId: userId, dataClasses: ["education_record"] });
    await this.applicationCommands?.authorizeMutation(context);
    const result = await this.repository.reorderApplicationChoices(userId, applicationSetId, input);
    const current = await this.repository.getApplicationSetById(applicationSetId, userId);
    if (!current) throw serviceUnavailable("Application set could not be reloaded.");
    if (result.changed) await this.recordAudit(context, {
      action: "student.application_choices.reorder", resourceType: "application_set", resourceId: applicationSetId,
      dataClasses: ["education_record"], metadata: { revision: current.revision, choiceCount: input.choiceIds.length },
    });
    return current;
  }

  private async runApplicationCommand<T extends { id: string }>(
    context: RequestContext, operation: ApplicationCommand, input: ApplicationCommandInput, options: ApplicationCommandOptions,
    create: () => Promise<T>, reload: (id: string) => Promise<T | null>,
  ): Promise<T> {
    if (context.tenantSchoolId !== null) throw forbidden("Student application commands cannot use a school tenant.");
    const key = options.idempotencyKey === undefined ? undefined : parseApplicationIdempotencyKey(options.idempotencyKey);
    if (this.applicationCommands) return this.applicationCommands.execute(context, operation, input, key, create, reload);
    if (key !== undefined) throw serviceUnavailable("Application idempotency storage is not configured.");
    return create();
  }

  private async recordAudit(
    context: RequestContext,
    input: {
      action: string;
      resourceType: string;
      resourceId: string | null;
      dataClasses: readonly DataClass[];
      metadata?: unknown;
    },
  ) {
    if (!this.auditSink) {
      return;
    }

    await this.auditSink.record(
      buildAuditEvent(context, {
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        allowed: true,
        policyDecisionId: context.policyDecisionId,
        dataClasses: input.dataClasses,
        metadata: input.metadata,
      }),
    );
  }
}

function requireAuthenticatedStudent(context: RequestContext): string {
  if (context.activeRole !== "student" || !context.actorUserId) {
    throw forbidden("Authenticated student context is required.");
  }

  return context.actorUserId;
}

function requireEducationStudent(context: RequestContext, write: boolean): string {
  const userId = requireAuthenticatedStudent(context);
  if (context.tenantSchoolId !== null) throw forbidden("Student education cannot use a school tenant.");
  const resource = { id: `education:${userId}`, ownerUserId: userId, dataClasses: ["education_record"] as const };
  if (write) authorizeWrite(context, resource); else authorizeRead(context, resource);
  return userId;
}

function requireAssessmentStudent(context: RequestContext, write: boolean): string {
  const userId = requireAuthenticatedStudent(context);
  if (context.tenantSchoolId !== null || context.selectedSurface !== "student" || context.purpose !== "student_action"
    || (context.authStrength !== "session" && context.authStrength !== "step_up")) throw forbidden("Student assessment context is required.");
  const resource = { id: `assessments:${userId}`, ownerUserId: userId, dataClasses: ["education_record"] as const };
  if (write) authorizeWrite(context, resource); else authorizeRead(context, resource);
  return userId;
}

function authorizeRead(context: RequestContext, resource: Parameters<typeof canReadStudentOwnedResource>[1]) {
  const decision = canReadStudentOwnedResource(context, resource);

  if (!decision.allowed) {
    throw forbidden(decision.reason);
  }
}

function authorizeWrite(context: RequestContext, resource: Parameters<typeof canWriteStudentOwnedResource>[1]) {
  const decision = canWriteStudentOwnedResource(context, resource);

  if (!decision.allowed) {
    throw forbidden(decision.reason);
  }
}
