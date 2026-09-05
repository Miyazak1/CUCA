# CUAC Product Architecture Spec

Date: 2026-08-14

Status: production product architecture draft derived from the frontend demo.

## 1. Purpose

This document defines the mature product architecture for CUAC as a real China admissions routing platform for international students. It turns the current frontend demo into a system design that can support authenticated users, school tenants, payments, application routing, analytics, operations, and natural-language Agent workflows.

CUAC should not become a generic course directory or a UCAS clone. Its product position is:

- program-first discovery for China study;
- student application-intent building;
- multi-school routing with a clear CUAC service fee;
- school-side admissions inbox;
- natural-language assistance for search, analysis, summarization, and permitted actions;
- CUAC operations tooling for data quality, payment, and routing control.

## 2. Product Surfaces

### Public Student Surface

- Home
- Program search and program detail
- University search and university detail
- Scholarships
- Cities
- Guides
- Auth and registration

Primary jobs:

- help a student discover realistic China routes;
- turn loose intent into concrete programs;
- build trust through clear source and deadline signals;
- move the student toward account creation and application choices.

### Authenticated Student Surface

- Onboarding
- Hub
- Favourites
- Application builder
- Notifications
- Preferences
- Agent workspace

Primary jobs:

- store profile and preferences;
- manage saved items;
- add concrete program choices;
- complete non-document application information;
- pay for multi-school routing if needed;
- submit application records to selected schools;
- track school-side follow-up.

### School Staff Surface

- School admissions workspace
- Application queue
- Applicant detail
- Analytics
- Staff settings
- Program availability/settings
- Export and reporting

Primary jobs:

- receive only this school's records;
- triage new applications;
- contact students directly;
- assign owners and update statuses;
- analyze demand by program, country, intake, source, and conversion.

### CUAC Operations Surface

- Data quality console
- School tenant management
- Program and scholarship management
- Application routing monitor
- Payment and invoice monitor
- User support tools
- Agent audit explorer
- Analytics dashboard

Primary jobs:

- keep program and school data accurate;
- onboard and manage school tenants;
- resolve routing and payment issues;
- audit sensitive activity;
- monitor conversion and product health.

## 3. Architecture Layers

### Client Layer

The frontend should keep the current demo's strong page semantics and shared shell, but production code should move toward componentized routes backed by API data.

Responsibilities:

- render public and authenticated product surfaces;
- maintain local UI state only;
- call backend APIs for all persisted operations;
- expose semantic controls for Agent page operation;
- never store secrets or authoritative permissions client-side.

### API Layer

Responsibilities:

- authenticate requests;
- authorize every object access and action;
- validate input;
- expose stable contracts for web, mobile, Agent, and internal tools;
- publish domain events after state changes.

Recommended pattern:

- REST for core CRUD and transactional actions;
- server-sent events or WebSocket later for live notifications;
- controlled analytics query endpoint for Agent and dashboards;
- background jobs for routing, reminders, source freshness, and exports.

### Domain Services

Suggested services:

- Identity and Account Service
- Catalog Service
- Student Profile Service
- Application Service
- School Portal Service
- Payment Service
- Notification Service
- Agent Action Service
- Analytics/Event Service
- Ops/Admin Service
- Audit Service

For an early production build, these can live in one modular monolith. The important boundary is domain ownership, not microservices.

### Data Layer

Primary store:

- relational database, preferably PostgreSQL, for transactional data and tenant isolation.

Supporting stores:

- object storage for future files and exports;
- search index for programs/universities/guides;
- vector index for Agent retrieval over public guides and verified catalog content;
- event warehouse for analytics.

## 4. Core Domain Flow

1. Visitor searches programs.
2. Visitor creates student account.
3. Student completes onboarding/profile.
4. Student saves programs/universities/scholarships.
5. Student adds concrete choices to an application set.
6. Student confirms non-document information.
7. System calculates distinct-school routing fee.
8. Student pays if required.
9. Application Service creates school-scoped records.
10. School Portal shows each school only its own records.
11. School staff contacts student directly.
12. Student Hub receives status updates.
13. CUAC Ops monitors routing, payment, and school activity.

## 5. Product Boundaries

CUAC should not claim to be the official application system for every school unless a specific integration exists.

CUAC should not collect student documents in the first production version unless the business explicitly expands into document management.

CUAC should not let a school see:

- other schools selected by the student;
- fees paid for other schools;
- private notes between student and CUAC;
- other school statuses;
- internal CUAC risk or fraud flags.

CUAC Ops may see cross-school application sets for support, but this must be permissioned and audited.

## 6. Agent Position

CUAC has two Agent layers:

- Admissions Agent: understands CUAC data, student goals, school/program fit, deadlines, fees, and safe next steps.
- Page Operation Agent: executes allowed UI operations such as filtering, saving, comparing, opening pages, and filling non-sensitive fields.

Alibaba PageAgent is a useful reference for the page-operation layer because it is an in-page JavaScript GUI agent that can operate DOM-based web interfaces with natural language. It should not become the admissions truth layer. CUAC domain services must remain authoritative for eligibility, fees, routing, and permissions.

Reference: https://github.com/alibaba/page-agent

## 7. System Quality Requirements

### Reliability

- application submission must be idempotent;
- payment callbacks must be idempotent;
- school record creation must be atomic after payment success or free submission;
- background routing retries must not duplicate school records.

### Security

- tenant isolation enforced in the database query layer and API layer;
- every Agent action goes through the same permission checks as manual actions;
- sensitive operations require explicit confirmation;
- audit logs are immutable from normal admin interfaces.

### Privacy

- collect minimum student data needed for school follow-up;
- mask sensitive fields where possible;
- support data deletion and retention policies;
- separate public catalog content from personal data.

### Observability

- trace request ID across API, event, payment, Agent action, and audit logs;
- dashboards for submission, routing, payment, notification, and Agent failure rates;
- alerts for school routing failures and tenant access anomalies.

## 8. MVP Boundary

Production MVP should include:

- student accounts;
- catalog search backed by database;
- application set and choices;
- non-document student profile fields;
- fee calculation and payment simulation or real payment provider;
- school-scoped application records;
- school staff login and queue;
- basic notifications;
- audit logs;
- analytics events;
- controlled Agent actions.

Do not include in MVP unless explicitly required:

- document upload;
- official school system integration;
- final admission decisions;
- visa/JW-form management;
- multi-currency settlement to schools;
- fully autonomous Agent submission without confirmation.

## 9. Open Decisions

- Payment provider and supported currencies.
- Whether schools can self-edit programs in MVP or only request CUAC Ops edits.
- Whether CUAC will add paid advisory services beyond routing.
- Whether student documents are a later product line.
- Whether PageAgentCore is embedded directly or CUAC builds a custom operation layer inspired by it.

