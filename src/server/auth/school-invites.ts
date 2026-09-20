import { createHash, randomBytes } from "node:crypto";

import { buildAuditEvent, type AuditEvent } from "../audit/audit.ts";
import { evaluatePolicy } from "../policy/policy.ts";
import { badRequest, conflict, forbidden } from "../shared/errors.ts";
import type { RequestContext } from "../shared/request-context.ts";
import { inputText, inputUuid } from "../shared/input.ts";
import { authDisplayName, authEmail, authInput, authPassword, authToken } from "./input.ts";
import { passwordHasher, type PasswordHasher } from "./password-hasher.ts";
import type { CuacInternalRole } from "./cuac-staff-authority.ts";

export const SCHOOL_STAFF_INVITE_ROLES = ["admissions", "counselor", "viewer", "school_admin"] as const;

export type SchoolStaffInviteRole = (typeof SCHOOL_STAFF_INVITE_ROLES)[number];

export type SchoolStaffInviteAccount = {
  userId: string;
  emailNormalized: string;
  accountStatus: string;
};

export type SchoolStaffInviteSchool = {
  id: string;
  status: string;
};

export type ActiveSchoolStaffInvite = {
  id: string;
  schoolId: string;
  emailNormalized: string;
  role: string;
  invitedByUserId: string | null;
  expiresAt: Date;
};

export type CreatedSchoolStaffInvite = {
  inviteId: string;
  schoolId: string;
  emailNormalized: string;
  role: SchoolStaffInviteRole;
  expiresAt: Date;
  deliveryStatus: "deferred" | "queued";
};

export type AcceptedSchoolStaffInvite = {
  inviteId: string;
  schoolId: string;
  userId: string;
  role: SchoolStaffInviteRole;
  membershipId: string;
  acceptedAt: Date;
  schoolStaffRoleGranted: boolean;
};

export type ActivatedSchoolStaffInvite = AcceptedSchoolStaffInvite & {
  emailNormalized: string;
  accountCreated: true;
  emailVerified: true;
};

export type RevokedSchoolStaffInvite = {
  inviteId: string;
  revoked: boolean;
  revokedAt: Date;
};

export type CreateSchoolStaffInviteInput = {
  schoolId: unknown;
  email: unknown;
  role: unknown;
};

export type ActivateSchoolStaffInviteInput = {
  inviteToken: unknown;
  password: unknown;
  displayName?: unknown;
};

export type SchoolStaffInviteRepository = {
  hasLiveCuacStaffAuthority(input: { actorUserId: string; activeRole: CuacInternalRole }): Promise<boolean>;
  findAccountByUserId(userId: string): Promise<SchoolStaffInviteAccount | null>;
  findSchoolById(schoolId: string): Promise<SchoolStaffInviteSchool | null>;
  createInvite(input: {
    schoolId: string;
    email: string;
    emailNormalized: string;
    role: SchoolStaffInviteRole;
    inviteTokenHash: string;
    invitedByUserId: string;
    now: Date;
    expiresAt: Date;
  }): Promise<{ inviteId: string }>;
  findActiveInviteByIdAndTokenHash(input: {
    inviteId: string;
    inviteTokenHash: string;
    now: Date;
  }): Promise<ActiveSchoolStaffInvite | null>;
  acceptInvite(input: {
    inviteId: string;
    userId: string;
    schoolId: string;
    role: SchoolStaffInviteRole;
    acceptedAt: Date;
    invitedByUserId: string | null;
  }): Promise<AcceptedSchoolStaffInvite | null>;
  activateInviteForNewAccount(input: {
    inviteId: string;
    inviteTokenHash: string;
    schoolId: string;
    role: SchoolStaffInviteRole;
    invitedByUserId: string | null;
    passwordHash: string;
    displayName: string | null;
    activatedAt: Date;
  }): Promise<ActivatedSchoolStaffInvite | null>;
  revokePendingInvite(input: {
    inviteId: string;
    revokedByUserId: string;
    revokedAt: Date;
  }): Promise<{ revoked: boolean }>;
};

export type SchoolStaffInviteDeliverySink = {
  send(input: {
    inviteId: string;
    schoolId: string;
    emailNormalized: string;
    role: SchoolStaffInviteRole;
    inviteToken: string;
    expiresAt: Date;
  }): Promise<void>;
};

export type SchoolStaffInviteAuditSink = {
  record(event: AuditEvent): Promise<void>;
};

export class SchoolStaffInviteService {
  private readonly repository: SchoolStaffInviteRepository;
  private readonly deliverySink: SchoolStaffInviteDeliverySink | null;
  private readonly auditSink: SchoolStaffInviteAuditSink | null;
  private readonly passwordHasher: PasswordHasher;
  private readonly now: () => Date;
  private readonly inviteTtlMs: number;

