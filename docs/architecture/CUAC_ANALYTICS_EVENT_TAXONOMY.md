# CUAC Analytics Event Taxonomy

Date: 2026-08-14

Status: production analytics design draft.

## 1. Purpose

This document defines the event taxonomy and metric model for CUAC. It supports product analytics, school dashboards, CUAC Ops reporting, and natural-language Agent analysis.

Analytics must be useful without leaking cross-tenant or personal data.

## 2. Event Principles

- Use stable event names.
- Include actor role and surface.
- Avoid storing raw sensitive text in event properties.
- Keep student, school, application, and program IDs as IDs, not names where possible.
- Use tenant school ID when an event is school-scoped.
- Append events; do not update past events.
- Maintain a metric registry for dashboards and Agent analytics.

## 3. Common Event Properties

All events should include:

- eventId
- eventName
- occurredAt
- anonymousId nullable
- userId nullable
- role
- sessionId
- surface
- requestId nullable
- tenantSchoolId nullable
- applicationSetId nullable
- schoolApplicationId nullable
- programId nullable
- schoolId nullable
- properties

## 4. Public Discovery Events

| Event | When |
| --- | --- |
| public_home_viewed | visitor/student views home |
| natural_language_search_submitted | user submits goal |
| program_search_viewed | program page viewed |
| program_search_filter_applied | filter changes |
| program_search_sorted | sort changes |
| program_result_clicked | program opened |
| university_result_clicked | university opened |
| scholarship_result_clicked | scholarship opened |
| guide_opened | guide opened |

Important properties:

- queryLength
- filterKeys
- resultCount
- page
- sort
- sourceStatusFilter

## 5. Student Funnel Events

| Event | When |
| --- | --- |
| signup_started | auth flow begins |
| signup_completed | account created |
| onboarding_started | onboarding begins |
| onboarding_completed | onboarding complete |
| profile_updated | student profile saved |
| item_saved | user saves program/school/scholarship/city/guide |
| item_unsaved | save removed |
| compare_started | comparison begins |
| application_set_created | draft created |
| application_choice_added | choice added |
| application_choice_removed | choice removed |
| application_choice_order_changed | order changes |
| fee_preview_viewed | fee reviewed |
| payment_started | payment begins |
| payment_failed | payment fails |
| payment_completed | payment succeeds |
| application_submitted | set submitted |
| student_status_viewed | student checks application status |

## 6. School Portal Events

| Event | When |
| --- | --- |
| school_portal_viewed | school user opens workspace |
| school_queue_filtered | queue filters change |
| school_application_opened | detail opened |
| school_application_status_changed | status updated |
| school_application_assigned | owner assigned |
| school_contact_logged | contact logged |
| school_document_request_copied | request template copied |
| school_export_started | export requested |
| school_export_downloaded | export downloaded |
| school_analytics_viewed | analytics panel viewed |

Required tenant property:

- tenantSchoolId

Never include:

- other selected school IDs;
- raw private notes;
- full email or phone in analytics properties.

## 7. CUAC Ops Events

| Event | When |
| --- | --- |
| ops_dashboard_viewed | ops dashboard opened |
| catalog_record_created | catalog row created |
| catalog_record_updated | catalog row updated |
| catalog_record_verified | record verified |
| catalog_record_marked_stale | record stale |
| school_tenant_created | school tenant created |
| school_staff_invited | staff invited |
| routing_failure_detected | routing failed |
| routing_retry_started | retry started |
| payment_support_opened | payment support viewed |
| support_user_impersonation_started | support session begins |
| support_user_impersonation_ended | support session ends |

## 8. Agent Events

| Event | When |
| --- | --- |
| agent_conversation_started | Agent panel/conversation starts |
| agent_message_sent | user sends message |
| agent_response_generated | assistant responds |
| agent_action_proposed | action suggested |
| agent_action_confirmed | user confirms |
| agent_action_cancelled | user cancels |
| agent_action_executed | action succeeds |
| agent_action_failed | action fails |
| agent_permission_denied | policy blocks action |
| agent_safety_refusal | safety rule blocks request |

Properties:

- actionKey
- riskLevel
- confirmationRequired
- latencyMs
- modelProvider
- modelName
- tokenCountBucket
- failureCode

## 9. Metric Registry

### Student Metrics

- visitor_to_signup_rate
- signup_to_onboarding_complete_rate
- search_to_save_rate
- save_to_choice_rate
- choice_to_submit_rate
- payment_success_rate
- average_choices_per_application
- distinct_schools_per_application
- application_submit_completion_time

### Catalog Metrics

- verified_program_count
- stale_program_count
- programs_by_degree
- programs_by_language
- scholarship_available_program_count
- deadline_urgent_count
- source_freshness_age_days

### School Metrics

- school_new_records_count
- school_need_contact_count
- school_waiting_documents_count
- school_average_time_to_first_contact
- school_contact_rate_7d
- school_conversion_to_official_application_rate
- school_records_by_program
- school_records_by_country
- school_records_by_intake

### CUAC Business Metrics

- gross_routing_fee_revenue
- paid_school_count
- free_first_school_count
- payment_failure_rate
- routing_failure_rate
- active_school_tenants
- school_response_rate

### Agent Metrics

- agent_action_success_rate
- agent_action_confirmation_rate
- agent_deflection_rate
- agent_permission_denial_rate
- agent_latency_p95
- agent_repeated_failure_rate

## 10. Natural-Language Analytics

Agent analytics must use a governed semantic layer.

Allowed query types:

- count;
- trend;
- grouped breakdown;
- cohort conversion;
- status summary;
- top N list;
- anomaly explanation.

Disallowed:

- arbitrary SQL;
- raw personal data exports;
- cross-tenant school queries for school users;
- queries that reveal another school's records.

Example:

User: `Which programs had the most Malaysian applicants this month?`

School staff answer scope:

- only this school's programs.

CUAC Ops answer scope:

- platform-wide if role allows, with audit if personal data drilldown is used.

## 11. Data Retention

Suggested defaults:

- product events: 24 months aggregated, 13 months raw;
- audit logs: 7 years or legal requirement;
- Agent messages: configurable, default 12 months;
- exports: expire after 7 days;
- payment records: retained according to finance/legal requirements.

## 12. Dashboard Requirements

Student dashboards:

- application status;
- missing info;
- school follow-up.

School dashboards:

- queue health;
- country/program/intake breakdown;
- time to contact;
- conversion.

CUAC dashboards:

- funnel;
- revenue;
- data quality;
- school responsiveness;
- Agent performance;
- security/access anomalies.

