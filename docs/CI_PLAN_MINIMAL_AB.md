# Minimal A + dated B candidate: bounded CI plan

This plan describes proposed review-branch verification, not an executed CI run or deployment authorization. The candidate remains local-preview 0.3.22. The deployment workflow `site.yml` is unchanged. The review workflow still has `contents: read` and no deployment job.

## Complete checkout versus unavailable local assets

A future authorized review run may check the complete existing remote tree. The 619 original assets absent from the local reconstruction remain unchanged remote Git pointers. CI is not a recovery channel: do not download original resource files from CI artifacts or logs, encode them into reports, or use a site/source artifact to refill the local gap. Local availability is not inferred from a remote validation result.

## Retained gates

All original c70 test commands and assertions remain: JavaScript syntax and model/raster regression, independent geometry and spatial inputs, desktop/mobile/scenario/storage/export/provenance/upgrade/full-offline tests, and regional browser checks. A adds reviewed N/P UI, original-source and historical-record checks. B adds the full unit suite, current frozen BUILD17/18 source checks, bilingual/browser recovery and explicit authorization-gated dated UI checks.

Root Node coverage is 279 cases: all original 217 names remain plus 62 new cases. Relative to the previous 288-case background candidate, 13 historical-context cases are excluded because that feature is not included, and four minimal integration/compatibility cases are added. One B service-worker case is renamed and strengthened 1-for-1 to cover all 18 runtime entries and `.mjs`. Two of the four new cases are specifically historical compatibility checks; the other two protect scientific byte identities and parent wiring. No coverage count represents native browser or scientific validation.

## Runner-local native downloads

Do not remove or weaken the original download tests. They still use actual browser downloads saved to runner disk, verify exact byte length and SHA-256, validate ZIP structure/CRC, exercise TIFF byte ranges and repeated/navigation/cancel flows, and perform cold offline recovery. The retained B pressure tests still generate and restore the full 729-combination audit and dated attachment cases. A large synthetic B archive may exceed 38 MB; it is a test input/output, not an artifact to upload.

After these assertions, reports retain filenames, byte counts, digests, CRC/assertion outcomes, bounded summaries, failures and actual UI screenshots. Original files and large synthetic archives remain runner-local.

## Artifact boundary

Every upload action uses a positive report/screenshot allowlist. Report names are `*-report.json`, `*-metrics.json`, `browser-errors.json`, the A `browser-checks.json`, and the B browser `results.json` / dated `report.json`. Screenshot families correspond to actual Playwright screenshot calls. No broad `path: test-results`, whole evidence-directory upload or `*.json` payload collection is retained.

Explicit exclusions further reject ZIP, TIFF, WebP, NPZ, data/site folders, tile/classification/imagery folders and raw overview/detail tile PNG names. Native original-resource payloads, copied map tiles, `_site/data`, source/site bundles, B input snapshots and large full archives must not be uploaded. Only actual UI screenshots may contain rendered map pixels; they are not original raster/tile delivery.

Existing artifact purposes and retention remain: general browser reports/UI, bounded A/B/date reports/UI, complete-offline report/UI and compact mainland report/UI. Narrowing artifact paths changes evidence transport only; all test execution and assertions remain unchanged.

## Current limits

Local root Node: 277 passed / 279, with two existing missing-PNG failures. B: 209/209. Spatial Python checks cannot run without the absent local shapely/rasterio dependencies. Browser, full production build, service-worker cold offline and remote CI are NOT_RUN. Authorization/target guard tests only show that browser scripts refuse unapproved starts; they do not verify browser behavior.
