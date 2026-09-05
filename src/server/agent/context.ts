import { buildAuditEvent, type AuditEvent } from "../audit/audit.ts";
import { badRequest, CuacError, forbidden } from "../shared/errors.ts";
import { inputUuid } from "../shared/input.ts";
import type { DataClass, RequestContext } from "../shared/request-context.ts";
import { parseCandidateInput, parseStoredCandidate, type AgentContextCandidateInput } from "./candidate-input.ts";
export type { AgentContextCandidateInput } from "./candidate-input.ts";

export type AgentContextScope = "guest_page" | "student_account" | "school_tenant" | "ops_audit";
export type AgentContextCandidateStatus = "proposed" | "accepted" | "rejected" | "expired";
export type AgentMemoryConfidence = "inferred" | "repeated_signal" | "user_stated" | "user_confirmed";

export type AgentContextCandidateRecord = {
  id: string;
  anonymousSessionHash: string | null;
  userId: string | null;
  continuationId: string | null;
  candidateType: string;
  contextScope: AgentContextScope;
  activeRole: string;
  tenantSchoolId: string | null;
  memoryNamespace: string | null;
  dataClass: DataClass;
  confidence: AgentMemoryConfidence;
  summary: string;
  structured: Record<string, unknown>;
  sourceEntityIds: readonly string[];
  status: AgentContextCandidateStatus;
  expiresAt: Date;
  createdAt: Date;
  acceptedAt: Date | null;
};

export type AgentMemoryEntryRecord = {
  id: string;
  userId: string | null;
  memoryType: string;
  contextScope: AgentContextScope;
  activeRole: string;
  tenantSchoolId: string | null;
  memoryNamespace: string;
  dataClass: DataClass;
  confidence: AgentMemoryConfidence;
  summary: string;
  structured: Record<string, unknown>;
  source: string;
  sourceCandidateId: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  clearedAt: Date | null;
};

export type AgentCandidateOwner = { destinationUserId: string } & (
  | { contextScope: "guest_page"; anonymousSessionHash: string }
  | { contextScope: "student_account"; userId: string; memoryNamespace: string });

export type AgentContextRepository = {
  assertMemoryAllowed(userId: string): Promise<void>;
  createCandidate(input: Omit<AgentContextCandidateRecord, "id" | "createdAt" | "acceptedAt">): Promise<AgentContextCandidateRecord>;
  findCandidateForConfirmation(candidateId: string, owner: AgentCandidateOwner): Promise<AgentContextCandidateRecord | null>;
  markCandidateAccepted(candidateId: string, owner: AgentCandidateOwner): Promise<boolean>;
  createMemoryEntry(input: Omit<AgentMemoryEntryRecord, "id" | "expiresAt" | "createdAt" | "clearedAt">): Promise<AgentMemoryEntryRecord>;
};

export type AgentContextAuditSink = {
  record(event: AuditEvent): Promise<void>;
};

const GUEST_CANDIDATE_TTL_MS = 24 * 60 * 60 * 1000;

export class AgentContextService {
  private readonly repository: AgentContextRepository;
  private readonly auditSink: AgentContextAuditSink | null;
  private readonly deniedAuditSink: AgentContextAuditSink | null;

  constructor(repository: AgentContextRepository, auditSink: AgentContextAuditSink | null = null, options: { deniedAuditSink?: AgentContextAuditSink | null } = {}) {
    this.repository = repository;
    this.auditSink = auditSink;
    this.deniedAuditSink = options.deniedAuditSink === undefined ? auditSink : options.deniedAuditSink;
  }

