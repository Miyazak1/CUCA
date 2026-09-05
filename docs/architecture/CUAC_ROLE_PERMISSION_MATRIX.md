# CUAC Role Permission Matrix

Date: 2026-08-14

Status: production authorization design draft.

## 1. Purpose

This document defines who can see and do what in CUAC. It is a core security artifact because CUAC handles student personal data, school tenant data, payment records, and Agent actions.

## 2. Roles

### Public Visitor

Unauthenticated user browsing public content. Their account type is unknown until they choose an account path on the unified auth page.

### Student

Authenticated applicant.

### School Read-Only

School staff who can view records for their own school but cannot update them.

### School Admissions Staff

School staff who can manage application records for their own school.

### School Program Manager

School staff focused on assigned programs and related applications.

### School Owner

School administrator for one school tenant.

### CUAC Ops

Internal operations user who supports data, routing, payment, and schools.

### CUAC Admin

High-trust platform administrator.

### Agent Service

System actor that executes allowed actions on behalf of a user after permission checks.

## 3. Permission Principles

- Authorization is enforced server-side.
- School permissions are scoped by `school_id`.
- CUAC Ops cross-tenant access must be audited.
- Agent actions inherit the user's permissions and cannot exceed them.
- Dangerous actions require explicit confirmation.
- Export, payment, role changes, and cross-tenant access are always audited.

## 4. Matrix

| Resource / Action | Visitor | Student | School Read-Only | School Staff | School Program Manager | School Owner | CUAC Ops | CUAC Admin | Agent Service |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| View public programs | yes | yes | yes | yes | yes | yes | yes | yes | delegated |
| View public universities | yes | yes | yes | yes | yes | yes | yes | yes | delegated |
| Create student account | yes | no duplicate | no | no | no | no | support only | admin | no |
| Sign in as student | own credentials | own | no | no | no | no | support audit only | admin | no |
| Request school staff access | no | no | invite only | invite only | invite only | invite only | support with audit | admin | no |
| Accept school staff invite | no | no | tenant invite | tenant invite | tenant invite | tenant invite | support with audit | admin | no |
| Create CUAC account and request internal access | no | no | no | no | no | no | own account; no permission until approved | admin grant | no |
| Consume sign-in continuation | pending action only | rechecked own | tenant rechecked | tenant rechecked | assigned/tenant rechecked | tenant rechecked | audited recheck | audited recheck | no |
| Save favourites | no | own | no | no | no | no | support only | admin | delegated own |
| Edit student profile | no | own | no | no | no | no | support with audit | admin | delegated own |
| Create application set | no | own | no | no | no | no | support with audit | admin | delegated own confirm |
| Add application choice | no | own | no | no | no | no | support with audit | admin | delegated own |
| Submit application | no | own confirm | no | no | no | no | support with audit | admin | delegated own confirm |
| Pay CUAC fee | no | own confirm | no | no | no | no | support view | admin | never direct without provider confirmation |
| View own application status | no | own | no | no | no | no | support with audit | admin | delegated own |
| View school application queue | no | no | tenant only | tenant only | assigned/tenant policy | tenant only | cross-tenant audited | all | delegated tenant |
| View applicant contact details | no | no | tenant only | tenant only | assigned/tenant policy | tenant only | cross-tenant audited | all | delegated tenant |
| See student's other school choices | no | own only | no | no | no | no | support with audit | admin | no for school context |
| Update school application status | no | no | no | tenant only | assigned/tenant policy | tenant only | support with audit | admin | delegated tenant confirm for bulk |
| Assign school record owner | no | no | no | tenant policy | assigned policy | tenant only | support with audit | admin | delegated tenant |
| Export school CSV | no | no | no | tenant only | no unless allowed | tenant only | audited | all | delegated tenant confirm |
| Manage school staff | no | no | no | no | no | tenant only | support with audit | admin | no |
| Manage catalog data | no | no | no | request only | request assigned program edits | request/approve tenant data | yes | yes | no direct publish |
| Publish catalog verification | no | no | no | no | no | no | yes | yes | no |
| View payment amount | no | own | no | no | no | no | yes | yes | delegated own/support only |
| Refund payment | no | no | no | no | no | no | limited with approval | yes | no |
| View analytics dashboard | no | own summary | tenant summary | tenant summary | assigned summary | tenant summary | platform | platform | delegated scoped |
| View audit logs | no | own limited | no | no | no | tenant staff actions | yes | yes | no |
| Use Agent page context | current page only | own/account | tenant page only | tenant page only | assigned/tenant policy | tenant only | platform scoped | platform | delegated scoped |
| Read long-term student Agent memory | no | own | no | no | no | no | support with audit | admin | delegated own only |
| Write long-term student Agent memory | no | own | no | no | no | no | support with audit | admin | delegated own only |
| Clear Agent memory | no durable memory | own confirm | no | no | no | tenant session only if allowed | support with audit | admin | delegated scoped confirm |
| Access school Agent memory | no | no | tenant only | tenant only | assigned/tenant policy | tenant only | support with audit | admin | delegated tenant |

