# CUAC Shanghai City Acquisition Status

Date: 2026-09-22
Status: school-evidence draft complete; municipal acquisition blocked by official-host HTTP 403

## Registered sources

- `shanghai-statistical-communique-2025`
- `shanghai-international-study-portal`
- `shanghai-student-residence-guide-2025`
- `shanghai-public-transport-fares-2026`
- `shanghai-development-plan-report-2025-2026`

All five entries pass the official-source registry rules: exact HTTPS URL, explicit allowed hostname, city-specific source role and `citySlug: shanghai`.

The collector received HTTP 403 for each source. CUAC did not change headers to impersonate a browser, use a login session, copy search-result content into the data pack, or publish unsupported values. This is a source-acquisition exception, not a manual-review blocker.

## Structured school-evidence draft

CUAC now has a generated Shanghai school-evidence draft backed by 95 acquired official university snapshots across the ten active Shanghai school records. The draft includes six locale variants and remains `unreviewed_draft` with `publicationAuthorized: false`.

## Existing usable school-scoped cost evidence

The already acquired Shanghai University application overview publishes:

- on-campus rooms at CNY 12,700, 25,000 or 51,000 per year depending on occupancy;
- an off-campus reference of CNY 30,000 per year;
- average living expenses of about CNY 35,000 per year.

These values remain scoped to Shanghai University and cannot be represented as a city-wide market price.

## Resolution rule

Continue municipal completion only with an exact collectable official mirror or an official downloadable artifact. Do not weaken the collector or substitute a third-party source. The existing school-evidence draft must not be promoted into city-wide statistics or a city-wide cost profile.