  async proposeCandidate(
    context: RequestContext,
    input: AgentContextCandidateInput,
    now = new Date(),
  ): Promise<AgentContextCandidateRecord> {
    try {
      if (context.activeRole === "guest" && !context.guestSessionId) throw badRequest("Guest context requires a verified browser session.");
      if (!["guest", "student"].includes(context.activeRole) || context.tenantSchoolId) throw forbidden("Study preferences require a guest or student persona.");
      const content = parseCandidateInput(input);
      const scope = resolveContextScope(context, context.activeRole === "guest" ? "guest_page" : "student_account");
      if (context.activeRole === "student" && !context.dataClassAllowlist.includes(content.dataClass)) throw forbidden("Study preference storage is not allowed.");
      if (context.activeRole === "student") await this.repository.assertMemoryAllowed(context.actorUserId!);

      const candidate = await this.repository.createCandidate({
        anonymousSessionHash: context.actorUserId ? null : context.guestSessionId,
        userId: context.actorUserId,
        continuationId: null,
        candidateType: content.candidateType,
        contextScope: scope,
        activeRole: context.activeRole,
        tenantSchoolId: scope === "school_tenant" ? context.tenantSchoolId : null,
        memoryNamespace: scope === "guest_page" ? null : deriveMemoryNamespace(context, scope),
        dataClass: content.dataClass,
        confidence: content.confidence,
        summary: content.summary,
        structured: content.structured,
        sourceEntityIds: content.sourceEntityIds,
        status: "proposed",
        expiresAt: defaultCandidateExpiry(scope, now),
      });

      await this.recordAudit(context, {
        action: "agent.context_candidate.create",
        resourceType: "agent_context_candidate",
        resourceId: candidate.id,
        allowed: true,
        policyDecisionId: context.policyDecisionId,
        dataClasses: [candidate.dataClass],
        metadata: toCandidateAuditMetadata(candidate),
      });

      return candidate;
    } catch (error) {
      await recordDeniedCandidateAudit(this.deniedAuditSink, context, error);
      throw error;
    }
  }

  async acceptCandidateAsMemory(context: RequestContext, candidateId: string, now = new Date()): Promise<AgentMemoryEntryRecord> {
    requireStudentMemoryContext(context);
    candidateId = inputUuid(candidateId, "candidateId");
    await this.repository.assertMemoryAllowed(context.actorUserId!);
    const owner: AgentCandidateOwner = { destinationUserId: context.actorUserId!, contextScope: "student_account", userId: context.actorUserId!, memoryNamespace: deriveMemoryNamespace(context, "student_account") };
    const candidate = await this.repository.findCandidateForConfirmation(candidateId, owner);

    if (!candidate) {
      throw badRequest("Agent context candidate is not available for confirmation.");
    }

    validateCandidateCanBecomeMemory(context, candidate, now);
    const content = parseStoredCandidate(candidate);
    if (!await this.repository.markCandidateAccepted(candidate.id, owner)) {
      throw badRequest("Agent context candidate is not available for confirmation.");
    }

    const memory = await this.repository.createMemoryEntry({
      userId: context.actorUserId,
      memoryType: candidate.candidateType,
      contextScope: candidate.contextScope,
      activeRole: context.activeRole,
      tenantSchoolId: candidate.contextScope === "school_tenant" ? context.tenantSchoolId : null,
      memoryNamespace: deriveMemoryNamespace(context, candidate.contextScope),
      dataClass: candidate.dataClass,
      confidence: "user_confirmed",
      summary: content.summary,
      structured: content.structured,
      source: "context_candidate_confirmation",
      sourceCandidateId: candidate.id,
    });

    await this.recordAudit(context, {
      action: "agent.memory.create",
      resourceType: "agent_memory_entry",
      resourceId: memory.id,
      allowed: true,
      policyDecisionId: context.policyDecisionId,
      dataClasses: [memory.dataClass],
      metadata: toMemoryAuditMetadata(memory),
    });
    return memory;
  }