  constructor(
    repository: SchoolStaffInviteRepository,
    options: {
      deliverySink?: SchoolStaffInviteDeliverySink | null;
      auditSink?: SchoolStaffInviteAuditSink | null;
      passwordHasher?: PasswordHasher;
      now?: Date;
      inviteTtlMs?: number;
    } = {},
  ) {
    this.repository = repository;
    this.deliverySink = options.deliverySink ?? null;
    this.auditSink = options.auditSink ?? null;
    this.passwordHasher = options.passwordHasher ?? passwordHasher;
    this.now = () => options.now ?? new Date();
    this.inviteTtlMs = options.inviteTtlMs ?? 7 * 24 * 60 * 60 * 1000;
  }

  async createInvite(context: RequestContext, input: CreateSchoolStaffInviteInput): Promise<CreatedSchoolStaffInvite> {
    const actor = requireCuacInviteManager(context);
    const value = authInput(input, ["schoolId", "email", "role"]);
    const schoolId = inputUuid(value.schoolId, "School id");
    const email = authEmail(value.email);
    const role = parseSchoolStaffInviteRole(inputText(value.role, "School staff invite role", 32));
    const decision = evaluatePolicy(context, "ops.manage_school_invites", {
      type: "school_tenant",
      tenantSchoolId: schoolId,
      dataClasses: ["ops_confidential"],
    });

    if (!decision.allowed) {
      throw forbidden(decision.reason);
    }
    if (!await this.repository.hasLiveCuacStaffAuthority(actor)) {
      throw forbidden("Active CUAC staff access grant is required.");
    }

    const school = await this.repository.findSchoolById(schoolId);
    if (!school || school.status !== "active") {
      throw badRequest("School is not available for staff invites.");
    }

    const now = this.now();
    const expiresAt = new Date(now.getTime() + this.inviteTtlMs);
    const inviteToken = randomBytes(32).toString("base64url");
    const invite = await this.repository.createInvite({
      schoolId,
      email: email.original,
      emailNormalized: email.normalized,
      role,
      inviteTokenHash: sha256(inviteToken),
      invitedByUserId: actor.actorUserId,
      now,
      expiresAt,
    });

    if (this.deliverySink) {
      await this.deliverySink.send({
        inviteId: invite.inviteId,
        schoolId,
        emailNormalized: email.normalized,
        role,
        inviteToken,
        expiresAt,
      });
    }

    await this.recordAudit(context, {
      action: "auth.school_staff_invite.create",
      resourceType: "school_staff_invite",
      resourceId: invite.inviteId,
      allowed: true,
      policyDecisionId: decision.id,
      dataClasses: ["ops_confidential", "tenant_confidential", "secret"],
      metadata: {
        schoolId,
        role,
        emailDomain: extractEmailDomain(email.normalized),
        deliveryStatus: this.deliverySink ? "queued" : "deferred",
        expiresAt: expiresAt.toISOString(),
      },
    });

    return {
      inviteId: invite.inviteId,
      schoolId,
      emailNormalized: email.normalized,
      role,
      expiresAt,
      deliveryStatus: this.deliverySink ? "queued" : "deferred",
    };
  }

  async acceptInvite(
    context: RequestContext,
    inviteId: unknown,
    inviteToken: unknown,
  ): Promise<AcceptedSchoolStaffInvite> {
    const actorUserId = requireAuthenticatedActor(context);
    const normalizedInviteId = inputUuid(inviteId, "School staff invite id");
    const normalizedInviteToken = authToken(inviteToken);
    const now = this.now();
    const account = await this.repository.findAccountByUserId(actorUserId);

    if (!account || account.accountStatus !== "active") {
      throw forbidden("An active authenticated account is required to accept a school invite.");
    }

    const invite = await this.repository.findActiveInviteByIdAndTokenHash({
      inviteId: normalizedInviteId,
      inviteTokenHash: sha256(normalizedInviteToken),
      now,
    });

    if (!invite) {
      throw badRequest("School invite is invalid, expired, or already consumed.");
    }

    if (invite.emailNormalized !== account.emailNormalized) {
      throw forbidden("School invite can only be accepted by the invited account.");
    }

    const role = parseSchoolStaffInviteRole(invite.role);
    const accepted = await this.repository.acceptInvite({
      inviteId: invite.id,
      userId: actorUserId,
      schoolId: invite.schoolId,
      role,
      acceptedAt: now,
      invitedByUserId: invite.invitedByUserId,
    });

    if (!accepted) {
      throw badRequest("School invite is invalid, expired, or already consumed.");
    }

    await this.recordAudit(context, {
      action: "auth.school_staff_invite.accept",
      resourceType: "school_staff_invite",
      resourceId: invite.id,
      allowed: true,
      policyDecisionId: context.policyDecisionId,
      dataClasses: ["tenant_confidential", "secret"],
      metadata: {
        schoolId: invite.schoolId,
        role,
        emailDomain: extractEmailDomain(account.emailNormalized),
        membershipId: accepted.membershipId,
        schoolStaffRoleGranted: accepted.schoolStaffRoleGranted,
      },
    });

    return accepted;
  }

