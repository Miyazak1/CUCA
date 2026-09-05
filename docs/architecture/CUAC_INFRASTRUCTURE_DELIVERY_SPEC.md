# CUAC Infrastructure Delivery Spec

Date: 2026-08-14

Status: production infrastructure and delivery design draft.

## 1. Purpose

This document defines the infrastructure, environments, testing, observability, and delivery practices needed for CUAC as a mature product.

## 2. Recommended System Shape

MVP can use a modular monolith:

- web frontend;
- API backend;
- background worker;
- PostgreSQL;
- object storage for exports/future files;
- Redis or queue service;
- search index;
- analytics warehouse or event sink.

Do not start with microservices unless operationally required.

## 3. Environments

### Local

- seed data;
- mocked payment provider;
- mocked email provider;
- local Agent provider option;
- test school tenants.

### Preview

- per-branch or per-release preview;
- seeded but non-production personal data;
- safe Agent mode;
- no real payment capture unless explicitly configured.

### Staging

- production-like config;
- test payment provider;
- email sandbox;
- realistic seed data;
- migration rehearsal.

### Production

- real auth;
- real payment provider;
- real email;
- production monitoring;
- backups;
- incident response.

## 4. Configuration

Use environment variables or secret manager for:

- database URL;
- auth secret;
- payment provider keys;
- email provider keys;
- Agent model provider keys;
- storage credentials;
- analytics sink;
- feature flags.

Never expose secrets in frontend bundles.

## 5. CI/CD Gates

Required checks:

- type check;
- lint;
- unit tests;
- API contract tests;
- authorization policy tests;
- tenant isolation tests;
- migration tests;
- build;
- accessibility smoke tests;
- static dependency/security scan;
- secret scan.

For frontend demo continuity:

- keep design-lab and public static files in sync until demo architecture changes;
- keep rendered static page tests.

## 6. Database Migration Policy

- Every schema change has a migration.
- Migrations run in staging before production.
- Backward-compatible migrations preferred.
- Destructive migrations require backup and explicit approval.
- Seed data is separate from production data.
- Catalog import jobs are idempotent.

## 7. Background Jobs

Required jobs:

- payment reconciliation;
- application routing retry;
- notification delivery;
- export generation;
- catalog source freshness;
- analytics aggregation;
- stale record detection;
- Agent action cleanup/redaction if configured.

Job requirements:

- idempotency;
- retry with backoff;
- dead letter queue;
- alert on repeated failure.

## 8. Observability

### Logs

Include:

- requestId;
- userId hashed or internal ID;
- role;
- tenantSchoolId if applicable;
- action;
- status;
- latency;
- error code.

Do not log:

- passwords;
- raw payment secrets;
- full personal data;
- full Agent prompts if privacy policy disallows.

### Metrics

Track:

- API latency and errors;
- login success/failure;
- application submission success/failure;
- payment success/failure;
- school routing success/failure;
- notification delivery;
- Agent action success/failure;
- export jobs;
- database health.

### Tracing

Trace across:

- frontend request;
- API;
- domain service;
- database;
- queue;
- payment provider callback;
- notification provider.

## 9. Backups And Recovery

Requirements:

- automated database backups;
- point-in-time recovery if available;
- backup restore drills;
- object storage lifecycle rules;
- export expiry;
- documented RPO/RTO.

Suggested MVP targets:

- RPO: 24 hours or better;
- RTO: 4 hours or better.

## 10. Feature Flags

Use flags for:

- real payments;
- Agent actions;
- school exports;
- school self-service catalog edits;
- notifications by channel;
- document upload if added later.

High-risk features should support instant disable.

## 11. Testing Strategy

### Unit Tests

- fee calculation;
- status transitions;
- role policies;
- data validation;
- Agent action schemas.

### Integration Tests

- application submit creates school records;
- payment webhook updates payment;
- school queue filters by tenant;
- notifications generated from events;
- export includes tenant rows only.

### End-To-End Tests

- student search to submit;
- one school free;
- multiple schools paid;
- school marks contacted;
- student Hub reflects update;
- Agent adds choice with confirmation.

### Security Tests

- direct ID tenant access denial;
- school export scope;
- Agent action permission denial;
- payment webhook signature;
- support access audit.

## 12. Accessibility And Internationalization

Requirements:

- semantic controls;
- keyboard navigation;
- focus states;
- readable error messages;
- alt text for meaningful images;
- screen-reader friendly status updates;
- locale-ready copy and date/currency formatting.

Initial language can be English, but architecture should allow Chinese and other student-market languages later.

## 13. Release Policy

Release checklist:

- migrations applied in staging;
- smoke tests pass;
- feature flags reviewed;
- rollback plan documented;
- monitoring dashboards ready;
- support team notified for major changes.

Do not release real payment or Agent action features without security and policy review.

