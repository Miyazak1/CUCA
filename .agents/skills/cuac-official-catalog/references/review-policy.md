# Source review policy

Use a source only for the claims it directly supports. School identity may come from an education authority; program availability, tuition, deadlines, language rules, CSCA subjects, and scholarships should come from the university's current admissions page or its linked official attachment.

For each extracted CUAC field, record:

- exact official URL and snapshot SHA-256;
- page or attachment title and applicable intake/year;
- `capturedAt` timestamp from the acquisition manifest;
- a stable source path, heading, table name, row label, or PDF page reference;
- whether the value is explicit, derived, or unresolved.

Do not convert unresolved or inferred values into factual catalog fields. Keep them absent or `draft` and add a review note outside the import bundle. When two official pages disagree, prefer neither automatically: record the conflict and require editorial resolution.

Before preparing a v2 bundle, verify that no snapshot or extracted record contains applicant names, application numbers, passports, personal contact information, payment details, files, or account data. Publication review references and prohibited-data review references must identify completed human reviews; the agent must not fabricate or self-approve them.