  async carryForwardGuestCandidateToStudentMemory(
    context: RequestContext,
    candidateId: string,
    now = new Date(),
  ): Promise<AgentMemoryEntryRecord> {
    requireStudentMemoryContext(context);
    if (!context.guestSessionId) throw forbidden("Guest carry-forward requires a verified browser session.");
    candidateId = inputUuid(candidateId, "candidateId");
    await this.repository.assertMemoryAllowed(context.actorUserId!);
    const owner: AgentCandidateOwner = { destinationUserId: context.actorUserId!, contextScope: "guest_page", anonymousSessionHash: context.guestSessionId };
    const candidate = await this.repository.findCandidateForConfirmation(candidateId, owner);

    if (!candidate) {
      throw badRequest("Agent context candidate is not available for confirmation.");
    }

    validateGuestCandidateCarryForward(context, candidate, now);
    const content = parseStoredCandidate(candidate);
    if (!await this.repository.markCandidateAccepted(candidate.id, owner)) {
      throw badRequest("Agent context candidate is not available for confirmation.");
    }

    const memory = await this.repository.createMemoryEntry({
      userId: context.actorUserId,
      memoryType: candidate.candidateType,
      contextScope: "student_account",
      activeRole: "student",
      tenantSchoolId: null,
      memoryNamespace: deriveMemoryNamespace(context, "student_account"),
      dataClass: candidate.dataClass,
      confidence: "user_confirmed",
      summary: content.summary,
      structured: content.structured,
      source: "guest_context_carry_forward",
      sourceCandidateId: candidate.id,
    });

    await this.recordAudit(context, {
      action: "agent.memory.carry_forward",
      resourceType: "agent_memory_entry",
      resourceId: memory.id,
      allowed: true,
      policyDecisionId: context.policyDecisionId,
      dataClasses: [memory.dataClass],
      metadata: toMemoryAuditMetadata(memory),
    });
    return memory;
  }

  private async recordAudit(
    context: RequestContext,
    input: Omit<AuditEvent, "requestId" | "actorUserId" | "activeRole" | "tenantSchoolId" | "metadata"> & { metadata?: unknown },
  ) {
    if (!this.auditSink) {
      return;
    }

    await this.auditSink.record(buildAuditEvent(context, input));
  }
}

export async function recordDeniedCandidateAudit(sink: AgentContextAuditSink | null, context: RequestContext, error: unknown) {
  if (!sink || !(error instanceof CuacError) || error.status < 400 || error.status >= 500) return;
  await sink.record(buildAuditEvent(context, {
    action: "agent.context_candidate.create", resourceType: "agent_context_candidate", resourceId: null,
    allowed: false, policyDecisionId: context.policyDecisionId, dataClasses: [], metadata: { deniedCode: error.code },
  }));
}

export function requireStudentMemoryContext(context: RequestContext) {
  if (!context.actorUserId || context.activeRole !== "student" || context.tenantSchoolId || !context.dataClassAllowlist.includes("low_sensitive_preference")) {
    throw forbidden("Study memory requires an authenticated student context.");
  }
}

export function deriveMemoryNamespace(context: RequestContext, scope: AgentContextScope): string {
  if (scope === "student_account") {
    if (!context.actorUserId || context.activeRole !== "student") {
      throw forbidden("Student Agent memory requires an authenticated student context.");
    }

    return `user:${context.actorUserId}:student`;
  }

  if (scope === "school_tenant") {
    if (!context.actorUserId || context.activeRole !== "school_staff" || !context.tenantSchoolId) {
      throw forbidden("School Agent memory requires an authenticated tenant context.");
    }

    return `school:${context.tenantSchoolId}:staff`;
  }

  if (scope === "ops_audit") {
    if (!context.actorUserId || !["cuac_ops", "cuac_admin"].includes(context.activeRole)) {
      throw forbidden("Ops Agent memory requires an authenticated Ops context.");
    }

    return `ops:${context.actorUserId}:audit`;
  }

  throw forbidden("Guest Agent context cannot create durable memory.");
}

function resolveContextScope(context: RequestContext, requestedScope: AgentContextScope): AgentContextScope {
  if (context.activeRole === "guest") {
    if (requestedScope !== "guest_page") {
      throw forbidden("Guest Agent context must remain ephemeral.");
    }

    return "guest_page";
  }

  if (requestedScope === "student_account" && context.activeRole === "student" && context.actorUserId) {
    return requestedScope;
  }

  if (requestedScope === "school_tenant" && context.activeRole === "school_staff" && context.actorUserId && context.tenantSchoolId) {
    return requestedScope;
  }

  if (requestedScope === "ops_audit" && ["cuac_ops", "cuac_admin"].includes(context.activeRole) && context.actorUserId) {
    return requestedScope;
  }

  throw forbidden("Agent context scope does not match the active persona.");
}