  async activateInvite(
    context: RequestContext,
    inviteId: unknown,
    input: ActivateSchoolStaffInviteInput,
  ): Promise<ActivatedSchoolStaffInvite> {
    if (context.actorUserId || context.activeRole !== "guest") {
      throw forbidden("Sign out before activating a new school staff account. Existing accounts must use the signed-in invite acceptance flow.");
    }

    const value = authInput(input, ["inviteToken", "password", "displayName"]);
    const normalizedInviteId = inputUuid(inviteId, "School staff invite id");
    const normalizedInviteToken = authToken(value.inviteToken);
    const password = authPassword(value.password, true);
    const displayName = authDisplayName(value.displayName);
    const activatedAt = this.now();
    const inviteTokenHash = sha256(normalizedInviteToken);
    const invite = await this.repository.findActiveInviteByIdAndTokenHash({
      inviteId: normalizedInviteId,
      inviteTokenHash,
      now: activatedAt,
    });

    if (!invite) {
      throw badRequest("School invite is invalid, expired, or already consumed.");
    }

    const role = parseSchoolStaffInviteRole(invite.role);
    const passwordHash = await this.passwordHasher.hash(password);
    const activated = await this.repository.activateInviteForNewAccount({
      inviteId: invite.id,
      inviteTokenHash,
      schoolId: invite.schoolId,
      role,
      invitedByUserId: invite.invitedByUserId,
      passwordHash,
      displayName,
      activatedAt,
    });

    if (!activated) {
      throw conflict("This invitation cannot create a new account. If this email already has a CUAC account, sign in and accept the invitation from that account.");
    }

    await this.recordAudit(context, {
      action: "auth.school_staff_invite.activate",
      resourceType: "school_staff_invite",
      resourceId: invite.id,
      allowed: true,
      policyDecisionId: context.policyDecisionId,
      dataClasses: ["tenant_confidential", "secret"],
      metadata: {
        activatedUserId: activated.userId,
        schoolId: invite.schoolId,
        role,
        emailDomain: extractEmailDomain(activated.emailNormalized),
        membershipId: activated.membershipId,
        accountCreated: true,
        emailVerifiedByInvite: true,
        studentRoleGranted: false,
      },
    });

    return activated;
  }

  async revokeInvite(context: RequestContext, inviteId: unknown): Promise<RevokedSchoolStaffInvite> {
    const actor = requireCuacInviteManager(context);
    const normalizedInviteId = inputUuid(inviteId, "School staff invite id");
    const decision = evaluatePolicy(context, "ops.manage_school_invites", {
      type: "school_tenant",
      dataClasses: ["ops_confidential"],
    });

    if (!decision.allowed) {
      throw forbidden(decision.reason);
    }
    if (!await this.repository.hasLiveCuacStaffAuthority(actor)) {
      throw forbidden("Active CUAC staff access grant is required.");
    }

    const revokedAt = this.now();
    const result = await this.repository.revokePendingInvite({
      inviteId: normalizedInviteId,
      revokedByUserId: actor.actorUserId,
      revokedAt,
    });

    await this.recordAudit(context, {
      action: "auth.school_staff_invite.revoke",
      resourceType: "school_staff_invite",
      resourceId: normalizedInviteId,
      allowed: true,
      policyDecisionId: decision.id,
      dataClasses: ["ops_confidential", "tenant_confidential"],
      metadata: {
        revoked: result.revoked,
      },
    });

    return {
      inviteId: normalizedInviteId,
      revoked: result.revoked,
      revokedAt,
    };
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

export function hashSchoolStaffInviteToken(token: string): string {
  return sha256(token);
}

function requireAuthenticatedActor(context: RequestContext): string {
  if (!context.actorUserId || context.activeRole === "guest") {
    throw forbidden("An authenticated session is required to accept a school invite.");
  }

  return context.actorUserId;
}

function requireCuacInviteManager(context: RequestContext): { actorUserId: string; activeRole: CuacInternalRole } {
  if (!context.actorUserId || (context.activeRole !== "cuac_ops" && context.activeRole !== "cuac_admin")) {
    throw forbidden("CUAC internal role is required to manage school invites.");
  }

  return { actorUserId: context.actorUserId, activeRole: context.activeRole };
}

function parseSchoolStaffInviteRole(role: string): SchoolStaffInviteRole {
  if (SCHOOL_STAFF_INVITE_ROLES.includes(role as SchoolStaffInviteRole)) {
    return role as SchoolStaffInviteRole;
  }

  throw forbidden("School invite role is not allowed.");
}

function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function extractEmailDomain(emailNormalized: string): string | null {
  const [, domain] = emailNormalized.split("@");
  return domain || null;
}
