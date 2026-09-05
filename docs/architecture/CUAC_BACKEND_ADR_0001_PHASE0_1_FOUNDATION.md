# ADR 0001: Backend Phase 0/1 Foundation Decisions

Date: 2026-08-26

Status: accepted for Phase 0/1 execution on 2026-08-28

Related documents:

- `CUAC_SECURE_AGENT_BACKEND_ARCHITECTURE.md`
- `CUAC_BACKEND_IMPLEMENTATION_PLAN.md`
- `CUAC_DATABASE_ERD_SPEC.md`
- `CUAC_APPLICATION_API_CONTRACT.md`
- `CUAC_ROLE_PERMISSION_MATRIX.md`
- `CUAC_LEGACY_FIELD_MAPPING_SPEC.md`

## 1. Context

CUAC has a stable frontend-first product blueprint, but the production backend is not implemented yet. A separate frontend/admin workstream is still improving the administrator panel information architecture. Backend work can begin only where the domain boundaries are already stable and will not be invalidated by UI refactoring.

2026-08-28 update: Phase 0/1 execution has started. The frontend demo remains a design and validation artifact, not an immutable backend contract. Backend implementation should improve or replace demo-shaped assumptions when the stable domain model, security boundary, or product maturity requires it.

The delegated execution boundary is:

- proceed with Phase 0/1 foundation;
- do not implement full Agent execution;
- do not implement real payment charging or refunds;
- do not implement Ops Admin write APIs based on the current admin page shape;
- do not implement file upload, document management, or school system integrations.

## 2. Decision Summary

1. Use PostgreSQL as the production transactional primary database.
2. Target Alibaba Cloud as the production deployment baseline: backend on ECS/container runtime, PostgreSQL on Alibaba Cloud RDS, future files/exports on OSS, secrets in managed secret/KMS tooling, and queue/cache through Redis-compatible infrastructure.
3. Prefer Drizzle for schema definition if CUAC remains TypeScript-first; prefer Prisma only if the backend becomes a separate Node/Nest-style service and the team values Prisma's workflow more. The Phase 0 task must choose one source of truth before migrations start.
4. Use one modular monolith for the first backend rather than separate microservices.
5. Implement a unified account model: student, school staff, and CUAC staff are users in one identity system; authority comes from roles, school memberships, and internal access grants.
6. Use deny-by-default policy middleware for manual API calls and future Agent actions.
7. Implement audit logging in Phase 1, before sensitive mutations.
8. Implement public catalog read APIs first, preserving CSCAlite canonical field families and `sourceFieldLineage`.
9. Keep the Agent out of direct database access. Phase 1 may define the Agent service boundary and registry schema, but not production action execution.
10. Keep payment credentials completely out of CUAC. Phase 1 may model payment business status later, but real hosted checkout/webhooks belong to a later phase.
11. Do not derive Ops write APIs from the current administrator panel while that UI is still being restructured.

## 3. Architecture Shape

Phase 0/1 should target:

```text
Web Client
  -> API Route / Backend Service
    -> Auth
    -> Policy
    -> Catalog
    -> Student Foundation
    -> Audit
    -> Common Logging / Request Context
    -> PostgreSQL
```

Agent boundary for Phase 0/1:

```text
Agent UI / future Agent Orchestrator
  -> Tool Gateway contract only
  -> no direct DB credential
  -> no production execute path yet
```

School tenant boundary for Phase 0/1:

```text
school_staff_memberships
  -> tenant policy helper
  -> future school_applications queries
```

## 4. Database Decision

PostgreSQL is recommended because CUAC needs:

- strong relational constraints;
- transactional application submission later;
- tenant-scoped records;
- audit logs;
- JSONB snapshots for source lineage and school handoff;
- Row-Level Security for defense in depth;
- mature backup and restore workflows.

Alibaba Cloud deployment updates this from a generic PostgreSQL recommendation to a concrete hosting baseline: use Alibaba Cloud RDS for PostgreSQL for production and staging unless a later infrastructure review finds a stronger reason to self-manage PostgreSQL.

Cloudflare D1 can remain useful for:

- local starter examples;
- public catalog cache;
- edge-read optimization later.

D1 should not be the authoritative store for:

- application submission;
- payment state;
- school tenant records;
- audit logs;
- Agent memory/action records.

## 5. ORM Decision

Phase 0 must decide between Drizzle and Prisma before schema work starts.

Recommendation:

- Use Drizzle if backend code stays TypeScript-first.
- Use Prisma if CUAC creates a separate backend service from `migration-intake` patterns.

Do not maintain both Drizzle and Prisma as competing schema sources.

Phase 0 output must name:

- schema source of truth;
- migration command;
- test database setup;
- deployment migration procedure;
- owner for generated client updates.

## 6. Auth Decision

Use one account system:

- `users`
- `auth_identities`
- `auth_sessions`
- `user_roles`
- `school_staff_memberships`
- `school_staff_invites`
- `cuac_staff_access_grants`
- `sign_in_continuations`

Rules:

- student registration may create a student role and profile;
- school staff registration creates only a base user until an invite, school-email approval, SSO claim, or tenant owner approval creates membership;
- CUAC internal registration creates only a base user until an approved internal access grant creates Ops/Admin authority;
- sign-in continuation stores minimal action metadata and re-runs authorization after login;
- selected surface is UI context, not authority.

## 7. Policy Decision

Use centralized policy checks with explicit deny-by-default behavior.

Policy inputs:

- subject: user, role, memberships, session;
- action: API route or future tool/action key;
- resource: owner ID, tenant ID, data class, object state;
- context: selected surface, route, IP/user-agent hashes, continuation token, confirmation state;
- purpose: student action, school review, support, audit, billing.

Policy outputs:

- allow;
- deny;
- require sign-in;
- require tenant;
- require confirmation;
- require support reason;
- redact fields.

Phase 1 policy must cover:

- public catalog read;
- own student profile read/write;
- own saved item read/write;
- school membership resolution;
- audit log append;
- prohibited Agent/tool actions returning denial.

## 8. Audit Decision

Audit logging starts in Phase 1.

Initial audit table must support:

- actor;
- actor type;
- action;
- entity type;
- entity ID;
- tenant school ID;
- request ID;
- policy decision ID;
- purpose/reason;
- data classes disclosed;
- redacted before/after snapshots or hashes;
- created timestamp.

Rules:

- audit is append-only from normal app paths;
- general logs are not audit logs;
- audit records may outlive Agent memory;
- denied sensitive actions should write metadata audit where appropriate.

## 9. Catalog Decision

Catalog read APIs are the first safe backend surface because schools, programs, scholarships, and cities are stable domain objects and already mapped to CSCAlite field families.

Phase 1 catalog tables:

- `schools`
- `programs`
- `program_intakes`
- `scholarships`
- `program_scholarships`
- `cities`
- `catalog_source_evidence`

Phase 1 catalog APIs:

- `GET /api/v1/schools`
- `GET /api/v1/schools/:schoolId`
- `GET /api/v1/programs`
- `GET /api/v1/programs/:programId`
- `GET /api/v1/scholarships`
- `GET /api/v1/scholarships/:scholarshipId`
- `GET /api/v1/cities`
- `GET /api/v1/cities/:citySlug`

Rules:

- responses preserve CSCAlite-compatible camelCase fields;
- UI aliases may be included but cannot replace canonical fields;
- source lineage must be preserved;
- internal catalog quality metadata must not be displayed as raw student-facing copy;
- write/publish workflows for Ops are not Phase 1.

## 10. Agent Decision

Phase 0/1 may implement only:

- Agent architecture docs;
- tool registry schema;
- policy-denial fixtures;
- future Tool Gateway contract;
- prompt-injection test fixtures.

Phase 0/1 must not implement:

- Agent action execute;
- unrestricted Agent SQL;
- durable guest memory;
- raw application table retrieval;
- payment-provider access;
- school tenant queue access except future tenant-safe contract docs.

## 11. Consequences

Positive:

- backend work can begin without waiting for every admin UI polish issue;
- high-risk surfaces remain out of scope;
- security, policy, audit, and catalog foundations are established first;
- future Agent work will call normal domain services instead of becoming a privileged bypass.

Tradeoffs:

- fewer visible product features in the first backend sprint;
- Ops/Admin CRUD waits for admin information architecture to settle;
- real payment and Agent action demos wait until safer primitives exist.

## 12. Phase 0 Approval Checklist

Phase 0 can be considered approved when:

- database and ORM choice is final;
- auth/session strategy is chosen;
- payment provider pattern is confirmed as hosted checkout/hosted fields;
- Agent no-direct-DB rule is accepted;
- audit table fields are accepted;
- first ticket batch is approved;
- admin frontend workstream agrees not to force unstable page shapes into API contracts.
