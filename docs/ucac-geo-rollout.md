# UCAC GEO implementation status

Updated: 2026-10-09

## Completed technical foundation

- Server-rendered guide index at `/guides/`.
- Server-rendered guide detail routes at `/guides/{slug}`.
- Canonical metadata, Open Graph metadata, Article/CollectionPage structured data, sitemap, and robots rules.
- Permanent redirects from the legacy guide URLs.
- Primary Home, Hub, About, and shared navigation links migrated to clean guide routes.
- Empty and unavailable states that do not invent content when the catalog database is unavailable.
- Frontend contract coverage and successful production build.
- Native UCAC Insights at `/insights/`, with dated editorial analysis kept separate from evergreen Guides.
- Insight category archives, per-article official-source lists, Blog/BlogPosting structured data, RSS, and sitemap discovery.

## Insights editorial model

- Guides answer repeatable application questions; Insights explain current-cycle changes and patterns.
- The first Insights release covers admissions notices, English-taught program lists, and scholarship announcements without duplicating the four published Guides.
- Every factual article includes the university-owned sources checked for that article, a visible publication date, update date, category, author, and related evergreen Guide.
- The initial release is code-managed and version-controlled. Each record has an explicit draft or published status and positive version; public routes, RSS, sitemap, and search only read published records. A database-backed staff editor is intentionally deferred until its authoring roles, approval workflow, audit trail, and rollback contract are specified.

## Content approved, not yet deployed

The immutable first four English GEO article candidate is stored in `seeds/guides.geo-first-four.draft.json`. Product-owner approval is separately bound to its exact SHA-256 in `seeds/guides.geo-first-four.approval.json`. Keeping candidate and approval separate prevents later copy changes from inheriting an earlier approval.

Each article uses official university sources collected through the registered official-source workflow. The evidence manifest is intentionally stored under the ignored `work/catalog-official/` review area. No additional editorial approval is required for this exact candidate. Database publication must still:

1. Verify that the candidate SHA-256 still matches the approval artifact.
2. Use separate authenticated preparer and administrator identities required by the guide-governance schema.
3. Bind the database approval record to `product-owner-chat-approval-2026-10-09`.
4. Set an appropriate review-due date.
5. Publish through the governed version and publication records instead of editing the public projection directly.

## Deferred by design

- Analytics persistence: pages include stable `data-analytics-event` hooks, but no tracking request is sent because the project has no approved analytics provider, consent model, retention policy, or event endpoint yet.
- Additional languages: publish the reviewed English source first; translations must remain bound to the same section keys and pass the same source review.
- Large article volume: do not generate or publish unreviewed pages solely to increase URL count.

## Release and rollback

- Rehearse the exact approved pack locally with `npm run guides:geo:publish-local -- --confirm=publish-approved-geo-guides-to-cuac-local`.
- Deploy the application code before publishing any new guide version.
- Smoke-check `/guides/`, one published detail route, `/sitemap.xml`, and both legacy redirects.
- If the guide UI causes a runtime problem, roll back the application release; guide content remains separately governed in the database.
- If a factual issue is found after publication, withdraw the affected guide version through governance rather than deleting evidence or editing the projection directly.