function validateCandidateCanBecomeMemory(context: RequestContext, candidate: AgentContextCandidateRecord, now: Date) {
  if (candidate.contextScope !== "student_account" || candidate.activeRole !== "student" || candidate.tenantSchoolId
    || candidate.anonymousSessionHash !== null || candidate.memoryNamespace !== deriveMemoryNamespace(context, "student_account")) {
    throw forbidden("Agent context candidate does not match the active student persona.");
  }

  if (candidate.status !== "proposed") {
    throw badRequest("Agent context candidate is not available for confirmation.");
  }

  if (!Number.isFinite(candidate.expiresAt.getTime()) || candidate.expiresAt.getTime() <= now.getTime()) {
    throw badRequest("Agent context candidate has expired.");
  }

  if (candidate.userId !== context.actorUserId) {
    throw forbidden("Agent context candidate does not belong to the authenticated user.");
  }

  if (!context.dataClassAllowlist.includes(candidate.dataClass)) {
    throw forbidden("Agent memory data class is not allowed.");
  }
}

function validateGuestCandidateCarryForward(context: RequestContext, candidate: AgentContextCandidateRecord, now: Date) {
  if (!context.actorUserId || context.activeRole !== "student" || context.tenantSchoolId || !context.dataClassAllowlist.includes("low_sensitive_preference")) {
    throw forbidden("Guest Agent carry-forward requires an authenticated student context.");
  }

  if (candidate.contextScope !== "guest_page" || candidate.userId !== null || candidate.activeRole !== "guest"
    || candidate.tenantSchoolId !== null || candidate.memoryNamespace !== null) {
    throw forbidden("Only guest Agent candidates can use guest carry-forward.");
  }

  if (!context.guestSessionId || candidate.anonymousSessionHash !== context.guestSessionId) {
    throw forbidden("Guest Agent candidate does not match the current sign-in continuation context.");
  }

  if (candidate.status !== "proposed") {
    throw badRequest("Agent context candidate is not available for confirmation.");
  }

  if (!Number.isFinite(candidate.expiresAt.getTime()) || candidate.expiresAt.getTime() <= now.getTime()) {
    throw badRequest("Agent context candidate has expired.");
  }

  if (!["public_catalog", "low_sensitive_preference"].includes(candidate.dataClass)) {
    throw forbidden("Guest Agent carry-forward can store only public catalog or low-sensitive preference memory.");
  }
}

function defaultCandidateExpiry(scope: AgentContextScope, now: Date): Date {
  if (scope === "guest_page") {
    return new Date(now.getTime() + GUEST_CANDIDATE_TTL_MS);
  }

  return new Date(now.getTime() + 7 * GUEST_CANDIDATE_TTL_MS);
}

function toCandidateAuditMetadata(candidate: AgentContextCandidateRecord) {
  return {
    candidateType: candidate.candidateType,
    contextScope: candidate.contextScope,
    activeRole: candidate.activeRole,
    tenantSchoolId: candidate.tenantSchoolId,
    memoryNamespace: candidate.memoryNamespace,
    dataClass: candidate.dataClass,
    confidence: candidate.confidence,
    status: candidate.status,
    sourceEntityCount: candidate.sourceEntityIds.length,
    expiresAt: candidate.expiresAt.toISOString(),
  };
}

function toMemoryAuditMetadata(memory: AgentMemoryEntryRecord) {
  return {
    memoryType: memory.memoryType,
    contextScope: memory.contextScope,
    activeRole: memory.activeRole,
    tenantSchoolId: memory.tenantSchoolId,
    memoryNamespace: memory.memoryNamespace,
    dataClass: memory.dataClass,
    confidence: memory.confidence,
    source: memory.source,
    sourceCandidateId: memory.sourceCandidateId,
    expiresAt: memory.expiresAt?.toISOString() ?? null,
  };
}
