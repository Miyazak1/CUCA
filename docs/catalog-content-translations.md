# Catalog body translations

Catalog controls and catalog body fields have separate acceptance scopes. A
translated label does not establish that the English requirement, application
note, university tuition summary, or scholarship material underneath it was
translated.

The display layer reads local, versioned translation assets. It does not send
catalog or applicant data to a translation provider at runtime, change API
records, translate IDs/URLs, or alter filter and application values. Official
English names and source citations remain identified source references; each
translated page offers an English original link. Incomplete locales and asset
failures have distinct notices and retain usable source content.

## Local authoring

Start the owned local preview before taking a new snapshot. These commands read
only published catalog data, not private profiles or application materials:

```powershell
node scripts/catalog-translations-inventory.mjs --requirements
node scripts/catalog-school-translation-snapshot.mjs --origin=https://ucac.cn
node scripts/catalog-translations-inventory.mjs --cached
node scripts/catalog-translations-ui-inventory.mjs
node scripts/catalog-translations-batch.mjs
```

The inventory, public data snapshot, and per-language checkpoints live under
`.tmp/catalog-body-*` and `.tmp/catalog-translations/`. Batches save atomically.
The offline public translation connection uses the configured network proxy,
honors rate-limit responses with bounded backoff, and stops on a persistent
limit. Resume from the checkpoint after service availability returns. Rejected
row boundaries or source facts go to `needs-review.jsonl`; an incomplete or
rejected candidate is never made ready by the batch runner.

Review overrides in `src/content/catalog-translation-overrides.json`, then
validate a complete language:

```powershell
node scripts/catalog-translations-validate.mjs --locale=vi
node scripts/catalog-translations-validate.mjs --locale=vi --publish-local
npm run assets:update
npm run build
npm run preview:local
node scripts/local-catalog-content-acceptance.mjs
node scripts/local-school-body-acceptance.mjs
npm run quality:quick
```

`--publish-local` writes the local asset, its content hash/coverage manifest,
and the build allowlist. It does not deploy, import catalog data, or write a
database. Repeat for th/id/ms/ar only after each language passes. A new snapshot
changes the manifest source hash, so every enabled locale must be validated
against that snapshot again.

The school snapshot command reads all public pages from the selected known
origin and checks the published total against unique IDs. It writes translation
inputs only. The first local test database contained 100 schools; the deployed
public catalog contains 192. Local fixture totals must not stand in for deployed
coverage. The replay report records its exact source origin, date, and count.

Inventory includes Unicode letters, including Chinese-only fields, locations,
and current program titles from school deadlines. Official school-name source
references remain separate from translated body fields. Coverage validation
checks all inventoried source fields, unrestored authoring tokens, source
numbers/exam identifiers/URLs/currency symbols, unchanged long English prose,
and residual Chinese in non-Chinese translations.
These are machine reference translations with reviewed overrides; those checks
do not establish native-speaker review of every sentence. Admissions facts
remain traceable to their original source and require normal catalog review.

## Acceptance evidence

`output/feedback-20261112/catalog-content-completion.json` separates complete
Vietnamese body coverage from unfinished language candidates. The browser
report distinguishes 18 real page/viewports, 24 actual selector transitions,
two failure/pending fallbacks, and five fixture-based requirement-document
rendering checks. There were no approved requirement documents in the current
published snapshot, so fixture rendering is not recorded as an actual approved
admissions-document test.

`school-body-e2e.json` additionally replays every record from the published school
snapshot through the local built detail renderer at 320, 1280 and 1920 pixels.
It checks Chinese outside explicit source references, dictionary misses,
horizontal overflow, and one update panel in the actual DOM. Anhui University's
HSK4/220-point condition, currency and annual tuition unit, subjects and
deduplicated location have explicit assertions. A stitched long screenshot can
repeat sticky panels; repeated DOM nodes must be verified separately.

The registered AHU PDF's character-ID repair is display-only. Its exact source,
hash, printed row, and affected records are recorded in
`catalog-source-repair-evidence.json`; catalog records and source lineage are
unchanged. Production 301 and real iPhone Safari remain separate deferred
acceptance items. No deployment is authorized.