## 5. School Tenant Isolation

School users must be scoped through `school_staff_memberships`.

Rules:

- Students, school staff, and CUAC staff use the same base account registration and sign-in system.
- School staff permissions are not created by registration alone. They require an active `school_staff_memberships` row, usually created through a `school_staff_invites` token, school-email approval, or tenant owner approval.
- CUAC Ops and CUAC Admin permissions are not created by registration alone. They require an approved `cuac_staff_access_grants` record from controlled CUAC approval, team invitation, SSO claim, or admin assignment.
- The unified auth page should expose access context choices for unauthenticated users; page context may preselect an option but must not classify the visitor before authentication.
- Sign-in continuation is not permission by itself. It stores a pending action and optional action access-context constraints, then must be rechecked after login/register against the authenticated role, tenant, memberships, and action policy.
- A school user can see only `school_applications.tenant_school_id` values connected to their active memberships.
- A school user cannot infer how many other schools the student applied to.
- A school user cannot see payment amounts for other schools.
- A school user cannot see private CUAC Ops notes unless a note is explicitly marked school-visible.
- A school user cannot export records outside their tenant.

## 6. Agent Permission Rules

The Agent Service has no independent business authority. It must act as:

```txt
effective_permissions = user_permissions INTERSECT action_policy
```

Agent context and memory are also permission-scoped:

- Public visitors may use only current-page context. They cannot read or write saved routes, profile data, application choices, notifications, previous conversations, or long-term Agent memory.
- Protected visitor actions should return a sign-in continuation path, not execute under guest identity or inferred account type. After sign-in, the same action must be rechecked as the authenticated user.
- Students may read, write, and clear only their own long-term student Agent memory. Clearing memory requires confirmation.
- School staff may use only tenant-scoped school Agent context and tenant work-session memory. They must not read student private Agent memory or infer other school choices.
- CUAC Ops may use internal audited Agent context according to role and support reason; raw cross-tenant memory/data access must be audited.

Action policy fields:

- action_key
- allowed_roles
- required_scope
- confirmation_required
- reversible
- audit_level
- max_batch_size

Examples:

| Agent Action | Student | School Staff | CUAC Ops | Confirmation |
| --- | --- | --- | --- | --- |
| apply_program_filters | yes | yes | yes | no |
| save_program | yes | no | no | no |
| add_application_choice | yes | no | support | no or light confirm |
| submit_application | yes | no | support | required |
| mark_school_record_contacted | no | tenant | support | required for bulk |
| export_school_csv | no | tenant | support | required |
| refund_payment | no | no | limited | never autonomous |

## 7. Data Visibility By Role

### Student Can See

- own profile;
- own saved items;
- own application sets;
- own selected schools and choices;
- school status visible to student;
- own payments and invoices.

### School Staff Can See

- student contact fields needed for follow-up;
- program interests for their school only;
- funding intent and language readiness;
- CUAC note marked school-visible;
- school-side status and internal notes for their own tenant.

### CUAC Ops Can See

- cross-school application sets for support;
- payment/routing status;
- school activity;
- data freshness;
- Agent action logs;
- audit logs relevant to support.

CUAC Ops access to personal data should be purpose-limited and logged.

## 8. Implementation Requirements

- Use policy tests for every role and action.
- Use object-level authorization, not route-level only.
- Use row-level security for school-scoped tables if feasible.
- Add audit logs before or within the same transaction for sensitive mutations.
- Redact sensitive values in logs.
- Include permission denial telemetry.
